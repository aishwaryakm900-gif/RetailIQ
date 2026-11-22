'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowDownUp, Box, CalendarClock, ChevronRight, Clock3, Layers3,
  Package, Plus, Search, Tag, Trash2, Truck, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES } from '@/lib/retail-config';
import { Product } from '@/lib/retail-types';
import { daysUntil } from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import { resolveProductImage } from '@/lib/retail-images';
import { AddProductModal } from '@/components/inventory/add-product-modal';
import { toast } from 'sonner';

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW' | 'OUT';
type ExpiryFilter = 'ALL' | 'WEEK' | 'MONTH' | 'FRESH';
type SortBy = 'RECENT' | 'NAME' | 'PRICE_HIGH' | 'PRICE_LOW' | 'QUANTITY';

function stockTone(onHand: number, minStock: number) {
  if (onHand === 0) return { label: 'Out of stock', className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900' };
  if (onHand < minStock) return { label: 'Low stock', className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900' };
  return { label: 'In stock', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900' };
}

export function InventoryView() {
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';
  const { products, batches, suppliers, sales, deleteProduct } = useRetailStore();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('RECENT');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const catalogue = useMemo(() => products.map((product, index) => {
    const activeBatches = batches.filter((batch) => batch.productId === product.id && batch.qtyOnHand > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const onHand = activeBatches.reduce((total, batch) => total + batch.qtyOnHand, 0);
    const nearestBatch = activeBatches[0];
    return {
      product,
      index,
      onHand,
      activeBatchCount: activeBatches.length,
      nearestBatch,
      daysToExpiry: nearestBatch ? daysUntil(nearestBatch.expiryDate) : Infinity,
    };
  }), [products, batches]);

  const stats = useMemo(() => ({
    total: products.length,
    stocked: catalogue.filter((item) => item.onHand > 0).length,
    low: catalogue.filter((item) => item.onHand > 0 && item.onHand < item.product.minStock).length,
    expiry: catalogue.filter((item) => item.daysToExpiry <= 7).length,
  }), [catalogue, products.length]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return catalogue.filter((item) => {
      const { product, onHand, daysToExpiry } = item;
      if (term && ![product.name, product.sku, product.barcode].some((text) => text.toLowerCase().includes(term))) return false;
      if (categoryFilter !== 'ALL' && product.category !== categoryFilter) return false;
      if (stockFilter === 'IN_STOCK' && onHand < product.minStock) return false;
      if (stockFilter === 'LOW' && (onHand === 0 || onHand >= product.minStock)) return false;
      if (stockFilter === 'OUT' && onHand !== 0) return false;
      if (expiryFilter === 'WEEK' && daysToExpiry > 7) return false;
      if (expiryFilter === 'MONTH' && daysToExpiry > 30) return false;
      if (expiryFilter === 'FRESH' && daysToExpiry <= 30) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'NAME') return a.product.name.localeCompare(b.product.name);
      if (sortBy === 'PRICE_HIGH') return b.product.sellingPrice - a.product.sellingPrice;
      if (sortBy === 'PRICE_LOW') return a.product.sellingPrice - b.product.sellingPrice;
      if (sortBy === 'QUANTITY') return b.onHand - a.onHand;
      return a.index - b.index;
    });
  }, [catalogue, query, categoryFilter, stockFilter, expiryFilter, sortBy]);

  const selected = catalogue.find((item) => item.product.id === selectedId) ?? null;
  const hasFilters = Boolean(query) || categoryFilter !== 'ALL' || stockFilter !== 'ALL' || expiryFilter !== 'ALL' || sortBy !== 'RECENT';
  const clearFilters = () => { setQuery(''); setCategoryFilter('ALL'); setStockFilter('ALL'); setExpiryFilter('ALL'); setSortBy('RECENT'); };

  const handleDeleteConfirm = () => {
    if (!productToDelete) return;
    const res = deleteProduct(productToDelete.id);
    if (res.ok) {
      toast.success(`"${productToDelete.name}" was removed from inventory.`);
      if (selectedId === productToDelete.id) {
        setSelectedId(null);
      }
    } else {
      toast.error(res.error || 'Failed to delete product.');
    }
    setProductToDelete(null);
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Catalogue</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">Inventory</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Manage and monitor your store products.</p>
        </div>
        <Button size="lg" className="gap-2 self-start bg-emerald-600 px-5 shadow-lg shadow-emerald-600/15 hover:bg-emerald-700 sm:self-auto" onClick={() => setAddProductOpen(true)}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </header>

      <section aria-label="Inventory summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Package} label="Total Products" value={stats.total} tone="emerald" />
        <Metric icon={Layers3} label="In Stock" value={stats.stocked} tone="blue" />
        <Metric icon={AlertTriangle} label="Low Stock" value={stats.low} tone="amber" />
        <Metric icon={CalendarClock} label="Near Expiry" value={stats.expiry} tone="red" />
      </section>

      <section className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-card dark:border-neutral-800 dark:bg-neutral-900 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or SKU..." className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={categoryFilter} onChange={setCategoryFilter} options={['ALL', ...PRODUCT_CATEGORIES]} display={{ ALL: 'All categories' }} />
            <Select value={stockFilter} onChange={(value) => setStockFilter(value as StockFilter)} options={['ALL', 'IN_STOCK', 'LOW', 'OUT']} display={{ ALL: 'All stock', IN_STOCK: 'In stock', LOW: 'Low stock', OUT: 'Out of stock' }} />
            <Select value={expiryFilter} onChange={(value) => setExpiryFilter(value as ExpiryFilter)} options={['ALL', 'WEEK', 'MONTH', 'FRESH']} display={{ ALL: 'All expiry', WEEK: '≤ 7 days', MONTH: '≤ 30 days', FRESH: '> 30 days' }} />
            <Select value={sortBy} onChange={(value) => setSortBy(value as SortBy)} options={['RECENT', 'NAME', 'PRICE_HIGH', 'PRICE_LOW', 'QUANTITY']} display={{ RECENT: 'Recently added', NAME: 'Name A–Z', PRICE_HIGH: 'Price: high', PRICE_LOW: 'Price: low', QUANTITY: 'Quantity' }} withIcon />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs dark:border-neutral-800">
          <span className="text-gray-500 dark:text-gray-400"><strong className="font-semibold text-gray-700 dark:text-gray-200">{shown.length}</strong> {shown.length === 1 ? 'product' : 'products'} shown</span>
          {hasFilters && <button type="button" onClick={clearFilters} className="font-semibold text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-400"><X className="mr-1 inline h-3.5 w-3.5" />Clear filters</button>}
        </div>
      </section>

      {shown.length ? (
        <motion.section layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Product catalogue">
          {shown.map((item, index) => (
            <ProductCard
              key={item.product.id}
              item={item}
              index={index}
              intlLocale={intlLocale}
              onClick={() => setSelectedId(item.product.id)}
              onDelete={(p) => setProductToDelete(p)}
            />
          ))}
        </motion.section>
      ) : (
        <EmptyState hasProducts={products.length > 0} clearFilters={clearFilters} />
      )}

      <AnimatePresence>
        {selected && (
          <ProductDrawer
            item={selected}
            suppliers={suppliers}
            sales={sales}
            intlLocale={intlLocale}
            onClose={() => setSelectedId(null)}
            onDelete={(p) => setProductToDelete(p)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addProductOpen && (
          <AddProductModal intlLocale={intlLocale} onClose={() => setAddProductOpen(false)} />
        )}
      </AnimatePresence>

      {/* Modern ReactBits-inspired Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <DeleteProductModal
            product={productToDelete}
            onClose={() => setProductToDelete(null)}
            onConfirm={handleDeleteConfirm}
            batchesCount={batches.filter((b) => b.productId === productToDelete.id).length}
            onHandUnits={batches
              .filter((b) => b.productId === productToDelete.id)
              .reduce((sum, b) => sum + b.qtyOnHand, 0)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: 'emerald' | 'blue' | 'amber' | 'red' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400', blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/45 dark:text-blue-400', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/45 dark:text-amber-400', red: 'bg-red-50 text-red-600 dark:bg-red-950/45 dark:text-red-400' };
  return <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card dark:border-neutral-800 dark:bg-neutral-900"><div className="flex items-center justify-between"><span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-bold tracking-tight text-gray-950 dark:text-white">{value.toLocaleString()}</p></div>;
}

function Select({ value, onChange, options, display = {}, withIcon = false }: { value: string; onChange: (value: string) => void; options: string[]; display?: Record<string, string>; withIcon?: boolean }) {
  return <label className="relative min-w-0"><span className="sr-only">Filter products</span>{withIcon && <ArrowDownUp className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />}<select value={value} onChange={(e) => onChange(e.target.value)} className={`h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white ${withIcon ? 'pl-7' : 'pl-3'} pr-7 text-xs font-medium text-gray-700 outline-none transition hover:border-gray-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-gray-200`}><option value="ALL">{display.ALL ?? 'All categories'}</option>{options.filter((option) => option !== 'ALL').map((option) => <option key={option} value={option}>{display[option] ?? option}</option>)}</select><ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-gray-400" /></label>;
}

function ProductCard({
  item,
  index,
  intlLocale,
  onClick,
  onDelete,
}: {
  item: { product: Product; onHand: number; daysToExpiry: number };
  index: number;
  intlLocale: string;
  onClick: () => void;
  onDelete: (product: Product) => void;
}) {
  const { product, onHand, daysToExpiry } = item;
  const stock = stockTone(onHand, product.minStock);
  const showExpiry = Number.isFinite(daysToExpiry) && daysToExpiry <= 30;

  // Resolve the accurate high-resolution photography for this product
  const imageSrc = resolveProductImage(product.name, product.category, product.imageUrl);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.035, 0.2) }}
      className="group relative flex min-h-[355px] flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white text-left shadow-card transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-gray-200/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-900 dark:hover:shadow-black/20"
    >
      {/* Quick Action: Delete button on hover */}
      <button
        type="button"
        aria-label={`Delete ${product.name}`}
        title="Delete product from inventory"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(product);
        }}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-gray-400 opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:bg-neutral-900/90 dark:text-gray-400 dark:hover:bg-red-950/80 dark:hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Main card click area */}
      <div onClick={onClick} className="flex flex-1 flex-col cursor-pointer">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-neutral-800">
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
          {showExpiry && (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                daysToExpiry <= 3 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {daysToExpiry <= 0 ? 'Expired' : `${daysToExpiry}d to expiry`}
            </span>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-700 backdrop-blur dark:bg-neutral-950/85 dark:text-gray-200">
            {product.category}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-gray-950 dark:text-white">
              {product.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-gray-400 dark:text-gray-500">
              {product.sku}
            </p>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Selling price
              </p>
              <p className="mt-0.5 text-lg font-bold tracking-tight text-gray-950 dark:text-white">
                {formatINR(product.sellingPrice, intlLocale)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Available
              </p>
              <p className="mt-0.5 text-sm font-bold text-gray-800 dark:text-gray-200">
                {onHand.toLocaleString()} <span className="font-medium text-gray-400">units</span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-neutral-800">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${stock.className}`}>
              {stock.label}
            </span>
            <span className="text-xs font-semibold text-emerald-700 opacity-0 transition group-hover:opacity-100 dark:text-emerald-400">
              View details <ChevronRight className="inline h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ hasProducts, clearFilters }: { hasProducts: boolean; clearFilters: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
        <Package className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-bold text-gray-950 dark:text-white">
        {hasProducts ? 'No products found' : 'Your catalogue is ready'}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {hasProducts ? 'Try changing your search or filters to find what you need.' : 'Products you add to your store will appear here in a clean, easy-to-browse catalogue.'}
      </p>
      {hasProducts && <Button variant="outline" size="sm" className="mt-5" onClick={clearFilters}>Clear filters</Button>}
    </section>
  );
}

function ProductDrawer({
  item,
  suppliers,
  sales,
  intlLocale,
  onClose,
  onDelete,
}: {
  item: {
    product: Product;
    onHand: number;
    nearestBatch?: { batchNo: string; mfgDate: string; expiryDate: string };
    daysToExpiry: number;
    activeBatchCount: number;
  };
  suppliers: Array<{ id: string; name: string; phone: string; leadTimeDays: number }>;
  sales: Array<{ id: string; source: string; createdAt: string; items: Array<{ productId: string; qty: number }> }>;
  intlLocale: string;
  onClose: () => void;
  onDelete: (product: Product) => void;
}) {
  const { product, onHand, nearestBatch, daysToExpiry, activeBatchCount } = item;
  const supplier = suppliers.find((entry) => entry.id === product.supplierId);
  const stock = stockTone(onHand, product.minStock);
  const recentSales = sales.filter((sale) => sale.items.some((line) => line.productId === product.id)).slice(0, 3);
  const imageSrc = resolveProductImage(product.name, product.category, product.imageUrl);

  return (
    <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Close product details" className="absolute inset-0 bg-gray-950/35 backdrop-blur-[1px]" onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} details`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
          <span className="text-sm font-bold text-gray-950 dark:text-white">Product details</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDelete(product)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
              title="Delete this product from inventory"
              aria-label="Delete product"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative aspect-[16/9] bg-gray-100 dark:bg-neutral-900">
            <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-800 backdrop-blur">
                {product.category}
              </span>
              <h2 className="mt-2 text-2xl font-bold text-white">{product.name}</h2>
              <p className="mt-1 font-mono text-xs text-white/75">SKU {product.sku}</p>
            </div>
          </div>

          <div className="space-y-6 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Detail label="Cost price" value={formatINR(product.purchasePrice, intlLocale)} />
              <Detail label="Selling price" value={formatINR(product.sellingPrice, intlLocale)} emphasis />
              <Detail label="Current stock" value={`${onHand.toLocaleString()} units`} />
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-neutral-900">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Stock status</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${stock.className}`}>
                  {stock.label}
                </span>
              </div>
            </div>

            <DrawerSection icon={Truck} title="Supplier">
              <p className="font-semibold text-gray-900 dark:text-white">{supplier?.name ?? 'Supplier not assigned'}</p>
              {supplier && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{supplier.phone} · {supplier.leadTimeDays}-day lead time</p>}
            </DrawerSection>

            <DrawerSection icon={Box} title="Batch & expiry">
              {nearestBatch ? (
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <Detail label="Active batches" value={String(activeBatchCount)} compact />
                  <Detail label="Nearest batch" value={nearestBatch.batchNo} compact />
                  <Detail label="Manufactured" value={nearestBatch.mfgDate} compact />
                  <Detail label="Expires" value={nearestBatch.expiryDate} compact />
                  <div className="col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <Clock3 className="mr-1.5 inline h-3.5 w-3.5" />
                    {daysToExpiry <= 0 ? 'This batch has expired' : `${daysToExpiry} days remaining on the nearest-expiry batch`}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No active batch is currently available for this product.</p>
              )}
            </DrawerSection>

            <DrawerSection icon={Tag} title="Recent stock movements">
              {recentSales.length ? (
                <div className="space-y-2">
                  {recentSales.map((sale) => {
                    const qty = sale.items.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.qty, 0);
                    return (
                      <div key={sale.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm dark:bg-neutral-900">
                        <span className="text-gray-700 dark:text-gray-200">Sold via {sale.source}</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">−{qty} units</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No recent movements recorded for this product.</p>
              )}
            </DrawerSection>

            {/* Danger Zone: Delete Product from Inventory */}
            <section className="rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-950/60 dark:bg-red-950/20">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                <Trash2 className="h-4 w-4" /> Danger Zone
              </h3>
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                Permanently delete this product and its stock batches from your store catalogue.
              </p>
              <div className="mt-3.5 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(product)}
                  className="gap-1.5 border-red-300 bg-white text-xs font-bold text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:bg-neutral-900 dark:text-red-300 dark:hover:bg-red-950/60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Product
                </Button>
              </div>
            </section>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function Detail({ label, value, emphasis = false, compact = false }: { label: string; value: string; emphasis?: boolean; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'rounded-xl bg-gray-50 p-3 dark:bg-neutral-900'}>
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 font-bold ${emphasis ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'} ${compact ? 'text-sm' : 'text-base'}`}>{value}</p>
    </div>
  );
}

function DrawerSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-100 pt-5 dark:border-neutral-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Modern ReactBits-inspired micro-interaction delete confirmation modal
 */
function DeleteProductModal({
  product,
  batchesCount,
  onHandUnits,
  onClose,
  onConfirm,
}: {
  product: Product;
  batchesCount: number;
  onHandUnits: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onConfirm();
    }, 150);
  };

  const imageSrc = resolveProductImage(product.name, product.category, product.imageUrl);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-gray-200/90 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        {/* Animated Warning Icon with subtle pulse ring */}
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400">
          <motion.span
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-2xl bg-red-500/20"
          />
          <Trash2 className="relative z-10 h-7 w-7" />
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-lg font-bold tracking-tight text-gray-950 dark:text-white">
            Delete Product?
          </h3>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Are you sure you want to permanently delete this product from your inventory catalogue?
          </p>
        </div>

        {/* Product Identity Card */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-3 text-left dark:border-neutral-800 dark:bg-neutral-900">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-200 dark:bg-neutral-800">
            <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-gray-950 dark:text-white">
              {product.name}
            </p>
            <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
              SKU: {product.sku} • {product.category}
            </p>
          </div>
        </div>

        {/* Impact Warning */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold">Stock Impact:</span> This will remove{' '}
            <strong>{batchesCount} active batch(es)</strong> and{' '}
            <strong>{onHandUnits} on-hand unit(s)</strong>. This action cannot be undone.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-neutral-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="gap-1.5 bg-red-600 font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 focus-visible:ring-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? 'Deleting...' : 'Delete Product'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
