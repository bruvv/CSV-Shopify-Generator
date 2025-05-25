
import type * as React from 'react';
import type { Control, FieldErrors } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Box, TagIcon, CircleDollarSign, Pilcrow, Settings2, ImageIcon, Info, Search, Barcode, WeightIcon, AlignLeft } from 'lucide-react';
import type { ShopifyProductsFormData, ShopifyProductFormData } from '@/schemas/product';
import { cn } from '@/lib/utils';

interface ProductEntryFormProps {
  control: Control<ShopifyProductsFormData>;
  index: number; // This is the absolute index in the products array
  remove: (index: number) => void;
  errors: FieldErrors<ShopifyProductsFormData>;
  productData: ShopifyProductFormData; 
}

export function ProductEntryForm({ control, index, remove, errors, productData }: ProductEntryFormProps) {
  const productErrors = errors.products?.[index];
  const isFirstOccurrenceOfHandle = !productData.isVariantRow; // For simple products, this will usually be true.

  return (
    <Card className="mb-6 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl font-semibold">
            Product #{index + 1}{productData.title ? ` - ${productData.title}`: ''}{productData.variantSku ? ` (SKU: ${productData.variantSku})` : ''}
        </CardTitle>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={() => remove(index)}
          aria-label="Remove product"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Core Product Information */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
          <FormField
            control={control}
            name={`products.${index}.handle`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><TagIcon className="mr-2 h-4 w-4 text-muted-foreground" />Handle *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. unique-product-handle"
                    {...field}
                    className={cn(productErrors?.handle && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {productErrors?.handle && <FormMessage>{productErrors.handle.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.title`}
            render={({ field }) => (
              <FormItem className="lg:col-span-2">
                <FormLabel className="flex items-center"><Pilcrow className="mr-2 h-4 w-4 text-muted-foreground" />Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Awesome T-Shirt"
                    {...field}
                    className={cn(productErrors?.title && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {productErrors?.title && <FormMessage>{productErrors.title.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name={`products.${index}.bodyHtml`}
          render={({ field }) => (
            <FormItem className="mb-4">
              <FormLabel className="flex items-center"><AlignLeft className="mr-2 h-4 w-4 text-muted-foreground" />Body (HTML)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="<p>Product description here...</p>"
                  className={cn("min-h-[100px]", productErrors?.bodyHtml && "border-destructive focus-visible:ring-destructive")}
                  {...field}
                />
              </FormControl>
              {productErrors?.bodyHtml && <FormMessage>{productErrors.bodyHtml.message}</FormMessage>}
            </FormItem>
          )}
        />
         <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
            <FormField
                control={control}
                name={`products.${index}.vendor`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Vendor</FormLabel>
                    <FormControl>
                    <Input
                        placeholder="e.g. MyBrand"
                        {...field}
                        className={cn(productErrors?.vendor && "border-destructive focus-visible:ring-destructive")}
                    />
                    </FormControl>
                    {productErrors?.vendor && <FormMessage>{productErrors.vendor.message}</FormMessage>}
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`products.${index}.productType`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />Product Type</FormLabel>
                    <FormControl>
                    <Input
                        placeholder="e.g. Apparel"
                        {...field}
                        className={cn(productErrors?.productType && "border-destructive focus-visible:ring-destructive")}
                    />
                    </FormControl>
                    {productErrors?.productType && <FormMessage>{productErrors.productType.message}</FormMessage>}
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`products.${index}.tags`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><TagIcon className="mr-2 h-4 w-4 text-muted-foreground" />Tags (comma-separated)</FormLabel>
                    <FormControl>
                    <Input
                        placeholder="e.g. new, sale, cotton"
                        {...field}
                        className={cn(productErrors?.tags && "border-destructive focus-visible:ring-destructive")}
                    />
                    </FormControl>
                    {productErrors?.tags && <FormMessage>{productErrors.tags.message}</FormMessage>}
                </FormItem>
                )}
            />
         </div>

        {/* Variant Specific Information - For simple products, these are primary details */}
        <h3 className="text-lg font-medium mt-6 mb-2 text-primary">Product Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={control}
            name={`products.${index}.variantSku`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Barcode className="mr-2 h-4 w-4 text-muted-foreground" />SKU</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. TSHIRT-RED-SML"
                    {...field}
                    className={cn(productErrors?.variantSku && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {productErrors?.variantSku && <FormMessage>{productErrors.variantSku.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.variantPrice`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><CircleDollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 19.99"
                    {...field}
                     value={field.value === undefined ? '' : String(field.value)}
                     onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    className={cn(productErrors?.variantPrice && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {productErrors?.variantPrice && <FormMessage>{productErrors.variantPrice.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.variantInventoryQty`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Inventory Qty</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g. 100"
                     {...field}
                     value={field.value === undefined ? '' : String(field.value)}
                     onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                    className={cn(productErrors?.variantInventoryQty && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {productErrors?.variantInventoryQty && <FormMessage>{productErrors.variantInventoryQty.message}</FormMessage>}
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name={`products.${index}.variantWeight`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><WeightIcon className="mr-2 h-4 w-4 text-muted-foreground" />Weight (g)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 100"
                     {...field}
                     value={field.value === undefined ? '' : String(field.value)}
                     onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    className={cn(productErrors?.variantWeight && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {productErrors?.variantWeight && <FormMessage>{productErrors.variantWeight.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>

        {/* Options - For simple products, these are typically blank or "Title" / "Default Title" */}
        <h3 className="text-lg font-medium mt-6 mb-2 text-primary">Product Options (if applicable)</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
                control={control}
                name={`products.${index}.option1Name`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />Option1 Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Size or Title" {...field} className={cn(productErrors?.option1Name && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                    {productErrors?.option1Name && <FormMessage>{productErrors.option1Name.message}</FormMessage>}
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`products.${index}.option1Value`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Settings2 className="mr-2 h-4 w-4 text-muted-foreground" />Option1 Value</FormLabel>
                    <FormControl><Input placeholder="e.g. Small or Default Title" {...field} className={cn(productErrors?.option1Value && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                    {productErrors?.option1Value && <FormMessage>{productErrors.option1Value.message}</FormMessage>}
                </FormItem>
                )}
            />
        </div>
        {/* Add Option2 and Option3 fields similarly if needed for some simple products or future variant handling */}

        <h3 className="text-lg font-medium mt-6 mb-2 text-primary">Media & SEO</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
                control={control}
                name={`products.${index}.imageSrc`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" />Image Source URL</FormLabel>
                    <FormControl><Input placeholder="e.g. /p/a/image.jpg or https://..." {...field} className={cn(productErrors?.imageSrc && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                    {productErrors?.imageSrc && <FormMessage>{productErrors.imageSrc.message}</FormMessage>}
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`products.${index}.imageAltText`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" />Image Alt Text</FormLabel>
                    <FormControl><Input placeholder="e.g. Red T-Shirt front view" {...field} className={cn(productErrors?.imageAltText && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                    {productErrors?.imageAltText && <FormMessage>{productErrors.imageAltText.message}</FormMessage>}
                </FormItem>
                )}
            />
        </div>
         <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-2">
            <FormField
                control={control}
                name={`products.${index}.seoTitle`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Search className="mr-2 h-4 w-4 text-muted-foreground" />SEO Title</FormLabel>
                    <FormControl><Input placeholder="Max 70 characters e.g. Awesome Product Name" {...field} className={cn(productErrors?.seoTitle && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                    {productErrors?.seoTitle && <FormMessage>{productErrors.seoTitle.message}</FormMessage>}
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`products.${index}.seoDescription`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Search className="mr-2 h-4 w-4 text-muted-foreground" />SEO Description</FormLabel>
                    <FormControl><Textarea placeholder="Max 320 characters. Briefly describe your product." {...field} className={cn("min-h-[80px]", productErrors?.seoDescription && "border-destructive focus-visible:ring-destructive")} /></FormControl>
                    {productErrors?.seoDescription && <FormMessage>{productErrors.seoDescription.message}</FormMessage>}
                </FormItem>
                )}
            />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            control={control}
            name={`products.${index}.published`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(productErrors?.published && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                <FormLabel className="font-normal flex items-center">Published</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.variantTaxable`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(productErrors?.variantTaxable && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                <FormLabel className="font-normal flex items-center">Taxable</FormLabel>
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name={`products.${index}.variantRequiresShipping`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(productErrors?.variantRequiresShipping && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                <FormLabel className="font-normal flex items-center">Requires Shipping</FormLabel>
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

