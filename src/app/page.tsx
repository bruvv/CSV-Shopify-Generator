
'use client';

import type React from 'react';
import { useState, useRef } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shopifyCustomersSchema, type ShopifyCustomersFormData, type ShopifyCustomerFormData } from '@/schemas/customer';
import { generateShopifyCustomerCsv, parseMagentoCustomerCsv, type ParseCustomerResult } from '@/lib/customer-csv-converter';
import { Button } from '@/components/ui/button';
import { CustomerEntryForm } from '@/components/customer-entry-form'; // Updated import
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, PlusCircle, Users, RefreshCw } from 'lucide-react'; // Users icon instead of FileText
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

export default function MagentoToShopifyCustomerCsvConverterPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formMethods = useForm<ShopifyCustomersFormData>({
    resolver: zodResolver(shopifyCustomersSchema),
    defaultValues: {
      customers: [],
    },
    mode: 'onChange',
  });

  const { control, handleSubmit, reset, formState: { errors } } = formMethods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customers',
  });

  const addNewCustomer = () => {
    append({
      id: crypto.randomUUID(),
      firstName: '',
      lastName: '',
      email: '',
      company: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      provinceCode: '',
      country: '',
      countryCode: '',
      zip: '',
      phone: '',
      acceptsMarketing: false,
      tags: '',
      note: '',
      taxExempt: false,
    });
    toast({ title: "New customer entry added", description: "Fill in the details for the new customer." });
  };

  const onFormSubmit = (data: ShopifyCustomersFormData) => {
    if (data.customers.length === 0) {
      toast({
        title: 'No Customers to Export',
        description: 'Please add at least one customer before generating the Shopify CSV.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const csvContent = generateShopifyCustomerCsv(data.customers);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'shopify_customers_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Shopify Customer CSV Generated', description: 'Your Shopify customer CSV has been downloaded.' });
      }
    } catch (error) {
      console.error("Error generating CSV:", error);
      toast({ title: 'CSV Generation Failed', description: 'An error occurred while generating the CSV.', variant: 'destructive' });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvString = e.target?.result as string;
          const result: ParseCustomerResult = parseMagentoCustomerCsv(csvString);

          if (result.type === 'customers') {
            const parsedCustomers = result.data;
            if (parsedCustomers.length > 0) {
              const newCustomers = parsedCustomers.map(c => ({
                id: c.id || crypto.randomUUID(),
                firstName: c.firstName || '',
                lastName: c.lastName || '',
                email: c.email || '',
                company: c.company || '',
                address1: c.address1 || '',
                address2: c.address2 || '',
                city: c.city || '',
                province: c.province || '',
                provinceCode: c.provinceCode || '',
                country: c.country || '',
                countryCode: c.countryCode || '',
                zip: c.zip || '',
                phone: c.phone || '',
                acceptsMarketing: c.acceptsMarketing !== undefined ? c.acceptsMarketing : false,
                tags: c.tags || '',
                note: c.note || '',
                taxExempt: c.taxExempt !== undefined ? c.taxExempt : false,
              } as ShopifyCustomerFormData));
              reset({ customers: newCustomers });
              let importMessage = `${newCustomers.length} customers loaded.`;
              if (result.format === 'magento_customer') {
                importMessage = `${newCustomers.length} customers loaded from Magento Customer CSV.`;
              }
              if (result.message) {
                importMessage += ` ${result.message}`;
              }
              toast({ title: 'CSV Imported', description: importMessage });
            } else {
               toast({ title: 'Import Note', description: result.message || 'CSV processed, but no valid customer entries were found.', variant: 'default'});
            }
          } else if (result.type === 'products') {
             toast({ title: 'Import Info', description: result.message, variant: 'default' });
          } else if (result.type === 'unknown_csv' || result.type === 'empty') {
            toast({ title: 'Import Failed', description: result.message, variant: 'destructive'});
          }

        } catch (error) {
           console.error("Error processing CSV:", error);
           toast({ title: 'Import Failed', description: 'Could not process the CSV file. Please check the format.', variant: 'destructive'});
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <FormProvider {...formMethods}>
      <div className="min-h-screen container mx-auto p-4 md:p-8">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <RefreshCw className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-primary">Magento to Shopify Customer CSV Converter</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Upload your Magento customer CSV, review and edit if needed, then generate an importable Shopify customer CSV file.
          </p>
        </header>

        <div className="mb-6 p-6 bg-card rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Actions</h2>
            <div className="flex flex-wrap gap-4">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="mr-2 h-5 w-5" /> Import Magento Customer CSV
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                />
                <Button onClick={addNewCustomer} variant="default">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add New Customer Manually
                </Button>
                <Button onClick={handleSubmit(onFormSubmit)} variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Download className="mr-2 h-5 w-5" /> Generate & Download Shopify CSV
                </Button>
            </div>
        </div>
        
        <Separator className="my-8" />

        <form onSubmit={handleSubmit(onFormSubmit)}>
          {fields.length === 0 && (
             <div className="text-center py-10">
              <Image src="https://placehold.co/300x200.png" alt="No customers" width={300} height={200} className="mx-auto mb-4 rounded-lg shadow-md" data-ai-hint="empty state people" />
              <p className="text-xl text-muted-foreground">No customers loaded or added yet.</p>
              <p className="text-sm text-muted-foreground">Click "Import Magento Customer CSV" or "Add New Customer" to get started.</p>
            </div>
          )}
          {fields.map((field, index) => (
            <CustomerEntryForm // Updated component
              key={field.id}
              control={control}
              index={index}
              remove={remove}
              errors={errors}
            />
          ))}
        </form>
      </div>
    </FormProvider>
  );
}
