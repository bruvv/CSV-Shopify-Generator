import { z } from 'zod';

export const productSchema = z.object({
  id: z.string(), // for client-side keying, generated on add
  title: z.string().min(1, "Title is required"),
  bodyHtml: z.string().optional().default(''),
  vendor: z.string().optional().default(''),
  productType: z.string().optional().default(''),
  tags: z.string().optional().default(''), // comma-separated
  published: z.boolean().default(true),
  price: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : Number(val),
    z.number({ invalid_type_error: "Price must be a number" }).positive("Price must be positive").nullable().optional().default(0)
  ),
  sku: z.string().optional().default(''),
  imageSrc: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')).default(''),
  inventoryQuantity: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : Number(val),
    z.number({ invalid_type_error: "Quantity must be a number" }).int("Quantity must be an integer").min(0,"Quantity cannot be negative").nullable().optional().default(0)
  ),
  requiresShipping: z.boolean().default(true),
  taxable: z.boolean().default(true),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const productsSchema = z.object({
  products: z.array(productSchema),
});

export type ProductsFormData = z.infer<typeof productsSchema>;
