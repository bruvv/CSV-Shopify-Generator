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
});
