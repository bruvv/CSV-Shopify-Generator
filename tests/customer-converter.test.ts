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

  it('returns only headers when given an empty array', () => {
    const csv = generateShopifyCustomerCsv([]);
    expect(csv.split('\n').length).toBe(1); // header only
    expect(csv).toContain('First Name');
  });

  it('handles special characters in fields', () => {
    const data: ShopifyCustomerFormData[] = [
      {
        id: '2',
        firstName: 'Jane, "JJ"',
        lastName: 'O\'Connor',
        email: 'jane@example.com',
        company: 'ACME, Inc.',
        address1: 'Street 2',
        address2: 'Apt. 4\nSecond Floor',
        city: 'Rotterdam',
        province: '',
        provinceCode: '',
        country: 'Netherlands',
        countryCode: 'NL',
        zip: '2000BB',
        phone: '',
        acceptsMarketing: true,
        acceptsSmsMarketing: false,
        tags: 'vip,important',
        note: 'Special, needs follow-up',
        taxExempt: true
      }
    ];
    const csv = generateShopifyCustomerCsv(data);
    expect(csv).toContain('"Jane, ""JJ"""'); // CSV-escaped
    expect(csv).toContain("O'Connor");
    expect(csv).toContain('ACME, Inc.');
    expect(csv).toContain('Apt. 4');
    expect(csv).toContain('Special, needs follow-up');
  });

  it('outputs the exact expected header row', () => {
    const csv = generateShopifyCustomerCsv([]);
    const header = csv.split('\n')[0];
    expect(header).toBe(
      'First Name,Last Name,Email,Accepts Email Marketing,Default Address Company,Default Address Address1,Default Address Address2,Default Address City,Default Address Province Code,Default Address Country Code,Default Address Zip,Default Address Phone,Phone,Accepts SMS Marketing,Tags,Note,Tax Exempt'
    );
  });
});
