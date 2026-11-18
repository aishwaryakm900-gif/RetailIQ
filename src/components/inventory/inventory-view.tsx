'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Package,
  Layers,
  AlertTriangle,
  ClockAlert,
  Search,
  ShoppingCart,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Camera,
  Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES } from '@/lib/retail-config';
import { Product } from '@/lib/retail-types';
import { daysUntil } from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import {
  QuickPosModal,
  ProductBatchModal,
  StockIntakeModal,
} from '@/components/inventory/inventory-modals';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

type StockFilter = 'ALL' | 'HEALTHY' | 'LOW' | 'OUT';
type ExpiryFilter = 'ALL' | 'WEEK' | 'MONTH' | 'FRESH';

export function InventoryView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const { products, batches, recordSaleFEFO } = useRetailStore();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('ALL');
  const [page, setPage] = useState(1);

  const [posProductId, setPosProductId] = useState<string | null>(null);
  const [showPosModal, setShowPosModal] = useState(false);
  const [batchModalProduct, setBatchModalProduct] = useState<Product | null>(null);
  const [intakeConfig, setIntakeConfig] = useState<{
    productId?: string;
  } | null>(null);

  const enrichedProducts = useMemo(() => {
    return products.map((product) => {
      const prodBatches = batches
        .filter((b) => b.productId === product.id && b.qtyOnHand > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const allBatchesCount = batches.filter((b) => b.productId === product.id).length;
      const onHand = prodBatches.reduce((sum, b) => sum + b.qtyOnHand, 0);
      const earliestBatch = prodBatches[0] ?? null;
      const earliestDaysLeft = earliestBatch ? daysUntil(earliestBatch.expiryDate) : 999;

      return {
        product,
        onHand,
        batchCount: allBatchesCount,
        activeBatchCount: prodBatches.length,
        earliestBatch,
        earliestDaysLeft,
      };
    });
  }, [products, batches]);

  const stats = useMemo(() => {
    const totalUnits = enrichedProducts.reduce((sum, row) => sum + row.onHand, 0);
    const totalCostValue = batches.reduce((sum, b) => sum + b.qtyOnHand * b.costPrice, 0);
    const lowStockCount = enrichedProducts.filter((r) => r.onHand < r.product.minStock).length;
    const expiringSoonBatches = batches.filter(
      (b) => b.qtyOnHand > 0 && daysUntil(b.expiryDate) <= 7
    ).length;

    return {
      totalSkus: products.length,
      totalUnits,
      totalCostValue,
      lowStockCount,
      expiringSoonBatches,
    };
  }, [enrichedProducts, batches, products.length]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedProducts.filter((row) => {
      if (q) {
        const hit =
          row.product.name.toLowerCase().includes(q) ||
          row.product.barcode.toLowerCase().includes(q) ||
          row.product.sku.toLowerCase().includes(q) ||
          row.product.category.toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (categoryFilter !== 'ALL' && row.product.category !== categoryFilter) {
        return false;
      }

      if (stockFilter === 'OUT' && row.onHand > 0) return false;
      if (stockFilter === 'LOW' && (row.onHand === 0 || row.onHand >= row.product.minStock)) {
        return false;
      }
      if (stockFilter === 'HEALTHY' && row.onHand < row.product.minStock) return false;

      if (expiryFilter === 'WEEK' && row.earliestDaysLeft > 7) return false;
      if (expiryFilter === 'MONTH' && row.earliestDaysLeft > 30) return false;
      if (expiryFilter === 'FRESH' && row.earliestDaysLeft <= 30) return false;

      return true;
    });
  }, [enrichedProducts, query, categoryFilter, stockFilter, expiryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasActiveFilters =
    query !== '' || categoryFilter !== 'ALL' || stockFilter !== 'ALL' || expiryFilter !== 'ALL';

  const resetFilters = () => {
    setQuery('');
    setCategoryFilter('ALL');
    setStockFilter('ALL');
    setExpiryFilter('ALL');
    setPage(1);
  };

  const handleQuickSellOne = (product: Product) => {
    const res = recordSaleFEFO(product.id, 1, 'Counter POS', 'POS');
    if (!res.ok) {
      toast.error(res.error ?? 'Out of stock');
      return;
    }
    toast.success(`Sold 1x ${product.name} (${formatINR(product.sellingPrice, intlLocale)}) via FEFO`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('inventory')} & Batches
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            FEFO – First Expired, First Out: Products with the nearest expiry date are sold first to reduce product wastage.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold px-4"
            onClick={() => setIntakeConfig({})}
          >
            <Camera className="w-4 h-4" />
            <Mic className="w-4 h-4" />
            <span>📸 Photo & Voice Stock Intake</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setPosProductId(null);
              setShowPosModal(true);
            }}
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
            <span>Quick POS Sale</span>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Total SKUs</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {stats.totalSkus}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Across {batches.length} total stock batches
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Total Stock Units</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {stats.totalUnits.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cost valuation {formatINR(stats.totalCostValue, intlLocale)}
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3 tabular-nums">
            {stats.lowStockCount}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Products running low on stock
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Expiry Risk (&le; 7 Days)</span>
            <ClockAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-3 tabular-nums">
            {stats.expiringSoonBatches} batches
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Sold first using FEFO to avoid wastage
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-neutral-900 rounded-card p-4 border border-surface-border dark:border-neutral-800 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by product name, SKU, barcode, category..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50/60 dark:bg-neutral-950 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-gray-200"
          >
            <option value="ALL">All Categories</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value as StockFilter);
              setPage(1);
            }}
            aria-label="Filter by stock status"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-gray-200"
          >
            <option value="ALL">All Stock Status</option>
            <option value="HEALTHY">Healthy (&ge; min)</option>
            <option value="LOW">Low Stock (&lt; min)</option>
            <option value="OUT">Out of Stock (0)</option>
          </select>

          <select
            value={expiryFilter}
            onChange={(e) => {
              setExpiryFilter(e.target.value as ExpiryFilter);
              setPage(1);
            }}
            aria-label="Filter by expiry window"
            className="px-3 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-700 dark:text-gray-200"
          >
            <option value="ALL">Any Expiry Window</option>
            <option value="WEEK">Expiring &le; 7 days</option>
            <option value="MONTH">Expiring &le; 30 days</option>
            <option value="FRESH">Fresh (&gt; 30 days)</option>
          </select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs gap-1">
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Product & Batch Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Earliest Expiry</th>
                <th className="py-3 px-4">Buy / Sell</th>
                <th className="py-3 px-4">Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          {products.length === 0 ? 'Store Inventory is Empty' : 'No items match filters'}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          {products.length === 0
                            ? 'Start by adding stock using Photo & Multilingual Voice Intake. Confirmed items update inventory, valuations, and batches immediately.'
                            : 'Try adjusting your search query or reset filter options.'}
                        </p>
                      </div>
                      {products.length === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => setIntakeConfig({})}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <Mic className="w-3.5 h-3.5" />
                          <span>📸 Photo & Voice Intake</span>
                        </Button>
                      ) : (
                        hasActiveFilters && (
                          <Button variant="outline" size="sm" onClick={resetFilters}>
                            Reset Filters
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map(({ product, onHand, activeBatchCount, earliestBatch, earliestDaysLeft }) => {
                  const isLow = onHand < product.minStock;
                  const expVariant =
                    earliestDaysLeft <= 3
                      ? 'danger'
                      : earliestDaysLeft <= 7
                        ? 'warning'
                        : 'healthy';
                  const moverVariant =
                    product.moverState === 'near-expiry' || product.moverState === 'dead stock'
                      ? 'danger'
                      : product.moverState === 'slow-moving'
                        ? 'slow'
                        : 'healthy';

                  return (
                    <tr
                      key={product.id}
                      onClick={() => setBatchModalProduct(product)}
                      className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl shrink-0">{product.imageEmoji}</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[220px]">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {product.sku} • {activeBatchCount} active batch
                              {activeBatchCount === 1 ? '' : 'es'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300">
                        {product.category}
                      </td>
                      <td className="py-3 px-4">
                        {earliestBatch ? (
                          <div className="space-y-0.5">
                            <Badge variant={expVariant}>
                              {earliestDaysLeft <= 0 ? 'Expired' : `${earliestDaysLeft}d left`}
                            </Badge>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {earliestBatch.expiryDate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No active batch</span>
                        )}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-xs">
                        <div className="text-gray-500 dark:text-gray-400">
                          Buy {formatINR(product.purchasePrice, intlLocale)}
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          Sell {formatINR(product.sellingPrice, intlLocale)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={moverVariant}
                          className="capitalize"
                          title={
                            product.moverState === 'dead stock'
                              ? 'Dead Stock: Identifies products that are not selling.'
                              : product.moverState === 'near-expiry'
                                ? 'Expiry Risk: Identifies products nearing their expiry date.'
                                : 'Product sales movement status.'
                          }
                        >
                          {product.moverState}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-950/40 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} products
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPosModal && (
        <QuickPosModal
          initialProductId={posProductId ?? undefined}
          intlLocale={intlLocale}
          onClose={() => setShowPosModal(false)}
        />
      )}

      {batchModalProduct && (
        <ProductBatchModal
          product={batchModalProduct}
          intlLocale={intlLocale}
          onClose={() => setBatchModalProduct(null)}
          onAddBatchClick={(pid) =>
            setIntakeConfig({ productId: pid })
          }
          onSellClick={(pid) => {
            setPosProductId(pid);
            setShowPosModal(true);
          }}
        />
      )}

      {intakeConfig && (
        <StockIntakeModal
          initialProductId={intakeConfig.productId}
          intlLocale={intlLocale}
          onClose={() => setIntakeConfig(null)}
        />
      )}
    </div>
  );
}

