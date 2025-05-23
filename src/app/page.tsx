
'use client';

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shopifyCustomersSchema, type ShopifyCustomersFormData, type ShopifyCustomerFormData } from '@/schemas/customer';
import { generateShopifyCustomerCsv, parseMagentoCustomerCsv, type ParseCustomerResult } from '@/lib/customer-csv-converter';
import { Button } from '@/components/ui/button';
import { CustomerEntryForm } from '@/components/customer-entry-form';
import { PaginationControls } from '@/components/pagination-controls';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, PlusCircle, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";


const PAGE_OPTIONS = [5, 20, 50, 100];
const HINT_OPTIONS = ["data illustration", "friendly robot", "abstract design", "task complete", "customer focus", "empty results", "data visualization", "user profile"];

export default function MagentoToShopifyCustomerCsvConverterPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(PAGE_OPTIONS[0]);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [randomImageHint, setRandomImageHint] = useState('empty state');
  const [randomPlaceholderUrl, setRandomPlaceholderUrl] = useState('https://placehold.co/300x200.png');


  const formMethods = useForm<ShopifyCustomersFormData>({
    resolver: zodResolver(shopifyCustomersSchema),
    defaultValues: {
      customers: [],
    },
    mode: 'onChange',
  });

  const { control, handleSubmit, reset, formState: { errors }, watch } = formMethods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customers',
  });

  const allCustomers = watch('customers');
  const totalItems = fields.length;

  // Calculate pagination variables
  const actualItemsPerPage = showAll ? (totalItems > 0 ? totalItems : 1) : itemsPerPage;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / actualItemsPerPage);
  
  const startIndex = (currentPage - 1) * actualItemsPerPage;
  const endIndex = Math.min(startIndex + actualItemsPerPage, totalItems);
  
  const paginatedFields = showAll ? fields : fields.slice(startIndex, endIndex);

  // Effect to adjust current page if it becomes out of bounds
  useEffect(() => {
    if (totalItems === 0) {
      setCurrentPage(1);
      return;
    }
    // Recalculate actualItemsPerPage and totalPages based on current state for this effect
    const currentActualItemsPerPage = showAll ? (totalItems > 0 ? totalItems : 1) : itemsPerPage;
    const newTotalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / currentActualItemsPerPage);

    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages > 0 ? newTotalPages : 1);
    }
  }, [totalItems, currentPage, itemsPerPage, showAll]);

  // Effect to set random image hint and placeholder URL on mount
  useEffect(() => {
    setRandomImageHint(HINT_OPTIONS[Math.floor(Math.random() * HINT_OPTIONS.length)]);
    
    const randomHexColor = () => Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    const bgColor = randomHexColor();
    const textColor = randomHexColor();
    setRandomPlaceholderUrl(`https://placehold.co/300x200/${bgColor}/${textColor}.png`);
  }, []);


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
    // Go to the page where the new customer will be visible
    const newTotalItems = fields.length + 1;
    const currentActualItemsPerPageForAdd = showAll ? (newTotalItems > 0 ? newTotalItems : 1) : itemsPerPage;
    const newTotalPages = Math.ceil(newTotalItems / currentActualItemsPerPageForAdd);
    setCurrentPage(newTotalPages);
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

          if (result.type === 'customers_found') {
            const parsedCustomers = result.data;
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
            setCurrentPage(1); 
            toast({ title: 'CSV Imported Successfully', description: result.message });
          } else if (result.type === 'no_customers_extracted') {
             toast({ title: 'Import Note', description: result.message, variant: 'default'});
             reset({ customers: [] }); 
             setCurrentPage(1);
          } else if (result.type === 'parse_error') {
            toast({ title: 'Import Failed', description: result.message, variant: 'destructive'});
          }

        } catch (error) {
           console.error("Error processing CSV:", error);
           toast({ title: 'Import Failed', description: 'Could not process the CSV file. Please check the format and content.', variant: 'destructive'});
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleRemoveCustomer = (index: number) => {
    remove(index);
  };

  const handleItemsPerPageChange = (value: string) => {
    if (value === 'all') {
      setShowAll(true);
    } else {
      setShowAll(false);
      setItemsPerPage(Number(value));
    }
    setCurrentPage(1); // Reset to first page
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
            Upload your Magento customer CSV, review and edit paginated entries, then generate an importable Shopify customer CSV file.
          </p>
        </header>

        <div className="mb-6 p-6 bg-card rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Actions</h2>
            <div className="flex flex-wrap items-center gap-4">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="mr-2 h-5 w-5" /> Import Customer CSV
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
                 <div className="flex items-center space-x-2">
                  <Label htmlFor="items-per-page-select" className="text-sm font-medium">Show:</Label>
                  <Select
                    value={showAll ? 'all' : String(itemsPerPage)}
                    onValueChange={handleItemsPerPageChange}
                  >
                    <SelectTrigger id="items-per-page-select" className="w-[100px] h-10">
                      <SelectValue placeholder="Count" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_OPTIONS.map(option => (
                        <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                      ))}
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            </div>
        </div>
        
        <Separator className="my-8" />

        <form onSubmit={handleSubmit(onFormSubmit)}>
          {fields.length === 0 && (
             <div className="text-center py-10">
              <Image src={randomPlaceholderUrl} alt="No customers" width={300} height={200} className="mx-auto mb-4 rounded-lg shadow-md" data-ai-hint={randomImageHint} />
              <p className="text-xl text-muted-foreground">No customers loaded or added yet.</p>
              <p className="text-sm text-muted-foreground">Click "Import Customer CSV" or "Add New Customer" to get started.</p>
            </div>
          )}

          {paginatedFields.map((field, localIndex) => {
            const originalIndex = startIndex + localIndex;
            return (
              <CustomerEntryForm
                key={field.id}
                control={control}
                index={originalIndex}
                remove={() => handleRemoveCustomer(originalIndex)}
                errors={errors}
              />
            );
          })}

          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </form>
      </div>
    </FormProvider>
  );
}
