import type { ProductFormData } from '@/schemas/product';

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
    // 'Google Shopping / Google Product Category', // Simplified, add more if needed
    // 'Google Shopping / Gender',
    // 'Google Shopping / Age Group',
    // 'Google Shopping / MPN',
    // 'Google Shopping / AdWords Grouping',
    // 'Google Shopping / AdWords Labels',
    // 'Google Shopping / Condition',
    // 'Google Shopping / Custom Product',
    // 'Google Shopping / Custom Label 0',
    // 'Google Shopping / Custom Label 1',
    // 'Google Shopping / Custom Label 2',
    // 'Google Shopping / Custom Label 3',
    // 'Google Shopping / Custom Label 4',
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
      // ... more google shopping fields (empty for now)
      p.imageSrc, // Variant Image (can be same as Image Src for simple product)
      '', // Variant Weight Unit (not collected, e.g. 'kg')
      '', // Variant Tax Code (not collected)
      '', // Cost per item (not collected)
      p.status // Status
    ];
  });

  return arrayToCsv(headers, csvData);
};


// Basic CSV parser
export const parseShopifyCsv = (csvString: string): Partial<ProductFormData>[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return []; // Must have header and at least one data row

  const headerLine = lines.shift();
  if (!headerLine) return [];
  
  // Basic CSV parsing for headers - handles quotes
  const headers = headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(h => h.replace(/^"|"$/g, '').trim()) || [];

  const products: Partial<ProductFormData>[] = [];

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.findIndex(h => h.toLowerCase() === alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  // Define common header aliases
  const titleIdx = findHeaderIndex(['Title']);
  const bodyHtmlIdx = findHeaderIndex(['Body (HTML)', 'Description']);
  const vendorIdx = findHeaderIndex(['Vendor']);
  const productTypeIdx = findHeaderIndex(['Type', 'Product Type']);
  const tagsIdx = findHeaderIndex(['Tags']);
  const publishedIdx = findHeaderIndex(['Published']);
  const priceIdx = findHeaderIndex(['Variant Price', 'Price']);
  const skuIdx = findHeaderIndex(['Variant SKU', 'SKU']);
  const imageSrcIdx = findHeaderIndex(['Image Src', 'Image URL']);
  const inventoryQtyIdx = findHeaderIndex(['Variant Inventory Qty', 'Inventory Quantity', 'Quantity']);
  const requiresShippingIdx = findHeaderIndex(['Variant Requires Shipping', 'Requires Shipping']);
  const taxableIdx = findHeaderIndex(['Variant Taxable', 'Taxable']);
  const statusIdx = findHeaderIndex(['Status']);


  for (const line of lines) {
    // Basic CSV parsing for data rows - handles quotes
    const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
    if (values.length < headers.length && values.length < 1) continue; // Skip empty or malformed lines

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
      product.status = 'active'; // Default status if not provided or invalid
    }
    
    // Only add if title is present (basic validation)
    if (product.title) {
      products.push(product);
    }
  }
  return products;
};
