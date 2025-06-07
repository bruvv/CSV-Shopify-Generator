import { parseMagentoProductCsv } from '../src/lib/product-csv-converter';

describe('parseMagentoProductCsv', () => {
  it('parses simple CSV with sku and name', () => {
    const csv = 'sku,name\nSKU1,Test Product';
    const result = parseMagentoProductCsv(csv);
    if (result.type !== 'products_found') {
      throw new Error('Expected products_found');
    }
    expect(result.data[0]).toHaveProperty('handle', 'SKU1');
  });

  it('returns no products for empty CSV', () => {
    const csv = '';
    const result = parseMagentoProductCsv(csv);
    expect(result.type).toBe('no_products_extracted');
  });

  it('handles CSV with only headers', () => {
    const csv = 'sku,name';
    const result = parseMagentoProductCsv(csv);
    expect(result.type).toBe('no_products_extracted');
  });

  it('parses CSV with special characters in fields', () => {
    const csv = 'sku,name\nSKU2,"Test, Product with, commas"';
    const result = parseMagentoProductCsv(csv);
    if (result.type !== 'products_found') {
      throw new Error('Expected products_found');
    }
    expect(result.data[0]).toHaveProperty('handle', 'SKU2');
    expect(result.data[0]).toHaveProperty('title', 'Test, Product with, commas');
  });

  it('parses multiple products', () => {
    const csv = 'sku,name\nSKU1,Product 1\nSKU2,Product 2';
    const result = parseMagentoProductCsv(csv);
    if (result.type !== 'products_found') {
      throw new Error('Expected products_found');
    }
    expect(result.data.length).toBe(2);
    expect(result.data[1]).toHaveProperty('handle', 'SKU2');
  });
});
