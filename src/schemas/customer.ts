
import { z } from 'zod';

export const shopifyCustomerSchema = z.object({
  id: z.string(), // for client-side keying
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.string().email({ message: "Invalid email format" }).optional().or(z.literal('')),
  company: z.string().optional().default(''),
  address1: z.string().optional().default(''),
  address2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  province: z.string().optional().default(''), // State/Province
  provinceCode: z.string().optional().default(''),
  country: z.string().optional().default(''),
  countryCode: z.string().optional().default(''), // e.g., US
  zip: z.string().optional().default(''), // Postal Code
  phone: z.string().optional().default(''),
  acceptsMarketing: z.boolean().default(false), // Corresponds to Accepts Email Marketing
  acceptsSmsMarketing: z.boolean().default(false),
  tags: z.string().optional().default(''), // comma-separated
  note: z.string().optional().default(''),
  taxExempt: z.boolean().default(false),
});

export type ShopifyCustomerFormData = z.infer<typeof shopifyCustomerSchema>;

export const shopifyCustomersSchema = z.object({
  customers: z.array(shopifyCustomerSchema),
});

export type ShopifyCustomersFormData = z.infer<typeof shopifyCustomersSchema>;

