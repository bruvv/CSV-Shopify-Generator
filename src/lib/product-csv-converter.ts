
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
    if (baseUrl && baseUrl.trim() !== '') {
        console.warn(`[buildFullImageUrl] Warning: Base URL ("${baseUrl}") was provided, but image path ("${imagePath}") is already absolute. Base URL will be ignored for this image.`);
    }
    return imagePath;
  }

  // At this point, imagePath is relative and not empty.
  if (!baseUrl || baseUrl.trim() === '') {
    console.warn(`[buildFullImageUrl] Condition 3: Base URL is not provided or is empty for relative imagePath: "${imagePath}". Shopify might not be able to import this image. Returning original relative imagePath as fallback.`);
    return imagePath;
  }

  console.log('[buildFullImageUrl] Proceeding to construct full URL with provided baseUrl.');
  const trimmedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  const finalUrl = `${trimmedBaseUrl}/${trimmedImagePath}`;
  // console.log(`[buildFullImageUrl] CONSTRUCTED URL: "${finalUrl}" (from baseUrl: "${trimmedBaseUrl}" and imagePath: "${trimmedImagePath}")`);
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

  // Common Magento fields
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
  const configurableVariationsIdx = findHeaderIndex(['configurable_variations']);
  const configurableVariationLabelsIdx = findHeaderIndex(['configurable_variation_labels']);

  if (skuIdx === -1 ) {
    return { type: 'parse_error', message: 'CSV must contain "sku" column for product import.' };
  }

  const magentoSimpleProducts = new Map<string, Record<string, string>>();
  const magentoConfigurableProducts: Record<string, string>[] = [];

  // First pass: categorize products
  for (const line of dataLines) {
    if (line.trim() === '') continue;
    const values = parseCsvLine(line, delimiter);
    if (values.length !== headers.length) continue;

    const rowData: Record<string, string> = {};
    headers.forEach((header, i) => rowData[header] = values[i]);

    const type = rowData[headers[productTypeIdx]]?.toLowerCase();
    if (type === 'simple') {
      magentoSimpleProducts.set(rowData[headers[skuIdx]], rowData);
    } else if (type === 'configurable') {
      magentoConfigurableProducts.push(rowData);
    }
  }

  const shopifyProducts: Partial<ShopifyProductFormData>[] = [];

  // Second pass: process configurable products and their variants
  for (const mConfig of magentoConfigurableProducts) {
    const configSku = mConfig[headers[skuIdx]];
    const configName = mConfig[headers[nameIdx]] || configSku;
    const option1NameFromLabel = (mConfig[headers[configurableVariationLabelsIdx]] || '').split('=')[1]?.trim() || 'Option';


    const mainProductData: Partial<ShopifyProductFormData> = {
      id: crypto.randomUUID(),
      handle: configSku,
      title: configName,
      bodyHtml: mConfig[headers[descriptionIdx]] || mConfig[headers[shortDescriptionIdx]] || '',
      vendor: mConfig[headers[attributeSetCodeIdx]]?.split(' ')[0] || '',
      productType: mConfig[headers[attributeSetCodeIdx]] || '',
      tags: categoriesIdx !== -1 ? extractTagsFromCategories(mConfig[headers[categoriesIdx]]) : '',
      published: (mConfig[headers[visibilityIdx]]?.toLowerCase() !== "not visible individually" && mConfig[headers[visibilityIdx]]?.toLowerCase() !== "1") && (mConfig[headers[productOnlineIdx]] !== '2' && mConfig[headers[productOnlineIdx]]?.toLowerCase() !== 'disabled'),
      variantPrice: priceIdx !== -1 && mConfig[headers[priceIdx]] ? parseFloat(mConfig[headers[priceIdx]]) : 0, // Configurable price as default
      variantInventoryQty: 0, // Configurable usually doesn't have its own stock
      variantTaxable: taxClassIdx !== -1 ? !(mConfig[headers[taxClassIdx]]?.toLowerCase().includes('none') || mConfig[headers[taxClassIdx]]?.toLowerCase() === '0') : true,
      variantWeight: weightIdx !== -1 && mConfig[headers[weightIdx]] ? parseFloat(mConfig[headers[weightIdx]]) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mConfig[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
      seoTitle: mConfig[headers[metaTitleIdx]] || configName,
      seoDescription: mConfig[headers[metaDescriptionIdx]] || mConfig[headers[shortDescriptionIdx]] || '',
      magentoProductType: 'configurable',
      isVariantRow: false,
      option1Name: option1NameFromLabel, // Set option name on main product
      // Option1Value will be set by the first variant, or "Default Title" if no variants. But Shopify expects it on variant lines.
      // For the main product row in Shopify, if it has options, Option1 Name is set, Option1 Value might be the first variant's value or blank.
      // Let's set Option1Value based on the first variant, Shopify seems to handle it.
    };
    
    const variationsStr = mConfig[headers[configurableVariationsIdx]];
    let firstVariantProcessed = false;

    if (variationsStr) {
      const variations = variationsStr.split('|');
      for (const variation of variations) {
        const attributes = variation.split(',');
        let simpleSku: string | undefined;
        let optionValue: string | undefined;

        attributes.forEach(attr => {
          const [key, value] = attr.split('=');
          if (key.trim().toLowerCase() === 'sku') simpleSku = value.trim();
          // The option key (e.g., 'colors_christian') should match the key from configurable_variation_labels
          const optionKeyFromLabel = (mConfig[headers[configurableVariationLabelsIdx]] || '').split('=')[0]?.trim();
          if (key.trim() === optionKeyFromLabel) optionValue = value.trim();
        });
        
        if (simpleSku && optionValue) {
          const mSimple = magentoSimpleProducts.get(simpleSku);
          if (mSimple) {
            if (!firstVariantProcessed) {
                mainProductData.option1Value = optionValue; // Set main product's Option1Value to the first variant's value
                mainProductData.variantPrice = priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(mSimple[headers[priceIdx]]) : 0;
                mainProductData.variantSku = simpleSku; // Main product row in Shopify CSV takes SKU of first variant
                mainProductData.variantInventoryQty = qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0;
                mainProductData.variantWeight = weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(mSimple[headers[weightIdx]]) : 0;
                mainProductData.imageSrc = buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl) || mainProductData.imageSrc;
                firstVariantProcessed = true;
                shopifyProducts.push(mainProductData); // Add main product data now
            }
             // For subsequent variants, or if the first variant is the ONLY variant, create a new row.
            // Shopify expects the first variant's details on the main product line,
            // and then *additional* variant rows if more than one variant exists.
            // OR, if only one variant, that variant IS the main line.
            // The current approach is: main line gets first variant details. If more variants, add them as new rows.

            // If this is NOT the first variant, create a new row for it.
            if (shopifyProducts.length === 0 || shopifyProducts[shopifyProducts.length-1].handle !== configSku || shopifyProducts[shopifyProducts.length-1].variantSku !== simpleSku) {
                 const variantProductData: Partial<ShopifyProductFormData> = {
                    id: crypto.randomUUID(),
                    handle: configSku,
                    title: '', // Blank for variant rows
                    bodyHtml: '',
                    vendor: '',
                    productType: '',
                    tags: '',
                    published: mSimple[headers[visibilityIdx]]?.toLowerCase() !== "not visible individually" && mSimple[headers[visibilityIdx]]?.toLowerCase() !== "1", // Variants can have own published status
                    option1Name: option1NameFromLabel,
                    option1Value: optionValue,
                    variantSku: simpleSku,
                    variantPrice: priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(mSimple[headers[priceIdx]]) : 0,
                    variantInventoryQty: qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0,
                    variantTaxable: taxClassIdx !== -1 ? !(mSimple[headers[taxClassIdx]]?.toLowerCase().includes('none') || mSimple[headers[taxClassIdx]]?.toLowerCase() === '0') : true,
                    variantWeight: weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(mSimple[headers[weightIdx]]) : 0,
                    imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
                    seoTitle: '',
                    seoDescription: '',
                    magentoProductType: 'simple_variant', // Custom type to denote it's part of a configurable
                    isVariantRow: true,
                };
                shopifyProducts.push(variantProductData);
            }
            magentoSimpleProducts.delete(simpleSku); // Mark as processed
          }
        }
      }
    }
    // If no variants were processed (e.g. configurable_variations was empty or malformed, but it was a configurable product)
    // Add the main product data with default option values
    if (!firstVariantProcessed) {
        mainProductData.option1Name = 'Title';
        mainProductData.option1Value = 'Default Title';
        mainProductData.variantSku = configSku; // Fallback SKU
        shopifyProducts.push(mainProductData);
    }
  }

  // Third pass: process standalone simple products
  for (const [sku, mSimple] of magentoSimpleProducts.entries()) {
    const simpleName = mSimple[headers[nameIdx]] || sku;
    const simpleProductData: Partial<ShopifyProductFormData> = {
      id: crypto.randomUUID(),
      handle: sku,
      title: simpleName,
      bodyHtml: mSimple[headers[descriptionIdx]] || mSimple[headers[shortDescriptionIdx]] || '',
      vendor: mSimple[headers[attributeSetCodeIdx]]?.split(' ')[0] || '',
      productType: mSimple[headers[attributeSetCodeIdx]] || '',
      tags: categoriesIdx !== -1 ? extractTagsFromCategories(mSimple[headers[categoriesIdx]]) : '',
      published: (mSimple[headers[visibilityIdx]]?.toLowerCase() !== "not visible individually" && mSimple[headers[visibilityIdx]]?.toLowerCase() !== "1") && (mSimple[headers[productOnlineIdx]] !== '2' && mSimple[headers[productOnlineIdx]]?.toLowerCase() !== 'disabled'),
      option1Name: 'Title',
      option1Value: 'Default Title',
      variantSku: sku,
      variantPrice: priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(mSimple[headers[priceIdx]]) : 0,
      variantInventoryQty: qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0,
      variantTaxable: taxClassIdx !== -1 ? !(mSimple[headers[taxClassIdx]]?.toLowerCase().includes('none') || mSimple[headers[taxClassIdx]]?.toLowerCase() === '0') : true,
      variantWeight: weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(mSimple[headers[weightIdx]]) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
      seoTitle: mSimple[headers[metaTitleIdx]] || simpleName,
      seoDescription: mSimple[headers[metaDescriptionIdx]] || mSimple[headers[shortDescriptionIdx]] || '',
      magentoProductType: 'simple',
      isVariantRow: false,
    };
    shopifyProducts.push(simpleProductData);
  }


  if (shopifyProducts.length > 0) {
    return { type: 'products_found', data: shopifyProducts, message: `${shopifyProducts.length} product entries (including variants) loaded. Review and edit.` };
  } else {
    return { type: 'no_products_extracted', message: 'No products or variants could be extracted. Check CSV format and content.' };
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

  const csvData = products.map(p => {
    // For variant rows (isVariantRow is true), certain fields should be blank as per Shopify spec
    const title = p.isVariantRow ? '' : p.title;
    const bodyHtml = p.isVariantRow ? '' : p.bodyHtml;
    const vendor = p.isVariantRow ? '' : p.vendor;
    const productType = p.isVariantRow ? '' : p.productType; // Shopify 'Type' column
    const tags = p.isVariantRow ? '' : p.tags;
    // Published can be set per variant in some Shopify setups, but often it's on main product.
    // For CSV, it's often just on the main product line, or True/False for each line.
    // The 'Status' column (active/draft/archived) is often preferred for overall product visibility.
    // The 'Published' column in Shopify's CSV is a True/False for web visibility.
    // Let's assume 'Published' applies to the line item.
    const publishedStatus = p.published ? 'TRUE' : 'FALSE';
    const shopifyStatus = p.published ? 'active' : 'draft';


    return [
        p.handle,
        title,
        bodyHtml,
        vendor,
        '', // Product Category - Shopify has its own taxonomy, usually set in Admin
        productType,
        tags,
        publishedStatus,
        p.option1Name,
        p.option1Value,
        p.option2Name,
        p.option2Value,
        p.option3Name,
        p.option3Value,
        p.variantSku,
        String(p.variantWeight ?? 0), // Variant Grams
        p.variantInventoryQty && p.variantInventoryQty > 0 ? 'shopify' : '', // Variant Inventory Tracker
        String(p.variantInventoryQty ?? 0), // Variant Inventory Qty
        'deny', // Variant Inventory Policy
        'manual', // Variant Fulfillment Service
        String(p.variantPrice ?? 0), // Variant Price
        p.variantCompareAtPrice ? String(p.variantCompareAtPrice) : '', // Variant Compare At Price
        p.variantRequiresShipping ? 'TRUE' : 'FALSE', // Variant Requires Shipping
        p.variantTaxable ? 'TRUE' : 'FALSE', // Variant Taxable
        '', // Variant Barcode
        p.imageSrc, // Image Src (for the main product or this specific variant)
        p.isVariantRow ? '' : String(p.imagePosition ?? 1), // Image Position (usually for main product image)
        p.imageAltText || p.title, // Image Alt Text
        'FALSE', // Gift Card
        p.isVariantRow ? '' : (p.seoTitle || p.title), // SEO Title
        p.isVariantRow ? '' : p.seoDescription, // SEO Description
        '', '', '', '', '', '', '', '', '', '', '', '', '', // Google Shopping fields
        p.imageSrc, // Variant Image (can be same as main or different)
        p.variantWeightUnit || 'g', // Variant Weight Unit
        '', // Variant Tax Code
        '', // Cost per item
        '', // Price / International
        '', // Compare At Price / International
        shopifyStatus // Status (active or draft)
    ];
  });

  return arrayToCsv(shopifyHeaders, csvData);
};

