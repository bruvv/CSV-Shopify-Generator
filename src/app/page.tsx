
'use client';

import type React from 'react';
import { useState, useRef } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productsSchema, type ProductsFormData, type ProductFormData } from '@/schemas/product';
import { generateShopifyCsv, parseShopifyCsv, type ParseResult } from '@/lib/shopify-csv';
import { Button } from '@/components/ui/button';
import { ProductEntryForm } from '@/components/product-entry-form';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, PlusCircle, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

export default function ShopifyCsvGeneratorPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formMethods = useForm<ProductsFormData>({
    resolver: zodResolver(productsSchema),
    defaultValues: {
      products: [],
    },
    mode: 'onChange', // Useful for immediate feedback on validation
  });

  const { control, handleSubmit, reset, formState: { errors } } = formMethods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const addNewProduct = () => {
    append({
      id: crypto.randomUUID(),
      title: '',
      bodyHtml: '',
      vendor: '',
      productType: '',
      tags: '',
      published: true,
      price: 0,
      sku: '',
      imageSrc: '',
      inventoryQuantity: 0,
      requiresShipping: true,
      taxable: true,
      status: 'active',
    });
    toast({ title: "New product entry added", description: "Fill in the details for the new product." });
  };

  const onFormSubmit = (data: ProductsFormData) => {
    if (data.products.length === 0) {
      toast({
        title: 'No Products to Export',
        description: 'Please add at least one product before generating the CSV.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const csvContent = generateShopifyCsv(data.products);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'shopify_products_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'CSV Generated', description: 'Your Shopify product CSV has been downloaded.' });
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
          const result: ParseResult = parseShopifyCsv(csvString);

          if (result.type === 'products') {
            const parsedProducts = result.data;
            if (parsedProducts.length > 0) {
              const newProducts = parsedProducts.map(p => ({
                id: p.id || crypto.randomUUID(),
                title: p.title || '',
                bodyHtml: p.bodyHtml || '',
                vendor: p.vendor || '',
                productType: p.productType || '',
                tags: p.tags || '',
                published: p.published !== undefined ? p.published : true,
                price: p.price !== undefined ? p.price : 0,
                sku: p.sku || '',
                imageSrc: p.imageSrc || '',
                inventoryQuantity: p.inventoryQuantity !== undefined ? p.inventoryQuantity : 0,
                requiresShipping: p.requiresShipping !== undefined ? p.requiresShipping : true,
                taxable: p.taxable !== undefined ? p.taxable : true,
                status: p.status || 'active',
              } as ProductFormData));
              reset({ products: newProducts }); 
              toast({ title: 'CSV Imported', description: `${newProducts.length} products loaded from CSV.` });
            } else {
               toast({ title: 'Import Note', description: 'CSV structure suggests products, but no valid product entries were found.', variant: 'default'});
            }
          } else if (result.type === 'customers') {
            toast({ title: 'Import Info', description: result.message, variant: 'default' });
          } else if (result.type === 'unknown' || result.type === 'empty') {
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
            <FileText className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-primary">Shopify CSV Generator</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Easily create and manage your Shopify product listings and export them as an importable CSV file.
          </p>
        </header>

        <div className="mb-6 p-6 bg-card rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Actions</h2>
            <div className="flex flex-wrap gap-4">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="mr-2 h-5 w-5" /> Import CSV
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                />
                <Button onClick={addNewProduct} variant="default">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add New Product
                </Button>
                <Button onClick={handleSubmit(onFormSubmit)} variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Download className="mr-2 h-5 w-5" /> Generate & Download CSV
                </Button>
            </div>
        </div>
        
        <Separator className="my-8" />

        <form onSubmit={handleSubmit(onFormSubmit)}>
          {fields.length === 0 && (
             <div className="text-center py-10">
              <Image src="https://placehold.co/300x200.png" alt="No products" width={300} height={200} className="mx-auto mb-4 rounded-lg shadow-md" data-ai-hint="empty state illustration" />
              <p className="text-xl text-muted-foreground">No products added yet.</p>
              <p className="text-sm text-muted-foreground">Click "Add New Product" or "Import CSV" to get started.</p>
            </div>
          )}
          {fields.map((field, index) => (
            <ProductEntryForm
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
