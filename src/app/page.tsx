
'use client';

import type React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
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

  const [isLoading, setIsLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<'all' | 'errors'>('all');

  const formMethods = useForm<ShopifyCustomersFormData>({
    resolver: zodResolver(shopifyCustomersSchema),
    defaultValues: {
      customers: [],
    },
    mode: 'onChange', 
  });

  const { control, handleSubmit, reset, formState, watch, trigger, getValues } = formMethods;
  const { errors } = formState; // errors object from react-hook-form

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'customers',
  });

  // const allWatchedCustomers = watch('customers'); // For reactively deriving error indices - replaced by `fields`

  const derivedErrorIndices = useMemo(() => {
    // Use `fields` from useFieldArray as it's more directly tied to RHF's array state
    if (!errors.customers || !fields || fields.length === 0) return [];
    const indices: number[] = [];
    for (let i = 0; i < fields.length; i++) {
      // Check if the error object for this customer index exists and has any keys
      if (errors.customers[i] && Object.keys(errors.customers[i]!).length > 0) {
        indices.push(i);
      }
    }
    return indices;
  }, [errors.customers, fields]);

  useEffect(() => {
    // If in 'errors' mode and all errors are resolved, switch back to 'all' mode
    if (displayMode === 'errors' && derivedErrorIndices.length === 0 && fields.length > 0) {
      setDisplayMode('all');
      toast({ title: "All Errors Fixed!", description: "Displaying all customers." });
      setCurrentPage(1); // Reset to first page of all items
    }
  }, [displayMode, derivedErrorIndices, fields, toast]); // Added fields to dependency array
  

  const itemsToPaginate: { field: ShopifyCustomerFormData & { id: string }, originalIndex: number }[] = useMemo(() => {
    if (displayMode === 'errors') {
      return derivedErrorIndices
        .map(originalIndex => {
          const field = fields[originalIndex];
          // Ensure the field exists, as `fields` might update slightly after `derivedErrorIndices`
          return field ? { field: field as (ShopifyCustomerFormData & {id: string}), originalIndex } : null;
        })
        .filter(item => item !== null) as { field: ShopifyCustomerFormData & { id: string }, originalIndex: number }[];
    }
    // In 'all' mode, map all current fields with their original indices
    return fields.map((field, index) => ({ field: field as (ShopifyCustomerFormData & {id: string}), originalIndex: index }));
  }, [displayMode, fields, derivedErrorIndices]);


  const totalItemsForCurrentMode = itemsToPaginate.length;

  // Effect to adjust current page if it becomes out of bounds
  useEffect(() => {
    if (totalItemsForCurrentMode === 0) {
      setCurrentPage(1);
      return;
    }
    const currentActualItemsPerPage = showAll ? (totalItemsForCurrentMode > 0 ? totalItemsForCurrentMode : 1) : itemsPerPage;
    const newTotalPages = totalItemsForCurrentMode === 0 ? 1 : Math.ceil(totalItemsForCurrentMode / currentActualItemsPerPage);

    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages > 0 ? newTotalPages : 1);
    }
  }, [totalItemsForCurrentMode, currentPage, itemsPerPage, showAll]);


  const addNewCustomer = () => {
    setDisplayMode('all'); // Switch to show all customers
    
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
    // Calculate new total pages based on ALL items
    const newTotalAllItems = fields.length + 1; 
    const itemsPerPageForAll = showAll ? (newTotalAllItems > 0 ? newTotalAllItems : 1) : itemsPerPage;
    const newTotalPagesForAll = Math.ceil(newTotalAllItems / itemsPerPageForAll);
    setCurrentPage(newTotalPagesForAll);
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
      setIsLoading(true);
      setDisplayMode('all'); // Reset to 'all' mode for new import

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvString = e.target?.result as string;
          const result: ParseCustomerResult = parseMagentoCustomerCsv(csvString);

          let parsedCustomers: Partial<ShopifyCustomerFormData>[] = [];
          if (result.type === 'customers_found') {
            parsedCustomers = result.data;
          }
          
          const newCustomersToSet = parsedCustomers.map(c => ({
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
            
          reset({ customers: newCustomersToSet }); 
          
          await new Promise(resolve => setTimeout(resolve, 0)); 

          const isValid = await trigger(); 
          const currentCustomerData = getValues().customers; // RHF internal state may take a moment to sync after reset

          // Calculate tempErrorIndices based on the most recent formState.errors AFTER trigger()
          let tempErrorIndices: number[] = [];
          if (!isValid && formMethods.formState.errors.customers && currentCustomerData && currentCustomerData.length > 0) {
            const customerErrors = formMethods.formState.errors.customers;
            for (let i = 0; i < currentCustomerData.length; i++) {
                if (customerErrors[i] && Object.keys(customerErrors[i]!).length > 0) {
                    tempErrorIndices.push(i);
                }
            }
          }


          if (tempErrorIndices.length > 0) {
              setDisplayMode('errors');
              setCurrentPage(1); // Go to the first page of errors
              toast({
                title: "Validation Errors Found",
                description: `Displaying ${tempErrorIndices.length} customer(s) with errors. Please review and correct them.`,
                variant: "destructive",
              });
          } else { // No specific customer errors, or CSV was valid, or no customers extracted
               setDisplayMode('all'); 
               setCurrentPage(1);
               if (result.type === 'customers_found' && newCustomersToSet.length > 0 && isValid) {
                 toast({ title: 'CSV Imported Successfully', description: `${newCustomersToSet.length} customer(s) loaded and valid.` });
               } else if (result.type === 'customers_found' && newCustomersToSet.length > 0 && !isValid) {
                 // This case should ideally be caught by tempErrorIndices.length > 0, but as a fallback:
                 toast({ title: 'Imported with Validation Issues', description: 'Please check the form for highlighted errors. Some issues might not be per-customer.', variant: 'destructive'});
               } else if (result.type === 'no_customers_extracted') {
                 toast({ title: 'Import Note', description: result.message, variant: 'default'});
               } else if (result.type === 'parse_error') {
                toast({ title: 'Import Failed', description: result.message, variant: 'destructive'});
               } else if (newCustomersToSet.length === 0 && result.type === 'customers_found'){
                 toast({ title: 'Import Note', description: 'CSV parsed, but no customer data extracted.', variant: 'default'});
               }
          }

        } catch (errorCatch) {
           console.error("Error processing CSV:", errorCatch);
           setDisplayMode('all');
           toast({ title: 'Import Failed', description: 'Could not process the CSV file. Please check the format and content.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
              fileInputRef.current.value = ''; // Reset file input
            }
        }
      };
      reader.readAsText(file);
    }
  };
  
  const handleRemoveCustomer = (originalIndexToRemove: number) => {
    remove(originalIndexToRemove);
  };

  const handleItemsPerPageChange = (value: string) => {
    if (value === 'all') {
      setShowAll(true);
    } else {
      setShowAll(false);
      setItemsPerPage(Number(value));
    }
    setCurrentPage(1); 
  };

  const actualItemsPerPage = showAll ? (totalItemsForCurrentMode > 0 ? totalItemsForCurrentMode : 1) : itemsPerPage;
  const totalPages = totalItemsForCurrentMode === 0 ? 1 : Math.ceil(totalItemsForCurrentMode / actualItemsPerPage);
  const startIndex = (currentPage - 1) * actualItemsPerPage;
  const paginatedItemsForRender = itemsToPaginate.slice(startIndex, startIndex + actualItemsPerPage);


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
            {displayMode === 'errors' && derivedErrorIndices.length > 0 && (
                <span className="block mt-2 font-semibold text-destructive">Currently showing {derivedErrorIndices.length} customer(s) with errors.</span>
            )}
             {displayMode === 'errors' && derivedErrorIndices.length === 0 && fields.length > 0 && (
                <span className="block mt-2 font-semibold text-green-600">All previously found errors seem to be fixed!</span>
            )}
          </p>
        </header>

        <div className="mb-6 p-6 bg-card rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Acties</h2>
            <div className="flex flex-wrap items-center gap-4">
                <Button onClick={() => !isLoading && fileInputRef.current?.click()} variant="outline" disabled={isLoading}>
                    <Upload className="mr-2 h-5 w-5" /> Importeer Klanten CSV
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                    disabled={isLoading}
                />
                <Button onClick={addNewCustomer} variant="default" disabled={isLoading}>
                    <PlusCircle className="mr-2 h-5 w-5" /> Nieuwe Klant Handmatig Toevoegen
                </Button>
                <Button 
                    onClick={handleSubmit(onFormSubmit)} 
                    variant="secondary" 
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    disabled={isLoading || fields.length === 0}
                >
                    <Download className="mr-2 h-5 w-5" /> Genereer & Download Shopify CSV
                </Button>
                 {(fields.length > 0 ) && !isLoading && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="items-per-page-select" className="text-sm font-medium">Totaal klanten per pagina:</Label>
                      <Select
                        value={showAll ? 'all' : String(itemsPerPage)}
                        onValueChange={handleItemsPerPageChange}
                        disabled={isLoading}
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

        {isLoading && (
          <div className="text-center py-10">
            <RefreshCw className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
            <p className="text-xl text-muted-foreground">Processing CSV, please wait...</p>
          </div>
        )}

        {!isLoading && (
          <form onSubmit={handleSubmit(onFormSubmit)}>
            {itemsToPaginate.length === 0 && displayMode === 'all' && (
               <div className="text-center py-10">
                <p className="text-xl text-muted-foreground">Nog geen klanten geladen of toegevoegd.</p>
                <p className="text-sm text-muted-foreground">Klik op "Importeer Klanten CSV" of "Nieuwe Klant Handmatig Toevoegen" om te beginnen.</p>
              </div>
            )}
            {itemsToPaginate.length === 0 && displayMode === 'errors' && (
                 <div className="text-center py-10">
                 <p className="text-xl text-muted-foreground">Geen klanten met validatiefouten gevonden.</p>
                 <Button onClick={() => { setDisplayMode('all'); setCurrentPage(1);}} variant="link">Toon alle klanten</Button>
               </div>
            )}

            {paginatedItemsForRender.map(({ field, originalIndex }) => {
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
        )}
      </div>
    </FormProvider>
  );
}
    

    