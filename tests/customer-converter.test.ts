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
    expect(csv.split('\n').length).toBe(2); // header + empty line
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
    expect(csv).toContain('Jane, "JJ"');
    expect(csv).toContain('O\'Connor');
    expect(csv).toContain('ACME, Inc.');
    expect(csv).toContain('Apt. 4');
    expect(csv).toContain('Special, needs follow-up');
  });

  it('outputs the correct number of lines for multiple customers', () => {
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
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        company: '',
        address1: 'Street 2',
        address2: '',
        city: 'Rotterdam',
        province: '',
        provinceCode: '',
        country: 'Netherlands',
        countryCode: 'NL',
        zip: '2000BB',
        phone: '',
        acceptsMarketing: true,
        acceptsSmsMarketing: false,
        tags: '',
        note: '',
        taxExempt: true
      }
    ];
    const csv = generateShopifyCustomerCsv(data);
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(3); // header + 2 customers
  });

  it('outputs the exact expected header row', () => {
    const csv = generateShopifyCustomerCsv([]);
    const header = csv.split('\n')[0];
    expect(header).toBe(
      'First Name,Last Name,Email,Company,Address1,Address2,City,Province,Province Code,Country,Country Code,Zip,Phone,Accepts Marketing,Accepts SMS Marketing,Tags,Note,Tax Exempt,ID'
    );
  });
});
