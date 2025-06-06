
import type { ShopifyProductFormData } from '@/schemas/product';

export type ParseProductResult =
  | { type: 'products_found'; data: Partial<ShopifyProductFormData>[]; message: string; rawRecordCount: number; shopifyEntryCount: number; }
  | { type: 'no_products_extracted'; message: string; rawRecordCount: number; }
  | { type: 'parse_error'; message: string; rawRecordCount: number; };


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

  if (!baseUrl || baseUrl.trim() === '') {
    console.warn(`[buildFullImageUrl] Condition 3: Base URL is not provided or is empty for relative imagePath: "${imagePath}". Shopify might not be able to import this image. Returning original relative imagePath as fallback.`);
    return imagePath;
  }

  console.log('[buildFullImageUrl] Proceeding to construct full URL with provided baseUrl.');
  const trimmedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  const finalUrl = `${trimmedBaseUrl}/${trimmedImagePath}`;
  console.log(`[buildFullImageUrl] CONSTRUCTED URL: "${finalUrl}" (from baseUrl: "${trimmedBaseUrl}" and imagePath: "${trimmedImagePath}")`);
  return finalUrl;
};


export const parseMagentoProductCsv = (csvString: string, magentoBaseImageUrl?: string): ParseProductResult => {
  const trimmedCsvString = csvString.trim();
  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.', rawRecordCount: 0 };

  const allLines = trimmedCsvString.split(/\r?\n/);
  if (allLines.length === 0) return { type: 'parse_error', message: 'The CSV file has no lines.', rawRecordCount: 0 };
  
  const headerLine = allLines[0];
  const dataLines = allLines.slice(1);
  const rawRecordCount = dataLines.filter(line => line.trim() !== '').length;

  if (allLines.length < 2) return { type: 'parse_error', message: 'The CSV file must contain a header row and at least one data row.', rawRecordCount: 0 };

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
  const qtyIdx = findHeaderIndex(['qty', 'quantity']);
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
    return { type: 'parse_error', message: 'CSV must contain "sku" column for product import.', rawRecordCount };
  }

  const magentoSimpleProducts = new Map<string, Record<string, string>>();
  const magentoConfigurableProducts: Record<string, string>[] = [];

  for (const line of dataLines) {
    if (line.trim() === '') continue;
    const values = parseCsvLine(line, delimiter);
    if (values.length !== headers.length) {
        console.warn(`Column count mismatch in Magento CSV. Expected ${headers.length}, got ${values.length}. Line: "${line}"`);
        continue;
    }

    const rowData: Record<string, string> = {};
    headers.forEach((header, i) => rowData[header] = values[i]);

    const type = productTypeIdx !== -1 ? rowData[headers[productTypeIdx]]?.toLowerCase() : 'simple';
    if (type === 'simple') {
      magentoSimpleProducts.set(rowData[headers[skuIdx]], rowData);
    } else if (type === 'configurable') {
      magentoConfigurableProducts.push(rowData);
    }
  }

  const shopifyProducts: Partial<ShopifyProductFormData>[] = [];

  for (const mConfig of magentoConfigurableProducts) {
    const configSku = mConfig[headers[skuIdx]];
    const configName = mConfig[headers[nameIdx]] || configSku;
    
    let option1NameFromLabel = 'Option'; 
    if (configurableVariationLabelsIdx !== -1 && mConfig[headers[configurableVariationLabelsIdx]]) {
        const labelParts = mConfig[headers[configurableVariationLabelsIdx]].split('=');
        if (labelParts.length > 0 && labelParts[0].trim()) {
            option1NameFromLabel = labelParts[0].trim();
        }
    }

    const mainProductData: Partial<ShopifyProductFormData> = {
      id: crypto.randomUUID(),
      handle: configSku,
      title: configName,
      bodyHtml: mConfig[headers[descriptionIdx]] || mConfig[headers[shortDescriptionIdx]] || '',
      vendor: attributeSetCodeIdx !== -1 ? mConfig[headers[attributeSetCodeIdx]]?.split(' ')[0] || '' : '',
      productType: attributeSetCodeIdx !== -1 ? mConfig[headers[attributeSetCodeIdx]] || '' : '',
      tags: categoriesIdx !== -1 ? extractTagsFromCategories(mConfig[headers[categoriesIdx]]) : '',
      published: (visibilityIdx !== -1 ? !(mConfig[headers[visibilityIdx]]?.toLowerCase().includes("not visible")) : true) &&
                 (productOnlineIdx !== -1 ? (String(mConfig[headers[productOnlineIdx]]) !== '2' && mConfig[headers[productOnlineIdx]]?.toLowerCase() !== 'disabled') : true),
      variantPrice: priceIdx !== -1 && mConfig[headers[priceIdx]] ? parseFloat(mConfig[headers[priceIdx]]) : 0,
      variantInventoryQty: 0, 
      variantTaxable: taxClassIdx !== -1 ? !(mConfig[headers[taxClassIdx]]?.toLowerCase().includes('none') || String(mConfig[headers[taxClassIdx]]) === '0') : true,
      variantWeight: weightIdx !== -1 && mConfig[headers[weightIdx]] ? parseFloat(mConfig[headers[weightIdx]]) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mConfig[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
      imagePosition: 1,
      seoTitle: metaTitleIdx !== -1 ? mConfig[headers[metaTitleIdx]] || configName : configName,
      seoDescription: metaDescriptionIdx !== -1 ? mConfig[headers[metaDescriptionIdx]] || mConfig[headers[shortDescriptionIdx]] || '' : mConfig[headers[shortDescriptionIdx]] || '',
      magentoProductType: 'configurable',
      isVariantRow: false,
      option1Name: option1NameFromLabel,
    };
    
    const variationsStr = configurableVariationsIdx !== -1 ? mConfig[headers[configurableVariationsIdx]] : '';
    let firstVariantProcessed = false;
    let imagePositionCounter = 1; // For configurable product and its variants

    if (variationsStr) {
      const variations = variationsStr.split('|');
      for (const variation of variations) {
        const attributes = variation.split(',');
        let simpleSku: string | undefined;
        let optionValue: string | undefined;
        
        const optionKeyFromConfigLabel = option1NameFromLabel;

        attributes.forEach(attr => {
          const [key, value] = attr.split('=');
          if (key && value) { 
            if (key.trim().toLowerCase() === 'sku') simpleSku = value.trim();
            if (key.trim() === optionKeyFromConfigLabel) optionValue = value.trim();
          }
        });
        
        if (simpleSku && optionValue) {
          const mSimple = magentoSimpleProducts.get(simpleSku);
          if (mSimple) {
            const variantPublishedStatus = (visibilityIdx !== -1 ? !(mSimple[headers[visibilityIdx]]?.toLowerCase().includes("not visible")) : true) &&
                               (productOnlineIdx !== -1 ? (String(mSimple[headers[productOnlineIdx]]) !== '2' && mSimple[headers[productOnlineIdx]]?.toLowerCase() !== 'disabled') : true);

            if (!firstVariantProcessed) {
                mainProductData.option1Value = optionValue; 
                mainProductData.variantPrice = priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(mSimple[headers[priceIdx]]) : (mainProductData.variantPrice || 0);
                mainProductData.variantSku = simpleSku; 
                mainProductData.variantInventoryQty = qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0;
                mainProductData.variantWeight = weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(mSimple[headers[weightIdx]]) : (mainProductData.variantWeight || 0);
                mainProductData.imageSrc = buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl) || mainProductData.imageSrc;
                mainProductData.imagePosition = imagePositionCounter++;
                mainProductData.published = variantPublishedStatus; // Configurable takes status from first variant for main row
                firstVariantProcessed = true;
                shopifyProducts.push(mainProductData); 
            } else { // This is for subsequent variant rows
                 const variantProductData: Partial<ShopifyProductFormData> = {
                    id: crypto.randomUUID(),
                    handle: configSku,
                    title: '', 
                    bodyHtml: '',
                    vendor: '',
                    productType: '',
                    tags: '',
                    published: variantPublishedStatus,
                    option1Name: option1NameFromLabel,
                    option1Value: optionValue,
                    variantSku: simpleSku,
                    variantPrice: priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(mSimple[headers[priceIdx]]) : 0,
                    variantInventoryQty: qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0,
                    variantTaxable: taxClassIdx !== -1 ? !(mSimple[headers[taxClassIdx]]?.toLowerCase().includes('none') || String(mSimple[headers[taxClassIdx]]) === '0') : true,
                    variantWeight: weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(mSimple[headers[weightIdx]]) : 0,
                    imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
                    imagePosition: imagePositionCounter++, 
                    seoTitle: '',
                    seoDescription: '',
                    magentoProductType: 'simple_variant', 
                    isVariantRow: true,
                };
                shopifyProducts.push(variantProductData);
            }
            magentoSimpleProducts.delete(simpleSku); 
          }
        }
      }
    }
    if (!firstVariantProcessed && shopifyProducts.find(p => p.handle === configSku) === undefined) { // If no variants were found/processed, add the main config as a simple product
        mainProductData.option1Name = mainProductData.option1Name || 'Title';
        mainProductData.option1Value = 'Default Title';
        mainProductData.variantSku = configSku; 
        mainProductData.imagePosition = 1;
        shopifyProducts.push(mainProductData);
    }
  }

  for (const [sku, mSimple] of magentoSimpleProducts.entries()) {
    const simpleName = mSimple[headers[nameIdx]] || sku;
    const simpleProductData: Partial<ShopifyProductFormData> = {
      id: crypto.randomUUID(),
      handle: sku,
      title: simpleName,
      bodyHtml: mSimple[headers[descriptionIdx]] || mSimple[headers[shortDescriptionIdx]] || '',
      vendor: attributeSetCodeIdx !== -1 ? mSimple[headers[attributeSetCodeIdx]]?.split(' ')[0] || '' : '',
      productType: attributeSetCodeIdx !== -1 ? mSimple[headers[attributeSetCodeIdx]] || '' : '',
      tags: categoriesIdx !== -1 ? extractTagsFromCategories(mSimple[headers[categoriesIdx]]) : '',
      published: (visibilityIdx !== -1 ? !(mSimple[headers[visibilityIdx]]?.toLowerCase().includes("not visible")) : true) &&
                 (productOnlineIdx !== -1 ? (String(mSimple[headers[productOnlineIdx]]) !== '2' && mSimple[headers[productOnlineIdx]]?.toLowerCase() !== 'disabled') : true),
      option1Name: 'Title',
      option1Value: 'Default Title',
      variantSku: sku,
      variantPrice: priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(mSimple[headers[priceIdx]]) : 0,
      variantInventoryQty: qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0,
      variantTaxable: taxClassIdx !== -1 ? !(mSimple[headers[taxClassIdx]]?.toLowerCase().includes('none') || String(mSimple[headers[taxClassIdx]]) === '0') : true,
      variantWeight: weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(mSimple[headers[weightIdx]]) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
      imagePosition: 1,
      seoTitle: metaTitleIdx !== -1 ? mSimple[headers[metaTitleIdx]] || simpleName : simpleName,
      seoDescription: metaDescriptionIdx !== -1 ? mSimple[headers[metaDescriptionIdx]] || mSimple[headers[shortDescriptionIdx]] || '' : mSimple[headers[shortDescriptionIdx]] || '',
      magentoProductType: 'simple',
      isVariantRow: false,
    };
    shopifyProducts.push(simpleProductData);
  }


  if (shopifyProducts.length > 0) {
    return { 
        type: 'products_found', 
        data: shopifyProducts, 
        message: `${rawRecordCount} Magento records processed, ${shopifyProducts.length} Shopify entries generated.`,
        rawRecordCount: rawRecordCount,
        shopifyEntryCount: shopifyProducts.length 
    };
  } else {
    return { type: 'no_products_extracted', message: 'No products or variants could be extracted. Check CSV format and content.', rawRecordCount };
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
    const title = p.isVariantRow ? '' : p.title;
    const bodyHtml = p.isVariantRow ? '' : p.bodyHtml;
    const vendor = p.isVariantRow ? '' : p.vendor;
    const productTypeVal = p.isVariantRow ? '' : p.productType; // Renamed to avoid conflict
    const tags = p.isVariantRow ? '' : p.tags;
    const publishedStatus = p.published ? 'TRUE' : 'FALSE';
    const shopifyStatus = p.published ? 'active' : 'draft';


    return [
        p.handle,
        title,
        bodyHtml,
        vendor,
        '', 
        productTypeVal,
        tags,
        publishedStatus, 
        p.option1Name,
        p.option1Value,
        p.option2Name || '',
        p.option2Value || '',
        p.option3Name || '',
        p.option3Value || '',
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
        p.isVariantRow ? '' : (p.imageAltText || p.title), 
        'FALSE', 
        p.isVariantRow ? '' : (p.seoTitle || p.title), 
        p.isVariantRow ? '' : p.seoDescription, 
        '', '', '', '', '', '', '', '', '', '', '', '', '', 
        p.isVariantRow ? p.imageSrc : '', 
        p.variantWeightUnit || 'g', 
        '', 
        '', 
        '', 
        '', 
        shopifyStatus 
    ];
  });

  return arrayToCsv(shopifyHeaders, csvData);
};

