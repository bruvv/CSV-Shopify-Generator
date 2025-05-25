
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
import { Trash2, User, Mail, Building, MapPin, Phone, Tag, FileText, Percent, MessageSquare } from 'lucide-react';
import type { ShopifyCustomersFormData } from '@/schemas/customer';
import { cn } from '@/lib/utils';

interface CustomerEntryFormProps {
  control: Control<ShopifyCustomersFormData>;
  index: number; // This is the absolute index in the customers array
  remove: (index: number) => void;
  errors: FieldErrors<ShopifyCustomersFormData>;
}

export function CustomerEntryForm({ control, index, remove, errors }: CustomerEntryFormProps) {
  const customerErrors = errors.customers?.[index];

  return (
    <Card className="mb-6 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-xl font-semibold">Customer #{index + 1}</CardTitle>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={() => remove(index)}
          aria-label="Remove customer"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={control}
            name={`customers.${index}.firstName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />First Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. John"
                    {...field}
                    className={cn(customerErrors?.firstName && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.firstName && <FormMessage>{customerErrors.firstName.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`customers.${index}.lastName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Doe"
                    {...field}
                    className={cn(customerErrors?.lastName && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.lastName && <FormMessage>{customerErrors.lastName.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`customers.${index}.email`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="e.g. john.doe@example.com"
                    {...field}
                    className={cn(customerErrors?.email && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.email && <FormMessage>{customerErrors.email.message}</FormMessage>}
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`customers.${index}.company`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Company</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Doe Inc."
                    {...field}
                    className={cn(customerErrors?.company && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.company && <FormMessage>{customerErrors.company.message}</FormMessage>}
              </FormItem>
            )}
          />
          
          <FormField
            control={control}
            name={`customers.${index}.phone`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Phone Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. +1 555-123-4567"
                    {...field}
                    className={cn(customerErrors?.phone && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.phone && <FormMessage>{customerErrors.phone.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>

        <h3 className="text-lg font-medium mt-6 mb-2 text-primary">Address</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
           <FormField
            control={control}
            name={`customers.${index}.address1`}
            render={({ field }) => (
              <FormItem className="md:col-span-2 lg:col-span-3">
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Address Line 1</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 123 Main St"
                    {...field}
                    className={cn(customerErrors?.address1 && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.address1 && <FormMessage>{customerErrors.address1.message}</FormMessage>}
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name={`customers.${index}.address2`}
            render={({ field }) => (
              <FormItem className="md:col-span-2 lg:col-span-3">
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Address Line 2</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Apt 4B"
                    {...field}
                    className={cn(customerErrors?.address2 && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.address2 && <FormMessage>{customerErrors.address2.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.city`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />City</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. New York"
                    {...field}
                    className={cn(customerErrors?.city && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.city && <FormMessage>{customerErrors.city.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.province`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Province</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. California"
                    {...field}
                    className={cn(customerErrors?.province && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.province && <FormMessage>{customerErrors.province.message}</FormMessage>}
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name={`customers.${index}.provinceCode`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Province Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. CA"
                    {...field}
                    className={cn(customerErrors?.provinceCode && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.provinceCode && <FormMessage>{customerErrors.provinceCode.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.zip`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Zip/Postal Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. 10001"
                    {...field}
                    className={cn(customerErrors?.zip && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.zip && <FormMessage>{customerErrors.zip.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.country`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Country</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. United States"
                    {...field}
                    className={cn(customerErrors?.country && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.country && <FormMessage>{customerErrors.country.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.countryCode`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Country Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. US"
                    {...field}
                    className={cn(customerErrors?.countryCode && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                {customerErrors?.countryCode && <FormMessage>{customerErrors.countryCode.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name={`customers.${index}.tags`}
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground" />Tags (comma-separated)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. vip, wholesale"
                  {...field}
                  className={cn(customerErrors?.tags && "border-destructive focus-visible:ring-destructive")}
                />
              </FormControl>
              {customerErrors?.tags && <FormMessage>{customerErrors.tags.message}</FormMessage>}
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`customers.${index}.note`}
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Note</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Notes about the customer..."
                  className={cn("min-h-[80px]", customerErrors?.note && "border-destructive focus-visible:ring-destructive")}
                  {...field}
                />
              </FormControl>
              {customerErrors?.note && <FormMessage>{customerErrors.note.message}</FormMessage>}
            </FormItem>
          )}
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            control={control}
            name={`customers.${index}.acceptsMarketing`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(customerErrors?.acceptsMarketing && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                <FormLabel className="font-normal flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Accepts Email Marketing</FormLabel>
                {customerErrors?.acceptsMarketing && <FormMessage>{customerErrors.acceptsMarketing.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.acceptsSmsMarketing`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                     className={cn(customerErrors?.acceptsSmsMarketing && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                <FormLabel className="font-normal flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />Accepts SMS Marketing</FormLabel>
                {customerErrors?.acceptsSmsMarketing && <FormMessage>{customerErrors.acceptsSmsMarketing.message}</FormMessage>}
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customers.${index}.taxExempt`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                 <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(customerErrors?.taxExempt && "border-destructive focus-visible:ring-destructive")}
                  />
                </FormControl>
                <FormLabel className="font-normal flex items-center"><Percent className="mr-2 h-4 w-4 text-muted-foreground" />Tax Exempt</FormLabel>
                {customerErrors?.taxExempt && <FormMessage>{customerErrors.taxExempt.message}</FormMessage>}
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

    
