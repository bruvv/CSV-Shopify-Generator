
import type { ShopifyCustomerFormData } from '@/schemas/customer';

export type ParsedCustomerDataPayload = {
  data: Partial<ShopifyCustomerFormData>[];
  format: 'magento_customer' | 'unknown_customer_format';
  message?: string;
}

export type ParseCustomerResult =
  | ({ type: 'customers' } & ParsedCustomerDataPayload)
  | { type: 'products'; message: string } // To indicate if it looks like a product CSV
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

export const generateShopifyCustomerCsv = (customers: ShopifyCustomerFormData[]): string => {
  const headers = [
    'First Name', 'Last Name', 'Email', 'Company', 'Address1', 'Address2', 'City', 'Province', 
    'Province Code', 'Country', 'Country Code', 'Zip', 'Phone', 'Accepts Marketing', 'Tags', 
    'Note', 'Tax Exempt'
  ];

  const csvData = customers.map(c => [
    c.firstName, c.lastName, c.email, c.company, c.address1, c.address2, c.city, c.province,
    c.provinceCode, c.country, c.countryCode, c.zip, c.phone, c.acceptsMarketing ? 'yes' : 'no', c.tags,
    c.note, c.taxExempt ? 'yes' : 'no'
  ]);

  return arrayToCsv(headers, csvData);
};

const detectDelimiter = (headerLine: string): ',' | ';' => {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

const parseCsvLine = (line: string, delimiter: ',' | ';'): string[] => {
  const regex = new RegExp(`(".*?"|[^"${delimiter}]+)(?=\\s*${delimiter}|\\s*$)`, 'g');
  return (line.match(regex) || []).map(v => v.replace(/^"|"$/g, '').trim());
};

export const parseMagentoCustomerCsv = (csvString: string): ParseCustomerResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'empty', message: 'The CSV file is empty.' };

  const lines = trimmedCsvString.split(/\r?\n/); // Handles both CRLF and LF
  if (lines.length === 0) return { type: 'empty', message: 'The CSV file has no lines.' };
  
  const headerLine = lines.shift();
  if (!headerLine) return { type: 'empty', message: 'The CSV file has no header line.' };
  
  const delimiter = detectDelimiter(headerLine);
  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const headers = rawHeaders.map(h => h.toLowerCase());

  if (headers.length === 0) return { type: 'unknown_csv', message: 'Could not parse headers from the CSV file.' };

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.indexOf(alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  // Magento Customer specific header checks
  const emailIdx = findHeaderIndex(['email']);
  const firstnameIdx = findHeaderIndex(['firstname', 'first_name']);
  const lastnameIdx = findHeaderIndex(['lastname', 'last_name']);
  const companyAddressIdx = findHeaderIndex(['company_address', 'street', 'address']); // Broader match
  const companyNameIdx = findHeaderIndex(['company_name', 'company']);
  const contactPhoneIdx = findHeaderIndex(['contact_phone', 'telephone', 'phone']);
  const websiteIdx = findHeaderIndex(['_website', 'website']);
  const storeIdx = findHeaderIndex(['_store', 'store']);
  const groupIdIdx = findHeaderIndex(['group_id', 'customer_group']);
  const countryIdx = findHeaderIndex(['land', 'country_id', 'country']);
  const cityIdx = findHeaderIndex(['plaats', 'city']);
  const postcodeIdx = findHeaderIndex(['postcode', 'zip']);
  const createdAtIdx = findHeaderIndex(['created_at']);

  // Product CSV detection (to inform user if they uploaded the wrong type)
  const productSkuIdx = findHeaderIndex(['sku', 'variant sku']);
  const productTitleIdx = findHeaderIndex(['name', 'title']);
  const productPriceIdx = findHeaderIndex(['price', 'variant price']);

  if (productSkuIdx !== -1 && productTitleIdx !== -1 && productPriceIdx !== -1) {
      return { type: 'products', message: 'This appears to be a product CSV. This tool is now configured for customer CSVs.' };
  }
  
  const isLikelyMagentoCustomer = emailIdx !== -1 && (firstnameIdx !== -1 || lastnameIdx !== -1);

  if (!isLikelyMagentoCustomer) {
    return { type: 'unknown_csv', message: 'Could not identify this as a Magento Customer CSV. Key headers like "email", "firstname", or "lastname" are missing.' };
  }

  const customers: Partial<ShopifyCustomerFormData>[] = [];
  let parseMessage: string | undefined;

  for (const line of lines) {
    const values = parseCsvLine(line, delimiter);
    if (values.length === 0 || values.every(v => v === '')) continue;

    const customer: Partial<ShopifyCustomerFormData> = { id: crypto.randomUUID() };
    
    if (emailIdx !== -1) customer.email = values[emailIdx];
    if (firstnameIdx !== -1) customer.firstName = values[firstnameIdx];
    if (lastnameIdx !== -1) customer.lastName = values[lastnameIdx];
    if (companyNameIdx !== -1) customer.company = values[companyNameIdx];
    if (companyAddressIdx !== -1) customer.address1 = values[companyAddressIdx]; // Simplified mapping
    if (cityIdx !== -1) customer.city = values[cityIdx];
    if (postcodeIdx !== -1) customer.zip = values[postcodeIdx];
    if (countryIdx !== -1) customer.country = values[countryIdx];
    if (contactPhoneIdx !== -1) customer.phone = values[contactPhoneIdx];

    let tagsArray: string[] = [];
    if (websiteIdx !== -1 && values[websiteIdx]) tagsArray.push(`magento_website:${values[websiteIdx]}`);
    if (storeIdx !== -1 && values[storeIdx]) tagsArray.push(`magento_store:${values[storeIdx]}`);
    if (groupIdIdx !== -1 && values[groupIdIdx]) tagsArray.push(`magento_group_id:${values[groupIdIdx]}`);
    if (createdAtIdx !== -1 && values[createdAtIdx]) tagsArray.push(`magento_created_at:${values[createdAtIdx]}`);
    
    customer.tags = tagsArray.join(', ');
    
    // Set default values for Shopify specific fields if not mapped
    customer.acceptsMarketing = false; // Default, Magento doesn't have direct equivalent in simple export
    customer.taxExempt = false; // Default

    if (customer.email || customer.firstName || customer.lastName) {
      customers.push(customer);
    }
  }

  if (customers.length === 0 && lines.length > 0) {
    parseMessage = "Magento Customer CSV detected, but no actual customer rows could be parsed or essential data like email/name was missing in rows.";
  } else if (customers.length > 0) {
    parseMessage = `${customers.length} customers loaded from Magento CSV. Review and generate Shopify CSV. Note: Address mapping is simplified; review address fields.`;
  }


  return { type: 'customers', data: customers, format: 'magento_customer', message: parseMessage };
};
