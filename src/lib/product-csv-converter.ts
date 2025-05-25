
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
  console.log('[buildFullImageUrl] INPUT - imagePath:', imagePath, 'baseUrl:', baseUrl);

  if (!imagePath || imagePath.trim() === '') {
    console.log('[buildFullImageUrl] Condition 1: imagePath is empty or undefined. Returning empty string.');
    return '';
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    console.log('[buildFullImageUrl] Condition 2: imagePath is already absolute. Returning original imagePath:', imagePath);
    return imagePath;
  }

  // At this point, imagePath is relative and not empty.
  // Now we check baseUrl.
  if (!baseUrl || baseUrl.trim() === '') {
    console.warn(`[buildFullImageUrl] Condition 3: baseUrl is not provided or is empty. imagePath: "${imagePath}". Returning original relative imagePath as fallback.`);
    return imagePath; // This returns the relative path if no base URL.
  }

  // If we reach here, imagePath is relative, not empty, AND baseUrl is provided and not empty.
  console.log('[buildFullImageUrl] Proceeding to construct full URL with provided baseUrl.');
  const trimmedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  const finalUrl = `${trimmedBaseUrl}/${trimmedImagePath}`;
  console.log(`[buildFullImageUrl] CONSTRUCTED URL: "${finalUrl}" (from baseUrl: "${trimmedBaseUrl}" and imagePath: "${trimmedImagePath}")`);
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

  const skuIdx = findHeaderIndex(['sku']);
  const nameIdx = findHeaderIndex(['name']);
  const descriptionIdx = findHeaderIndex(['description']);
  const shortDescriptionIdx = findHeaderIndex(['short_description']);
  const priceIdx = findHeaderIndex(['price']);
  const qtyIdx = findHeaderIndex(['qty']);
  const categoriesIdx = findHeaderIndex(['categories']);
  const baseImageIdx = findHeaderIndex(['base_image', 'image']);
  const productTypeIdx = findHeaderIndex(['product_type', 'type_id']);
  const visibilityIdx = findHeaderIndex(['visibility']);
  const taxClassIdx = findHeaderIndex(['tax_class_name', 'tax_class_id']);
  const weightIdx = findHeaderIndex(['weight']);
  const metaTitleIdx = findHeaderIndex(['meta_title']);
  const metaDescriptionIdx = findHeaderIndex(['meta_description']);
  const attributeSetCodeIdx = findHeaderIndex(['attribute_set_code']);
  const productOnlineIdx = findHeaderIndex(['product_online', 'status']);

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
      productType: attributeSetCodeIdx !== -1 ? values[attributeSetCodeIdx] : '', 
      vendor: attributeSetCodeIdx !== -1 ? values[attributeSetCodeIdx].split(' ')[0] : '',
      
      published: true, 
      variantTaxable: true, 
      variantWeight: weightIdx !== -1 ? parseFloat(values[weightIdx]) : 0,
      variantWeightUnit: 'g', 
      magentoProductType: magentoProductType,
      isVariantRow: false,

      seoTitle: metaTitleIdx !== -1 ? values[metaTitleIdx] : (nameIdx !== -1 ? values[nameIdx] : sku),
      seoDescription: metaDescriptionIdx !== -1 ? values[metaDescriptionIdx] : (shortDescriptionIdx !== -1 ? values[shortDescriptionIdx] : ''), 
      
      option1Name: productTypeIdx !== -1 && values[productTypeIdx] === 'simple' ? 'Title' : '',
      option1Value: productTypeIdx !== -1 && values[productTypeIdx] === 'simple' ? 'Default Title' : '',
      variantRequiresShipping: true,
      imagePosition: 1,
    };
    
    if (visibilityIdx !== -1) {
        const magentoVisibility = values[visibilityIdx].toLowerCase();
        if (magentoVisibility === "not visible individually" || magentoVisibility === "1") {
             product.published = false; 
        } else if (magentoVisibility.includes("catalog") || magentoVisibility.includes("search") || magentoVisibility === "4" || magentoVisibility === "2" || magentoVisibility === "3") {
            product.published = true;
        }
    }

    if (productOnlineIdx !== -1 && (values[productOnlineIdx] === '2' || values[productOnlineIdx].toLowerCase() === 'disabled')) { 
        product.published = false;
    }

    if (taxClassIdx !== -1) {
        const taxValue = values[taxClassIdx].toLowerCase();
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
    '', 
    p.productType, 
    p.tags,
    p.published ? 'TRUE' : 'FALSE', 
    p.option1Name || (p.magentoProductType === 'simple' && !p.isVariantRow ? 'Title' : ''),
    p.option1Value || (p.magentoProductType === 'simple' && !p.isVariantRow ? 'Default Title' : ''),
    p.option2Name,
    p.option2Value,
    p.option3Name,
    p.option3Value,
    p.variantSku,
    String(p.variantWeight ?? 0), 
    p.variantInventoryQty && p.variantInventoryQty > 0 ? 'shopify' : '', 
    String(p.variantInventoryQty ?? 0), 
    'deny', 
    'manual', 
    String(p.variantPrice ?? 0), 
    p.variantCompareAtPrice ? String(p.variantCompareAtPrice) : '', 
    p.variantRequiresShipping ? 'TRUE' : 'FALSE', 
    p.variantTaxable ? 'TRUE' : 'FALSE', 
    '', 
    p.imageSrc, 
    String(p.imagePosition ?? 1), 
    p.imageAltText || p.title, 
    'FALSE', 
    p.seoTitle || p.title, 
    p.seoDescription, 
    '', '', '', '', '', '', '', '', '', '', '', '', '', 
    p.imageSrc, 
    p.variantWeightUnit || 'g', 
    '', 
    '', 
    '', 
    '', 
    p.published ? 'active' : 'draft' 
  ]);

  return arrayToCsv(shopifyHeaders, csvData);
};

