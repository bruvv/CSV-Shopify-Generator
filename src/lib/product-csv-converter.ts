
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

// More robust manual CSV line parser from customer converter
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


export const parseMagentoProductCsv = (csvString: string): ParseProductResult => {
  // Placeholder implementation - This will be built out in the next step
  console.log("Parsing Magento Product CSV (placeholder)...", csvString.substring(0,100));

  // Basic CSV parsing structure
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.' };

  const allLines = trimmedCsvString.split(/\r?\n/);
  if (allLines.length === 0) return { type: 'parse_error', message: 'The CSV file has no lines.' };

  // TODO: Implement robust header detection for products
  const headerLine = allLines[0]; // Simplified for now
  const dataLines = allLines.slice(1);
  const delimiter = detectDelimiter(headerLine); // Assuming comma for product CSV for now
  
  const rawHeaders = parseCsvLine(headerLine, delimiter);
   const headers = rawHeaders.map((h, idx) => {
    let cleanH = h.toLowerCase().trim();
    if (idx === 0) cleanH = cleanH.replace(/^\ufeff/, ''); 
    if (cleanH.startsWith('"') && cleanH.endsWith('"')) {
        cleanH = cleanH.substring(1, cleanH.length - 1);
    }
    return cleanH;
  });

  console.log("Detected Product Headers:", headers);

  // For now, return a dummy product for testing the UI flow
  const dummyProducts: Partial<ShopifyProductFormData>[] = [
    // {
    //   id: crypto.randomUUID(),
    //   handle: 'test-product-1',
    //   title: 'Test Product 1 from CSV',
    //   variantSku: 'TP001',
    //   variantPrice: 19.99,
    //   variantInventoryQty: 10,
    // }
  ];
  
  if (headers.length > 0 && dataLines.length > 0 && headers.includes('sku') && headers.includes('name')) {
     // A very basic check to see if it might be a product CSV
     // Actual parsing will be complex
     return { type: 'no_products_extracted', data: [], message: 'Product CSV parsing not fully implemented yet. Headers detected.' };
  }


  // return { type: 'products_found', data: dummyProducts, message: 'Dummy product data loaded for UI testing.' };
  return { type: 'parse_error', message: 'Could not recognize Magento Product CSV structure. Ensure headers like SKU and Name are present.' };
};


export const generateShopifyProductCsv = (products: ShopifyProductFormData[]): string => {
  // Placeholder - This will generate the Shopify Product CSV format
  const shopifyHeaders = [
    'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
    'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
    'Variant SKU', 'Variant Grams', 'Variant Inventory Qty', 'Variant Inventory Policy', 
    'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 
    'Variant Requires Shipping', 'Variant Taxable', 'Variant Barcode',
    'Image Src', 'Image Position', 'Image Alt Text', 'Gift Card',
    'SEO Title', 'SEO Description',
    // ... other Shopify headers as needed
  ];

  const csvData = products.map(p => [
    p.handle,
    p.title,
    p.bodyHtml,
    p.vendor,
    p.productType,
    p.tags,
    p.published ? 'TRUE' : 'FALSE',
    p.option1Name,
    p.option1Value,
    p.option2Name,
    p.option2Value,
    p.option3Name,
    p.option3Value,
    p.variantSku,
    String(p.variantWeight), // Assuming grams for now
    String(p.variantInventoryQty),
    'deny', // Variant Inventory Policy (deny/continue)
    'manual', // Variant Fulfillment Service
    String(p.variantPrice),
    p.variantCompareAtPrice ? String(p.variantCompareAtPrice) : '',
    p.variantRequiresShipping ? 'TRUE' : 'FALSE',
    p.variantTaxable ? 'TRUE' : 'FALSE',
    '', // Variant Barcode
    p.imageSrc,
    String(p.imagePosition),
    p.imageAltText,
    'FALSE', // Gift Card
    p.seoTitle,
    p.seoDescription,
  ]);

  return arrayToCsv(shopifyHeaders, csvData);
};
