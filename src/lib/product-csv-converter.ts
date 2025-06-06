
import type { ShopifyProductFormData } from '@/schemas/product';

export type ParseProductResult =
  | {
      type: 'products_found';
      data: Partial<ShopifyProductFormData>[];
      message: string;
      processedNonEmptyLines: number;
      linesSkippedNoSku: number;
      linesSkippedColumnCountMismatch: number;
      simpleProductsCollected: number;
      configurableProductsCollected: number;
      otherProductTypesSkipped: number;
      variantsProcessedForConfigurables: number;
      variantSkusNotFoundInSimples: number;
      standaloneSimplesProcessed: number;
      shopifyEntryCount: number;
    }
  | {
      type: 'no_products_extracted';
      message: string;
      processedNonEmptyLines: number;
      linesSkippedNoSku: number;
      linesSkippedColumnCountMismatch: number;
      simpleProductsCollected: number;
      configurableProductsCollected: number;
      otherProductTypesSkipped: number;
    }
  | {
      type: 'parse_error';
      message: string;
      processedNonEmptyLines: number;
    };


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
  // Do not trim leading/trailing quotes here, as Shopify CSV might need them
  // Example: "This is a ""quoted"" field"
  // return result.map(field => field.trim().replace(/^"|"$/g, ''));
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

  const trimmedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedImagePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  const finalUrl = `${trimmedBaseUrl}/${trimmedImagePath}`;
  console.log(`[buildFullImageUrl] CONSTRUCTED URL: "${finalUrl}" (from baseUrl: "${trimmedBaseUrl}" and imagePath: "${trimmedImagePath}")`);
  return finalUrl;
};


export const parseMagentoProductCsv = (csvString: string, magentoBaseImageUrl?: string): ParseProductResult => {
  const trimmedCsvString = csvString.trim();
  let processedNonEmptyLines = 0;
  let linesSkippedNoSku = 0;
  let linesSkippedColumnCountMismatch = 0;
  let simpleProductsCollected = 0;
  let configurableProductsCollected = 0;
  let otherProductTypesSkipped = 0;
  let variantsProcessedForConfigurables = 0;
  let variantSkusNotFoundInSimples = 0;
  let standaloneSimplesProcessed = 0;
  const notFoundVariantSkusList: {configurableSku: string, missingSimpleSku: string}[] = [];


  if (!trimmedCsvString) return { type: 'parse_error', message: 'The CSV file is empty.', processedNonEmptyLines: 0 };

  const allLines = trimmedCsvString.split(/\r?\n/);
  if (allLines.length === 0) return { type: 'parse_error', message: 'The CSV file has no lines.', processedNonEmptyLines: 0 };

  const headerLine = allLines[0];
  const dataLines = allLines.slice(1);

  if (allLines.length < 2) return { type: 'parse_error', message: 'The CSV file must contain a header row and at least one data row.', processedNonEmptyLines: 0 };

  const delimiter = detectDelimiter(headerLine);

  const rawHeaders = parseCsvLine(headerLine, delimiter);
  const headers = rawHeaders.map((h, idx) => {
    let cleanH = h.toLowerCase().trim();
    if (idx === 0) cleanH = cleanH.replace(/^\ufeff/, '');
    // Do not remove quotes from headers themselves, as they might be part of the name
    // if (cleanH.startsWith('"') && cleanH.endsWith('"')) {
    //     cleanH = cleanH.substring(1, cleanH.length - 1);
    // }
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
    return { type: 'parse_error', message: 'CSV must contain "sku" column for product import.', processedNonEmptyLines };
  }

  const magentoSimpleProducts = new Map<string, Record<string, string>>();
  const magentoConfigurableProducts: Record<string, string>[] = [];

  for (const line of dataLines) {
    processedNonEmptyLines++; // Count before checking if it's blank
    if (line.trim() === '') continue;

    const values = parseCsvLine(line, delimiter);
    if (values.length !== headers.length) {
        console.warn(`Column count mismatch on data line ${processedNonEmptyLines}. Expected ${headers.length} columns, got ${values.length}. This line's data will be skipped. Line content: "${line}"`);
        linesSkippedColumnCountMismatch++;
        continue;
    }

    const rowData: Record<string, string> = {};
    headers.forEach((header, i) => rowData[header] = values[i]);

    const currentSku = rowData[headers[skuIdx]];
    if (!currentSku || currentSku.trim() === '') {
      linesSkippedNoSku++;
      continue;
    }

    const type = productTypeIdx !== -1 ? rowData[headers[productTypeIdx]]?.toLowerCase() : 'simple';
    if (type === 'simple') {
      magentoSimpleProducts.set(currentSku, rowData);
      simpleProductsCollected++;
    } else if (type === 'configurable') {
      magentoConfigurableProducts.push(rowData);
      configurableProductsCollected++;
    } else {
      console.log(`Skipping product with SKU '${currentSku}' due to unhandled type: '${type}'`);
      otherProductTypesSkipped++;
    }
  }

  const shopifyProducts: Partial<ShopifyProductFormData>[] = [];
  let imagePositionGlobalCounter = 1;

  for (const mConfig of magentoConfigurableProducts) {
    imagePositionGlobalCounter = 1; // Reset for each configurable product's set of images
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
                 (productOnlineIdx !== -1 ? (String(mConfig[headers[productOnlineIdx]]) !== '2' && String(mConfig[headers[productOnlineIdx]])?.toLowerCase() !== 'disabled') : true),
      variantPrice: priceIdx !== -1 && mConfig[headers[priceIdx]] ? parseFloat(String(mConfig[headers[priceIdx]]).replace(',','.')) : 0,
      variantInventoryQty: 0, // Default, will be overridden by first variant if found
      variantTaxable: taxClassIdx !== -1 ? !(mConfig[headers[taxClassIdx]]?.toLowerCase().includes('none') || String(mConfig[headers[taxClassIdx]]) === '0') : true,
      variantWeight: weightIdx !== -1 && mConfig[headers[weightIdx]] ? parseFloat(String(mConfig[headers[weightIdx]]).replace(',','.')) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mConfig[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
      imagePosition: imagePositionGlobalCounter++,
      seoTitle: metaTitleIdx !== -1 ? mConfig[headers[metaTitleIdx]] || configName : configName,
      seoDescription: metaDescriptionIdx !== -1 ? mConfig[headers[metaDescriptionIdx]] || mConfig[headers[shortDescriptionIdx]] || '' : mConfig[headers[shortDescriptionIdx]] || '',
      magentoProductType: 'configurable',
      isVariantRow: false,
      option1Name: option1NameFromLabel,
    };

    const variationsStr = configurableVariationsIdx !== -1 ? mConfig[headers[configurableVariationsIdx]] : '';
    let firstVariantProcessedForThisConfigurable = false;

    if (variationsStr) {
      const variations = variationsStr.split('|');
      for (const variation of variations) {
        const attributes = variation.split(',');
        let simpleSku: string | undefined;
        let optionValue: string | undefined;

        const optionKeyFromConfigLabel = option1NameFromLabel; // Use the derived option name

        attributes.forEach(attr => {
          const [key, value] = attr.split('=');
          if (key && value) {
            if (key.trim().toLowerCase() === 'sku') simpleSku = value.trim();
            // Match the key from configurable_variation_labels to get the value
            if (key.trim() === optionKeyFromConfigLabel) optionValue = value.trim();
          }
        });

        if (simpleSku) {
          const mSimple = magentoSimpleProducts.get(simpleSku);
          if (mSimple) {
            variantsProcessedForConfigurables++;
            const variantPublishedStatus = (visibilityIdx !== -1 ? !(mSimple[headers[visibilityIdx]]?.toLowerCase().includes("not visible")) : true) &&
                               (productOnlineIdx !== -1 ? (String(mSimple[headers[productOnlineIdx]]) !== '2' && String(mSimple[headers[productOnlineIdx]])?.toLowerCase() !== 'disabled') : true);

            if (!firstVariantProcessedForThisConfigurable) {
                // This is the first variant, its data populates the main product's first variant row
                mainProductData.option1Value = optionValue || 'Default';
                mainProductData.variantPrice = priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(String(mSimple[headers[priceIdx]]).replace(',','.')) : (mainProductData.variantPrice || 0);
                mainProductData.variantSku = simpleSku;
                mainProductData.variantInventoryQty = qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0;
                mainProductData.variantWeight = weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(String(mSimple[headers[weightIdx]]).replace(',','.')) : (mainProductData.variantWeight || 0);
                // Use simple's image if available, otherwise keep configurable's image
                mainProductData.imageSrc = buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl) || mainProductData.imageSrc;
                mainProductData.imagePosition = 1; // First variant image is position 1 for the handle
                mainProductData.published = variantPublishedStatus; // Shopify uses variant's published status for the line

                shopifyProducts.push({...mainProductData}); // Add the main product row (which is also the first variant)
                firstVariantProcessedForThisConfigurable = true;
                imagePositionGlobalCounter = 2; // Next image for this handle will be position 2
            } else {
                 // Subsequent variants get their own rows
                 const variantProductData: Partial<ShopifyProductFormData> = {
                    id: crypto.randomUUID(),
                    handle: configSku, // Same handle
                    title: '', // Blank for subsequent variants
                    bodyHtml: '',
                    vendor: '',
                    productType: '',
                    tags: '',
                    published: variantPublishedStatus, // Shopify uses variant's published status for the line
                    option1Name: option1NameFromLabel,
                    option1Value: optionValue || 'Default',
                    // option2Name, option2Value, etc. would go here if used
                    variantSku: simpleSku,
                    variantPrice: priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(String(mSimple[headers[priceIdx]]).replace(',','.')) : 0,
                    variantInventoryQty: qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0,
                    variantTaxable: taxClassIdx !== -1 ? !(mSimple[headers[taxClassIdx]]?.toLowerCase().includes('none') || String(mSimple[headers[taxClassIdx]]) === '0') : true,
                    variantWeight: weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(String(mSimple[headers[weightIdx]]).replace(',','.')) : 0,
                    imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
                    imagePosition: imagePositionGlobalCounter++,
                    seoTitle: '', // Blank for variants
                    seoDescription: '',
                    magentoProductType: 'simple_variant', // Internal type
                    isVariantRow: true, // Mark as a variant row
                };
                shopifyProducts.push(variantProductData);
            }
            magentoSimpleProducts.delete(simpleSku); // Remove simple from map as it's processed
          } else {
             if(simpleSku) {
                variantSkusNotFoundInSimples++;
                notFoundVariantSkusList.push({ configurableSku: configSku, missingSimpleSku: simpleSku });
             }
             // console.warn(`Configurable variation for "${configSku}" references SKU "${simpleSku}" but it was not found among simple products.`);
          }
        } else {
            // console.warn(`Could not parse simple SKU from variation string: "${variation}" for configurable "${configSku}"`);
        }
      }
    }
    // If no variants were processed for this configurable (e.g. empty configurable_variations or all simple SKUs missing)
    // ensure the main product row is still added (it might have been pushed already if firstVariantProcessed became true)
    if (!firstVariantProcessedForThisConfigurable) {
        mainProductData.option1Name = mainProductData.option1Name || 'Title';
        mainProductData.option1Value = mainProductData.option1Value || 'Default Title'; // Shopify needs a default option
        mainProductData.variantSku = configSku; // Use configurable SKU if no variants
        mainProductData.imagePosition = 1;
        shopifyProducts.push(mainProductData);
    }
  }

  // Process remaining simple products (those not used as variants)
  for (const [sku, mSimple] of magentoSimpleProducts.entries()) {
    standaloneSimplesProcessed++;
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
                 (productOnlineIdx !== -1 ? (String(mSimple[headers[productOnlineIdx]]) !== '2' && String(mSimple[headers[productOnlineIdx]])?.toLowerCase() !== 'disabled') : true),
      option1Name: 'Title', // Shopify default for single-variant products
      option1Value: 'Default Title',
      variantSku: sku,
      variantPrice: priceIdx !== -1 && mSimple[headers[priceIdx]] ? parseFloat(String(mSimple[headers[priceIdx]]).replace(',','.')) : 0,
      variantInventoryQty: qtyIdx !== -1 && mSimple[headers[qtyIdx]] ? parseInt(mSimple[headers[qtyIdx]], 10) : 0,
      variantTaxable: taxClassIdx !== -1 ? !(mSimple[headers[taxClassIdx]]?.toLowerCase().includes('none') || String(mSimple[headers[taxClassIdx]]) === '0') : true,
      variantWeight: weightIdx !== -1 && mSimple[headers[weightIdx]] ? parseFloat(String(mSimple[headers[weightIdx]]).replace(',','.')) : 0,
      imageSrc: buildFullImageUrl(baseImageIdx !== -1 ? mSimple[headers[baseImageIdx]] : undefined, magentoBaseImageUrl),
      imagePosition: 1, // Always 1 for standalone products
      seoTitle: metaTitleIdx !== -1 ? mSimple[headers[metaTitleIdx]] || simpleName : simpleName,
      seoDescription: metaDescriptionIdx !== -1 ? mSimple[headers[metaDescriptionIdx]] || mSimple[headers[shortDescriptionIdx]] || '' : mSimple[headers[shortDescriptionIdx]] || '',
      magentoProductType: 'simple',
      isVariantRow: false,
    };
    shopifyProducts.push(simpleProductData);
  }

  if (notFoundVariantSkusList.length > 0) {
    console.warn("Missing simple product SKUs referenced in configurable_variations:", notFoundVariantSkusList);
  }
  if (otherProductTypesSkipped > 0) {
    console.warn(`${otherProductTypesSkipped} products were skipped because their type was not 'simple' or 'configurable'.`);
  }


  console.log("Product Parsing Stats:", {
    processedNonEmptyLines,
    linesSkippedNoSku,
    linesSkippedColumnCountMismatch,
    simpleProductsCollected,
    configurableProductsCollected,
    otherProductTypesSkipped,
    variantsProcessedForConfigurables,
    variantSkusNotFoundInSimples,
    standaloneSimplesProcessed,
    shopifyEntryCount: shopifyProducts.length
  });

  if (shopifyProducts.length > 0) {
    return {
        type: 'products_found',
        data: shopifyProducts,
        message: `Magento: ${processedNonEmptyLines} lines. Shopify: ${shopifyProducts.length} entries.`,
        processedNonEmptyLines,
        linesSkippedNoSku,
        linesSkippedColumnCountMismatch,
        simpleProductsCollected,
        configurableProductsCollected,
        otherProductTypesSkipped,
        variantsProcessedForConfigurables,
        variantSkusNotFoundInSimples,
        standaloneSimplesProcessed,
        shopifyEntryCount: shopifyProducts.length
    };
  } else {
    return {
        type: 'no_products_extracted',
        message: 'No products or variants could be extracted. Check CSV format and content.',
        processedNonEmptyLines,
        linesSkippedNoSku,
        linesSkippedColumnCountMismatch,
        simpleProductsCollected,
        configurableProductsCollected,
        otherProductTypesSkipped,
    };
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
    const isParentRow = !p.isVariantRow || (p.imagePosition === 1 && p.magentoProductType !== 'simple_variant');
    // For configurable products, the first row IS the parent product AND the first variant.
    // For standalone simple products, it's just the parent.
    // For subsequent variant rows (isVariantRow = true), most parent fields are blank.

    const title = isParentRow ? p.title : '';
    const bodyHtml = isParentRow ? p.bodyHtml : '';
    const vendor = isParentRow ? p.vendor : '';
    const productTypeVal = isParentRow ? p.productType : '';
    const tags = isParentRow ? p.tags : '';
    // 'Published' column in Shopify CSV refers to the product's visibility on the storefront.
    // It's typically TRUE for the first row of a product (parent) if the product is meant to be live.
    // For subsequent variant rows, this field is often ignored by Shopify during import for the product's overall status,
    // but it can control individual variant visibility in some contexts or future Shopify versions.
    // The 'Status' column ('active', 'archived', 'draft') is the main indicator for product status.
    const publishedStatus = p.published ? 'TRUE' : 'FALSE'; // For the "Published" column
    const shopifyStatus = p.published ? 'active' : 'draft'; // For the "Status" column at the end

    const imageSrcForShopify = p.imageSrc;
    const imageAltTextForShopify = isParentRow ? (p.imageAltText || p.title) : (p.imageAltText || p.option1Value || p.title);


    return [
        p.handle,
        title,
        bodyHtml,
        vendor,
        '', // Product Category - usually set in Shopify admin
        productTypeVal,
        tags,
        publishedStatus, // Published column
        p.option1Name,
        p.option1Value,
        p.option2Name || '',
        p.option2Value || '',
        p.option3Name || '',
        p.option3Value || '',
        p.variantSku,
        // Shopify expects grams. Ensure conversion if Magento stores in other units and p.variantWeightUnit reflects that.
        String(p.variantWeight ?? 0).replace('.',','), // Use comma for decimal in CSV for some locales
        p.variantInventoryQty && p.variantInventoryQty > 0 ? 'shopify' : '', // Variant Inventory Tracker
        String(p.variantInventoryQty ?? 0), // Variant Inventory Qty
        'deny', // Variant Inventory Policy (deny or continue)
        'manual', // Variant Fulfillment Service
        String(p.variantPrice ?? 0).replace('.',','), // Variant Price
        p.variantCompareAtPrice ? String(p.variantCompareAtPrice).replace('.',',') : '', // Variant Compare At Price
        p.variantRequiresShipping ? 'TRUE' : 'FALSE', // Variant Requires Shipping
        p.variantTaxable ? 'TRUE' : 'FALSE', // Variant Taxable
        '', // Variant Barcode
        imageSrcForShopify, // Image Src (main image for parent, can be variant image for variant rows)
        String(p.imagePosition ?? 1), // Image Position
        imageAltTextForShopify, // Image Alt Text
        'FALSE', // Gift Card
        isParentRow ? (p.seoTitle || p.title) : '', // SEO Title
        isParentRow ? p.seoDescription : '', // SEO Description
        '', '', '', '', '', '', '', '', '', '', '', '', '', // Google Shopping fields
        p.isVariantRow ? imageSrcForShopify : '', // Variant Image (Shopify uses this to assign specific images to variants if Image Src on this row differs from parent's first image)
        p.variantWeightUnit || 'g', // Variant Weight Unit
        '', // Variant Tax Code
        '', // Cost per item
        '', // Price / International
        '', // Compare At Price / International
        shopifyStatus // Status column (active, draft, archived)
    ];
  });

  return arrayToCsv(shopifyHeaders, csvData);
};
