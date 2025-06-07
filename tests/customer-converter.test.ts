import { generateShopifyCustomerCsv } from '../src/lib/customer-csv-converter';
import type { ShopifyCustomerFormData } from '../src/schemas/customer';

describe('generateShopifyCustomerCsv', () => {
  it('creates CSV with expected headers and values', () => {
    const data: ShopifyCustomerFormData[] = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        company: '',
        address1: 'Street 1',
        address2: '',
        city: 'Amsterdam',
        province: '',
        provinceCode: '',
        country: 'Netherlands',
        countryCode: 'NL',
        zip: '1000AA',
        phone: '+31612345678',
        acceptsMarketing: false,
        acceptsSmsMarketing: false,
        tags: '',
        note: '',
        taxExempt: false
      }
    ];
    const csv = generateShopifyCustomerCsv(data);
    expect(csv.split('\n')[0]).toContain('First Name');
    expect(csv).toContain('John');
    expect(csv).toContain('Doe');
    expect(csv).toContain('john@example.com');
  });
});
