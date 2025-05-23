
import { z } from 'zod';

const phoneRegex = /^[\d\s()+-]*$/;
const cleanedPhoneLength = (phone: string) => phone.replace(/\D/g, '').length;

export const shopifyCustomerSchema = z.object({
  id: z.string(), // for client-side keying
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  email: z.string()
    .email({ message: "Invalid email address. Example: name@example.com" })
    .optional()
    .or(z.literal('')),
  company: z.string().optional().default(''),
  address1: z.string().optional().default(''),
  address2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  province: z.string().optional().default(''), // State/Province
  provinceCode: z.string().optional().default(''),
  country: z.string().optional().default(''),
  countryCode: z.string().optional().default(''), // e.g., US, NL
  zip: z.string().optional().default(''), // Postal Code
  phone: z.string()
    .optional()
    .default('')
    .refine(val => val === '' || phoneRegex.test(val), {
      message: "Phone number has invalid characters. Only digits and ()-+/space are allowed."
    })
    .refine(val => val === '' || cleanedPhoneLength(val) >= 7, { 
      message: "Phone number seems too short (minimum 7 digits required)."
    }),
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
