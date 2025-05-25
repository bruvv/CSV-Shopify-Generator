
import { z } from 'zod';

// Represents a single row in the Shopify Product CSV
// For products with variants, the first row is the "parent" product,
// subsequent rows are variants with the same handle.
export const shopifyProductSchema = z.object({
  id: z.string(), // Client-side key
  handle: z.string().min(1, { message: "Handle is required." }),
  title: z.string().optional().default(''), // Shopify: Title - Required for parent, blank for variants after the first
  bodyHtml: z.string().optional().default(''), // Shopify: Body (HTML)
  vendor: z.string().optional().default(''),
  productType: z.string().optional().default(''), // Shopify: Type
  tags: z.string().optional().default(''), // Shopify: Tags (comma-separated)
  published: z.boolean().optional().default(true), // Shopify: Published

  option1Name: z.string().optional().default(''),
  option1Value: z.string().optional().default(''),
  option2Name: z.string().optional().default(''),
  option2Value: z.string().optional().default(''),
  option3Name: z.string().optional().default(''),
  option3Value: z.string().optional().default(''),

  variantSku: z.string().optional().default(''), // Shopify: Variant SKU
  variantPrice: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(',', '.'))),
    z.number().positive({ message: "Price must be positive" }).optional()
  ).default(0),
  variantCompareAtPrice: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(String(val).replace(',', '.'))),
    z.number().positive().optional()
  ).optional().default(undefined),
  variantInventoryQty: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().int().optional()
  ).default(0),
  variantRequiresShipping: z.boolean().optional().default(true),
  variantTaxable: z.boolean().optional().default(true),
  variantWeight: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().nonnegative().optional()
  ).default(0),
  variantWeightUnit: z.enum(['g', 'kg', 'lb', 'oz']).optional().default('g'),
  
  imageSrc: z.string().optional().default(''), // Shopify: Image Src (for the product or variant)
  imagePosition: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : Number(val)),
    z.number().int().positive().optional()
  ).optional().default(1),
  imageAltText: z.string().optional().default(''),

  // SEO Fields
  seoTitle: z.string().optional().default(''),
  seoDescription: z.string().optional().default(''),

  // Additional fields for internal processing if needed
  magentoProductType: z.string().optional().default('simple'), // e.g., simple, configurable
  isVariantRow: z.boolean().default(false), // Helper to know if this row is a variant of a main product
});

export type ShopifyProductFormData = z.infer<typeof shopifyProductSchema>;

export const shopifyProductsSchema = z.object({
  products: z.array(shopifyProductSchema),
});

export type ShopifyProductsFormData = z.infer<typeof shopifyProductsSchema>;
