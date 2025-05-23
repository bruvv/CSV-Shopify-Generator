
import type { ShopifyCustomerFormData } from '@/schemas/customer';

export type ParseCustomerResult =
  | { type: 'customers_found'; data: Partial<ShopifyCustomerFormData>[]; message: string }
  | { type: 'no_customers_extracted'; message: string }
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

const detectDelimiter = (line: string): ',' | ';' => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

const parseCsvLine = (line: string, delimiter: ',' | ';'): string[] => {
  const regex = new RegExp(`(".*?"|[^"${delimiter}\\r\\n]+)(?=\\s*${delimiter}|\\s*$)`, 'g');
  return (line.match(regex) || []).map(v => v.replace(/^"|"$/g, '').trim());
};

// Helper function to escape string for regex constructor
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export const parseMagentoCustomerCsv = (csvString: string): ParseCustomerResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.' };

  const allLines = trimmedCsvString.split(/\r?\n/);
  if (allLines.length === 0) return { type: 'parse_error', message: 'The CSV file has no lines.' };

  let headerLine: string | undefined;
  let actualHeaderRowIndex = -1;
  const potentialHeaderKeywords = ['email', 'firstname', 'lastname', 'company_address', 'company_name', 'contact_phone', 'land', 'plaats', 'postcode'];
  
  for (let i = 0; i < Math.min(allLines.length, 10); i++) { // Check more lines for header
    const currentLine = allLines[i];
    if (!currentLine.trim()) continue;

    const tempDelimiter = detectDelimiter(currentLine);
    const parsedAsHeader = parseCsvLine(currentLine, tempDelimiter).map(h => h.toLowerCase().trim().replace(/^"+|"+$/g, '')); // Also strip quotes from headers
    
    let keywordFoundCount = 0;
    for (const keyword of potentialHeaderKeywords) {
      if (parsedAsHeader.includes(keyword)) {
        keywordFoundCount++;
      }
    }
    
    if (keywordFoundCount >= 2 || parsedAsHeader.includes('email')) {
      headerLine = currentLine;
      actualHeaderRowIndex = i;
      break;
    }
  }

  if (!headerLine || actualHeaderRowIndex === -1) {
    return { type: 'parse_error', message: 'Could not find a valid header row in the CSV. Please ensure headers like "email", "firstname", "lastname" are present within the first few lines of the file.' };
  }

  const dataLines = allLines.slice(actualHeaderRowIndex + 1);
  const delimiter = detectDelimiter(headerLine); 
  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/^"+|"+$/g, '')); // Also strip quotes from headers

  if (headers.length === 0) return { type: 'parse_error', message: 'Could not parse headers from the identified header row.' };

  const findHeaderIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const index = headers.indexOf(alias.toLowerCase());
      if (index !== -1) return index;
    }
    return -1;
  }

  const emailIdx = findHeaderIndex(['email']);
  const firstnameIdx = findHeaderIndex(['firstname', 'first_name', 'first name']);
  const lastnameIdx = findHeaderIndex(['lastname', 'last_name', 'last name']);
  const companyAddressIdx = findHeaderIndex(['company_address', 'street', 'address', 'address1', 'billing_street', 'shipping_street']);
  const address2Idx = findHeaderIndex(['address2', 'street2', 'billing_street2', 'shipping_street2']);
  const companyNameIdx = findHeaderIndex(['company_name', 'company']);
  const contactPersonIdx = findHeaderIndex(['contact_person']);
  const contactPhoneIdx = findHeaderIndex(['contact_phone', 'telephone', 'phone', 'billing_telephone', 'shipping_telephone']);
  const countryIdx = findHeaderIndex(['land', 'country_id', 'country', 'country_code', 'billing_country_id', 'shipping_country_id']);
  const cityIdx = findHeaderIndex(['plaats', 'city', 'billing_city', 'shipping_city']);
  const postcodeIdx = findHeaderIndex(['postcode', 'zip', 'zip_code', 'postal_code', 'billing_postcode', 'shipping_postcode']);
  const provinceIdx = findHeaderIndex(['province', 'state', 'region', 'billing_region', 'shipping_region']);
  const provinceCodeIdx = findHeaderIndex(['province_code', 'state_code', 'region_code', 'billing_region_id', 'shipping_region_id']);
  
  const websiteIdx = findHeaderIndex(['_website', 'website']);
  const storeIdx = findHeaderIndex(['_store', 'store']);
  const groupIdIdx = findHeaderIndex(['group_id', 'customer_group']);
  const createdAtIdx = findHeaderIndex(['created_at']);
  const notesIdx = findHeaderIndex(['notes', 'note', 'customer_notes']);
  const vatNumberIdx = findHeaderIndex(['vat_number', 'taxvat', 'billing_taxvat', 'shipping_taxvat']);


  const customers: Partial<ShopifyCustomerFormData>[] = [];
  let mappableHeadersFound = [emailIdx, firstnameIdx, lastnameIdx, companyAddressIdx, companyNameIdx, contactPhoneIdx, countryIdx, cityIdx, postcodeIdx].some(idx => idx !== -1);

   if (!mappableHeadersFound && dataLines.length > 0 && headers.length > 0) {
     return { type: 'no_customers_extracted', message: 'No recognizable customer data columns (like email, name, address) were found in the CSV header. Please check your file.' };
  }


  for (const line of dataLines) {
    if (line.trim() === '') continue;
    const values = parseCsvLine(line, delimiter);
    if (values.length === 0 || values.every(v => v === '')) continue;
    if (values.length < headers.length && values.length < 3) continue; 

    const customer: Partial<ShopifyCustomerFormData> = { id: crypto.randomUUID() };

    if (emailIdx !== -1) customer.email = values[emailIdx]?.trim();
    
    const rawFirstNameFromColumn = firstnameIdx !== -1 ? values[firstnameIdx]?.trim() : '';
    const rawLastNameFromColumn = lastnameIdx !== -1 ? values[lastnameIdx]?.trim() : '';
    const rawContactPerson = contactPersonIdx !== -1 ? values[contactPersonIdx]?.trim() : '';

    let finalFirstName = '';
    let finalLastName = '';

    // 1. Prioritize lastname column for finalLastName
    if (rawLastNameFromColumn) {
        finalLastName = rawLastNameFromColumn;
    }

    // 2. Attempt to derive firstName from contact_person using finalLastName
    if (rawContactPerson && finalLastName) {
        const potentialFirstName = rawContactPerson.replace(new RegExp(`\\s*${escapeRegExp(finalLastName)}$`, 'i'), '').trim();
        if (potentialFirstName && potentialFirstName.toLowerCase() !== rawContactPerson.toLowerCase()) { 
            finalFirstName = potentialFirstName;
        }
    }

    // 3. If firstName could not be derived (still empty) AND contact_person exists, split contact_person
    if (!finalFirstName && rawContactPerson) {
        const contactParts = rawContactPerson.split(/\s+/);
        if (contactParts.length > 0) {
            finalFirstName = contactParts.shift()!;
            // Only set lastName from here if not already set by the 'lastname' column
            if (!finalLastName && contactParts.length > 0) { 
                finalLastName = contactParts.join(' ');
            }
        }
    }

    // 4. If firstName is still empty, use the value from firstname column as a last resort.
    if (!finalFirstName && rawFirstNameFromColumn) {
        finalFirstName = rawFirstNameFromColumn;
    }

    customer.firstName = finalFirstName;
    customer.lastName = finalLastName;


    if (companyNameIdx !== -1) customer.company = values[companyNameIdx]?.trim();
    if (companyAddressIdx !== -1) customer.address1 = values[companyAddressIdx]?.trim();
    if (address2Idx !== -1) customer.address2 = values[address2Idx]?.trim();
    if (cityIdx !== -1) customer.city = values[cityIdx]?.trim();
    if (postcodeIdx !== -1) customer.zip = values[postcodeIdx]?.trim();
    
    if (countryIdx !== -1 && values[countryIdx]) {
        const countryValue = values[countryIdx].trim();
        customer.country = countryValue;
        if (countryValue?.length === 2 && countryValue === countryValue?.toUpperCase()) {
            customer.countryCode = countryValue;
        }
    }
    if (provinceIdx !== -1) customer.province = values[provinceIdx]?.trim();
    if (provinceCodeIdx !== -1) customer.provinceCode = values[provinceCodeIdx]?.trim();

    if (contactPhoneIdx !== -1) customer.phone = values[contactPhoneIdx]?.trim();
    if (notesIdx !== -1) customer.note = values[notesIdx]?.trim();

    let tagsArray: string[] = [];
    if (websiteIdx !== -1 && values[websiteIdx]?.trim()) tagsArray.push(`magento_website:${values[websiteIdx].trim()}`);
    if (storeIdx !== -1 && values[storeIdx]?.trim()) tagsArray.push(`magento_store:${values[storeIdx].trim()}`);
    if (groupIdIdx !== -1 && values[groupIdIdx]?.trim()) tagsArray.push(`magento_group_id:${values[groupIdIdx].trim()}`);
    if (createdAtIdx !== -1 && values[createdAtIdx]?.trim()) tagsArray.push(`magento_created_at:${values[createdAtIdx].trim()}`);
    if (vatNumberIdx !== -1 && values[vatNumberIdx]?.trim()) tagsArray.push(`magento_vat_number:${values[vatNumberIdx].trim()}`);
    
    customer.tags = tagsArray.filter(tag => tag.split(':')[1]?.trim()).join(', ');


    customer.acceptsMarketing = false; 
    customer.taxExempt = false; 

    if (customer.email || customer.firstName || customer.lastName || customer.company || customer.address1 || customer.phone) {
      customers.push(customer);
    }
  }

  if (customers.length > 0) {
    return { type: 'customers_found', data: customers, message: `${customers.length} customer(s) loaded from the CSV. Review and edit if needed.` };
  } else {
    if (mappableHeadersFound || headers.length > 0) { 
         return { type: 'no_customers_extracted', message: 'CSV headers were recognized, but no valid customer data rows could be extracted. Check if rows have essential info like email or names, and ensure data aligns with headers.' };
    }
    return { type: 'no_customers_extracted', message: 'Could not extract any customer data from the CSV. Please ensure it contains customer information with recognizable headers.' };
  }
};

