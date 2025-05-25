
'use client';

import type React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shopifyCustomersSchema, type ShopifyCustomersFormData, type ShopifyCustomerFormData } from '@/schemas/customer';
import { shopifyProductsSchema, type ShopifyProductsFormData, type ShopifyProductFormData } from '@/schemas/product';

import { generateShopifyCustomerCsv, parseMagentoCustomerCsv, type ParseCustomerResult } from '@/lib/customer-csv-converter';
import { generateShopifyProductCsv, parseMagentoProductCsv, type ParseProductResult } from '@/lib/product-csv-converter';

import { Button } from '@/components/ui/button';
import { CustomerEntryForm } from '@/components/customer-entry-form';
import { ProductEntryForm } from '@/components/product-entry-form';
import { PaginationControls } from '@/components/pagination-controls';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, PlusCircle, RefreshCw, SearchCheck, Users, ShoppingBag, AlignLeft, Image as ImageIcon, MailPlus, MailMinus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const PAGE_OPTIONS = [5, 10, 20, 50, 100];
type DisplayMode = 'all' | 'errors' | 'test';

export default function CsvConverterPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'customer' | 'product'>('customer');

  // Customer specific state
  const customerFileInputRef = useRef<HTMLInputElement>(null);
  const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
  const [customerItemsPerPage, setCustomerItemsPerPage] = useState<number>(PAGE_OPTIONS[0]);
  const [customerShowAll, setCustomerShowAll] = useState<boolean>(false);
  const [customerIsLoading, setCustomerIsLoading] = useState(false);
  const [customerDisplayMode, setCustomerDisplayMode] = useState<DisplayMode>('all');
  const [customerCurrentErrorIndices, setCustomerCurrentErrorIndices] = useState<number[]>([]);
  const [customerCurrentTestFilterIndices, setCustomerCurrentTestFilterIndices] = useState<number[]>([]);
  const [allCustomersSubscribed, setAllCustomersSubscribed] = useState(false);


  // Product specific state
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const [productCurrentPage, setProductCurrentPage] = useState(1);
  const [productItemsPerPage, setProductItemsPerPage] = useState<number>(PAGE_OPTIONS[0]);
  const [productShowAll, setProductShowAll] = useState<boolean>(false);
  const [productIsLoading, setProductIsLoading] = useState(false);
  const [productDisplayMode, setProductDisplayMode] = useState<DisplayMode>('all');
  const [productCurrentErrorIndices, setProductCurrentErrorIndices] = useState<number[]>([]);
  const [productCurrentTestFilterIndices, setProductCurrentTestFilterIndices] = useState<number[]>([]);
  const [magentoBaseImageUrl, setMagentoBaseImageUrl] = useState<string>('');
  const magentoBaseImageUrlRef = useRef<string>(magentoBaseImageUrl);

  useEffect(() => {
    magentoBaseImageUrlRef.current = magentoBaseImageUrl;
  }, [magentoBaseImageUrl]);


  const customerFormMethods = useForm<ShopifyCustomersFormData>({
    resolver: zodResolver(shopifyCustomersSchema),
    defaultValues: { customers: [] },
    mode: 'onChange',
  });

  const productFormMethods = useForm<ShopifyProductsFormData>({
    resolver: zodResolver(shopifyProductsSchema),
    defaultValues: { products: [] },
    mode: 'onChange',
  });

  const {
    control: customerControl,
    handleSubmit: handleCustomerSubmit,
    reset: resetCustomerForm,
    formState: customerFormState,
    watch: watchCustomerForm,
    trigger: triggerCustomerForm,
    getValues: getCustomerValues,
    setValue: setCustomerValue,
  } = customerFormMethods;

  const watchedCustomers = watchCustomerForm("customers");

  useEffect(() => {
    if (watchedCustomers && watchedCustomers.length > 0) {
      const allSub = watchedCustomers.every(c => c.acceptsMarketing);
      setAllCustomersSubscribed(allSub);
    } else {
      setAllCustomersSubscribed(false);
    }
  }, [watchedCustomers]);

  const { fields: customerFields, append: appendCustomer, remove: removeCustomer } = useFieldArray({
    control: customerControl,
    name: 'customers',
  });

   const {
    control: productControl,
    handleSubmit: handleProductSubmit,
    reset: resetProductForm,
    formState: productFormState,
    watch: watchProductForm,
    trigger: triggerProductForm,
    getValues: getProductValues,
  } = productFormMethods;

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
    control: productControl,
    name: 'products',
  });


  // --- Customer Error Handling ---
  useEffect(() => {
    if (customerFormState.errors.customers && customerFields.length > 0) {
      const indices: number[] = [];
      (customerFormState.errors.customers as any[]).forEach((errorObj, i) => {
        if (errorObj && Object.keys(errorObj).length > 0) {
          indices.push(i);
        }
      });
      setCustomerCurrentErrorIndices(indices);
    } else {
      setCustomerCurrentErrorIndices([]);
    }
  }, [customerFormState.errors.customers, customerFields]);


  useEffect(() => {
    if (customerDisplayMode === 'errors' && customerCurrentErrorIndices.length === 0 && customerFields.length > 0 && !customerIsLoading) {
      setCustomerDisplayMode('all');
      // toast({ title: "All Customer Errors Fixed!", description: "Displaying all customers." });
      setCustomerCurrentPage(1);
    }
  }, [customerDisplayMode, customerCurrentErrorIndices, customerFields.length, customerIsLoading, toast]);

  // --- Product Error Handling ---
   useEffect(() => {
    if (productFormState.errors.products && productFields.length > 0) {
      const indices: number[] = [];
      (productFormState.errors.products as any[]).forEach((errorObj, i) => {
        if (errorObj && Object.keys(errorObj).length > 0) {
          indices.push(i);
        }
      });
      setProductCurrentErrorIndices(indices);
    } else {
      setProductCurrentErrorIndices([]);
    }
  }, [productFormState.errors.products, productFields]);

  useEffect(() => {
    if (productDisplayMode === 'errors' && productCurrentErrorIndices.length === 0 && productFields.length > 0 && !productIsLoading) {
      setProductDisplayMode('all');
      // toast({ title: "All Product Errors Fixed!", description: "Displaying all products." });
      setProductCurrentPage(1);
    }
  }, [productDisplayMode, productCurrentErrorIndices, productFields.length, productIsLoading, toast]);


  // --- Customer Pagination Data ---
  const customerItemsToPaginate: { field: ShopifyCustomerFormData & { id: string }, originalIndex: number }[] = useMemo(() => {
    let sourceFields = customerFields;
    let indicesToUse: number[] = [];

    if (customerDisplayMode === 'errors') indicesToUse = customerCurrentErrorIndices;
    else if (customerDisplayMode === 'test') indicesToUse = customerCurrentTestFilterIndices;
    else return sourceFields.map((field, index) => ({ field: field as (ShopifyCustomerFormData & { id: string }), originalIndex: index }));

    return indicesToUse
      .map(originalIndex => {
        const field = sourceFields[originalIndex];
        return field ? { field: field as (ShopifyCustomerFormData & { id: string }), originalIndex } : null;
      })
      .filter(item => item !== null) as { field: ShopifyCustomerFormData & { id: string }, originalIndex: number }[];
  }, [customerDisplayMode, customerFields, customerCurrentErrorIndices, customerCurrentTestFilterIndices]);

  const totalCustomerItemsForCurrentMode = useMemo(() => {
    if (customerDisplayMode === 'errors') return customerCurrentErrorIndices.length;
    if (customerDisplayMode === 'test') return customerCurrentTestFilterIndices.length;
    return customerFields.length;
  }, [customerDisplayMode, customerFields.length, customerCurrentErrorIndices.length, customerCurrentTestFilterIndices.length]);

  // --- Product Pagination Data ---
  const productItemsToPaginate: { field: ShopifyProductFormData & { id: string }, originalIndex: number }[] = useMemo(() => {
    let sourceFields = productFields;
    let indicesToUse: number[] = [];

    if (productDisplayMode === 'errors') indicesToUse = productCurrentErrorIndices;
    else if (productDisplayMode === 'test') indicesToUse = productCurrentTestFilterIndices;
    else return sourceFields.map((field, index) => ({ field: field as (ShopifyProductFormData & { id: string }), originalIndex: index }));
    
    return indicesToUse
      .map(originalIndex => {
        const field = sourceFields[originalIndex];
        return field ? { field: field as (ShopifyProductFormData & {id: string}), originalIndex } : null;
      })
      .filter(item => item !== null) as { field: ShopifyProductFormData & { id: string }, originalIndex: number }[];
  }, [productDisplayMode, productFields, productCurrentErrorIndices, productCurrentTestFilterIndices]);

  const totalProductItemsForCurrentMode = useMemo(() => {
    if (productDisplayMode === 'errors') return productCurrentErrorIndices.length;
    if (productDisplayMode === 'test') return productCurrentTestFilterIndices.length;
    return productFields.length;
  }, [productDisplayMode, productFields.length, productCurrentErrorIndices.length, productCurrentTestFilterIndices.length]);


  // --- Generic Pagination Logic ---
  useEffect(() => {
    const totalItems = activeTab === 'customer' ? totalCustomerItemsForCurrentMode : totalProductItemsForCurrentMode;
    const currentPage = activeTab === 'customer' ? customerCurrentPage : productCurrentPage;
    const setCurrentPage = activeTab === 'customer' ? setCustomerCurrentPage : setProductCurrentPage;
    const itemsPerPage = activeTab === 'customer' ? customerItemsPerPage : productItemsPerPage;
    const showAll = activeTab === 'customer' ? customerShowAll : productShowAll;
    const displayMode = activeTab === 'customer' ? customerDisplayMode : productDisplayMode;

    if (totalItems === 0 && displayMode === 'all') {
      setCurrentPage(1);
      return;
    }
    if (totalItems === 0 && (displayMode === 'errors' || displayMode === 'test')) {
      setCurrentPage(1);
      return;
    }

    const currentActualItemsPerPage = showAll ? (totalItems > 0 ? totalItems : 1) : itemsPerPage;
    const newTotalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / currentActualItemsPerPage);

    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages > 0 ? newTotalPages : 1);
    }
  }, [
    activeTab, 
    totalCustomerItemsForCurrentMode, customerCurrentPage, customerItemsPerPage, customerShowAll, customerDisplayMode,
    totalProductItemsForCurrentMode, productCurrentPage, productItemsPerPage, productShowAll, productDisplayMode
  ]);


  // --- Customer Actions ---
  const addNewCustomer = () => {
    setCustomerDisplayMode('all');
    appendCustomer({
      id: crypto.randomUUID(), firstName: '', lastName: '', email: '', company: '', address1: '',
      address2: '', city: '', province: '', provinceCode: '', country: '', countryCode: '',
      zip: '', phone: '', acceptsMarketing: false, acceptsSmsMarketing: false, tags: '', note: '', taxExempt: false,
    });
    const newTotalAllItems = customerFields.length + 1;
    const itemsPerPageForAll = customerShowAll ? (newTotalAllItems > 0 ? newTotalAllItems : 1) : customerItemsPerPage;
    const newTotalPagesForAll = Math.ceil(newTotalAllItems / itemsPerPageForAll);
    setCustomerCurrentPage(newTotalPagesForAll);
    toast({ title: "New customer entry added", description: "Fill in the details for the new customer." });
  };

  const onCustomerFormSubmit = (data: ShopifyCustomersFormData) => {
    if (data.customers.length === 0) {
      toast({ title: 'No Customers to Export', description: 'Please add at least one customer.', variant: 'destructive' });
      return;
    }
    try {
      const csvContent = generateShopifyCustomerCsv(data.customers);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', 'shopify_customers_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Shopify Customer CSV Generated', description: 'Download started.' });
    } catch (error) {
      console.error("Error generating customer CSV:", error);
      toast({ title: 'Customer CSV Generation Failed', variant: 'destructive' });
    }
  };

  const handleCustomerFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCustomerIsLoading(true);
      setCustomerDisplayMode('all');
      setCustomerCurrentPage(1);
      setCustomerCurrentTestFilterIndices([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvString = e.target?.result as string;
          const result: ParseCustomerResult = parseMagentoCustomerCsv(csvString);

          let parsedCustomers: Partial<ShopifyCustomerFormData>[] = [];
          if (result.type === 'customers_found') parsedCustomers = result.data;

          const newCustomersToSet = parsedCustomers.map(c => ({
            id: c.id || crypto.randomUUID(),
            firstName: c.firstName || '', lastName: c.lastName || '',
            email: c.email || '', company: c.company || '', address1: c.address1 || '',
            address2: c.address2 || '', city: c.city || '', province: c.province || '',
            provinceCode: c.provinceCode || '', country: c.country || '', countryCode: c.countryCode || '',
            zip: c.zip || '', phone: c.phone || '', acceptsMarketing: c.acceptsMarketing ?? false,
            acceptsSmsMarketing: c.acceptsSmsMarketing ?? false,
            tags: c.tags || '', note: c.note || '', taxExempt: c.taxExempt ?? false,
          } as ShopifyCustomerFormData));

          resetCustomerForm({ customers: newCustomersToSet });
          await new Promise(resolve => setTimeout(resolve, 0)); // Allow state to update
          const isValid = await triggerCustomerForm();

          let tempErrorIndices: number[] = [];
          if (!isValid && customerFormMethods.formState.errors.customers) {
            const customerErrors = customerFormMethods.formState.errors.customers as any[]; // Type assertion
            newCustomersToSet.forEach((_, i) => {
              if (customerErrors[i] && Object.keys(customerErrors[i]!).length > 0) {
                tempErrorIndices.push(i);
              }
            });
          }
          // setCustomerCurrentErrorIndices is handled by useEffect based on formState

          if (tempErrorIndices.length > 0) {
            setCustomerDisplayMode('errors');
            setCustomerCurrentPage(1);
            toast({ title: "Validation Errors Found", description: `Displaying ${tempErrorIndices.length} customer(s) with errors. Please review.`, variant: "destructive" });
          } else {
            setCustomerDisplayMode('all');
            setCustomerCurrentPage(1);
            if (result.type === 'customers_found' && newCustomersToSet.length > 0 && isValid) {
              toast({ title: 'Customer CSV Imported', description: `${newCustomersToSet.length} customer(s) loaded and valid.` });
            } else if (result.type === 'customers_found' && newCustomersToSet.length > 0 && !isValid) {
              // This case should be covered by the tempErrorIndices check above
              toast({ title: 'Imported with Validation Issues', description: 'Check form for errors. Errors have been highlighted.', variant: 'destructive' });
            } else if (result.type === 'no_customers_extracted') {
              toast({ title: 'Import Note', description: result.message });
            } else if (result.type === 'parse_error') {
              toast({ title: 'Import Failed', description: result.message, variant: 'destructive' });
            } else if (newCustomersToSet.length === 0 && result.type === 'customers_found') {
                 toast({ title: 'Import Note', description: 'CSV parsed, but no customer data extracted.' });
            }
          }
        } catch (errorCatch) {
          console.error("Error processing customer CSV:", errorCatch);
          setCustomerDisplayMode('all');
          toast({ title: 'Import Failed', description: 'Could not process customer CSV.', variant: 'destructive' });
        } finally {
          setCustomerIsLoading(false);
          if (customerFileInputRef.current) customerFileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCustomerItemsPerPageChange = (value: string) => {
    setCustomerShowAll(value === 'all');
    if (value !== 'all') setCustomerItemsPerPage(Number(value));
    setCustomerCurrentPage(1);
  };

  const handleFindCustomerTestEntries = () => {
    const allCustomers = getCustomerValues().customers;
    const indices: number[] = [];
    const testRegex = /\btest\b/i;
    allCustomers.forEach((customer, index) => {
      const searchableFields = [
        customer.firstName, customer.lastName, customer.email, customer.company,
        customer.address1, customer.address2, customer.city, customer.province,
        customer.country, customer.zip, customer.phone, customer.note
      ];
      if (searchableFields.some(field => typeof field === 'string' && field && testRegex.test(field))) {
        indices.push(index);
      }
    });
    setCustomerCurrentTestFilterIndices(indices);
    if (indices.length > 0) {
      setCustomerDisplayMode('test');
      setCustomerCurrentPage(1);
      toast({ title: "Test Customer Entries Found", description: `Displaying ${indices.length} customer(s) containing 'test'.` });
    } else {
      toast({ title: "No Test Customer Entries Found" });
    }
  };

  const handleToggleAllCustomerSubscriptions = () => {
    const currentCustomers = getCustomerValues().customers;
    const targetSubscriptionStatus = !allCustomersSubscribed;
    currentCustomers.forEach((_, index) => {
      setCustomerValue(`customers.${index}.acceptsMarketing`, targetSubscriptionStatus, { shouldValidate: true, shouldDirty: true });
    });
    setAllCustomersSubscribed(targetSubscriptionStatus); // Optimistically update UI
    toast({
      title: targetSubscriptionStatus ? "All Customers Subscribed" : "All Customers Unsubscribed",
      description: `Marketing preference updated for ${currentCustomers.length} customer(s).`
    });
  };


  // --- Product Actions ---
    const addNewProduct = () => {
    setProductDisplayMode('all');
    appendProduct({
      id: crypto.randomUUID(), handle: '', title: '', bodyHtml: '', vendor: '', productType: '',
      tags: '', published: true, option1Name: 'Title', option1Value: 'Default Title', option2Name: '', option2Value: '',
      option3Name: '', option3Value: '', variantSku: '', variantPrice: 0, variantInventoryQty: 0,
      variantWeight: 0, variantWeightUnit: 'g', variantRequiresShipping: true, variantTaxable: true,
      imageSrc: '', imagePosition:1, imageAltText: '', seoTitle: '', seoDescription: '', magentoProductType: 'simple', isVariantRow: false,
    });
    const newTotalAllItems = productFields.length + 1;
    const itemsPerPageForAll = productShowAll ? (newTotalAllItems > 0 ? newTotalAllItems : 1) : productItemsPerPage;
    const newTotalPagesForAll = Math.ceil(newTotalAllItems / itemsPerPageForAll);
    setProductCurrentPage(newTotalPagesForAll);
    toast({ title: "New product entry added", description: "Fill in the details for the new product." });
  };

  const onProductFormSubmit = (data: ShopifyProductsFormData) => {
    if (data.products.length === 0) {
      toast({ title: 'No Products to Export', description: 'Please add at least one product.', variant: 'destructive' });
      return;
    }
    try {
      const csvContent = generateShopifyProductCsv(data.products);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', 'shopify_products_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Shopify Product CSV Generated', description: 'Download started.' });
    } catch (error) {
      console.error("Error generating product CSV:", error);
      toast({ title: 'Product CSV Generation Failed', variant: 'destructive' });
    }
  };

  const handleProductFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProductIsLoading(true);
      setProductDisplayMode('all');
      setProductCurrentPage(1);
      setProductCurrentTestFilterIndices([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvString = e.target?.result as string;
          const currentBaseUrl = magentoBaseImageUrlRef.current; // Use the ref here
          const result: ParseProductResult = parseMagentoProductCsv(csvString, currentBaseUrl); 

          let parsedProducts: Partial<ShopifyProductFormData>[] = [];
          if (result.type === 'products_found') parsedProducts = result.data;
          
          const newProductsToSet = parsedProducts.map(p => ({
            id: p.id || crypto.randomUUID(),
            handle: p.handle || '',
            title: p.title || '',
            bodyHtml: p.bodyHtml || '',
            vendor: p.vendor || '',
            productType: p.productType || '',
            tags: p.tags || '',
            published: p.published ?? true,
            option1Name: p.option1Name || 'Title',
            option1Value: p.option1Value || 'Default Title',
            option2Name: p.option2Name || '',
            option2Value: p.option2Value || '',
            option3Name: p.option3Name || '',
            option3Value: p.option3Value || '',
            variantSku: p.variantSku || '',
            variantPrice: p.variantPrice === undefined ? 0 : p.variantPrice,
            variantCompareAtPrice: p.variantCompareAtPrice,
            variantInventoryQty: p.variantInventoryQty === undefined ? 0 : p.variantInventoryQty,
            variantRequiresShipping: p.variantRequiresShipping ?? true,
            variantTaxable: p.variantTaxable ?? true,
            variantWeight: p.variantWeight === undefined ? 0 : p.variantWeight,
            variantWeightUnit: p.variantWeightUnit || 'g',
            imageSrc: p.imageSrc || '',
            imagePosition: p.imagePosition === undefined ? 1 : p.imagePosition,
            imageAltText: p.imageAltText || '',
            seoTitle: p.seoTitle || '',
            seoDescription: p.seoDescription || '',
            magentoProductType: p.magentoProductType || 'simple',
            isVariantRow: p.isVariantRow || false,
          } as ShopifyProductFormData));

          resetProductForm({ products: newProductsToSet });
          await new Promise(resolve => setTimeout(resolve, 0)); // Allow state to update
          const isValid = await triggerProductForm();

          let tempErrorIndices: number[] = [];
           if (!isValid && productFormMethods.formState.errors.products) {
            const productErrors = productFormMethods.formState.errors.products as any[]; // Type assertion
            newProductsToSet.forEach((_, i) => {
              if (productErrors[i] && Object.keys(productErrors[i]!).length > 0) tempErrorIndices.push(i);
            });
          }
          // setProductCurrentErrorIndices is handled by useEffect

          if (tempErrorIndices.length > 0) {
            setProductDisplayMode('errors');
            setProductCurrentPage(1);
            toast({ title: "Validation Errors Found", description: `Displaying ${tempErrorIndices.length} product(s) with errors.`, variant: "destructive" });
          } else {
            setProductDisplayMode('all');
            setProductCurrentPage(1);
             if (result.type === 'products_found' && newProductsToSet.length > 0 && isValid) {
              toast({ title: 'Product CSV Imported', description: `${newProductsToSet.length} product entries loaded and valid.` });
            } else if (result.type === 'products_found' && newProductsToSet.length > 0 && !isValid) {
              toast({ title: 'Imported with Validation Issues', description: 'Check form for errors.', variant: 'destructive' });
            } else if (result.type === 'no_products_extracted') {
              toast({ title: 'Import Note', description: result.message });
            } else if (result.type === 'parse_error') {
              toast({ title: 'Import Failed', description: result.message, variant: 'destructive' });
            } else if (newProductsToSet.length === 0 && result.type === 'products_found'){
                 toast({ title: 'Import Note', description: 'CSV parsed, but no product data extracted.', variant: 'default'});
            }
          }
        } catch (errorCatch) {
          console.error("Error processing product CSV:", errorCatch);
          setProductDisplayMode('all');
          toast({ title: 'Import Failed', description: 'Could not process product CSV.', variant: 'destructive' });
        } finally {
          setProductIsLoading(false);
          if (productFileInputRef.current) productFileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  const handleProductItemsPerPageChange = (value: string) => {
    setProductShowAll(value === 'all');
    if (value !== 'all') setProductItemsPerPage(Number(value));
    setProductCurrentPage(1);
  };

  const handleFindProductTestEntries = () => {
    const allProducts = getProductValues().products;
    const indices: number[] = [];
    const testRegex = /\btest\b/i;
    allProducts.forEach((product, index) => {
      const searchableFields = [
        product.handle, product.title, product.bodyHtml, product.vendor, product.productType,
        product.variantSku, product.option1Value, product.option2Value, product.option3Value,
        product.seoTitle, product.seoDescription
      ];
      if (searchableFields.some(field => typeof field === 'string' && field && testRegex.test(field))) {
        indices.push(index);
      }
    });
    setProductCurrentTestFilterIndices(indices);
    if (indices.length > 0) {
      setProductDisplayMode('test');
      setProductCurrentPage(1);
      toast({ title: "Test Product Entries Found", description: `Displaying ${indices.length} product(s) containing 'test'.` });
    } else {
      toast({ title: "No Test Product Entries Found" });
    }
  };


  // --- Current Mode Data (for rendering) ---
  const isCustomerMode = activeTab === 'customer';
  const formMethods = isCustomerMode ? customerFormMethods : productFormMethods;
  const fields = isCustomerMode ? customerFields : productFields;
  const itemsToPaginate = isCustomerMode ? customerItemsToPaginate : productItemsToPaginate;
  const isLoading = isCustomerMode ? customerIsLoading : productIsLoading;
  const displayMode = isCustomerMode ? customerDisplayMode : productDisplayMode;
  const setDisplayMode = isCustomerMode ? setCustomerDisplayMode : setProductDisplayMode;
  const currentPage = isCustomerMode ? customerCurrentPage : productCurrentPage;
  const setCurrentPage = isCustomerMode ? setCustomerCurrentPage : setProductCurrentPage;
  const itemsPerPage = isCustomerMode ? customerItemsPerPage : productItemsPerPage;
  const showAll = isCustomerMode ? customerShowAll : productShowAll;
  const handleItemsPerPageChange = isCustomerMode ? handleCustomerItemsPerPageChange : handleProductItemsPerPageChange;
  const handleFileUpload = isCustomerMode ? handleCustomerFileUpload : handleProductFileUpload;
  const fileInputRef = isCustomerMode ? customerFileInputRef : productFileInputRef;
  const addNewEntry = isCustomerMode ? addNewCustomer : addNewProduct;
  const onFormSubmit = isCustomerMode ? onCustomerFormSubmit : onProductFormSubmit; 
  const handleSubmit = isCustomerMode ? handleCustomerSubmit : handleProductSubmit; 
  const currentErrorIndices = isCustomerMode ? customerCurrentErrorIndices : productCurrentErrorIndices;
  const currentTestFilterIndices = isCustomerMode ? customerCurrentTestFilterIndices : productCurrentTestFilterIndices;
  const handleFindTestEntries = isCustomerMode ? handleFindCustomerTestEntries : handleFindProductTestEntries;
  const entityName = isCustomerMode ? "Klant" : "Product";
  const entityNamePlural = isCustomerMode ? "Klanten" : "Producten";


  const actualItemsPerPage = showAll ? ( (isCustomerMode ? totalCustomerItemsForCurrentMode : totalProductItemsForCurrentMode) > 0 ? (isCustomerMode ? totalCustomerItemsForCurrentMode : totalProductItemsForCurrentMode) : 1) : itemsPerPage;
  const totalPages = (isCustomerMode ? totalCustomerItemsForCurrentMode : totalProductItemsForCurrentMode) === 0 ? 1 : Math.ceil((isCustomerMode ? totalCustomerItemsForCurrentMode : totalProductItemsForCurrentMode) / actualItemsPerPage);
  const startIndex = (currentPage - 1) * actualItemsPerPage;
  const paginatedItemsForRender = itemsToPaginate.slice(startIndex, startIndex + actualItemsPerPage);


  return (
    <FormProvider {...formMethods}>
      <div className="min-h-screen container mx-auto p-4 md:p-8">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <RefreshCw className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-primary">Magento naar Shopify {entityNamePlural} CSV Converter</h1>
          </div>
           <p className="text-lg text-muted-foreground">
            Upload uw Magento {entityName.toLowerCase()} CSV, bekijk en bewerk gepagineerde vermeldingen, en genereer vervolgens een importeerbaar Shopify {entityName.toLowerCase()} CSV-bestand.
            {displayMode === 'errors' && currentErrorIndices.length > 0 && (
                <span className="block mt-2 font-semibold text-destructive">Momenteel {currentErrorIndices.length} {entityName.toLowerCase()}(en) met fouten weergegeven.</span>
            )}
            {displayMode === 'errors' && currentErrorIndices.length === 0 && fields.length > 0 && !isLoading && (
                <span className="block mt-2 font-semibold text-green-600">Alle eerder gevonden fouten lijken te zijn opgelost!</span>
            )}
            {displayMode === 'test' && currentTestFilterIndices.length > 0 && (
                <span className="block mt-2 font-semibold text-blue-600">Momenteel {currentTestFilterIndices.length} {entityName.toLowerCase()}(en) die overeenkomen met 'test'-filter weergegeven.</span>
            )}
            {displayMode === 'test' && currentTestFilterIndices.length === 0 && fields.length > 0 && !isLoading && (
                <span className="block mt-2 font-semibold text-muted-foreground">Geen {entityName.toLowerCase()}(en) gevonden die overeenkomen met 'test'-filter.</span>
            )}
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'customer' | 'product')} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="customer" className="flex items-center gap-2"><Users className="h-5 w-5"/> Klanten</TabsTrigger>
                <TabsTrigger value="product" className="flex items-center gap-2"><ShoppingBag className="h-5 w-5"/> Producten</TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="mb-6 p-6 bg-card rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Acties voor {entityNamePlural}</h2>
            <div className="flex flex-wrap items-center gap-4">
                <Button 
                    onClick={() => !isLoading && fileInputRef.current?.click()} 
                    variant="outline" 
                    disabled={isLoading || (!isCustomerMode && magentoBaseImageUrl.trim() === '')}
                    title={!isCustomerMode && magentoBaseImageUrl.trim() === '' ? "Voer eerst de Magento Basis Afbeeldings-URL in" : `Importeer ${entityName} CSV`}
                >
                    <Upload className="mr-2 h-5 w-5" /> Importeer {entityName} CSV
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                    disabled={isLoading || (!isCustomerMode && magentoBaseImageUrl.trim() === '')}
                />
                <Button onClick={addNewEntry} variant="default" disabled={isLoading}>
                    <PlusCircle className="mr-2 h-5 w-5" /> Nieuwe {entityName} Handmatig Toevoegen
                </Button>
                <Button
                    onClick={handleSubmit(onFormSubmit)}
                    variant="secondary"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    disabled={isLoading || fields.length === 0}
                >
                    <Download className="mr-2 h-5 w-5" /> Genereer & Download Shopify {entityName} CSV
                </Button>
                {isCustomerMode && fields.length > 0 && !isLoading && (
                   <Button
                      onClick={handleToggleAllCustomerSubscriptions}
                      variant={allCustomersSubscribed ? "secondary" : "outline"}
                      className={allCustomersSubscribed ? "bg-accent hover:bg-accent/90 text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}
                      disabled={isLoading || fields.length === 0}
                    >
                      {allCustomersSubscribed ? <MailMinus className="mr-2 h-5 w-5" /> : <MailPlus className="mr-2 h-5 w-5" />}
                      {allCustomersSubscribed ? "Schrijf Iedereen Uit Nieuwsbrief" : "Schrijf Iedereen In Nieuwsbrief"}
                    </Button>
                )}
                {!isCustomerMode && (
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="magento-base-image-url" className="text-sm font-medium flex items-center"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Magento Basis Afbeeldings-URL:</Label>
                    <Input
                      id="magento-base-image-url"
                      type="url"
                      placeholder="https://uw-magento-winkel.com/media/catalog/product/"
                      value={magentoBaseImageUrl}
                      onChange={(e) => setMagentoBaseImageUrl(e.target.value)}
                      className="w-96"
                      disabled={isLoading}
                    />
                  </div>
                )}
                 {(fields.length > 0 ) && !isLoading && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="items-per-page-select" className="text-sm font-medium">Totaal {entityNamePlural.toLowerCase()} per pagina:</Label>
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
                     <Button onClick={handleFindTestEntries} variant="outline" disabled={isLoading || fields.length === 0}>
                        <SearchCheck className="mr-2 h-5 w-5" /> Vind 'Test' Vermeldingen
                    </Button>
                    {displayMode === 'errors' && currentErrorIndices.length > 0 && (
                        <Button onClick={() => { setDisplayMode('all'); setCurrentPage(1);}} variant="link">Toon alle {entityNamePlural.toLowerCase()} ({fields.length})</Button>
                    )}
                    {displayMode === 'all' && currentErrorIndices.length > 0 && (
                         <Button onClick={() => { setDisplayMode('errors'); setCurrentPage(1);}} variant="link" className="text-destructive hover:text-destructive/80">Toon alleen {entityName.toLowerCase()}(en) met fouten ({currentErrorIndices.length})</Button>
                    )}
                    {displayMode === 'test' && (
                        <Button onClick={() => { setDisplayMode('all'); setCurrentPage(1);}} variant="link">Toon alle {entityNamePlural.toLowerCase()} ({fields.length})</Button>
                    )}
                    {displayMode === 'all' && currentTestFilterIndices.length > 0 && ( 
                         <Button onClick={() => { setDisplayMode('test'); setCurrentPage(1);}} variant="link" className="text-blue-600 hover:text-blue-500">Toon alleen 'test' vermeldingen ({currentTestFilterIndices.length})</Button>
                    )}
                     {displayMode === 'test' && currentErrorIndices.length > 0 && ( 
                         <Button onClick={() => { setDisplayMode('errors'); setCurrentPage(1);}} variant="link" className="text-destructive hover:text-destructive/80">Toon {entityName.toLowerCase()}(en) met fouten ({currentErrorIndices.length})</Button>
                    )}
                     {displayMode === 'errors' && currentTestFilterIndices.length > 0 && (
                        <Button onClick={() => { setDisplayMode('test'); setCurrentPage(1);}} variant="link" className="text-blue-600 hover:text-blue-500">Toon alleen 'test' vermeldingen ({currentTestFilterIndices.length})</Button>
                    )}
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
            {fields.length === 0 && displayMode === 'all' && (
               <div className="text-center py-10">
                <p className="text-xl text-muted-foreground">Nog geen {entityNamePlural.toLowerCase()} geladen of toegevoegd.</p>
                <p className="text-sm text-muted-foreground">Klik op "Importeer {entityName} CSV" of "Nieuwe {entityName} Handmatig Toevoegen" om te beginnen.</p>
              </div>
            )}
            {itemsToPaginate.length === 0 && displayMode === 'errors' && (
                 <div className="text-center py-10">
                 <p className="text-xl text-muted-foreground">Geen {entityNamePlural.toLowerCase()} met validatiefouten gevonden.</p>
                 <Button onClick={() => { setDisplayMode('all'); setCurrentPage(1);}} variant="link">Toon alle {entityNamePlural.toLowerCase()}</Button>
               </div>
            )}
            {itemsToPaginate.length === 0 && displayMode === 'test' && (
                 <div className="text-center py-10">
                 <p className="text-xl text-muted-foreground">Geen {entityNamePlural.toLowerCase()} gevonden die overeenkomen met de 'test' filter.</p>
                 <Button onClick={() => { setDisplayMode('all'); setCurrentPage(1);}} variant="link">Toon alle {entityNamePlural.toLowerCase()}</Button>
               </div>
            )}
             {itemsToPaginate.length === 0 && displayMode === 'all' && fields.length > 0 && (currentErrorIndices.length > 0 || currentTestFilterIndices.length >0) && (
                <div className="text-center py-10">
                    <p className="text-xl text-muted-foreground">Alle {entityNamePlural.toLowerCase()} zijn verborgen door de huidige filterinstellingen.</p>
                    {currentErrorIndices.length > 0 && (
                        <Button onClick={() => { setDisplayMode('errors'); setCurrentPage(1);}} variant="link" className="text-destructive hover:text-destructive/80">Toon alleen {entityName.toLowerCase()}(en) met fouten ({currentErrorIndices.length})</Button>
                    )}
                     {currentTestFilterIndices.length > 0 && (
                        <Button onClick={() => { setDisplayMode('test'); setCurrentPage(1);}} variant="link" className="text-blue-600 hover:text-blue-500">Toon alleen 'test' vermeldingen ({currentTestFilterIndices.length})</Button>
                    )}
                </div>
            )}

            {paginatedItemsForRender.map(({ field, originalIndex }) => {
              if (isCustomerMode) {
                return (
                  <CustomerEntryForm
                    key={field.id}
                    control={customerControl}
                    index={originalIndex}
                    remove={() => removeCustomer(originalIndex)}
                    errors={customerFormState.errors} 
                  />
                );
              } else {
                const productField = field as ShopifyProductFormData & { id: string };
                return (
                  <ProductEntryForm
                    key={productField.id}
                    control={productControl}
                    index={originalIndex}
                    remove={() => removeProduct(originalIndex)}
                    errors={productFormState.errors}
                    productData={productField} 
                  />
                );
              }
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

    