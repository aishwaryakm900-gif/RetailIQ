'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  ShoppingCart,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { Product, Batch } from '@/lib/retail-types';
import {
  assessBatchExpiryRisk,
  daysUntil,
} from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

export { AddProductModal as StockIntakeModal } from './add-product-modal';

interface QuickPosModalProps {
  initialProductId?: string;
  intlLocale: string;
  onClose: () => void;
}

/**
 * Quick POS Sale Modal demonstrating Hard Rule R6 (FEFO deduction & non-negative stock guard).
 */
export function QuickPosModal({ initialProductId, intlLocale, onClose }: QuickPosModalProps) {
  const { products, batches, recordSaleFEFO } = useRetailStore();
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState('Walk-in Customer');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const productBatches = useMemo(
    () =>
      batches
        .filter((b) => b.productId === productId && b.qtyOnHand > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [batches, productId]
  );

  const totalAvailable = productBatches.reduce((sum, b) => sum + b.qtyOnHand, 0);

  // Preview exact FEFO split before committing
  const fefoPlan = useMemo(() => {
    let remaining = Math.max(0, qty);
    const plan: Array<{ batch: Batch; take: number }> = [];
    for (const batch of productBatches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.qtyOnHand, remaining);
      plan.push({ batch, take });
      remaining -= take;
    }
    return { plan, shortBy: remaining };
  }, [productBatches, qty]);

  const canSubmit = selectedProduct && qty > 0 && qty <= totalAvailable;

  const handleConfirmSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const res = recordSaleFEFO(selectedProduct.id, qty, customerName.trim() || 'Walk-in', 'POS');
    if (!res.ok) {
      toast.error(res.error ?? 'Unable to record sale');
      return;
    }
    toast.success(
      `Sold ${qty}x ${selectedProduct.name} (${formatINR(res.sale?.total ?? 0, intlLocale)}) via FEFO`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Quick POS Sale (FEFO)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                FEFO – First Expired, First Out: Products with the nearest expiry date are sold first.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {products.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Store Inventory is Empty</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              No products available yet. Click Add Product to add items to your store first.
            </p>
            <div className="pt-2">
              <Button type="button" size="sm" onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirmSale} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Select Product
              </label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setQty(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
              >
                {products.map((p) => {
                  const stock = batches
                    .filter((b) => b.productId === p.id)
                    .reduce((s, b) => s + b.qtyOnHand, 0);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.imageEmoji} {p.name} — {stock} units ({formatINR(p.sellingPrice, intlLocale)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Quantity (Available: {totalAvailable})
                </label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {qty > totalAvailable && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Insufficient stock ({totalAvailable} available). Negative stock deduction is blocked.
                </span>
              </div>
            )}

            {/* Live FEFO Allocation Preview */}
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                <span>FEFO Batch Allocation Plan</span>
                {selectedProduct && (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Total: {formatINR(selectedProduct.sellingPrice * qty, intlLocale)}
                  </span>
                )}
              </div>
              {fefoPlan.plan.length === 0 ? (
                <p className="text-xs text-gray-500">No stock on hand for this SKU.</p>
              ) : (
                <div className="space-y-1.5">
                  {fefoPlan.plan.map(({ batch, take }) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between text-xs bg-white dark:bg-neutral-900 px-3 py-2 rounded-lg border border-gray-100 dark:border-neutral-800"
                    >
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {batch.batchNo}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          Exp: {batch.expiryDate} ({daysUntil(batch.expiryDate)}d left)
                        </span>
                      </div>
                      <Badge variant="healthy">-{take} units</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit}>
                Confirm POS Sale
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface BatchDrawerProps {
  product: Product;
  intlLocale: string;
  onClose: () => void;
  onAddBatchClick: (productId: string) => void;
  onSellClick: (productId: string) => void;
}

/**
 * Drawer listing all stock batches for a single product with expiry risk breakdown.
 */
export function ProductBatchModal({
  product,
  intlLocale,
  onClose,
  onAddBatchClick,
  onSellClick,
}: BatchDrawerProps) {
  const { batches, suppliers } = useRetailStore();
  const productBatches = useMemo(
    () =>
      batches
        .filter((b) => b.productId === product.id)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [batches, product.id]
  );

  const supplier = suppliers.find((s) => s.id === product.supplierId);
  const totalUnits = productBatches.reduce((sum, b) => sum + b.qtyOnHand, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{product.imageEmoji}</span>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{product.name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {product.category} • SKU {product.sku} • Barcode {product.barcode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close batches modal"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800">
              <div className="text-gray-500">On Hand</div>
              <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">
                {totalUnits} units
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800">
              <div className="text-gray-500">Cost / Sell</div>
              <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">
                {formatINR(product.purchasePrice, intlLocale)} /{' '}
                {formatINR(product.sellingPrice, intlLocale)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800">
              <div className="text-gray-500">Avg Demand</div>
              <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">
                {product.dailyDemandAvg.toFixed(1)}/day
              </div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800">
              <div className="text-gray-500">Supplier Lead</div>
              <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5 truncate">
                {supplier ? `${supplier.leadTimeDays}d (${supplier.name.split(' ')[0]})` : 'Local'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Batches (FEFO – First Expired, First Out: nearest expiry sells first)
            </h3>
            {productBatches.map((batch, idx) => {
              const risk = assessBatchExpiryRisk(batch, product);
              const badgeVar =
                risk.riskLevel === 'Critical'
                  ? 'danger'
                  : risk.riskLevel === 'High' || risk.riskLevel === 'Medium'
                    ? 'warning'
                    : 'healthy';
              return (
                <div
                  key={batch.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/60"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {batch.batchNo}
                      </span>
                      {idx === 0 && batch.qtyOnHand > 0 && (
                        <Badge variant="info">Next Out (FEFO)</Badge>
                      )}
                      <Badge variant={badgeVar}>
                        {risk.riskLevel} ({risk.daysLeft}d left)
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Mfg: {batch.mfgDate} • Exp: {batch.expiryDate} • Cost:{' '}
                      {formatINR(batch.costPrice, intlLocale)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {batch.qtyOnHand} / {batch.qtyReceived} units
                    </div>
                    {risk.predictedLeftover > 0 && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        Est. leftover: {risk.predictedLeftover} ({formatINR(risk.estimatedLoss, intlLocale)} risk)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-end gap-2 bg-gray-50/70 dark:bg-neutral-950/60 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              onSellClick(product.id);
            }}
            disabled={totalUnits === 0}
          >
            Quick Sell (FEFO)
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              onClose();
              onAddBatchClick(product.id);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
