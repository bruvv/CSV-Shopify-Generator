
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
  // Example: "Default Category/Collectie/HEREN BRILLEN,Default Category/Collectie"
  // We want "Collectie, HEREN BRILLEN"
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


export const parseMagentoProductCsv = (csvString: string): ParseProductResult => {
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

  // Magento Header Indices
  const skuIdx = findHeaderIndex(['sku']);
  const nameIdx = findHeaderIndex(['name']);
  const descriptionIdx = findHeaderIndex(['description']);
  const shortDescriptionIdx = findHeaderIndex(['short_description']);
  const priceIdx = findHeaderIndex(['price']);
  const qtyIdx = findHeaderIndex(['qty']);
  const categoriesIdx = findHeaderIndex(['categories']);
  const baseImageIdx = findHeaderIndex(['base_image', 'image']); // 'image' as an alias
  const productTypeIdx = findHeaderIndex(['product_type', 'type_id']);
  const visibilityIdx = findHeaderIndex(['visibility']);
  const taxClassIdx = findHeaderIndex(['tax_class_name']);
  const weightIdx = findHeaderIndex(['weight']);
  const metaTitleIdx = findHeaderIndex(['meta_title']);
  const metaDescriptionIdx = findHeaderIndex(['meta_description']);
  const attributeSetCodeIdx = findHeaderIndex(['attribute_set_code']); // For Vendor
  const productOnlineIdx = findHeaderIndex(['product_online']); // For Published status

  if (skuIdx === -1 || nameIdx === -1) {
    return { type: 'parse_error', message: 'CSV must contain "sku" and "name" columns for product import.' };
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
      continue;
    }

    const sku = values[skuIdx];
    if (!sku) continue; // SKU is essential for a product

    const product: Partial<ShopifyProductFormData> = {
      id: crypto.randomUUID(),
      handle: sku, // Use SKU as handle for Shopify
      title: values[nameIdx],
      bodyHtml: descriptionIdx !== -1 ? values[descriptionIdx] : (shortDescriptionIdx !== -1 ? values[shortDescriptionIdx] : ''),
      variantSku: sku,
      variantPrice: priceIdx !== -1 ? parseFloat(values[priceIdx]) : 0,
      variantInventoryQty: qtyIdx !== -1 ? parseInt(values[qtyIdx], 10) : 0,
      imageSrc: baseImageIdx !== -1 ? values[baseImageIdx] : '',
      tags: categoriesIdx !== -1 ? extractTagsFromCategories(values[categoriesIdx]) : '',
      productType: attributeSetCodeIdx !== -1 ? values[attributeSetCodeIdx] : '', // Using attribute_set_code as Shopify Product Type
      vendor: attributeSetCodeIdx !== -1 ? values[attributeSetCodeIdx].split(' ')[0] : '', // First word of attribute_set_code as Vendor
      
      published: true, // Default to true
      variantTaxable: true, // Default to true
      variantWeight: weightIdx !== -1 ? parseFloat(values[weightIdx]) : 0,
      variantWeightUnit: 'g', // Assuming grams, Shopify's default if not specified otherwise
      magentoProductType: magentoProductType,
      isVariantRow: false, // Simple products are not variant rows in this context

      seoTitle: metaTitleIdx !== -1 ? values[metaTitleIdx] : '',
      seoDescription: metaDescriptionIdx !== -1 ? values[metaDescriptionIdx] : '',

      // Default Shopify values for simple products
      option1Name: '',
      option1Value: '',
    };
    
    if (visibilityIdx !== -1) {
        const magentoVisibility = values[visibilityIdx].toLowerCase();
        // Shopify 'published' is true if visible in "Catalog, Search" or if it's a simple product part of a visible configurable.
        // "Not Visible Individually" simple products are generally variants of a configurable.
        // For standalone simple products, if visibility is not "Catalog, Search", they might be considered not published.
        // Magento's product_online (1=Enabled, 2=Disabled) is also a factor.
        if (magentoVisibility === "not visible individually") {
             product.published = false; // Or based on product_online
        } else if (magentoVisibility.includes("catalog") && magentoVisibility.includes("search")) {
            product.published = true;
        }
    }
    if (productOnlineIdx !== -1 && values[productOnlineIdx] === '2') { // 2 means disabled in Magento
        product.published = false;
    }


    if (taxClassIdx !== -1) {
        product.variantTaxable = values[taxClassIdx].toLowerCase() === 'taxable goods';
    }

    products.push(product);
  }

  if (products.length > 0) {
    return { type: 'products_found', data: products, message: `${products.length} simple product(s) loaded. Review and edit if needed.` };
  } else {
    return { type: 'no_products_extracted', message: 'No simple products found or extracted. Check if "product_type" is "simple" and essential columns like "sku" and "name" are present.' };
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
  
  // Note: 'Product Category' is a newer Shopify field.
  // 'Type' is the traditional product type.

  const csvData = products.map(p => [
    p.handle,
    p.title,
    p.bodyHtml,
    p.vendor,
    '', // Product Category - Shopify's standardized taxonomy. Leave blank or map if available.
    p.productType, // Type
    p.tags,
    p.published ? 'TRUE' : 'FALSE', // Published
    p.option1Name,
    p.option1Value,
    p.option2Name,
    p.option2Value,
    p.option3Name,
    p.option3Value,
    p.variantSku,
    String(p.variantWeight), // Variant Grams
    '', // Variant Inventory Tracker (e.g., shopify) - can be left blank for Shopify to handle
    String(p.variantInventoryQty), // Variant Inventory Qty
    'deny', // Variant Inventory Policy (deny/continue)
    'manual', // Variant Fulfillment Service
    String(p.variantPrice), // Variant Price
    p.variantCompareAtPrice ? String(p.variantCompareAtPrice) : '', // Variant Compare At Price
    p.variantRequiresShipping ? 'TRUE' : 'FALSE', // Variant Requires Shipping
    p.variantTaxable ? 'TRUE' : 'FALSE', // Variant Taxable
    '', // Variant Barcode - typically unique
    p.imageSrc, // Image Src
    String(p.imagePosition), // Image Position
    p.imageAltText, // Image Alt Text
    'FALSE', // Gift Card
    p.seoTitle, // SEO Title
    p.seoDescription, // SEO Description
    '', '', '', '', '', '', '', '', '', '', '', '', '', // Google Shopping fields
    '', // Variant Image
    p.variantWeightUnit, // Variant Weight Unit
    '', // Variant Tax Code
    '', // Cost per item
    '', // Price / International
    '', // Compare At Price / International
    p.published ? 'active' : 'draft' // Status (active, archived, draft)
  ]);

  return arrayToCsv(shopifyHeaders, csvData);
};
