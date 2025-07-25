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
  // Escape quotes by doubling them, and wrap in quotes if it contains delimiter, newline or quote
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

// Helper function for Dutch phone number formatting
const formatDutchPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return '';
  let cleanedPhone = phone.replace(/[\s-()]/g, ''); // Remove spaces, hyphens, parentheses

  if (cleanedPhone.startsWith('0031')) {
    cleanedPhone = `+31${cleanedPhone.substring(4)}`;
  } else if (cleanedPhone.startsWith('06') && cleanedPhone.length === 10) { // Standard Dutch mobile
    cleanedPhone = `+316${cleanedPhone.substring(2)}`;
  } else if (cleanedPhone.startsWith('0') && cleanedPhone.length > 1) { // Other Dutch numbers starting with 0
    cleanedPhone = `+31${cleanedPhone.substring(1)}`;
  } else if (cleanedPhone.startsWith('31') && !cleanedPhone.startsWith('+31') && cleanedPhone.length > 2) {
    // Handles cases like 31612345678 or 31501234567
    cleanedPhone = `+${cleanedPhone}`;
  }
  return cleanedPhone;
};

function capitalizeCityName(city: string): string {
  if (!city) return '';
  return city
    .toLowerCase()
    .split(/\s+/) // Split by spaces
    .map(word =>
      word
        .split('-') // Split by hyphens
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-')
    )
    .join(' ');
}


export const generateShopifyCustomerCsv = (customers: ShopifyCustomerFormData[]): string => {
  const headers = [
    'First Name', 'Last Name', 'Email', 'Accepts Email Marketing', 'Default Address Company',
    'Default Address Address1', 'Default Address Address2', 'Default Address City',
    'Default Address Province Code', 'Default Address Country Code', 'Default Address Zip',
    'Default Address Phone', 'Phone', 'Accepts SMS Marketing', 'Tags', 'Note', 'Tax Exempt'
  ];

  const csvData = customers.map(c => {
    const formattedPhone = formatDutchPhoneNumber(c.phone);
    return [
      c.firstName,
      c.lastName,
      c.email,
      c.acceptsMarketing ? 'yes' : 'no',
      c.company,
      c.address1,
      c.address2,
      c.city,
      c.provinceCode,
      c.countryCode,
      c.zip,
      formattedPhone, // For "Default Address Phone"
      formattedPhone, // For "Phone"
      c.acceptsSmsMarketing ? 'yes' : 'no',
      c.tags,
      c.note,
      c.taxExempt ? 'yes' : 'no'
    ];
  });

  return arrayToCsv(headers, csvData);
};

const detectDelimiter = (line: string): ',' | ';' => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

// More robust manual CSV line parser
const parseCsvLine = (line: string, delimiter: ',' | ';'): string[] => {
  const result: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // This is an escaped quote ("")
        currentValue += '"';
        i++; // Skip the second quote of the pair
      } else {
        // This is a regular quote, toggle the inQuotes state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Delimiter found outside of quotes, field ends
      result.push(currentValue);
      currentValue = ""; // Reset for the next field
    } else {
      // Regular character, append to current field value
      currentValue += char;
    }
  }
  result.push(currentValue); // Add the last field
  return result.map(field => field.trim());
};


export const parseMagentoCustomerCsv = (csvString: string): ParseCustomerResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.' };

  const allLines = trimmedCsvString.split(/\r?\n/);
  if (allLines.length === 0) return { type: 'parse_error', message: 'The CSV file has no lines.' };

  let headerLine: string | undefined;
  let actualHeaderRowIndex = -1;
  const potentialHeaderKeywords = ['email', 'firstname', 'lastname', 'company_address', 'company_name', 'contact_phone', 'land', 'plaats', 'postcode', 'street', 'city', 'zip', 'telephone'];

  for (let i = 0; i < Math.min(allLines.length, 10); i++) {
    const currentLine = allLines[i];
    if (!currentLine.trim()) continue; 

    const tempDelimiter = detectDelimiter(currentLine);
    const parsedAsHeader = parseCsvLine(currentLine, tempDelimiter).map((h, idx) => {
        let cleanH = h.toLowerCase().trim();
        if (idx === 0) cleanH = cleanH.replace(/^\ufeff/, ''); 
        if (cleanH.startsWith('"') && cleanH.endsWith('"')) {
            cleanH = cleanH.substring(1, cleanH.length - 1);
        }
        return cleanH;
    });

    let keywordFoundCount = 0;
    for (const keyword of potentialHeaderKeywords) {
      if (parsedAsHeader.includes(keyword)) {
        keywordFoundCount++;
      }
    }
    
    if (parsedAsHeader.includes('email') || keywordFoundCount >= 3) {
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
  const headers = rawHeaders.map((h, idx) => {
    let cleanH = h.toLowerCase().trim();
    if (idx === 0) cleanH = cleanH.replace(/^\ufeff/, ''); 
    if (cleanH.startsWith('"') && cleanH.endsWith('"')) {
        cleanH = cleanH.substring(1, cleanH.length - 1);
    }
    return cleanH;
  });


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

    if (values.length !== headers.length && line.trim() !== '') {
        console.warn(`Column count mismatch: Expected ${headers.length}, got ${values.length}. Line: "${line}"`);
        continue; 
    }
    if (values.length === 0 || values.every(v => v === '')) continue;

    const customer: Partial<ShopifyCustomerFormData> = {
      id: crypto.randomUUID(),
      acceptsSmsMarketing: false, 
    };

    if (emailIdx !== -1) customer.email = values[emailIdx];
    
    const magentoRawLastName = lastnameIdx !== -1 ? values[lastnameIdx] : '';
    const magentoContactPerson = contactPersonIdx !== -1 ? values[contactPersonIdx] : '';
    const magentoRawFirstName = firstnameIdx !== -1 ? values[firstnameIdx] : '';

    let finalFirstName = '';
    let finalLastName = magentoRawLastName; 

    if (finalLastName && magentoContactPerson) {
        const contactLower = magentoContactPerson.toLowerCase();
        const lastNameLower = finalLastName.toLowerCase();
        
        if (contactLower.endsWith(lastNameLower)) {
            const potentialFirstName = magentoContactPerson.substring(0, magentoContactPerson.length - finalLastName.length).trim();
            if (potentialFirstName) {
                finalFirstName = potentialFirstName.replace(/,$/, '').trim(); 
            }
        }
    }
    
    if (!finalFirstName && magentoRawFirstName) {
        finalFirstName = magentoRawFirstName;
    }
    
    if (!finalFirstName && magentoContactPerson && !finalLastName) {
        const parts = magentoContactPerson.split(/\s+/);
        finalFirstName = parts[0];
        if (parts.length > 1) {
            finalLastName = parts.slice(1).join(' ');
        }
    }
    
    customer.firstName = finalFirstName;
    customer.lastName = finalLastName;


    if (companyNameIdx !== -1) customer.company = values[companyNameIdx];
    if (companyAddressIdx !== -1) customer.address1 = values[companyAddressIdx];
    if (address2Idx !== -1) customer.address2 = values[address2Idx];
    
    if (cityIdx !== -1 && values[cityIdx]) {
      customer.city = capitalizeCityName(values[cityIdx]);
    }

    if (postcodeIdx !== -1) customer.zip = values[postcodeIdx];

    if (countryIdx !== -1 && values[countryIdx]) {
        const countryValue = values[countryIdx];
        customer.country = countryValue;
        if (countryValue?.length === 2 && countryValue === countryValue?.toUpperCase()) {
            customer.countryCode = countryValue;
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
    if (vatNumberIdx !== -1 && values[vatNumberIdx]) {
      tagsArray.push(`magento_vat_number:${values[vatNumberIdx]}`);
      customer.taxExempt = true; 
    }


    customer.tags = tagsArray.filter(tag => tag.split(':')[1]?.trim()).join(', ');
    customer.acceptsMarketing = false; 

    if (customer.email || customer.firstName || customer.lastName || customer.company || customer.address1 || customer.phone) {
      customers.push(customer);
    }
  }

  if (customers.length > 0) {
    return { type: 'customers_found', data: customers, message: `${customers.length} customer(s) loaded from the CSV. Review and edit if needed.` };
  } else {
    return { type: 'no_customers_extracted', message: 'No valid customer data rows could be extracted. Check if rows have essential info like email or names, and ensure data aligns with headers.' };
  }
};
