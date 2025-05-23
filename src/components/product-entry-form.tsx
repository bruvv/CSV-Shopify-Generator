import type * as React from 'react';
import type { Control, UseFieldArrayRemove, FieldErrors } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Info, Type, ShoppingBag, Tag, DollarSign, Hash, ImageIcon, PackageCheck, Truck, PercentCircle, Power } from 'lucide-react';
import type { ProductsFormData } from '@/schemas/product';

interface ProductEntryFormProps {
  control: Control<ProductsFormData>;
  index: number;
  remove: UseFieldArrayRemove;
  errors: FieldErrors<ProductsFormData>;
}

export function ProductEntryForm({ control, index, remove, errors }: ProductEntryFormProps) {
  const { register } = useFormContext<ProductsFormData>();
  const productErrors = errors.products?.[index];

  return (
    <Card className="mb-6 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl font-semibold">Product #{index + 1}</CardTitle>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={control}
            name={`products.${index}.title`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" />Title*</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Awesome T-Shirt" {...field} />
                </FormControl>
                {productErrors?.title && <FormMessage>{productErrors.title.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`products.${index}.vendor`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />Vendor</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. MyBrand" {...field} />
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
                <FormLabel className="flex items-center"><Type className="mr-2 h-4 w-4 text-muted-foreground" />Product Type</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Apparel" {...field} />
                </FormControl>
                {productErrors?.productType && <FormMessage>{productErrors.productType.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`products.${index}.price`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Price</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 19.99" {...field} value={field.value ?? ''} />
                </FormControl>
                 {productErrors?.price && <FormMessage>{productErrors.price.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`products.${index}.sku`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />SKU</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. TSHIRT-RED-L" {...field} />
                </FormControl>
                {productErrors?.sku && <FormMessage>{productErrors.sku.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`products.${index}.inventoryQuantity`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><PackageCheck className="mr-2 h-4 w-4 text-muted-foreground" />Inventory Quantity</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 100" {...field} value={field.value ?? ''} />
                </FormControl>
                {productErrors?.inventoryQuantity && <FormMessage>{productErrors.inventoryQuantity.message}</FormMessage>}
              </FormItem>
            )}
          />
        
          <FormField
            control={control}
            name={`products.${index}.tags`}
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground" />Tags (comma-separated)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. clothing, summer, sale" {...field} />
                </FormControl>
                {productErrors?.tags && <FormMessage>{productErrors.tags.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`products.${index}.imageSrc`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground" />Image URL</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://example.com/image.jpg" {...field} />
                </FormControl>
                {productErrors?.imageSrc && <FormMessage>{productErrors.imageSrc.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name={`products.${index}.bodyHtml`}
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel className="flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" />Description (Body HTML)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detailed product description..." className="min-h-[100px]" {...field} />
              </FormControl>
              {productErrors?.bodyHtml && <FormMessage>{productErrors.bodyHtml.message}</FormMessage>}
            </FormItem>
          )}
        />

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <FormField
            control={control}
            name={`products.${index}.published`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="flex items-center font-normal"><Power className="mr-2 h-4 w-4 text-muted-foreground" />Published</FormLabel>
                {productErrors?.published && <FormMessage>{productErrors.published.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.requiresShipping`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="flex items-center font-normal"><Truck className="mr-2 h-4 w-4 text-muted-foreground" />Requires Shipping</FormLabel>
                {productErrors?.requiresShipping && <FormMessage>{productErrors.requiresShipping.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.taxable`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="flex items-center font-normal"><PercentCircle className="mr-2 h-4 w-4 text-muted-foreground" />Taxable</FormLabel>
                {productErrors?.taxable && <FormMessage>{productErrors.taxable.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`products.${index}.status`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" />Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                {productErrors?.status && <FormMessage>{productErrors.status.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
