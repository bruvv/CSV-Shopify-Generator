
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";


const PAGE_OPTIONS = [5, 20, 50, 100];


export default function MagentoToShopifyCustomerCsvConverterPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(PAGE_OPTIONS[0]);
  const [showAll, setShowAll] = useState<boolean>(false);


  const formMethods = useForm<ShopifyCustomersFormData>({
    resolver: zodResolver(shopifyCustomersSchema),
    defaultValues: {
      customers: [],
    },
    mode: 'onChange', // onChange mode is good for immediate feedback, but trigger after load is explicit
  });

  const { control, handleSubmit, reset, formState, watch, trigger, getValues } = formMethods;
  const { errors } = formState;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customers',
  });

  const allCustomers = watch('customers'); // Watching for real-time updates
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
    const currentActualItemsPerPage = showAll ? (totalItems > 0 ? totalItems : 1) : itemsPerPage;
    const newTotalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / currentActualItemsPerPage);

    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages > 0 ? newTotalPages : 1);
    }
  }, [totalItems, currentPage, itemsPerPage, showAll]);


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
      acceptsSmsMarketing: false,
      tags: '',
      note: '',
      taxExempt: false,
    });
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
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
              acceptsSmsMarketing: c.acceptsSmsMarketing !== undefined ? c.acceptsSmsMarketing : false,
              tags: c.tags || '',
              note: c.note || '',
              taxExempt: c.taxExempt !== undefined ? c.taxExempt : false,
            } as ShopifyCustomerFormData));
            
            reset({ customers: newCustomers }); // Populate form
            
            // Ensure state updates from reset are processed before trigger and error checking
            await new Promise(resolve => setTimeout(resolve, 0)); 

            const isValid = await trigger(); // Validate all fields

            if (!isValid) {
              const customerErrors = formState.errors.customers;
              let firstErrorCustomerIndex = -1;
              const currentCustomers = getValues().customers; // Get current customer list after reset

              if (customerErrors && Array.isArray(customerErrors) && currentCustomers) {
                for (let i = 0; i < currentCustomers.length; i++) {
                  if (customerErrors[i] && Object.keys(customerErrors[i]!).length > 0) {
                    firstErrorCustomerIndex = i;
                    break;
                  }
                }
              }

              if (firstErrorCustomerIndex !== -1) {
                const itemsPerPageToUse = showAll ? (currentCustomers.length > 0 ? currentCustomers.length : 1) : itemsPerPage;
                const errorPage = Math.floor(firstErrorCustomerIndex / itemsPerPageToUse) + 1;
                setCurrentPage(errorPage);
                toast({
                  title: "Validation Errors Found",
                  description: `Please review customer #${firstErrorCustomerIndex + 1} (and potentially others) for errors. Navigated to their page.`,
                  variant: "destructive",
                });
              } else {
                 // This case means isValid is false, but we couldn't pinpoint an error in the customers array.
                 // Could be a root form error or an issue if customers array was empty during check.
                 toast({ title: 'Imported with Validation Issues', description: 'Please check the form for highlighted errors.', variant: 'destructive'});
                 setCurrentPage(1); // Default to first page if specific error not found
              }
            } else {
              // Successfully imported and all data is valid
              setCurrentPage(1);
              toast({ title: 'CSV Imported Successfully', description: `${newCustomers.length} customer(s) loaded and valid.` });
            }

          } else if (result.type === 'no_customers_extracted') {
             toast({ title: 'Import Note', description: result.message, variant: 'default'});
             reset({ customers: [] }); 
             setCurrentPage(1);
          } else if (result.type === 'parse_error') {
            toast({ title: 'Import Failed', description: result.message, variant: 'destructive'});
            reset({ customers: [] });
            setCurrentPage(1);
          }

        } catch (error) {
           console.error("Error processing CSV:", error);
           toast({ title: 'Import Failed', description: 'Could not process the CSV file. Please check the format and content.', variant: 'destructive'});
           reset({ customers: [] });
           setCurrentPage(1);
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
            <h1 className="text-4xl font-bold text-primary">Magento naar Shopify Klanten CSV Converter</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Upload uw Magento klanten CSV, bekijk en bewerk gepagineerde vermeldingen, en genereer vervolgens een importeerbaar Shopify klanten CSV-bestand.
          </p>
        </header>

        <div className="mb-6 p-6 bg-card rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Acties</h2>
            <div className="flex flex-wrap items-center gap-4">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="mr-2 h-5 w-5" /> Importeer Klanten CSV
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                />
                <Button onClick={addNewCustomer} variant="default">
                    <PlusCircle className="mr-2 h-5 w-5" /> Nieuwe Klant Handmatig Toevoegen
                </Button>
                <Button onClick={handleSubmit(onFormSubmit)} variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Download className="mr-2 h-5 w-5" /> Genereer & Download Shopify CSV
                </Button>
                 {fields.length > 0 && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="items-per-page-select" className="text-sm font-medium">Totaal klanten per pagina:</Label>
                      <Select
                        value={showAll ? 'all' : String(itemsPerPage)}
                        onValueChange={handleItemsPerPageChange}
                      >
                        <SelectTrigger id="items-per-page-select" className="w-[100px] h-10">
                          <SelectValue placeholder="Aantal" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_OPTIONS.map(option => (
                            <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                          ))}
                          <SelectItem value="all">Alles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
            </div>
        </div>
        
        <Separator className="my-8" />

        <form onSubmit={handleSubmit(onFormSubmit)}>
          {fields.length === 0 && (
             <div className="text-center py-10">
              <p className="text-xl text-muted-foreground">Nog geen klanten geladen of toegevoegd.</p>
              <p className="text-sm text-muted-foreground">Klik op "Importeer Klanten CSV" of "Nieuwe Klant Handmatig Toevoegen" om te beginnen.</p>
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
