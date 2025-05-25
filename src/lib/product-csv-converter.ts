
import type { ShopifyProductFormData } from '@/schemas/product';

export type ParseProductResult =
  | { type: 'products_found'; data: Partial<ShopifyProductFormData>[]; message: string }
  | { type: 'no_products_extracted'; message: string }
  | { type: 'parse_error'; message: string };


const escapeCsvField = (field: string | number | boolean | undefined | null): string => {
  if (field === undefined || field === null) {
    return '';
  }
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

const arrayToCsv = (headers: string[], data: (string | number | boolean | undefined | null)[][]): string => {
  const headerRow = headers.map(escapeCsvField).join(',');
  const dataRows = data.map(row =>
    row.map(escapeCsvField).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
};

const parseCsvLine = (line: string, delimiter: ',' | ';'): string[] => {
  const result: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        currentValue += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(currentValue);
      currentValue = ""; 
    } else {
      currentValue += char;
    }
  }
  result.push(currentValue); 
  return result.map(field => field.trim());
};

const detectDelimiter = (line: string): ',' | ';' => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

const extractTagsFromCategories = (categoriesString: string | undefined): string => {
  if (!categoriesString) return '';
  const allPaths = categoriesString.split(',');
  const tags = new Set<string>();
  allPaths.forEach(path => {
    path.split('/')
      .map(part => part.trim())
      .filter(part => part.toLowerCase() !== 'default category' && part !== '')
      .forEach(tag => tags.add(tag));
  });
  return Array.from(tags).join(', ');
};

const buildFullImageUrl = (imagePath: string | undefined, baseUrl: string | undefined): string => {
  if (!imagePath || imagePath.trim() === '') {
    // console.log("Image path is empty or undefined.");
    return '';
  }

  // If imagePath is already a full URL, return it directly
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // console.log(`Image path "${imagePath}" is already absolute. Using it directly.`);
    return imagePath;
  }

  // If no baseUrl is provided, we can't construct a full URL for a relative path
  if (!baseUrl || baseUrl.trim() === '') {
    console.warn(`No base URL provided for relative image path: "${imagePath}". Returning path as is. This might not work for Shopify import.`);
    return imagePath;
  }

  // At this point, we have a relative imagePath and a baseUrl.
  // Combine baseUrl and imagePath
  const trimmedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  const finalUrl = `${trimmedBaseUrl}/${trimmedImagePath}`;
  // console.log(`Constructed image URL: "${finalUrl}" from base "${baseUrl}" and path "${imagePath}"`);
  return finalUrl;
};


export const parseMagentoProductCsv = (csvString: string, magentoBaseImageUrl?: string): ParseProductResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.' };

  const allLines = trimmedCsvString.split(/\r?\n/);
  if (allLines.length < 2) return { type: 'parse_error', message: 'The CSV file must contain a header row and at least one data row.' };

  const headerLine = allLines[0];
  const dataLines = allLines.slice(1);
  const delimiter = detectDelimiter(headerLine);
  
  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const headers = rawHeaders.map((h, idx) => {
    let cleanH = h.toLowerCase().trim();
    if (idx === 0) cleanH = cleanH.replace(/^\ufeff/, ''); 
    if (cleanH.startsWith('"') && cleanH.endsWith('"')) {
        cleanH = cleanH.substring(1, cleanH.length - 1);
    }
    return cleanH;
  });

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.indexOf(alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  // Core Magento fields
  const skuIdx = findHeaderIndex(['sku']);
  const nameIdx = findHeaderIndex(['name']);
  const descriptionIdx = findHeaderIndex(['description']);
  const shortDescriptionIdx = findHeaderIndex(['short_description']);
  const priceIdx = findHeaderIndex(['price']);
  const qtyIdx = findHeaderIndex(['qty']);
  const categoriesIdx = findHeaderIndex(['categories']);
  const baseImageIdx = findHeaderIndex(['base_image', 'image']);
  const productTypeIdx = findHeaderIndex(['product_type', 'type_id']);
  const visibilityIdx = findHeaderIndex(['visibility']); // e.g., "Catalog, Search", "Not Visible Individually"
  const taxClassIdx = findHeaderIndex(['tax_class_name', 'tax_class_id']); // e.g., "Taxable Goods"
  const weightIdx = findHeaderIndex(['weight']);
  const metaTitleIdx = findHeaderIndex(['meta_title']);
  const metaDescriptionIdx = findHeaderIndex(['meta_description']);
  const attributeSetCodeIdx = findHeaderIndex(['attribute_set_code']); // Can be used for Vendor or Product Type
  const productOnlineIdx = findHeaderIndex(['product_online', 'status']); // Magento status: 1 (Enabled), 2 (Disabled)

  if (skuIdx === -1 ) { 
    return { type: 'parse_error', message: 'CSV must contain "sku" column for product import.' };
  }

  const products: Partial<ShopifyProductFormData>[] = [];

  for (const line of dataLines) {
    if (line.trim() === '') continue;
    const values = parseCsvLine(line, delimiter);

    if (values.length !== headers.length) {
        console.warn(`Product CSV: Column count mismatch. Expected ${headers.length}, got ${values.length}. Line: "${line}"`);
        continue; 
    }
    
    const magentoProductType = productTypeIdx !== -1 ? values[productTypeIdx] : 'simple';
    if (magentoProductType !== 'simple') {
      // For now, only process simple products. Configurable products will be handled later.
      // TODO: Add configurable product handling
      continue;
    }

    const sku = values[skuIdx];
    if (!sku) continue; 

    const product: Partial<ShopifyProductFormData> = {
      id: crypto.randomUUID(),
      handle: sku, 
      title: nameIdx !== -1 ? values[nameIdx] : sku,
      bodyHtml: descriptionIdx !== -1 ? values[descriptionIdx] : (shortDescriptionIdx !== -1 ? values[shortDescriptionIdx] : ''),
      variantSku: sku,
      variantPrice: priceIdx !== -1 ? parseFloat(values[priceIdx]) : 0,
      variantInventoryQty: qtyIdx !== -1 ? parseInt(values[qtyIdx], 10) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? values[baseImageIdx] : undefined, magentoBaseImageUrl),
      tags: categoriesIdx !== -1 ? extractTagsFromCategories(values[categoriesIdx]) : '',
      // Attempt to derive productType and vendor from attribute_set_code
      productType: attributeSetCodeIdx !== -1 ? values[attributeSetCodeIdx] : '', 
      vendor: attributeSetCodeIdx !== -1 ? values[attributeSetCodeIdx].split(' ')[0] : '', // Taking first word as vendor
      
      published: true, // Default to true, adjust based on visibility/status
      variantTaxable: true, // Default to true, adjust based on tax_class
      variantWeight: weightIdx !== -1 ? parseFloat(values[weightIdx]) : 0,
      variantWeightUnit: 'g', // Shopify default is g, Magento weight is often in store's base unit. Assume grams for now.
      magentoProductType: magentoProductType,
      isVariantRow: false, // For simple products, this is always the main row.

      seoTitle: metaTitleIdx !== -1 ? values[metaTitleIdx] : (nameIdx !== -1 ? values[nameIdx] : sku), // Fallback to name/sku for SEO title
      seoDescription: metaDescriptionIdx !== -1 ? values[metaDescriptionIdx] : (shortDescriptionIdx !== -1 ? values[shortDescriptionIdx] : ''), // Fallback for SEO desc
      
      // Shopify defaults for simple products
      option1Name: 'Title', 
      option1Value: 'Default Title', 
      variantRequiresShipping: true,
      imagePosition: 1,
    };
    
    // Handle Magento visibility
    // Common values: "Not Visible Individually", "Catalog", "Search", "Catalog, Search"
    // Magento numeric visibility: 1 (Not Visible), 2 (Catalog), 3 (Search), 4 (Catalog, Search)
    if (visibilityIdx !== -1) {
        const magentoVisibility = values[visibilityIdx].toLowerCase();
        if (magentoVisibility === "not visible individually" || magentoVisibility === "1") {
             product.published = false; 
        } else if (magentoVisibility.includes("catalog") || magentoVisibility.includes("search") || magentoVisibility === "4" || magentoVisibility === "2" || magentoVisibility === "3") {
            product.published = true; // If it's visible in catalog or search, it's published
        }
    }

    // Magento 'status' (product_online): 1 = Enabled, 2 = Disabled
    // If product_online is 2 (Disabled), then it's not published, overriding visibility.
    if (productOnlineIdx !== -1 && (values[productOnlineIdx] === '2' || values[productOnlineIdx].toLowerCase() === 'disabled')) { 
        product.published = false;
    }

    // Handle tax_class_name
    if (taxClassIdx !== -1) {
        const taxValue = values[taxClassIdx].toLowerCase();
        // Common Magento tax class names/IDs that imply taxable.
        // Shopify 'Taxable' is true if it's not tax-exempt.
        product.variantTaxable = !(taxValue.includes('none') || taxValue.includes('exempt') || taxValue === '0');
    }

    products.push(product);
  }

  if (products.length > 0) {
    return { type: 'products_found', data: products, message: `${products.length} simple product(s) loaded. Review and edit if needed.` };
  } else {
    return { type: 'no_products_extracted', message: 'No simple products found or extracted. Check if "product_type" is "simple" and essential columns like "sku" are present.' };
  }
};


export const generateShopifyProductCsv = (products: ShopifyProductFormData[]): string => {
  const shopifyHeaders = [
    'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
    'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
    'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy', 
    'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 
    'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode',
    'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card', 'SEO Title', 'SEO Description',
    'Google Shopping / Google Product Category', 'Google Shopping / Gender', 'Google Shopping / Age Group',
    'Google Shopping / MPN', 'Google Shopping / AdWords Grouping', 'Google Shopping / AdWords Labels',
    'Google Shopping / Condition', 'Google Shopping / Custom Product', 'Google Shopping / Custom Label 0',
    'Google Shopping / Custom Label 1', 'Google Shopping / Custom Label 2', 'Google Shopping / Custom Label 3',
    'Google Shopping / Custom Label 4',
    'Variant Image', 'Variant Weight Unit', 'Variant Tax Code', 'Cost per item', 
    'Price / International', 'Compare At Price / International', 'Status'
  ];
  
  const csvData = products.map(p => [
    p.handle,
    p.title,
    p.bodyHtml,
    p.vendor,
    '', // Product Category - Shopify recommends using their predefined categories. Mapping this is complex.
    p.productType, 
    p.tags,
    p.published ? 'TRUE' : 'FALSE', 
    p.option1Name, // For simple products, usually "Title"
    p.option1Value, // For simple products, usually "Default Title"
    p.option2Name,
    p.option2Value,
    p.option3Name,
    p.option3Value,
    p.variantSku,
    String(p.variantWeight ?? 0), // Shopify expects grams
    p.variantInventoryQty && p.variantInventoryQty > 0 ? 'shopify' : '', // Variant Inventory Tracker 
    String(p.variantInventoryQty ?? 0), 
    'deny', // Variant Inventory Policy (deny or continue)
    'manual', // Variant Fulfillment Service
    String(p.variantPrice ?? 0), 
    p.variantCompareAtPrice ? String(p.variantCompareAtPrice) : '', 
    p.variantRequiresShipping ? 'TRUE' : 'FALSE', 
    p.variantTaxable ? 'TRUE' : 'FALSE', 
    '', // Variant Barcode
    p.imageSrc, 
    String(p.imagePosition ?? 1), 
    p.imageAltText || p.title, // Use title as fallback for alt text
    'FALSE', // Gift Card
    p.seoTitle || p.title, // Use title as fallback for SEO title
    p.seoDescription, 
    '', '', '', '', '', '', '', '', '', '', '', '', '', // Google Shopping fields
    p.imageSrc, // Variant Image (often same as main image for simple products/first variant)
    p.variantWeightUnit || 'g', 
    '', // Variant Tax Code
    '', // Cost per item
    '', // Price / International
    '', // Compare At Price / International
    p.published ? 'active' : 'draft' // Status: active, archived, draft
  ]);

  return arrayToCsv(shopifyHeaders, csvData);
};

