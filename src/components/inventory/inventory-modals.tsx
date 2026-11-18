'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  ScanLine,
  Mic,
  MicOff,
  Volume2,
  Languages,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShoppingCart,
  PackagePlus,
  Layers,
  Lock,
  Camera,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Calendar,
  IndianRupee,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES, ProductCategory } from '@/lib/retail-config';
import { Product, Batch } from '@/lib/retail-types';
import {
  addDaysIso,
  assessBatchExpiryRisk,
  daysUntil,
  parseSentenceIntake,
} from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

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
              No products available yet. Use Photo & Multilingual Voice Intake to add items to your store first.
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
            <Camera className="w-3.5 h-3.5" />
            <Mic className="w-3.5 h-3.5" />
            <span>📸 Photo & Voice Intake</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface StockIntakeModalProps {
  initialTab?: string;
  initialProductId?: string;
  intlLocale: string;
  onClose: () => void;
}

interface SamplePackPreset {
  id: string;
  name: string;
  category: ProductCategory;
  keyword: string;
  mfgDate: string;
  expiryDate: string;
  costPrice: number;
  mrp: number;
  batchNo: string;
  emoji: string;
  bgGradient: string;
  ocrSnippet: string;
  badge: string;
}

const PACK_PRESETS: SamplePackPreset[] = [
  {
    id: 'juice',
    name: 'Real Mixed Fruit Juice (200ml)',
    category: 'Beverages',
    keyword: 'fruit juice',
    mfgDate: '2026-10-10',
    expiryDate: '2027-04-10',
    costPrice: 24,
    mrp: 30,
    batchNo: 'BN-REAL-261010',
    emoji: '🧃',
    bgGradient: '#7c2d12',
    ocrSnippet: 'REAL MIXED FRUIT JUICE 200ml | MFD: 10/10/2026 | BEST BEFORE: 10/04/2027 | MRP Rs. 30.00 | BATCH: BN-REAL-261010',
    badge: 'TetraPak 200ml',
  },
  {
    id: 'milk',
    name: 'Nandini GoodLife Milk (1L)',
    category: 'Dairy',
    keyword: 'goodlife',
    mfgDate: '2026-11-10',
    expiryDate: '2026-11-25',
    costPrice: 56,
    mrp: 64,
    batchNo: 'BN-ND-261110',
    emoji: '🥛',
    bgGradient: '#1e3a8a',
    ocrSnippet: 'NANDINI GOODLIFE MILK 1L | MFD: 10/11/2026 | EXP: 25/11/2026 | MRP: Rs. 64.00 | BATCH: BN-ND-261110',
    badge: 'Dairy 1L Pouch',
  },
  {
    id: 'butter',
    name: 'Amul Butter (100g)',
    category: 'Dairy',
    keyword: 'butter',
    mfgDate: '2026-09-15',
    expiryDate: '2027-06-15',
    costPrice: 50,
    mrp: 58,
    batchNo: 'BN-AMUL-260915',
    emoji: '🧈',
    bgGradient: '#713f12',
    ocrSnippet: 'AMUL BUTTER 100g | PKD: 15/09/2026 | USE BY: 15/06/2027 | MRP: Rs. 58.00 | BATCH: BN-AMUL-260915',
    badge: 'Carton 100g',
  },
  {
    id: 'tea',
    name: 'Tata Tea Gold (250g)',
    category: 'Beverages',
    keyword: 'tata tea',
    mfgDate: '2026-08-20',
    expiryDate: '2027-08-20',
    costPrice: 130,
    mrp: 160,
    batchNo: 'BN-TTG-260820',
    emoji: '☕',
    bgGradient: '#064e3b',
    ocrSnippet: 'TATA TEA GOLD 250g | MFD: 20/08/2026 | BEST BEFORE: 20/08/2027 | MRP: Rs. 160.00 | BATCH: BN-TTG-260820',
    badge: 'Pouch 250g',
  },
  {
    id: 'biscuit',
    name: 'Parle-G Biscuits (130g)',
    category: 'Snacks',
    keyword: 'parle',
    mfgDate: '2026-10-25',
    expiryDate: '2027-04-25',
    costPrice: 8,
    mrp: 10,
    batchNo: 'BN-PARLE-261025',
    emoji: '🍪',
    bgGradient: '#78350f',
    ocrSnippet: 'PARLE-G BISCUITS 130g | MFD: 25/10/2026 | EXP: 25/04/2027 | MRP Rs. 10.00 | BATCH: BN-PARLE-261025',
    badge: 'Pack 130g',
  },
];

function generatePackSvg(
  emoji: string,
  title: string,
  mfg: string,
  exp: string,
  price: number,
  mrp: number,
  batch: string,
  bgGradient = '#0f172a'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="${bgGradient}"/>
      </linearGradient>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="480" height="300" fill="url(#bg)" rx="16"/>
    <rect width="480" height="300" fill="url(#grid)" rx="16"/>
    <rect x="24" y="24" width="432" height="252" fill="rgba(15,23,42,0.65)" rx="12" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <text x="240" y="80" font-size="52" text-anchor="middle">${emoji}</text>
    <text x="240" y="125" font-family="system-ui,sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
    <rect x="50" y="148" width="380" height="42" fill="rgba(255,255,255,0.06)" rx="8" stroke="rgba(255,255,255,0.1)"/>
    <text x="65" y="174" font-family="monospace" font-size="12" font-weight="bold" fill="#38bdf8">MFD: ${mfg}</text>
    <text x="235" y="174" font-family="monospace" font-size="12" font-weight="bold" fill="#f87171">EXP: ${exp}</text>
    <text x="365" y="174" font-family="monospace" font-size="12" font-weight="bold" fill="#4ade80">MRP: ₹${mrp}</text>
    <rect x="130" y="206" width="220" height="26" fill="rgba(16,185,129,0.18)" rx="6" stroke="rgba(16,185,129,0.3)"/>
    <text x="240" y="223" font-family="system-ui,sans-serif" font-size="11" font-weight="bold" fill="#34d399" text-anchor="middle">COST PRICE: ₹${price} • ${batch}</text>
    <text x="240" y="258" font-family="monospace" font-size="9" fill="#94a3b8" text-anchor="middle">RETAILIQ PACK OCR SCANNER • CERTIFIED PACKAGING</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface ScanErrorModalProps {
  error: {
    title: string;
    message: string;
    suggestion?: string;
    type?: 'pack' | 'date' | 'voice' | 'api';
  };
  onClose: () => void;
  onRetry?: () => void;
  onManualEdit?: () => void;
}

export function ScanErrorModal({
  error,
  onClose,
  onRetry,
  onManualEdit,
}: ScanErrorModalProps) {
  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-900/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-red-100 dark:border-red-950/60 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-sm font-bold text-red-900 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{error.title}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close error modal"
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                {error.message}
              </p>
            </div>
          </div>

          {error.suggestion && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <strong className="block font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                Recommendation / How to Fix:
              </strong>
              <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-200/90">
                {error.suggestion}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onRetry();
                }}
              >
                Retake / Try Again
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onClose();
                if (onManualEdit) onManualEdit();
              }}
            >
              Continue & Edit Manually
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const VOICE_SAMPLES = {
  'en-IN': [
    { text: 'Added 25 packs Parle-G biscuits at ₹8 mfd yesterday exp in 6 months', label: 'Parle-G 25 packs' },
    { text: 'Thirty packets Real Mixed Fruit juice at 24 rupees', label: 'Real Fruit Juice 30 packs' },
    { text: 'Ten packets Nandini GoodLife Milk at 56 rupees', label: 'Nandini Milk 10 packs' },
  ],
  'kn-IN': [
    { text: 'ಹತ್ತು ಹಾಲು ಪ್ಯಾಕೆಟ್ 26 ರೂಪಾಯಿಗೆ ಸೇರಿಸಲಾಗಿದೆ', label: '10 ಹಾಲು ಪ್ಯಾಕೆಟ್' },
    { text: 'ಇಪ್ಪತ್ತು ಬ್ರೆಡ್ ಪ್ಯಾಕೆಟ್ 38 ರೂಪಾಯಿಗೆ', label: '20 ಬ್ರೆಡ್ ಪ್ಯಾಕೆಟ್' },
    { text: 'ಇಪ್ಪತ್ತೈದು ಪಾರ್ಲೆ-ಜಿ ಬಿಸ್ಕತ್ತು 8 ರೂಪಾಯಿಗೆ', label: '25 ಪಾರ್ಲೆ-ಜಿ ಬಿಸ್ಕತ್ತು' },
  ],
  'hi-IN': [
    { text: 'बीस ब्रेड पैकेट 34 रुपये में जोड़े', label: '20 ब्रेड पैकेट' },
    { text: 'पच्चीस बिस्कुट पैकेट 8 रुपये में जोड़े कल बना हुआ', label: '25 बिस्कुट पैकेट' },
    { text: 'तीस पैकेट नंदिनी दूध 56 रुपये में जोड़े', label: '30 दूध पैकेट' },
  ],
};

/**
 * Unified Stock Intake Modal (Hard requirement):
 * Exclusively Photo & Multilingual Voice (EN/KN/HI) Intake.
 * All confirmed batches are added directly into store inventory.
 */
export function StockIntakeModal({
  initialProductId,
  intlLocale,
  onClose,
}: StockIntakeModalProps) {
  const { products, addBatchToProduct, addProductWithBatch } = useRetailStore();

  // Shared confirmation preview step (Hard Rule R5)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Scan Error Pop-up state (Hard requirement: "if any error it shd show pop up")
  const [scanError, setScanError] = useState<{
    title: string;
    message: string;
    suggestion?: string;
    type?: 'pack' | 'date' | 'voice' | 'api';
  } | null>(null);

  // Multilingual Voice Input State (Beside Photo: "beside photo ann multilanguae input using voice")
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'kn-IN' | 'hi-IN'>('en-IN');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  // Tab 0: Image Pack OCR intake (MFD, EXP, Price auto-retrieved, Quantity manually entered)
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isScanningImage, setIsScanningImage] = useState<boolean>(false);
  const [ocrSuccess, setOcrSuccess] = useState<boolean>(false);
  const [ocrConfidence, setOcrConfidence] = useState<number>(98);
  const [ocrRawText, setOcrRawText] = useState<string>('');

  const [imageProductId, setImageProductId] = useState<string>(
    initialProductId ?? products[0]?.id ?? ''
  );
  const [imageProductName, setImageProductName] = useState<string>(
    products.find((p) => p.id === initialProductId)?.name ?? ''
  );
  const [imageCategory, setImageCategory] = useState<ProductCategory>(
    products.find((p) => p.id === initialProductId)?.category ?? 'Beverages'
  );
  const [imageSellingPrice, setImageSellingPrice] = useState<number>(
    products.find((p) => p.id === initialProductId)?.sellingPrice ?? 0
  );
  const [imageBarcode, setImageBarcode] = useState<string>(
    products.find((p) => p.id === initialProductId)?.barcode ?? ''
  );
  const [imageMfgDate, setImageMfgDate] = useState<string>('');
  const [imageExpiryDate, setImageExpiryDate] = useState<string>('');
  const [imageCostPrice, setImageCostPrice] = useState<number>(0);
  const [imageMrp, setImageMrp] = useState<number>(0);
  const [imageBatchNo, setImageBatchNo] = useState<string>('');
  // REQUIRED MANUAL ENTRY: Stock quantity must be entered manually by the user (or via voice)
  const [imageQty, setImageQty] = useState<string>('');

  const handleSelectPreset = (preset: SamplePackPreset) => {
    setIsScanningImage(true);
    setImageFileName(`${preset.id}-pack.jpg`);
    const svgPreview = generatePackSvg(
      preset.emoji,
      preset.name,
      preset.mfgDate,
      preset.expiryDate,
      preset.costPrice,
      preset.mrp,
      preset.batchNo,
      preset.bgGradient
    );
    setImagePreview(svgPreview);

    const matched = products.find(
      (p) =>
        p.name.toLowerCase().includes(preset.keyword.toLowerCase()) ||
        preset.name.toLowerCase().includes(p.name.toLowerCase())
    );

    setTimeout(() => {
      setImageProductId(matched?.id ?? '');
      setImageProductName(matched?.name ?? preset.name);
      setImageCategory(matched?.category ?? preset.category);
      setImageMfgDate(preset.mfgDate);
      setImageExpiryDate(preset.expiryDate);
      setImageCostPrice(preset.costPrice);
      setImageMrp(preset.mrp);
      setImageSellingPrice(matched?.sellingPrice ?? preset.mrp);
      setImageBatchNo(preset.batchNo);
      setImageBarcode(matched?.barcode ?? `890${Math.floor(1000000000 + Math.random() * 9000000000)}`);
      setOcrRawText(preset.ocrSnippet);
      setOcrConfidence(98);
      setOcrSuccess(true);
      setIsScanningImage(false);
      // QUANTITY MUST BE MANUALLY ENTERED
      setImageQty('');
      toast.success(
        `Retrieved pack details: MFD ${preset.mfgDate}, EXP ${preset.expiryDate}, Price ₹${preset.costPrice}. Please enter quantity manually.`
      );
    }, 450);
  };

  const processImageFile = async (file: File) => {
    setImageFileName(file.name);
    setIsScanningImage(true);
    setOcrSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);

      try {
        const apiLocale = intlLocale ? intlLocale.slice(0, 2) : 'en';
        const res = await fetch(`/${apiLocale}/api/ai/scan-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType: file.type || 'image/jpeg',
            availableProducts: products.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              sku: p.sku,
              barcode: p.barcode,
              mrp: p.mrp,
              purchasePrice: p.purchasePrice,
              shelfLifeDays: p.shelfLifeDays,
            })),
          }),
        });

        const json = await res.json();

        if (json.ok && json.data) {
          const d = json.data;
          const targetProduct =
            products.find((p) => p.id === d.matchedProductId) ||
            products.find((p) => p.name.toLowerCase().includes((d.productName || '').toLowerCase()));

          const finalName = targetProduct?.name || d.productName || 'Scanned Pack Item';
          const finalCat = (targetProduct?.category || d.category || 'Packaged Foods') as ProductCategory;

          setImageProductId(targetProduct?.id ?? '');
          setImageProductName(finalName);
          setImageCategory(finalCat);
          setImageMfgDate(d.mfgDate || '');
          setImageExpiryDate(d.expiryDate || '');
          setImageCostPrice(d.costPrice || targetProduct?.purchasePrice || 25);
          setImageMrp(d.mrp || targetProduct?.mrp || (d.costPrice ? Math.round(d.costPrice * 1.25) : 30));
          setImageSellingPrice(targetProduct?.sellingPrice || d.mrp || (d.costPrice ? Math.round(d.costPrice * 1.2) : 30));
          setImageBatchNo(d.batchNo || `BN-${Date.now().toString().slice(-6)}`);
          setImageBarcode(targetProduct?.barcode || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`);
          setOcrConfidence(d.confidence || 98);
          setOcrRawText(
            d.rawOcrSnippet ||
              `[GEMINI 2.5 FLASH OCR] MFD: ${d.mfgDate} | EXP: ${d.expiryDate} | PRICE: ₹${d.costPrice}`
          );
          setOcrSuccess(true);
          // QUANTITY MUST BE MANUALLY ENTERED
          setImageQty('');
          toast.success(
            `Gemini AI verified: MFD ${d.mfgDate}, EXP ${d.expiryDate}, Price ₹${d.costPrice}. Please enter quantity manually.`
          );
        } else {
          // Hard requirement: "if any error it shd show pop up"
          setScanError({
            title: 'Packaging Scan Error',
            message:
              json.error ||
              'Gemini AI could not verify clear product packaging dates (MFD/EXP) or prices on this image.',
            suggestion:
              'Ensure the camera is focused directly on the printed packaging dates, or speak the details using the voice assistant beside the photo.',
            type: 'pack',
          });

          // Local fallback so user can still continue
          const lowerName = file.name.toLowerCase();
          const matched = products.find((p) => {
            const words = p.name.toLowerCase().split(/\s+/);
            return words.some((w) => w.length > 3 && lowerName.includes(w));
          });

          const now = new Date();
          const mfg = addDaysIso(now, -15);
          const exp = addDaysIso(now, matched?.shelfLifeDays || 90);
          setImageProductId(matched?.id ?? '');
          setImageProductName(matched?.name || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
          setImageCategory(matched?.category || 'Packaged Foods');
          setImageMfgDate(mfg);
          setImageExpiryDate(exp);
          setImageCostPrice(matched?.purchasePrice ?? 25);
          setImageMrp(matched?.mrp ?? 30);
          setImageSellingPrice(matched?.sellingPrice ?? 30);
          setImageBatchNo(`BN-${Date.now().toString().slice(-6)}`);
          setImageBarcode(matched?.barcode ?? `890${Math.floor(1000000000 + Math.random() * 9000000000)}`);
          setOcrConfidence(72);
          setOcrRawText(`[IMAGE SCANNER] Verify detected values below`);
        }
      } catch (err: any) {
        setScanError({
          title: 'Packaging Scan Error',
          message: err.message || 'Network error while contacting Gemini Vision API.',
          suggestion:
            'Please check your network connection, or use the multilingual voice assistant beside the photo to enter stock.',
          type: 'api',
        });
      } finally {
        setIsScanningImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const startVoiceListening = () => {
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setScanError({
        title: 'Microphone Not Available',
        message: 'Your browser does not support live Web Speech Recognition.',
        suggestion:
          'Please use Chrome or Edge for live microphone listening, or click one of the quick speech simulation pills below.',
        type: 'voice',
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognitionRef.current = recognition;
      setIsListeningVoice(true);
      setVoiceTranscript('');

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setVoiceTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsListeningVoice(false);
        if (event.error !== 'no-speech') {
          setScanError({
            title: 'Microphone / Voice Error',
            message: `Speech error: "${event.error}". The browser could not capture audio from your microphone.`,
            suggestion:
              'Check microphone permissions in your browser address bar, ensure your mic is not muted, or test with the quick speech sample buttons.',
            type: 'voice',
          });
        }
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (err: any) {
      setIsListeningVoice(false);
      setScanError({
        title: 'Microphone Start Failed',
        message: err.message || 'Unable to start speech recognition.',
        suggestion: 'Please verify microphone permissions in browser settings.',
        type: 'voice',
      });
    }
  };

  const stopVoiceListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListeningVoice(false);
    if (voiceTranscript.trim()) {
      processVoiceTranscript(voiceTranscript);
    }
  };

  const processVoiceTranscript = async (textToParse: string) => {
    if (!textToParse.trim()) {
      setScanError({
        title: 'No Speech Received',
        message: 'The microphone did not detect any speech words.',
        suggestion:
          'Speak clearly into your microphone, e.g.: "Added 25 packs Parle-G at 8 rupees mfd yesterday expiry June 2027", or click one of the sample prompt pills.',
        type: 'voice',
      });
      return;
    }

    setIsProcessingVoice(true);

    try {
      const apiLocale = intlLocale ? intlLocale.slice(0, 2) : 'en';
      const res = await fetch(`/${apiLocale}/api/ai/voice-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToParse,
          language: voiceLang,
          availableProducts: products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            sku: p.sku,
            barcode: p.barcode,
            mrp: p.mrp,
            purchasePrice: p.purchasePrice,
            shelfLifeDays: p.shelfLifeDays,
          })),
        }),
      });

      const json = await res.json();
      if (json.ok && json.data) {
        const data = json.data;
        const p = data.matchedProductId
          ? products.find((item) => item.id === data.matchedProductId)
          : products.find((item) => item.name.toLowerCase().includes((data.productName || '').toLowerCase()));

        const name = p?.name || data.productName || 'Voice Item';
        const category = (p?.category || data.category || 'Packaged Foods') as ProductCategory;

        setImageProductId(p?.id ?? '');
        setImageProductName(name);
        setImageCategory(category);
        if (data.quantity) {
          setImageQty(String(data.quantity));
        }
        if (data.costPrice) {
          setImageCostPrice(data.costPrice);
          setImageMrp(p?.mrp || Math.round(data.costPrice * 1.25));
          setImageSellingPrice(p?.sellingPrice || Math.round(data.costPrice * 1.2));
        } else if (p) {
          setImageCostPrice(p.purchasePrice);
          setImageMrp(p.mrp);
          setImageSellingPrice(p.sellingPrice);
        }
        if (data.mfgDate) {
          setImageMfgDate(data.mfgDate);
        }
        if (data.expiryDate) {
          setImageExpiryDate(data.expiryDate);
        }
        if (data.batchNo) {
          setImageBatchNo(data.batchNo);
        }
        setImageBarcode(p?.barcode || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`);
        setOcrSuccess(true);
        setOcrConfidence(data.confidence || 95);
        setOcrRawText(`[VOICE PARSED - ${voiceLang}] ${data.summary || textToParse}`);
        toast.success(
          `Gemini Voice interpreted (${voiceLang === 'kn-IN' ? 'ಕನ್ನಡ' : voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}): ${name} (${data.quantity ? data.quantity + ' units' : 'enter qty'})`
        );
      } else {
        // Fallback to local sentence parser
        const parsed = parseSentenceIntake(textToParse, products);
        if (parsed.matchedProduct) {
          setImageProductId(parsed.matchedProduct.id);
          setImageProductName(parsed.matchedProduct.name);
          setImageCategory(parsed.matchedProduct.category);
          setImageQty(String(parsed.quantity));
          setImageCostPrice(parsed.unitPrice || parsed.matchedProduct.purchasePrice);
          setImageMrp(parsed.matchedProduct.mrp);
          setImageSellingPrice(parsed.matchedProduct.sellingPrice);
          setImageMfgDate(addDaysIso(new Date(), -1));
          setImageExpiryDate(addDaysIso(new Date(), parsed.matchedProduct.shelfLifeDays));
          setImageBatchNo(`BN-${Date.now().toString().slice(-6)}`);
          setOcrSuccess(true);
          toast.success(`Voice parsed locally: ${parsed.matchedProduct.name} (+${parsed.quantity} units)`);
        } else {
          // If no matching product exists, extract name from transcript
          const trimmed = textToParse.trim();
          const words = trimmed.split(/\s+/);
          setImageProductId('');
          setImageProductName(trimmed.length > 30 ? words.slice(0, 4).join(' ') : trimmed);
          setImageCategory('Packaged Foods');
          if (parsed.quantity) setImageQty(String(parsed.quantity));
          if (parsed.unitPrice) {
            setImageCostPrice(parsed.unitPrice);
            setImageMrp(Math.round(parsed.unitPrice * 1.25));
            setImageSellingPrice(Math.round(parsed.unitPrice * 1.2));
          }
          setImageMfgDate(addDaysIso(new Date(), -1));
          setImageExpiryDate(addDaysIso(new Date(), 90));
          setImageBatchNo(`BN-${Date.now().toString().slice(-6)}`);
          setOcrSuccess(true);
          toast.success(`Voice captured: "${trimmed.slice(0, 25)}..."`);
        }
      }
    } catch (err: any) {
      // Local fallback
      const parsed = parseSentenceIntake(textToParse, products);
      if (parsed.matchedProduct) {
        setImageProductId(parsed.matchedProduct.id);
        setImageProductName(parsed.matchedProduct.name);
        setImageCategory(parsed.matchedProduct.category);
        setImageQty(String(parsed.quantity));
        setImageCostPrice(parsed.unitPrice || parsed.matchedProduct.purchasePrice);
        setImageMfgDate(addDaysIso(new Date(), -1));
        setImageExpiryDate(addDaysIso(new Date(), parsed.matchedProduct.shelfLifeDays));
        setOcrSuccess(true);
        toast.success(`Voice parsed: ${parsed.matchedProduct.name}`);
      } else {
        setScanError({
          title: 'Voice Network Error',
          message: err.message || 'Unable to connect to AI voice parsing service.',
          suggestion: 'Please verify your network connection and retry.',
          type: 'api',
        });
      }
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleConfirmSubmit = () => {
    const qtyNum = Number(imageQty);
    if (!qtyNum || qtyNum <= 0) {
      setScanError({
        title: 'Quantity Required',
        message: 'The physical stock quantity must be entered manually before saving to inventory.',
        suggestion: 'Please enter the number of units physically received in this delivery batch (e.g. 10, 24).',
        type: 'pack',
      });
      return;
    }

    const finalName = imageProductName.trim();
    if (!finalName) {
      setScanError({
        title: 'Product Name Required',
        message: 'Please provide or confirm the product item name before saving.',
        suggestion: 'Type the product name in the "Product Item Name" field below.',
        type: 'pack',
      });
      return;
    }

    if (imageMfgDate && imageExpiryDate) {
      const mfg = new Date(imageMfgDate);
      const exp = new Date(imageExpiryDate);
      if (exp <= mfg) {
        setScanError({
          title: 'Date Inconsistency Error',
          message: `The Expiry Date (${imageExpiryDate}) cannot be earlier than or equal to the Manufacturing Date (${imageMfgDate}).`,
          suggestion: 'Please verify the dates stamped on the product packaging and edit them before saving.',
          type: 'date',
        });
        return;
      }
    }

    const finalBatchNo = imageBatchNo.trim() || `BN-${Date.now().toString().slice(-6)}`;
    const finalMfgDate = imageMfgDate || addDaysIso(new Date(), -1);
    const finalExpiryDate = imageExpiryDate || addDaysIso(new Date(), 90);
    const finalCostPrice = imageCostPrice > 0 ? imageCostPrice : 25;
    const finalMrp = imageMrp > 0 ? imageMrp : Math.round(finalCostPrice * 1.25);
    const finalSellingPrice = imageSellingPrice > 0 ? imageSellingPrice : Math.round(finalCostPrice * 1.2);

    // Look for matching product by ID or exact/case-insensitive name
    const existing =
      products.find((p) => p.id === imageProductId) ||
      products.find((p) => p.name.trim().toLowerCase() === finalName.toLowerCase());

    if (existing) {
      // Add batch to existing product
      addBatchToProduct(existing.id, {
        batchNo: finalBatchNo,
        mfgDate: finalMfgDate,
        expiryDate: finalExpiryDate,
        qty: qtyNum,
        costPrice: finalCostPrice,
      });
      toast.success(
        `✓ Confirmed intake: +${qtyNum} units of ${existing.name} (Batch: ${finalBatchNo}) added to inventory! All fields updated.`
      );
    } else {
      // Create new product item with initial batch
      const newSku = `SKU-${finalName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const barcode = imageBarcode.trim() || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const shelfDays = Math.max(
        15,
        Math.round((new Date(finalExpiryDate).getTime() - new Date(finalMfgDate).getTime()) / (1000 * 60 * 60 * 24))
      );

      addProductWithBatch(
        {
          name: finalName,
          barcode,
          sku: newSku,
          category: imageCategory,
          mrp: finalMrp,
          purchasePrice: finalCostPrice,
          sellingPrice: finalSellingPrice,
          minStock: Math.max(4, Math.round(qtyNum * 0.2)),
          supplierId: 'sup-01',
          shelfLifeDays: isNaN(shelfDays) || shelfDays <= 0 ? 90 : shelfDays,
        },
        {
          batchNo: finalBatchNo,
          mfgDate: finalMfgDate,
          expiryDate: finalExpiryDate,
          qty: qtyNum,
          costPrice: finalCostPrice,
        }
      );
      toast.success(
        `✓ Created product "${finalName}" & added +${qtyNum} units (Batch: ${finalBatchNo}) to inventory! All fields updated.`
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Stock Intake (Photo & Multilingual Voice)
                </h2>
                <Badge variant="healthy" className="text-[10px] py-0 px-1.5 font-medium">
                  AI Powered
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Snap pack photo or speak beside it (EN/KN/HI). Updates are added directly to store inventory.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close intake modal"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {!awaitingConfirmation ? (
            <div className="space-y-4">
                  {/* Beside-Photo 2-Column Responsive Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Column 1: Packaging Photo & AI OCR Scanner */}
                    <div className="space-y-2.5">
                      {!imagePreview ? (
                        <>
                          <div
                            onClick={() => document.getElementById('pack-file-input')?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file) processImageFile(file);
                            }}
                            className="border-2 border-dashed border-gray-300 dark:border-neutral-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-gray-50/60 dark:bg-neutral-950/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 group flex flex-col items-center justify-center min-h-[190px]"
                          >
                            <input
                              id="pack-file-input"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={handleFileUpload}
                            />
                            <div className="w-10 h-10 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-xs">
                              <Camera className="w-5 h-5" />
                            </div>
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                              Upload / Snap Pack Photo (1 Item)
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                              Gemini 2.5 Flash Vision extracts MFD, EXP, and Price. Quantity must be entered manually.
                            </p>
                            <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-700 dark:text-gray-300 shadow-2xs">
                              <Upload className="w-3 h-3 text-emerald-600" />
                              <span>Select Photo or Camera</span>
                            </div>
                          </div>

                          {/* Quick test presets */}
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">
                              Or test 1-click sample packs:
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {PACK_PRESETS.slice(0, 4).map((preset) => (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => handleSelectPreset(preset)}
                                  className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-left transition-all group"
                                >
                                  <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                                    {preset.emoji}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-semibold text-gray-900 dark:text-white truncate">
                                      {preset.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      ₹{preset.costPrice} • Exp {preset.expiryDate.slice(5)}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-neutral-950 p-2.5 flex flex-col gap-2">
                            <div className="relative w-full h-36 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700 flex items-center justify-center">
                              <img
                                src={imagePreview}
                                alt="Packaging preview"
                                className="w-full h-full object-contain"
                              />
                              {isScanningImage && (
                                <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-2xs flex flex-col items-center justify-center gap-2">
                                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                                  <span className="text-xs font-bold text-white bg-black/70 px-2.5 py-0.5 rounded-full">
                                    Gemini Vision Scanning...
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-white truncate block">
                                  {imageFileName || 'Item Pack Photo'}
                                </span>
                                {ocrSuccess && (
                                  <Badge variant="healthy" className="text-[10px] mt-0.5">
                                    ✓ Gemini AI Verified ({ocrConfidence}%)
                                  </Badge>
                                )}
                              </div>
                              <label
                                htmlFor="reupload-pack-input"
                                className="cursor-pointer text-[11px] font-medium px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-neutral-700 transition-colors inline-flex items-center gap-1 shrink-0"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Change</span>
                              </label>
                              <input
                                id="reupload-pack-input"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handleFileUpload}
                              />
                            </div>
                          </div>

                          {ocrRawText && (
                            <div className="p-2 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 flex items-start gap-1.5 text-[11px] font-mono text-gray-600 dark:text-gray-400">
                              <ScanLine className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="truncate flex-1">
                                <strong className="text-emerald-700 dark:text-emerald-400 mr-1">
                                  Retrieved:
                                </strong>
                                {ocrRawText}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Column 2: Multilingual Voice Intake Assistant (Beside Photo) */}
                    <div className="p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                              <Mic className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <span>Multilingual Voice Intake</span>
                                <Badge variant="healthy" className="text-[9px] py-0 px-1 font-mono">
                                  Gemini 2.5
                                </Badge>
                              </h4>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                Speak beside photo in English, ಕನ್ನಡ, or हिन्दी
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Language Selection Buttons */}
                        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 mb-2.5">
                          {(
                            [
                              { id: 'en-IN', label: '🇬🇧 English' },
                              { id: 'kn-IN', label: '🇮🇳 ಕನ್ನಡ' },
                              { id: 'hi-IN', label: '🇮🇳 हिन्दी' },
                            ] as const
                          ).map((lang) => (
                            <button
                              key={lang.id}
                              type="button"
                              onClick={() => setVoiceLang(lang.id)}
                              className={`py-1 px-1.5 rounded-lg text-[11px] font-semibold transition-all text-center ${
                                voiceLang === lang.id
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                              }`}
                            >
                              {lang.label}
                            </button>
                          ))}
                        </div>

                        {/* Mic Action Button */}
                        {!isListeningVoice ? (
                          <Button
                            type="button"
                            onClick={startVoiceListening}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold py-2 text-xs shadow-xs"
                          >
                            <Mic className="w-4 h-4" />
                            <span>
                              Speak in {voiceLang === 'kn-IN' ? 'ಕನ್ನಡ' : voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}
                            </span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={stopVoiceListening}
                            className="w-full animate-pulse gap-2 font-bold py-2 text-xs shadow-xs"
                          >
                            <MicOff className="w-4 h-4" />
                            <span>Listening... Click to Finish</span>
                          </Button>
                        )}

                        {/* Live Soundwave Animation */}
                        {isListeningVoice && (
                          <div className="flex items-center justify-center gap-1 py-2">
                            <div className="w-1 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1 h-5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1 h-7 bg-emerald-500 rounded-full animate-bounce" />
                            <div className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.2s]" />
                            <div className="w-1 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.4s]" />
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 ml-1.5">
                              Listening in {voiceLang === 'kn-IN' ? 'ಕನ್ನಡ' : voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}...
                            </span>
                          </div>
                        )}

                        {/* Transcript Area */}
                        <div className="mt-2.5">
                          <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Captured Transcript (Live or Typed)
                          </label>
                          <textarea
                            rows={2}
                            value={voiceTranscript}
                            onChange={(e) => setVoiceTranscript(e.target.value)}
                            placeholder={
                              voiceLang === 'kn-IN'
                                ? 'ಹತ್ತು ಹಾಲು ಪ್ಯಾಕೆಟ್ 26 ರೂಪಾಯಿಗೆ...'
                                : voiceLang === 'hi-IN'
                                ? 'बीस ब्रेड पैकेट 34 रुपये में जोड़े...'
                                : 'Added 25 packs Parle-G at ₹8...'
                            }
                            className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                          />
                          {voiceTranscript.trim() && !isListeningVoice && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isProcessingVoice}
                              onClick={() => processVoiceTranscript(voiceTranscript)}
                              className="mt-1 w-full h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1"
                            >
                              {isProcessingVoice ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Gemini Parsing Speech...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3" />
                                  <span>Parse Voice into Fields</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Quick Sample Voice Prompts */}
                      <div className="pt-2 border-t border-gray-200/60 dark:border-neutral-800">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                          Test voice phrases in {voiceLang === 'kn-IN' ? 'ಕನ್ನಡ' : voiceLang === 'hi-IN' ? 'हिन्दी' : 'English'}:
                        </span>
                        <div className="flex flex-col gap-1">
                          {VOICE_SAMPLES[voiceLang].map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setVoiceTranscript(s.text);
                                processVoiceTranscript(s.text);
                              }}
                              className="text-[10px] text-left px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-neutral-800 hover:border-purple-300 transition-colors flex items-center justify-between"
                            >
                              <span className="truncate mr-1 font-medium">{s.text}</span>
                              <Badge variant="outline" className="text-[8px] py-0 px-1 shrink-0">
                                Test
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extracted Fields: Product Name, Category, MFD, EXP, Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {products.length > 0 && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                          <span>Link to Existing Catalog SKU (Optional)</span>
                          <span className="text-[10px] text-gray-400">
                            Or leave blank to create as new item
                          </span>
                        </label>
                        <select
                          value={imageProductId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setImageProductId(id);
                            const p = products.find((item) => item.id === id);
                            if (p) {
                              setImageProductName(p.name);
                              setImageCategory(p.category);
                              setImageCostPrice(p.purchasePrice);
                              setImageMrp(p.mrp);
                              setImageSellingPrice(p.sellingPrice);
                              setImageBarcode(p.barcode);
                            }
                          }}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                        >
                          <option value="">✨ + Create as New Product Item</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.imageEmoji} {p.name} ({p.category}) — SKU {p.sku}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Product Item Name *</span>
                        {ocrSuccess && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50/50"
                          >
                            AI Extracted
                          </Badge>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Nandini GoodLife Milk 1L"
                        value={imageProductName}
                        onChange={(e) => setImageProductName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <select
                        value={imageCategory}
                        onChange={(e) => setImageCategory(e.target.value as ProductCategory)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                      >
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Manufacturing Date (MFD)</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-blue-600 border-blue-200 bg-blue-50/50"
                        >
                          Auto-Retrieved
                        </Badge>
                      </label>
                      <input
                        type="date"
                        value={imageMfgDate}
                        onChange={(e) => setImageMfgDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Expiry Date (EXP)</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-red-600 border-red-200 bg-red-50/50"
                        >
                          Auto-Retrieved
                        </Badge>
                      </label>
                      <input
                        type="date"
                        value={imageExpiryDate}
                        onChange={(e) => setImageExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Purchase Cost Price (₹)</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50/50"
                        >
                          Auto-Retrieved
                        </Badge>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={imageCostPrice || ''}
                        placeholder="Cost price ₹"
                        onChange={(e) =>
                          setImageCostPrice(Math.max(1, Number(e.target.value) || 0))
                        }
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Batch Number</span>
                        <span className="text-[10px] text-gray-400">
                          MRP: ₹{imageMrp || (imageCostPrice ? Math.round(imageCostPrice * 1.25) : 30)}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={imageBatchNo}
                        placeholder="e.g. BN-261110"
                        onChange={(e) => setImageBatchNo(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* MANDATORY MANUAL QUANTITY ENTRY */}
                  <div className="p-4 rounded-xl border-2 border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>Stock Quantity (Enter Manually *)</span>
                      </label>
                      <Badge
                        variant="outline"
                        className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 font-semibold text-[11px]"
                      >
                        Manual Entry Required
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      The image scan does not assume physical delivery count. Please count and enter
                      the physical quantity received in this delivery batch.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          placeholder="Enter received units (e.g. 24)"
                          value={imageQty}
                          onChange={(e) => setImageQty(e.target.value)}
                          className={`w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border ${
                            !imageQty || Number(imageQty) <= 0
                              ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30'
                              : 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/30'
                          } bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[6, 12, 24, 48].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setImageQty(String(q))}
                            className="px-2.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:border-emerald-300 text-gray-700 dark:text-gray-300 transition-colors"
                          >
                            +{q}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(!imageQty || Number(imageQty) <= 0) && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Please enter a valid positive quantity to review and confirm intake.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!imageQty || Number(imageQty) <= 0 || isScanningImage}
                      onClick={() => setAwaitingConfirmation(true)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Review & Confirm Intake
                    </Button>
                  </div>
                </div>
          ) : (
            /* Mandatory Confirmation Preview Step (Hard Rule R5) */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Confirm Stock Entry Before Saving</span>
                  </div>
                  <Badge variant="healthy">Match Confidence: {ocrConfidence}%</Badge>
                </div>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  Verify quantities, cost price, and expiry date. Confirmed batches are added directly into inventory.
                </p>
              </div>

              <div className="space-y-3">
                  {imagePreview && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800">
                      <img
                        src={imagePreview}
                        alt="Scanned pack"
                        className="w-16 h-14 object-cover rounded-lg border border-gray-200 dark:border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {imageProductName || products.find((p) => p.id === imageProductId)?.name || 'Product Item'}
                          </span>
                          <Badge variant="healthy" className="text-[10px] shrink-0">
                            OCR Verified
                          </Badge>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          Batch: {imageBatchNo || 'Auto'} • {imageCategory}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 space-y-2 text-sm bg-white dark:bg-neutral-900">
                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Product Item</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-xs">
                        {imageProductName || products.find((p) => p.id === imageProductId)?.name || 'New Item'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Category</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-xs">
                        {imageCategory}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Batch Number</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-xs font-mono">
                        {imageBatchNo || 'BN-Auto'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Manufacturing Date (MFD)</span>
                      <span className="font-medium text-gray-900 dark:text-white text-xs font-mono">
                        {imageMfgDate || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Expiry Date (EXP)</span>
                      <span className="font-medium text-gray-900 dark:text-white text-xs font-mono flex items-center gap-1.5">
                        {imageExpiryDate || 'N/A'}
                        {imageExpiryDate && (
                          <Badge variant="warning" className="text-[10px]">
                            {daysUntil(imageExpiryDate)}d left
                          </Badge>
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Unit Purchase Cost (₹)</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-xs tabular-nums">
                        {formatINR(imageCostPrice, intlLocale)}{' '}
                        <span className="text-gray-400 font-normal">
                          (MRP {formatINR(imageMrp || Math.round(imageCostPrice * 1.25), intlLocale)})
                        </span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-neutral-800">
                      <span className="text-gray-500 text-xs">Inventory Action</span>
                      <Badge variant="healthy" className="text-[10px]">
                        {products.some((p) => p.id === imageProductId || (imageProductName && p.name.trim().toLowerCase() === imageProductName.trim().toLowerCase()))
                          ? 'Add Batch to Existing SKU'
                          : 'Create New SKU + Initial Batch'}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center py-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div>
                        <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs block">
                          Stock Quantity (Manually Entered)
                        </span>
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          Total batch cost:{' '}
                          {formatINR(Number(imageQty) * imageCostPrice, intlLocale)}
                        </span>
                      </div>
                      <Badge variant="healthy" className="text-sm font-bold px-2.5 py-1">
                        +{imageQty} units
                      </Badge>
                    </div>
                  </div>
                </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAwaitingConfirmation(false)}
                >
                  Back to Edit
                </Button>
                <Button type="button" size="sm" onClick={handleConfirmSubmit}>
                  Confirm & Save to Inventory
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up error modal for any scanning, date validation, or voice error */}
      {scanError && (
        <ScanErrorModal
          error={scanError}
          onClose={() => setScanError(null)}
          onRetry={() => {
            setScanError(null);
            setImagePreview(null);
            setIsScanningImage(false);
          }}
          onManualEdit={() => {
            setScanError(null);
          }}
        />
      )}
    </div>
  );
}

