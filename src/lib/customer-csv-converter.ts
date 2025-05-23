
import type { ShopifyCustomerFormData } from '@/schemas/customer';

export type ParseCustomerResult =
  | { type: 'customers_found'; data: Partial<ShopifyCustomerFormData>[]; message: string }
  | { type: 'no_customers_extracted'; message: string } // Headers might be okay/unclear, but no data rows, or rows lack essential info
  | { type: 'parse_error'; message: string }; // Critical error, e.g. empty file, no headers

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
  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.' };

  const lines = trimmedCsvString.split(/\r?\n/);
  if (lines.length === 0) return { type: 'parse_error', message: 'The CSV file has no lines.' };

  const headerLine = lines.shift();
  if (!headerLine) return { type: 'parse_error', message: 'The CSV file has no header line.' };

  const delimiter = detectDelimiter(headerLine);
  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const headers = rawHeaders.map(h => h.toLowerCase());

  if (headers.length === 0) return { type: 'parse_error', message: 'Could not parse headers from the CSV file.' };

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.indexOf(alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  // Common customer field headers (Magento and generic)
  const emailIdx = findHeaderIndex(['email']);
  const firstnameIdx = findHeaderIndex(['firstname', 'first_name', 'first name']);
  const lastnameIdx = findHeaderIndex(['lastname', 'last_name', 'last name']);
  const companyAddressIdx = findHeaderIndex(['company_address', 'street', 'address', 'address1']);
  const address2Idx = findHeaderIndex(['address2', 'street2']);
  const companyNameIdx = findHeaderIndex(['company_name', 'company']);
  const contactPhoneIdx = findHeaderIndex(['contact_phone', 'telephone', 'phone']);
  const countryIdx = findHeaderIndex(['land', 'country_id', 'country', 'country_code']);
  const cityIdx = findHeaderIndex(['plaats', 'city']);
  const postcodeIdx = findHeaderIndex(['postcode', 'zip', 'zip_code', 'postal_code']);
  const provinceIdx = findHeaderIndex(['province', 'state', 'region']);
  const provinceCodeIdx = findHeaderIndex(['province_code', 'state_code', 'region_code']);
  
  // Magento specific tags/notes fields
  const websiteIdx = findHeaderIndex(['_website', 'website']);
  const storeIdx = findHeaderIndex(['_store', 'store']);
  const groupIdIdx = findHeaderIndex(['group_id', 'customer_group']);
  const createdAtIdx = findHeaderIndex(['created_at']);
  const notesIdx = findHeaderIndex(['notes', 'note', 'customer_notes']); // General notes

  const customers: Partial<ShopifyCustomerFormData>[] = [];
  let mappableHeadersFound = [emailIdx, firstnameIdx, lastnameIdx, companyAddressIdx, companyNameIdx, contactPhoneIdx, countryIdx, cityIdx, postcodeIdx].some(idx => idx !== -1);

  if (!mappableHeadersFound && lines.length > 0) {
     return { type: 'no_customers_extracted', message: 'No recognizable customer data columns (like email, name, address) were found in the CSV header. Please check your file.' };
  }


  for (const line of lines) {
    if (line.trim() === '') continue; // Skip empty lines
    const values = parseCsvLine(line, delimiter);
    if (values.length === 0 || values.every(v => v === '')) continue;

    const customer: Partial<ShopifyCustomerFormData> = { id: crypto.randomUUID() };

    if (emailIdx !== -1) customer.email = values[emailIdx];
    if (firstnameIdx !== -1) customer.firstName = values[firstnameIdx];
    if (lastnameIdx !== -1) customer.lastName = values[lastnameIdx];
    if (companyNameIdx !== -1) customer.company = values[companyNameIdx];
    
    if (companyAddressIdx !== -1) customer.address1 = values[companyAddressIdx];
    if (address2Idx !== -1) customer.address2 = values[address2Idx];
    
    if (cityIdx !== -1) customer.city = values[cityIdx];
    if (postcodeIdx !== -1) customer.zip = values[postcodeIdx];
    if (countryIdx !== -1) { // Attempt to map country code if full name not available
        customer.country = values[countryIdx];
        if (values[countryIdx]?.length === 2 && values[countryIdx] === values[countryIdx]?.toUpperCase()) {
            customer.countryCode = values[countryIdx];
        }
    }
    if (provinceIdx !== -1) customer.province = values[provinceIdx];
    if (provinceCodeIdx !== -1) customer.provinceCode = values[provinceCodeIdx];

    if (contactPhoneIdx !== -1) customer.phone = values[contactPhoneIdx];
    if (notesIdx !== -1) customer.note = values[notesIdx];

    let tagsArray: string[] = [];
    if (websiteIdx !== -1 && values[websiteIdx]) tagsArray.push(`magento_website:${values[websiteIdx]}`);
    if (storeIdx !== -1 && values[storeIdx]) tagsArray.push(`magento_store:${values[storeIdx]}`);
    if (groupIdIdx !== -1 && values[groupIdIdx]) tagsArray.push(`magento_group_id:${values[groupIdIdx]}`);
    if (createdAtIdx !== -1 && values[createdAtIdx]) tagsArray.push(`magento_created_at:${values[createdAtIdx]}`);
    
    customer.tags = tagsArray.join(', ');

    customer.acceptsMarketing = false; // Default, can be refined if a column exists
    customer.taxExempt = false; // Default, can be refined if a column exists

    // Only add customer if some essential data is present
    if (customer.email || customer.firstName || customer.lastName || customer.company || customer.address1 || customer.phone) {
      customers.push(customer);
    }
  }

  if (customers.length > 0) {
    return { type: 'customers_found', data: customers, message: `${customers.length} customer(s) loaded from the CSV. Review and edit if needed.` };
  } else {
    if (mappableHeadersFound) {
         return { type: 'no_customers_extracted', message: 'CSV headers were recognized, but no valid customer data rows could be extracted. Check if rows have essential info like email or names.' };
    }
    // This case should be rare due to the earlier mappableHeadersFound check, but as a fallback:
    return { type: 'no_customers_extracted', message: 'Could not extract any customer data from the CSV. Please ensure it contains customer information with recognizable headers.' };
  }
};
