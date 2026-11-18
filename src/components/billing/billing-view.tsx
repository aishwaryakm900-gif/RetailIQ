'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ClockAlert,
  User,
  Phone,
  CreditCard,
  History,
  ShoppingBag,
  Eye,
  PackagePlus,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { daysUntil } from '@/lib/retail-rules';
import { Batch, Bill, PaymentMethod, PaymentStatus, Product } from '@/lib/retail-types';
import { formatINR } from '@/lib/utils';
import { InvoiceModal } from './invoice-modal';
import { toast } from 'sonner';

interface CartLine {
  productId: string;
  qty: number;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `bill-${crypto.randomUUID()}`;
  }
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function BillingView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const { shop, products, batches, bills, commitGeneratedBill, markBillPaid } = useRetailStore();

  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  // New Bill draft state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PAID');
  const [discountPct, setDiscountPct] = useState<number>(0);

  // Product search & selector state
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addQty, setAddQty] = useState<number>(1);

  // Active bill items & submission guard
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [draftIdempotencyKey, setDraftIdempotencyKey] = useState<string>(() =>
    createIdempotencyKey()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invoice preview modal
  const [activeInvoice, setActiveInvoice] = useState<Bill | null>(null);

  // Billing History filters
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [historyMethodFilter, setHistoryMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');

  // Compute live available stock & FEFO-ordered batches per product
  const inventoryIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        product: Product;
        availableStock: number;
        orderedBatches: Batch[];
        earliestDaysLeft: number | null;
      }
    >();

    for (const product of products) {
      const orderedBatches = batches
        .filter((b) => b.productId === product.id && b.qtyOnHand > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const availableStock = orderedBatches.reduce((sum, b) => sum + b.qtyOnHand, 0);
      const earliestDaysLeft = orderedBatches[0]
        ? daysUntil(orderedBatches[0].expiryDate)
        : null;

      map.set(product.id, {
        product,
        availableStock,
        orderedBatches,
        earliestDaysLeft,
      });
    }
    return map;
  }, [products, batches]);

  // Search products by name, barcode, SKU, or product ID
  const filteredCatalog = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = Array.from(inventoryIndex.values());
    if (!q) return list;
    return list.filter(({ product }) => {
      return (
        product.name.toLowerCase().includes(q) ||
        product.barcode.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        product.id.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q)
      );
    });
  }, [inventoryIndex, productQuery]);

  const effectiveSelectedId = useMemo(() => {
    if (selectedProductId && inventoryIndex.has(selectedProductId)) {
      return selectedProductId;
    }
    const firstInStock = filteredCatalog.find((x) => x.availableStock > 0);
    return firstInStock?.product.id ?? filteredCatalog[0]?.product.id ?? '';
  }, [selectedProductId, inventoryIndex, filteredCatalog]);

  const selectedEntry = effectiveSelectedId ? inventoryIndex.get(effectiveSelectedId) ?? null : null;

  // Enrich cart lines with live stock, authoritative price, FEFO preview, and warnings
  const enrichedCart = useMemo(() => {
    return cartLines
      .map((line) => {
        const entry = inventoryIndex.get(line.productId);
        if (!entry) return null;

        const { product, availableStock, orderedBatches, earliestDaysLeft } = entry;
        const unitPrice = product.sellingPrice;
        const subtotal = Math.round(unitPrice * line.qty * 100) / 100;

        // Live FEFO batch allocation preview
        let rem = line.qty;
        const fefoPreview: Array<{ batchNo: string; expiryDate: string; take: number }> = [];
        for (const b of orderedBatches) {
          if (rem <= 0) break;
          const take = Math.min(b.qtyOnHand, rem);
          fefoPreview.push({ batchNo: b.batchNo, expiryDate: b.expiryDate, take });
          rem -= take;
        }

        return {
          product,
          qty: line.qty,
          unitPrice,
          subtotal,
          availableStock,
          earliestDaysLeft,
          fefoPreview,
          isInsufficient: line.qty > availableStock,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cartLines, inventoryIndex]);

  const totals = useMemo(() => {
    const subtotal =
      Math.round(enrichedCart.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
    const clampedDisc = Math.min(50, Math.max(0, Number(discountPct) || 0));
    const discountAmount = Math.round(subtotal * (clampedDisc / 100) * 100) / 100;
    const grandTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    const totalUnits = enrichedCart.reduce((sum, item) => sum + item.qty, 0);
    const hasInsufficientStock = enrichedCart.some((item) => item.isInsufficient);

    return {
      subtotal,
      discountPct: clampedDisc,
      discountAmount,
      grandTotal,
      totalUnits,
      hasInsufficientStock,
    };
  }, [enrichedCart, discountPct]);

  // Add product to bill (prevents duplicate rows by updating existing product quantity)
  const handleAddProduct = (targetProductId?: string, requestedQty?: number) => {
    const pid = targetProductId ?? effectiveSelectedId;
    const qtyToAdd = Math.floor(requestedQty ?? addQty);
    setStockWarning(null);

    if (!pid) {
      toast.error('Please select a product from your inventory.');
      return;
    }

    const entry = inventoryIndex.get(pid);
    if (!entry) {
      toast.error('Product is not available in inventory.');
      return;
    }

    if (entry.availableStock <= 0) {
      const msg = `${entry.product.name} is currently out of stock.`;
      setStockWarning(msg);
      toast.error(msg);
      return;
    }

    if (!qtyToAdd || qtyToAdd <= 0) {
      toast.error('Quantity must be at least 1.');
      return;
    }

    const existing = cartLines.find((l) => l.productId === pid);
    const currentInCart = existing?.qty ?? 0;
    const nextQty = currentInCart + qtyToAdd;

    if (nextQty > entry.availableStock) {
      const msg = `Insufficient stock for ${entry.product.name}. Only ${entry.availableStock} unit(s) available (${currentInCart} already in bill).`;
      setStockWarning(msg);
      toast.error(msg);
      return;
    }

    if (existing) {
      setCartLines((prev) =>
        prev.map((l) => (l.productId === pid ? { ...l, qty: nextQty } : l))
      );
      toast.success(`Updated ${entry.product.name} quantity to ${nextQty}`);
    } else {
      setCartLines((prev) => [...prev, { productId: pid, qty: nextQty }]);
      toast.success(`Added ${qtyToAdd}x ${entry.product.name} to bill`);
    }

    setAddQty(1);
    setDraftIdempotencyKey(createIdempotencyKey());
  };

  const handleUpdateQty = (productId: string, nextQty: number) => {
    setStockWarning(null);
    const entry = inventoryIndex.get(productId);
    if (!entry) return;

    const cleanQty = Math.floor(nextQty);
    if (cleanQty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    if (cleanQty > entry.availableStock) {
      const msg = `Cannot exceed available stock for ${entry.product.name} (${entry.availableStock} available).`;
      setStockWarning(msg);
      toast.error(msg);
      return;
    }

    setCartLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty: cleanQty } : l))
    );
    setDraftIdempotencyKey(createIdempotencyKey());
  };

  const handleRemoveItem = (productId: string) => {
    setStockWarning(null);
    setCartLines((prev) => prev.filter((l) => l.productId !== productId));
    setDraftIdempotencyKey(createIdempotencyKey());
  };

  const handleClearBill = () => {
    setCartLines([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPct(0);
    setPaymentMethod('CASH');
    setPaymentStatus('PAID');
    setStockWarning(null);
    setDraftIdempotencyKey(createIdempotencyKey());
  };

  const handleGenerateBill = async () => {
    if (isSubmitting) return;
    setStockWarning(null);

    if (cartLines.length === 0) {
      toast.error('Add at least one product before generating a bill.');
      return;
    }

    if (totals.hasInsufficientStock) {
      const msg = 'One or more products exceed available stock. Adjust quantities before billing.';
      setStockWarning(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const apiLocale = locale || 'en';
      const response = await fetch(`/${apiLocale}/api/billing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: draftIdempotencyKey,
          shop: {
            id: shop.id,
            name: shop.name,
            address: shop.address,
            phone: shop.phone,
          },
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          paymentMethod,
          paymentStatus,
          discountPct: totals.discountPct,
          // Send only productId + qty; backend computes authoritative prices & totals
          items: cartLines.map((l) => ({ productId: l.productId, qty: l.qty })),
          inventorySnapshot: {
            products,
            batches,
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        const errMsg = json.error || 'Failed to generate bill. No inventory was deducted.';
        setStockWarning(errMsg);
        toast.error(errMsg);
        return;
      }

      commitGeneratedBill({
        bill: json.bill,
        sale: json.sale,
        updatedBatches: json.updatedBatches,
        updatedProducts: json.updatedProducts,
      });

      setActiveInvoice(json.bill);
      toast.success(
        `Invoice ${json.bill.invoiceNumber} generated (${formatINR(json.bill.grandTotal, intlLocale)}) — Inventory & Sales updated!`
      );

      // Reset draft bill cleanly for the next customer
      handleClearBill();
    } catch (err: any) {
      const errMsg =
        err?.message || 'Network error while generating bill. No stock was deducted.';
      setStockWarning(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Billing History filtering
  const filteredBills = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return bills.filter((bill) => {
      if (historyStatusFilter !== 'ALL' && bill.paymentStatus !== historyStatusFilter) {
        return false;
      }
      if (historyMethodFilter !== 'ALL' && bill.paymentMethod !== historyMethodFilter) {
        return false;
      }
      if (q) {
        const hit =
          bill.invoiceNumber.toLowerCase().includes(q) ||
          (bill.customerName ?? '').toLowerCase().includes(q) ||
          (bill.customerPhone ?? '').toLowerCase().includes(q) ||
          bill.items.some((it) => it.productName.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [bills, historyQuery, historyStatusFilter, historyMethodFilter]);

  const billingSummaryStats = useMemo(() => {
    const totalBilled = bills.reduce((sum, b) => sum + b.grandTotal, 0);
    const paidCount = bills.filter((b) => b.paymentStatus === 'PAID').length;
    const pendingCount = bills.filter((b) => b.paymentStatus === 'PENDING').length;
    return { totalBills: bills.length, totalBilled, paidCount, pendingCount };
  }, [bills]);

  return (
    <div className="space-y-5">
      {/* Page Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('billing')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create customer bills, print invoices, and automatically update inventory and sales.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'new'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>New Bill</span>
            {cartLines.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                {cartLines.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Billing History ({bills.length})</span>
          </button>
        </div>
      </div>

      {/* Simplified FEFO Info Banner */}
      <div className="flex items-start sm:items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200">
        <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
        <span>
          <strong>FEFO – First Expired, First Out:</strong> Products with the nearest expiry date
          are sold first to reduce product wastage.
        </span>
      </div>

      {activeTab === 'new' ? (
        products.length === 0 ? (
          /* Clean Empty Inventory Prompt */
          <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              No Products in Inventory Yet
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
              Only products available in your store inventory can be billed. Add products to your
              Inventory first, then return here to generate customer bills.
            </p>
            <div className="pt-2">
              <Link href="/inventory">
                <Button size="sm" className="gap-1.5">
                  <PackagePlus className="w-4 h-4" />
                  <span>Go to Inventory to Add Stock</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* LEFT 2 COLUMNS: Search, Add Product & Bill Line Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Product Search & Quick Add Card */}
              <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Search &amp; Add Products from Inventory
                  </h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {products.length} SKU(s) in catalog
                  </span>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search by product name, barcode, SKU, or product ID..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50/70 dark:bg-neutral-950 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                {/* Product Selector + Qty + Add Button */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Product
                    </label>
                    <select
                      value={effectiveSelectedId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setAddQty(1);
                        setStockWarning(null);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                    >
                      {filteredCatalog.length === 0 ? (
                        <option value="">No matching inventory products</option>
                      ) : (
                        filteredCatalog.map(({ product, availableStock }) => (
                          <option
                            key={product.id}
                            value={product.id}
                            disabled={availableStock <= 0}
                          >
                            {product.imageEmoji} {product.name} —{' '}
                            {formatINR(product.sellingPrice, intlLocale)} (
                            {availableStock > 0 ? `${availableStock} in stock` : 'Out of stock'})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={selectedEntry?.availableStock || 1}
                      value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      type="button"
                      className="w-full gap-1.5 h-[38px]"
                      disabled={!selectedEntry || selectedEntry.availableStock <= 0}
                      onClick={() => handleAddProduct()}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </Button>
                  </div>
                </div>

                {/* Live Selected Product Preview Strip */}
                {selectedEntry && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {selectedEntry.product.imageEmoji} {selectedEntry.product.name}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatINR(selectedEntry.product.sellingPrice, intlLocale)} / unit
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600 dark:text-gray-300 tabular-nums">
                        Available: <strong>{selectedEntry.availableStock}</strong>
                      </span>
                    </div>
                    {selectedEntry.earliestDaysLeft !== null &&
                      selectedEntry.earliestDaysLeft <= 7 && (
                        <Badge variant="warning" className="gap-1">
                          <ClockAlert className="w-3 h-3" />
                          Expires in {Math.max(0, selectedEntry.earliestDaysLeft)}d (FEFO first)
                        </Badge>
                      )}
                  </div>
                )}

                {/* Quick Matching Results Pills when searching */}
                {productQuery.trim() && filteredCatalog.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-gray-500">
                      Quick Add Matches ({filteredCatalog.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredCatalog.slice(0, 4).map(({ product, availableStock, earliestDaysLeft }) => (
                        <button
                          key={product.id}
                          type="button"
                          disabled={availableStock <= 0}
                          onClick={() => handleAddProduct(product.id, 1)}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {product.imageEmoji} {product.name}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatINR(product.sellingPrice, intlLocale)} • {availableStock} left
                              {earliestDaysLeft !== null && earliestDaysLeft <= 7
                                ? ` • Exp ${Math.max(0, earliestDaysLeft)}d`
                                : ''}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                            + Add
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {stockWarning && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>{stockWarning}</span>
                  </div>
                )}
              </div>

              {/* Current Bill Items Table */}
              <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Bill Items ({enrichedCart.length})
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Adjust quantities or remove items before generating the bill.
                    </p>
                  </div>
                  {enrichedCart.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1"
                      onClick={handleClearBill}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear Bill
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Unit Price</th>
                        <th className="py-3 px-4 text-center">Quantity</th>
                        <th className="py-3 px-4 text-right">Subtotal</th>
                        <th className="py-3 px-4 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
                      {enrichedCart.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-xs text-gray-500">
                            No items added yet. Search and add products from inventory above.
                          </td>
                        </tr>
                      ) : (
                        enrichedCart.map((item) => (
                          <tr
                            key={item.product.id}
                            className="hover:bg-gray-50/60 dark:hover:bg-neutral-800/30"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-start gap-2.5">
                                <span className="text-lg mt-0.5">{item.product.imageEmoji}</span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                    <span>{item.product.name}</span>
                                    {item.earliestDaysLeft !== null &&
                                      item.earliestDaysLeft <= 7 && (
                                        <Badge variant="warning" className="text-[10px]">
                                          Exp {Math.max(0, item.earliestDaysLeft)}d
                                        </Badge>
                                      )}
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    Stock: {item.availableStock} • FEFO:{' '}
                                    {item.fefoPreview
                                      .map((b) => `${b.batchNo} (${b.take})`)
                                      .join(', ')}
                                  </div>
                                  {item.isInsufficient && (
                                    <div className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-0.5">
                                      Exceeds available stock ({item.availableStock})
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 tabular-nums text-gray-700 dark:text-gray-300 font-medium">
                              {formatINR(item.unitPrice, intlLocale)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Decrease quantity for ${item.product.name}`}
                                  onClick={() => handleUpdateQty(item.product.id, item.qty - 1)}
                                  className="w-7 h-7 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-200"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.availableStock}
                                  value={item.qty}
                                  onChange={(e) =>
                                    handleUpdateQty(item.product.id, Number(e.target.value) || 1)
                                  }
                                  className="w-12 h-7 text-center text-xs font-bold rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                                />
                                <button
                                  type="button"
                                  aria-label={`Increase quantity for ${item.product.name}`}
                                  disabled={item.qty >= item.availableStock}
                                  onClick={() => handleUpdateQty(item.product.id, item.qty + 1)}
                                  className="w-7 h-7 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-200 disabled:opacity-40"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                              {formatINR(item.subtotal, intlLocale)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                aria-label={`Remove ${item.product.name}`}
                                onClick={() => handleRemoveItem(item.product.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Customer Details, Payment & Totals */}
            <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-4 sticky top-20">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Customer &amp; Bill Summary
              </h2>

              {/* Customer Details (Optional) */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name (Optional)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Walk-in Customer"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+91 98450 00000"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                  >
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              {/* Optional Discount */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Bill Discount (%)</span>
                  <span className="text-[11px] text-gray-400">Optional (0–50%)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={discountPct}
                  onChange={(e) => {
                    const val = Math.min(50, Math.max(0, Number(e.target.value) || 0));
                    setDiscountPct(val);
                    setDraftIdempotencyKey(createIdempotencyKey());
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                />
              </div>

              {/* Dynamic Totals Breakdown */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Items ({totals.totalUnits} units)</span>
                  <span className="tabular-nums font-medium">
                    {formatINR(totals.subtotal, intlLocale)}
                  </span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Discount ({totals.discountPct}%)</span>
                    <span className="tabular-nums font-medium">
                      -{formatINR(totals.discountAmount, intlLocale)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-neutral-800 text-base font-bold text-gray-900 dark:text-white">
                  <span>Final Payable</span>
                  <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatINR(totals.grandTotal, intlLocale)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  className="w-full gap-2 font-semibold h-10"
                  disabled={
                    enrichedCart.length === 0 || totals.hasInsufficientStock || isSubmitting
                  }
                  onClick={handleGenerateBill}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Invoice...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Generate Bill</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={enrichedCart.length === 0 && !customerName && !customerPhone}
                  onClick={handleClearBill}
                >
                  Clear Bill
                </Button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ==================== BILLING HISTORY TAB ==================== */
        <div className="space-y-4">
          {/* History KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-neutral-900 rounded-card p-4 border border-surface-border dark:border-neutral-800 shadow-card">
              <div className="text-xs font-medium text-gray-500 uppercase">Total Invoices</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 tabular-nums">
                {billingSummaryStats.totalBills}
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-card p-4 border border-surface-border dark:border-neutral-800 shadow-card">
              <div className="text-xs font-medium text-gray-500 uppercase">Total Billed Revenue</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
                {formatINR(billingSummaryStats.totalBilled, intlLocale)}
              </div>
            </div>
            <div className="bg-white dark:bg-neutral-900 rounded-card p-4 border border-surface-border dark:border-neutral-800 shadow-card">
              <div className="text-xs font-medium text-gray-500 uppercase">Paid / Pending</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 tabular-nums">
                {billingSummaryStats.paidCount}{' '}
                <span className="text-sm font-medium text-amber-600">
                  / {billingSummaryStats.pendingCount} pending
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white dark:bg-neutral-900 rounded-card p-4 border border-surface-border dark:border-neutral-800 shadow-card flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search by invoice number, customer name, phone, or product..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50/70 dark:bg-neutral-950 text-gray-900 dark:text-white"
              />
            </div>

            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value as 'ALL' | PaymentStatus)}
              aria-label="Filter by payment status"
              className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-gray-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
            </select>

            <select
              value={historyMethodFilter}
              onChange={(e) => setHistoryMethodFilter(e.target.value as 'ALL' | PaymentMethod)}
              aria-label="Filter by payment method"
              className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-gray-200"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          {/* History Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-3 px-4">Invoice Number</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Products</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-gray-500">
                        {bills.length === 0
                          ? 'No bills generated yet. Create your first invoice in the New Bill tab.'
                          : 'No invoices match your search or filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => {
                      const totalUnits = bill.items.reduce((s, it) => s + it.qty, 0);
                      return (
                        <tr
                          key={bill.id}
                          onClick={() => setActiveInvoice(bill)}
                          className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                            {bill.invoiceNumber}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300">
                            {new Date(bill.createdAt).toLocaleString(intlLocale, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-xs text-gray-900 dark:text-white">
                              {bill.customerName || 'Walk-in Customer'}
                            </div>
                            {bill.customerPhone && (
                              <div className="text-[11px] text-gray-500">{bill.customerPhone}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">{bill.items.length} product(s)</span>
                            <span className="text-gray-400"> • {totalUnits} units</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                            {formatINR(bill.grandTotal, intlLocale)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={bill.paymentStatus === 'PAID' ? 'healthy' : 'warning'}>
                                {bill.paymentStatus}
                              </Badge>
                              <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                                <CreditCard className="w-3 h-3" />
                                {bill.paymentMethod}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveInvoice(bill);
                              }}
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {activeInvoice && (
        <InvoiceModal
          bill={bills.find((b) => b.id === activeInvoice.id) ?? activeInvoice}
          intlLocale={intlLocale}
          onClose={() => setActiveInvoice(null)}
          onMarkPaid={(billId) => {
            markBillPaid(billId);
            toast.success('Invoice marked as PAID');
          }}
        />
      )}
    </div>
  );
}

