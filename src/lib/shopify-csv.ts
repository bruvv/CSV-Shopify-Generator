
import type { ProductFormData } from '@/schemas/product';

export type ParsedProductDataPayload = {
  data: Partial<ProductFormData>[];
  format: 'shopify' | 'magento' | 'unknown_product_format';
  message?: string;
}

export type ParseResult =
  | ({ type: 'products' } & ParsedProductDataPayload)
  | { type: 'customers'; message: string }
  | { type: 'unknown_csv'; message: string }
  | { type: 'empty'; message: string };


// Helper function to escape CSV fields
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

const generateHandle = (title: string | undefined): string => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, ''); 
};

export const generateShopifyCsv = (products: ProductFormData[]): string => {
  const headers = [
    'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
    'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
    'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
    'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping',
    'Variant Taxable', 'Variant Barcode', 'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card',
    'SEO Title', 'SEO Description',
    'Variant Image', 'Variant Weight Unit', 'Variant Tax Code', 'Cost per item', 'Status'
  ];

  const csvData = products.map(p => {
    const handle = generateHandle(p.title);
    return [
      handle, p.title, p.bodyHtml, p.vendor, p.productType, p.tags, p.published ? 'TRUE' : 'FALSE',
      p.title ? 'Title' : '', p.title ? 'Default Title' : '', '', '', '', '',
      p.sku, '', (p.inventoryQuantity !== undefined && p.inventoryQuantity !== null && p.inventoryQuantity > 0) ? 'shopify' : '', p.inventoryQuantity?.toString() || '0', 'deny',
      'manual', p.price?.toString() || '0', '', p.requiresShipping ? 'TRUE' : 'FALSE',
      p.taxable ? 'TRUE' : 'FALSE', '', p.imageSrc, p.imageSrc ? '1' : '', p.imageSrc && p.title ? p.title : '', 'FALSE',
      p.title, '', 
      p.imageSrc, '', '', '', p.status 
    ];
  });

  return arrayToCsv(headers, csvData);
};

// Utility to safely get a value from a CSV row by header index
const safeGet = (values: string[], index: number): string | undefined => {
  return index !== -1 && values[index] ? values[index] : undefined;
};

// Main product CSV parser - detects Shopify or Magento
export const parseProductCsv = (csvString: string): ParseResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'empty', message: 'The CSV file is empty.' };

  const lines = trimmedCsvString.split('\n');
  if (lines.length === 0) return { type: 'empty', message: 'The CSV file has no lines.' };
  
  const headerLine = lines.shift();
  if (!headerLine) return { type: 'empty', message: 'The CSV file has no header line.' };
  
  const rawHeaders = headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
  const headers = rawHeaders.map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  if (headers.length === 0) return { type: 'unknown_csv', message: 'Could not parse headers from the CSV file.' };

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.indexOf(alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  // Shopify specific header checks
  const shopifyTitleIdx = findHeaderIndex(['title']);
  const shopifyPriceIdx = findHeaderIndex(['variant price', 'price']); // Shopify often uses "Variant Price"
  const shopifySkuIdx = findHeaderIndex(['variant sku', 'sku']); // Shopify uses "Variant SKU"
  const shopifyHandleIdx = findHeaderIndex(['handle']);
  const shopifyBodyHtmlIdx = findHeaderIndex(['body (html)']);

  // Magento specific header checks
  const magentoSkuIdx = findHeaderIndex(['sku']); // Common for Magento
  const magentoNameIdx = findHeaderIndex(['name']); // Common for Magento
  const magentoPriceIdx = findHeaderIndex(['price']); // Common for Magento
  const magentoQtyIdx = findHeaderIndex(['qty', 'quantity']);
  const magentoTypeIdIdx = findHeaderIndex(['type_id', 'product_type']); // Magento type
  const magentoCategoriesIdx = findHeaderIndex(['categories']);
  const magentoStatusIdx = findHeaderIndex(['status', 'product_online', 'is_saleable']); // M2 status, M1 product_online/is_saleable
  const magentoVisibilityIdx = findHeaderIndex(['visibility']);

  const isLikelyShopify = (shopifyTitleIdx !== -1 && shopifyPriceIdx !== -1 && shopifySkuIdx !== -1) || shopifyHandleIdx !== -1 || shopifyBodyHtmlIdx !== -1;
  const isLikelyMagento = magentoSkuIdx !== -1 && magentoNameIdx !== -1 && (magentoPriceIdx !== -1 || magentoQtyIdx !== -1 || magentoTypeIdIdx !== -1);
  
  // Customer CSV detection (can be kept simple as before)
  const emailIdx = findHeaderIndex(['email']);
  const firstNameIdx = findHeaderIndex(['first name']);
  if (emailIdx !== -1 && firstNameIdx !== -1 && !isLikelyShopify && !isLikelyMagento) {
    return { type: 'customers', message: 'This appears to be a customer CSV. This tool is designed for product CSVs. No data was imported.' };
  }

  const products: Partial<ProductFormData>[] = [];
  let format: ParsedProductDataPayload['format'] = 'unknown_product_format';
  let parseMessage: string | undefined;

  if (isLikelyMagento) {
    format = 'magento';
    // Magento specific parsing logic
    const descIdx = findHeaderIndex(['description']);
    const imageIdx = findHeaderIndex(['image', 'base_image']);
    const vendorIdx = findHeaderIndex(['vendor', 'manufacturer']);

    for (const line of lines) {
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      if (values.length === 0 || values.every(v => v === '')) continue;

      const product: Partial<ProductFormData> = { id: crypto.randomUUID() };
      
      product.sku = safeGet(values, magentoSkuIdx);
      product.title = safeGet(values, magentoNameIdx);
      product.bodyHtml = safeGet(values, descIdx);
      const priceStr = safeGet(values, magentoPriceIdx);
      if (priceStr) product.price = parseFloat(priceStr);
      const qtyStr = safeGet(values, magentoQtyIdx);
      if (qtyStr) product.inventoryQuantity = parseInt(qtyStr, 10);
      product.imageSrc = safeGet(values, imageIdx);
      product.tags = safeGet(values, magentoCategoriesIdx);
      
      const magentoType = safeGet(values, magentoTypeIdIdx);
      if (magentoType) product.productType = `Magento Type: ${magentoType}`;
      
      product.vendor = safeGet(values, vendorIdx);

      const statusVal = safeGet(values, magentoStatusIdx)?.toLowerCase();
      if (statusVal === '1' || statusVal === 'enabled' || statusVal === 'true') {
        product.published = true;
        product.status = 'active';
      } else if (statusVal === '0' || statusVal === '2' /* M1 specific for product_online */ || statusVal === 'disabled' || statusVal === 'false') {
        product.published = false;
        product.status = 'draft';
      } else {
         product.published = true; // Default
         product.status = 'active'; // Default
      }
      
      const visibilityVal = safeGet(values, magentoVisibilityIdx);
      if (visibilityVal === '1' || visibilityVal?.toLowerCase() === 'not visible individually') { // Magento 1 or 2
         product.published = false; // Simplification
      }

      if (product.title || product.sku) {
        products.push(product);
      }
    }
    if (products.length === 0 && lines.length > 0) {
      parseMessage = "Magento CSV detected, but no products could be parsed. Check column names like 'sku', 'name', 'price'.";
    }

  } else if (isLikelyShopify) {
    format = 'shopify';
    // Shopify specific parsing logic (adapted from original)
    const bodyHtmlIdx = findHeaderIndex(['body (html)', 'description']);
    const vendorIdx = findHeaderIndex(['vendor']);
    const productTypeIdx = findHeaderIndex(['type', 'product type']);
    const tagsIdx = findHeaderIndex(['tags']);
    const publishedIdx = findHeaderIndex(['published']);
    const imageSrcIdx = findHeaderIndex(['image src', 'image url']);
    const inventoryQtyIdx = findHeaderIndex(['variant inventory qty', 'inventory quantity', 'quantity']);
    const requiresShippingIdx = findHeaderIndex(['variant requires shipping', 'requires shipping']);
    const taxableIdx = findHeaderIndex(['variant taxable', 'taxable']);
    const statusIdx = findHeaderIndex(['status']);

    for (const line of lines) {
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      if (values.length === 0 || values.every(v => v === '')) continue;

      const product: Partial<ProductFormData> = { id: crypto.randomUUID() };

      if (shopifyTitleIdx !== -1 && values[shopifyTitleIdx]) product.title = values[shopifyTitleIdx];
      if (bodyHtmlIdx !== -1) product.bodyHtml = values[bodyHtmlIdx];
      if (vendorIdx !== -1) product.vendor = values[vendorIdx];
      if (productTypeIdx !== -1) product.productType = values[productTypeIdx];
      if (tagsIdx !== -1) product.tags = values[tagsIdx];
      if (publishedIdx !== -1) product.published = values[publishedIdx]?.toLowerCase() === 'true';
      if (shopifyPriceIdx !== -1 && values[shopifyPriceIdx]) product.price = parseFloat(values[shopifyPriceIdx]);
      if (shopifySkuIdx !== -1) product.sku = values[shopifySkuIdx];
      if (imageSrcIdx !== -1) product.imageSrc = values[imageSrcIdx];
      if (inventoryQtyIdx !== -1 && values[inventoryQtyIdx]) product.inventoryQuantity = parseInt(values[inventoryQtyIdx], 10);
      if (requiresShippingIdx !== -1) product.requiresShipping = values[requiresShippingIdx]?.toLowerCase() === 'true';
      if (taxableIdx !== -1) product.taxable = values[taxableIdx]?.toLowerCase() === 'true';
      if (statusIdx !== -1 && ['active', 'draft', 'archived'].includes(values[statusIdx]?.toLowerCase())) {
        product.status = values[statusIdx].toLowerCase() as 'active' | 'draft' | 'archived';
      } else {
        product.status = 'active'; 
      }
      
      if (product.title || product.sku || (shopifyHandleIdx !== -1 && values[shopifyHandleIdx])) {
        products.push(product);
      }
    }
     if (products.length === 0 && lines.length > 0) {
      parseMessage = "Shopify CSV detected, but no products could be parsed. Check column names like 'Title', 'Variant Price', 'Variant SKU'.";
    }
  }

  if (products.length > 0) {
    return { type: 'products', data: products, format: format, message: parseMessage };
  }
  
  if (lines.length === 0 && (isLikelyShopify || isLikelyMagento)) {
      return { type: 'products', data: [], format: isLikelyMagento ? 'magento' : (isLikelyShopify ? 'shopify' : 'unknown_product_format'), message: 'CSV file contains only headers. No product data found.' };
  }

  return { type: 'unknown_csv', message: parseMessage || 'The CSV format is not recognized as a Shopify or Magento product CSV.' };
};
