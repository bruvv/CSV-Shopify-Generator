
import type { ProductFormData } from '@/schemas/product';

export type ParseResult =
  | { type: 'products'; data: Partial<ProductFormData>[] }
  | { type: 'customers'; message: string }
  | { type: 'unknown'; message: string }
  | { type: 'empty'; message: string };


// Helper function to escape CSV fields
const escapeCsvField = (field: string | number | boolean | undefined | null): string => {
  if (field === undefined || field === null) {
    return '';
  }
  const stringField = String(field);
  // Replace " with "" and wrap in quotes if it contains a comma, newline, or double quote
  if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

// Helper function to convert data to CSV string
const arrayToCsv = (headers: string[], data: (string | number | boolean | undefined | null)[][]): string => {
  const headerRow = headers.map(escapeCsvField).join(',');
  const dataRows = data.map(row =>
    row.map(escapeCsvField).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
};

// Function to generate handle
const generateHandle = (title: string | undefined): string => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^\w-]+/g, ''); // remove non-alphanumeric characters except hyphens
};

// Main CSV generation function
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
      handle, // Handle
      p.title, // Title
      p.bodyHtml, // Body (HTML)
      p.vendor, // Vendor
      p.productType, // Type (Product Type)
      p.tags, // Tags
      p.published ? 'TRUE' : 'FALSE', // Published
      p.title ? 'Title' : '', // Option1 Name (Shopify default for simple products)
      p.title ? 'Default Title' : '', // Option1 Value
      '', // Option2 Name
      '', // Option2 Value
      '', // Option3 Name
      '', // Option3 Value
      p.sku, // Variant SKU
      '', // Variant Grams (not collected)
      (p.inventoryQuantity !== undefined && p.inventoryQuantity !== null && p.inventoryQuantity > 0) ? 'shopify' : '', // Variant Inventory Tracker
      p.inventoryQuantity?.toString() || '0', // Variant Inventory Qty
      'deny', // Variant Inventory Policy
      'manual', // Variant Fulfillment Service
      p.price?.toString() || '0', // Variant Price
      '', // Variant Compare At Price (not collected)
      p.requiresShipping ? 'TRUE' : 'FALSE', // Variant Requires Shipping
      p.taxable ? 'TRUE' : 'FALSE', // Variant Taxable
      '', // Variant Barcode (not collected)
      p.imageSrc, // Image Src
      p.imageSrc ? '1' : '', // Image Position
      p.imageSrc && p.title ? p.title : '', // Image Alt Text (use title as default)
      'FALSE', // Gift Card
      p.title, // SEO Title (default to product title)
      '', // SEO Description (not collected, Shopify can auto-generate from Body (HTML))
      p.imageSrc, // Variant Image (can be same as Image Src for simple product)
      '', // Variant Weight Unit (not collected, e.g. 'kg')
      '', // Variant Tax Code (not collected)
      '', // Cost per item (not collected)
      p.status // Status
    ];
  });

  return arrayToCsv(headers, csvData);
};


// Shopify CSV parser
export const parseShopifyCsv = (csvString: string): ParseResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) {
    return { type: 'empty', message: 'The CSV file is empty.' };
  }

  const lines = trimmedCsvString.split('\n');
  if (lines.length === 0) {
     return { type: 'empty', message: 'The CSV file has no lines.' };
  }
  
  const headerLine = lines.shift();
  if (!headerLine) {
    return { type: 'empty', message: 'The CSV file has no header line.' };
  }
  
  // Basic CSV parsing for headers - handles quotes
  const headers = headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(h => h.replace(/^"|"$/g, '').trim().toLowerCase()) || [];

  if (headers.length === 0) {
    return { type: 'unknown', message: 'Could not parse headers from the CSV file.' };
  }

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.findIndex(h => h === alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  // Product specific headers
  const titleIdx = findHeaderIndex(['title']);
  const priceIdx = findHeaderIndex(['variant price', 'price']);
  const skuIdx = findHeaderIndex(['variant sku', 'sku']);
  const handleIdx = findHeaderIndex(['handle']);

  // Customer specific headers
  const emailIdx = findHeaderIndex(['email']);
  const firstNameIdx = findHeaderIndex(['first name']);
  const lastNameIdx = findHeaderIndex(['last name']);
  const acceptsMarketingIdx = findHeaderIndex(['accepts marketing']);


  const isLikelyProductCSV = titleIdx !== -1 || priceIdx !== -1 || skuIdx !== -1 || handleIdx !== -1;
  const isLikelyCustomerCSV = emailIdx !== -1 && (firstNameIdx !== -1 || lastNameIdx !== -1 || acceptsMarketingIdx !== -1);

  if (isLikelyProductCSV) {
    const products: Partial<ProductFormData>[] = [];
    // Define common product header aliases (already done for detection, re-use for parsing)
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

    if (lines.length === 0) { // Only header was present
        return { type: 'products', data: [] }; // Will be handled as "no valid product entries"
    }

    for (const line of lines) {
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      if (values.length === 0 || values.every(v => v === '')) continue; // Skip empty or effectively empty lines

      const product: Partial<ProductFormData> = { id: crypto.randomUUID() };

      if (titleIdx !== -1 && values[titleIdx]) product.title = values[titleIdx];
      if (bodyHtmlIdx !== -1) product.bodyHtml = values[bodyHtmlIdx];
      if (vendorIdx !== -1) product.vendor = values[vendorIdx];
      if (productTypeIdx !== -1) product.productType = values[productTypeIdx];
      if (tagsIdx !== -1) product.tags = values[tagsIdx];
      if (publishedIdx !== -1) product.published = values[publishedIdx]?.toLowerCase() === 'true';
      if (priceIdx !== -1 && values[priceIdx]) product.price = parseFloat(values[priceIdx]);
      if (skuIdx !== -1) product.sku = values[skuIdx];
      if (imageSrcIdx !== -1) product.imageSrc = values[imageSrcIdx];
      if (inventoryQtyIdx !== -1 && values[inventoryQtyIdx]) product.inventoryQuantity = parseInt(values[inventoryQtyIdx], 10);
      if (requiresShippingIdx !== -1) product.requiresShipping = values[requiresShippingIdx]?.toLowerCase() === 'true';
      if (taxableIdx !== -1) product.taxable = values[taxableIdx]?.toLowerCase() === 'true';
      if (statusIdx !== -1 && ['active', 'draft', 'archived'].includes(values[statusIdx]?.toLowerCase())) {
        product.status = values[statusIdx].toLowerCase() as 'active' | 'draft' | 'archived';
      } else {
        product.status = 'active'; 
      }
      
      if (product.title || product.sku || handleIdx !== -1 && values[handleIdx]) { // Basic validation: product must have at least one key identifier
        products.push(product);
      }
    }
    return { type: 'products', data: products };

  } else if (isLikelyCustomerCSV) {
    return { type: 'customers', message: 'This appears to be a customer CSV. This tool is designed for importing Shopify product CSVs. No data was imported.' };
  } else {
    return { type: 'unknown', message: 'The CSV format is not recognized. Please ensure it is a Shopify product CSV or a customer CSV if you intended to check its type.' };
  }
};
