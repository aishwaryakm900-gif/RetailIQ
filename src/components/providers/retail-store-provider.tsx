'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ProductCategory } from '@/lib/retail-config';
import { buildSeedData, PRIMARY_SHOP_ID } from '@/lib/retail-seed';
import {
  addDaysIso,
  computeWithdrawAt,
  deductStockFEFO,
  upsertDailySalesSeries,
} from '@/lib/retail-rules';
import {
  ActivityEvent,
  ArchivedReport,
  Batch,
  Bill,
  DailySalesPoint,
  Offer,
  Product,
  Recommendation,
  Reservation,
  Sale,
  Shop,
  Supplier,
} from '@/lib/retail-types';

interface RetailStoreState {
  shop: Shop;
  nearbyShops: Shop[];
  suppliers: Supplier[];
  products: Product[];
  batches: Batch[];
  sales: Sale[];
  bills: Bill[];
  archivedReports: ArchivedReport[];
  offers: Offer[];
  reservations: Reservation[];
  recommendations: Recommendation[];
  activities: ActivityEvent[];
  salesSeries: DailySalesPoint[];
  aiBasicMode: boolean;
  assistantEnabled: boolean;
  notificationsEnabled: boolean;
}

interface NewProductInput {
  name: string;
  barcode: string;
  sku: string;
  category: ProductCategory;
  mrp: number;
  purchasePrice: number;
  sellingPrice: number;
  minStock: number;
  supplierId: string;
  shelfLifeDays: number;
}

interface NewBatchInput {
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  qty: number;
  costPrice: number;
}

interface CreateOfferInput {
  batchId: string;
  type: 'DISCOUNT' | 'BUNDLE';
  bundleWithName?: string;
  discountPct: number;
  qty: number;
  validFrom: string;
  validTo: string;
  channels: ('WHATSAPP' | 'STOCK_RESCUE')[];
  recommendedByAi?: boolean;
}

interface CommitBillPayload {
  bill: Bill;
  sale: Sale;
  updatedBatches: Batch[];
  updatedProducts: Product[];
}

interface RetailStoreContextValue extends RetailStoreState {
  isHydrated: boolean;
  addProductWithBatch: (product: NewProductInput, batch: NewBatchInput) => Product;
  addBatchToProduct: (productId: string, batch: NewBatchInput) => Batch;
  commitGeneratedBill: (payload: CommitBillPayload) => { ok: boolean; duplicate?: boolean };
  markBillPaid: (billId: string) => void;
  archiveRecordsToReport: (
    mode: 'OLDER_THAN_7D' | 'ALL_CURRENT'
  ) => { ok: boolean; error?: string; report?: ArchivedReport };
  recordSaleFEFO: (
    productId: string,
    qty: number,
    customerName?: string,
    source?: 'POS' | 'RESERVATION',
    customUnitPrice?: number
  ) => { ok: boolean; error?: string; sale?: Sale };
  updateRecommendationStatus: (
    recId: string,
    status: 'ACCEPTED' | 'EDITED' | 'REJECTED',
    editedQty?: number
  ) => void;
  createOffer: (input: CreateOfferInput) => { ok: boolean; error?: string; offer?: Offer };
  withdrawOffer: (offerId: string) => void;
  reserveOffer: (
    offerId: string,
    qty: number,
    customerName: string,
    customerPhone: string
  ) => { ok: boolean; error?: string; reservation?: Reservation };
  collectReservation: (codeOrId: string) => { ok: boolean; error?: string; reservation?: Reservation };
  releaseExpiredReservations: () => number;
  updateShopSettings: (updates: Partial<Shop> & { aiBasicMode?: boolean; assistantEnabled?: boolean; notificationsEnabled?: boolean }) => void;
  resetDemoData: () => void;
}

const STORAGE_KEY = 'retailiq-store-v2';

const RetailStoreContext = createContext<RetailStoreContextValue | undefined>(undefined);

function createInitialState(): RetailStoreState {
  const seed = buildSeedData();
  return {
    ...seed,
    aiBasicMode: false,
    assistantEnabled: true,
    notificationsEnabled: true,
  };
}

export function RetailStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RetailStoreState>(() => createInitialState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      // Purge old demo data from previous sessions
      if (typeof window !== 'undefined') {
        localStorage.removeItem('retailiq-store-v1');
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<RetailStoreState>;
        if (Array.isArray(parsed.products) && Array.isArray(parsed.batches) && parsed.shop) {
          setState((prev) => ({
            ...prev,
            ...parsed,
            bills: Array.isArray(parsed.bills) ? parsed.bills : prev.bills,
            archivedReports: Array.isArray(parsed.archivedReports)
              ? parsed.archivedReports
              : prev.archivedReports,
          }));
        }
      }
    } catch {
      // Fall back safely to initial clean state
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state, isHydrated]);

  const addProductWithBatch = (productInput: NewProductInput, batchInput: NewBatchInput): Product => {
    const newId = `prod-${Date.now()}`;
    const categoryEmojis: Record<string, string> = {
      Dairy: '🥛',
      Bakery: '🍞',
      Snacks: '🍪',
      Beverages: '🧃',
      Grains: '🌾',
      'Oils and Fats': '🌻',
      'Spices and Condiments': '🧂',
      'Personal Care': '🧼',
      Household: '🧹',
      'Daily Essentials': '📦',
    };

    const newProduct: Product = {
      id: newId,
      shopId: PRIMARY_SHOP_ID,
      name: productInput.name,
      barcode: productInput.barcode || String(8901000000000 + Math.floor(Math.random() * 999999)),
      sku: productInput.sku || `SKU-${Math.floor(100 + Math.random() * 899)}`,
      category: productInput.category,
      mrp: productInput.mrp,
      purchasePrice: productInput.purchasePrice,
      sellingPrice: productInput.sellingPrice,
      minStock: productInput.minStock || 10,
      reorderLevel: Math.round((productInput.minStock || 10) * 1.3),
      supplierId: productInput.supplierId || 'sup-02',
      shelfLifeDays: productInput.shelfLifeDays || 90,
      dailyDemandAvg: 2.0,
      moverState: 'fresh',
      imageEmoji: categoryEmojis[productInput.category] || '📦',
    };

    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      productId: newId,
      batchNo: batchInput.batchNo,
      mfgDate: batchInput.mfgDate,
      expiryDate: batchInput.expiryDate,
      qtyReceived: batchInput.qty,
      qtyOnHand: batchInput.qty,
      costPrice: batchInput.costPrice || productInput.purchasePrice,
    };

    const act: ActivityEvent = {
      id: `act-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'product',
      message: `Added ${newProduct.name} (+${batchInput.qty} units, batch ${batchInput.batchNo})`,
      timestamp: 'Just now',
    };

    setState((prev) => ({
      ...prev,
      products: [newProduct, ...prev.products],
      batches: [newBatch, ...prev.batches],
      activities: [act, ...prev.activities.slice(0, 14)],
    }));

    return newProduct;
  };

  const addBatchToProduct = (productId: string, batchInput: NewBatchInput): Batch => {
    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      productId,
      batchNo: batchInput.batchNo,
      mfgDate: batchInput.mfgDate,
      expiryDate: batchInput.expiryDate,
      qtyReceived: batchInput.qty,
      qtyOnHand: batchInput.qty,
      costPrice: batchInput.costPrice,
    };

    setState((prev) => {
      const prod = prev.products.find((p) => p.id === productId);
      const act: ActivityEvent = {
        id: `act-${Date.now()}`,
        shopId: PRIMARY_SHOP_ID,
        type: 'stock',
        message: `Confirmed intake: +${batchInput.qty} units for ${prod?.name ?? 'Product'} (${batchInput.batchNo})`,
        timestamp: 'Just now',
      };
      return {
        ...prev,
        batches: [newBatch, ...prev.batches],
        activities: [act, ...prev.activities.slice(0, 14)],
      };
    });

    return newBatch;
  };

  const recordSaleFEFO = (
    productId: string,
    qty: number,
    customerName: string = 'Walk-in Customer',
    source: 'POS' | 'RESERVATION' = 'POS',
    customUnitPrice?: number
  ) => {
    const prod = state.products.find((p) => p.id === productId && p.shopId === PRIMARY_SHOP_ID);
    if (!prod) {
      return { ok: false, error: 'Product not found in your shop.' };
    }

    const fefo = deductStockFEFO(state.batches, productId, qty);
    if (!fefo.ok) {
      return { ok: false, error: fefo.error };
    }

    const unitPrice = customUnitPrice ?? prod.sellingPrice;
    const total = Math.round(unitPrice * qty);
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      customerName,
      total,
      source,
      createdAt: addDaysIso(new Date(), 0),
      items: fefo.saleItems.map((it) => ({ ...it, unitPrice })),
    };

    const act: ActivityEvent = {
      id: `act-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'sale',
      message: `${source} sale: ${qty}x ${prod.name} (₹${total}) via FEFO`,
      timestamp: 'Just now',
    };

    setState((prev) => ({
      ...prev,
      batches: fefo.updatedBatches,
      sales: [sale, ...prev.sales],
      salesSeries: upsertDailySalesSeries(prev.salesSeries, total, qty),
      activities: [act, ...prev.activities.slice(0, 14)],
    }));

    return { ok: true, sale };
  };

  const commitGeneratedBill = (payload: CommitBillPayload) => {
    const { bill, sale, updatedBatches, updatedProducts } = payload;
    // Duplicate guard: never commit the same bill or idempotencyKey twice
    const alreadyExists = state.bills.some(
      (b) => b.id === bill.id || b.idempotencyKey === bill.idempotencyKey
    );
    if (alreadyExists) {
      return { ok: true, duplicate: true };
    }

    const totalUnits = bill.items.reduce((sum, it) => sum + it.qty, 0);
    const act: ActivityEvent = {
      id: `act-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'sale',
      message: `Invoice ${bill.invoiceNumber}: ${bill.items.length} item(s), ${totalUnits} units (₹${bill.grandTotal})`,
      timestamp: 'Just now',
    };

    setState((prev) => {
      if (
        prev.bills.some((b) => b.id === bill.id || b.idempotencyKey === bill.idempotencyKey)
      ) {
        return prev;
      }
      return {
        ...prev,
        batches: updatedBatches,
        products: updatedProducts,
        bills: [bill, ...prev.bills],
        sales: [sale, ...prev.sales],
        salesSeries: upsertDailySalesSeries(prev.salesSeries, bill.grandTotal, totalUnits),
        activities: [act, ...prev.activities.slice(0, 14)],
      };
    });

    return { ok: true, duplicate: false };
  };

  const markBillPaid = (billId: string) => {
    setState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) =>
        b.id === billId ? { ...b, paymentStatus: 'PAID' as const } : b
      ),
    }));
  };

  const archiveRecordsToReport = (
    mode: 'OLDER_THAN_7D' | 'ALL_CURRENT'
  ): { ok: boolean; error?: string; report?: ArchivedReport } => {
    const now = new Date();
    const cutoffIso = addDaysIso(now, -7);
    const cutoffMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    const targetSales =
      mode === 'OLDER_THAN_7D'
        ? state.sales.filter((s) => new Date(s.createdAt).getTime() < cutoffMs)
        : state.sales;

    const targetSeries =
      mode === 'OLDER_THAN_7D'
        ? state.salesSeries.filter((pt) => pt.date < cutoffIso)
        : state.salesSeries;

    if (targetSales.length === 0 && targetSeries.length === 0) {
      return {
        ok: false,
        error:
          mode === 'OLDER_THAN_7D'
            ? 'No records older than 7 days found to archive.'
            : 'No active records available to compile into a report.',
      };
    }

    const totalRevenue =
      targetSales.length > 0
        ? Math.round(targetSales.reduce((s, sale) => s + sale.total, 0) * 100) / 100
        : Math.round(targetSeries.reduce((s, pt) => s + pt.revenue, 0) * 100) / 100;

    const totalUnits =
      targetSales.length > 0
        ? targetSales.reduce(
            (s, sale) => s + sale.items.reduce((sum, it) => sum + it.qty, 0),
            0
          )
        : targetSeries.reduce((s, pt) => s + pt.units, 0);

    const wasteAvoided =
      Math.round(targetSeries.reduce((s, pt) => s + pt.wasteAvoided, 0) * 100) / 100;

    const dates = [
      ...targetSales.map((s) => s.createdAt.slice(0, 10)),
      ...targetSeries.map((pt) => pt.date),
    ]
      .filter(Boolean)
      .sort();

    const periodStart = dates[0] ?? addDaysIso(now, 0);
    const periodEnd = dates[dates.length - 1] ?? addDaysIso(now, 0);
    const dateStamp = addDaysIso(now, 0).replace(/-/g, '');
    const seq = String(state.archivedReports.length + 1).padStart(2, '0');

    const report: ArchivedReport = {
      id: `rpt-${now.getTime()}`,
      reportCode: `RPT-${dateStamp}-${seq}`,
      periodStart,
      periodEnd,
      transactionCount: targetSales.length,
      totalUnits,
      totalRevenue,
      wasteAvoided,
      createdAt: now.toISOString(),
    };

    const targetSaleIds = new Set(targetSales.map((s) => s.id));
    const targetSeriesDates = new Set(targetSeries.map((pt) => pt.date));

    const act: ActivityEvent = {
      id: `act-${now.getTime()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'sale',
      message: `Compiled report ${report.reportCode} (${report.transactionCount} txns, ₹${report.totalRevenue}) into Total Records`,
      timestamp: 'Just now',
    };

    setState((prev) => ({
      ...prev,
      sales: prev.sales.filter((s) => !targetSaleIds.has(s.id)),
      salesSeries: prev.salesSeries.filter((pt) => !targetSeriesDates.has(pt.date)),
      archivedReports: [report, ...prev.archivedReports],
      activities: [act, ...prev.activities.slice(0, 14)],
    }));

    return { ok: true, report };
  };

  const updateRecommendationStatus = (
    recId: string,
    status: 'ACCEPTED' | 'EDITED' | 'REJECTED',
    editedQty?: number
  ) => {
    setState((prev) => {
      const target = prev.recommendations.find((r) => r.id === recId);
      const act: ActivityEvent = {
        id: `act-${Date.now()}`,
        shopId: PRIMARY_SHOP_ID,
        type: 'stock',
        message: `Recommendation ${status.toLowerCase()}: ${target?.title ?? recId}`,
        timestamp: 'Just now',
      };
      return {
        ...prev,
        recommendations: prev.recommendations.map((r) =>
          r.id === recId
            ? { ...r, status, suggestedQty: editedQty ?? r.suggestedQty }
            : r
        ),
        activities: [act, ...prev.activities.slice(0, 14)],
      };
    });
  };

  const createOffer = (input: CreateOfferInput) => {
    const batch = state.batches.find((b) => b.id === input.batchId && b.shopId === PRIMARY_SHOP_ID);
    if (!batch) return { ok: false, error: 'Batch not found in your shop.' };

    const product = state.products.find((p) => p.id === batch.productId);
    if (!product) return { ok: false, error: 'Product not found.' };

    const offerPrice = Math.round(product.sellingPrice * (1 - input.discountPct / 100));

    // Hard Rule R3: Never sell below purchase price
    if (offerPrice < product.purchasePrice) {
      return {
        ok: false,
        error: `Price floor violated: ₹${offerPrice} is below purchase price ₹${product.purchasePrice}.`,
      };
    }

    // Hard Rule R2: Auto-withdraw margin before expiry
    const withdrawAt = computeWithdrawAt(batch.expiryDate, product.category);
    if (withdrawAt < addDaysIso(new Date(), 0)) {
      return {
        ok: false,
        error: `Batch ${batch.batchNo} is past the category auto-withdrawal threshold (${withdrawAt}).`,
      };
    }

    const clampedQty = Math.min(input.qty, batch.qtyOnHand);
    if (clampedQty <= 0) {
      return { ok: false, error: 'Selected batch has no available stock.' };
    }

    const newOffer: Offer = {
      id: `offer-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      shopName: state.shop.name,
      batchId: batch.id,
      productId: product.id,
      productName: product.name,
      category: product.category,
      imageEmoji: product.imageEmoji,
      type: input.type,
      bundleWithName: input.bundleWithName,
      discountPct: input.discountPct,
      originalPrice: product.sellingPrice,
      purchasePrice: product.purchasePrice,
      offerPrice,
      qtyTotal: clampedQty,
      qtyAvailable: clampedQty,
      validFrom: input.validFrom,
      validTo: input.validTo,
      withdrawAt,
      channels: input.channels,
      status: 'PUBLISHED',
      recommendedByAi: Boolean(input.recommendedByAi),
      distanceKm: 0.4,
    };

    const act: ActivityEvent = {
      id: `act-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'offer',
      message: `Published ${input.discountPct}% OFF offer on ${product.name} (₹${offerPrice})`,
      timestamp: 'Just now',
    };

    setState((prev) => ({
      ...prev,
      offers: [newOffer, ...prev.offers],
      activities: [act, ...prev.activities.slice(0, 14)],
    }));

    return { ok: true, offer: newOffer };
  };

  const withdrawOffer = (offerId: string) => {
    setState((prev) => ({
      ...prev,
      offers: prev.offers.map((o) =>
        o.id === offerId ? { ...o, status: 'WITHDRAWN' } : o
      ),
    }));
  };

  const reserveOffer = (
    offerId: string,
    qty: number,
    customerName: string,
    customerPhone: string
  ) => {
    const offer = state.offers.find((o) => o.id === offerId);
    if (!offer || offer.status !== 'PUBLISHED') {
      return { ok: false, error: 'This offer is no longer active.' };
    }
    if (qty <= 0 || qty > offer.qtyAvailable) {
      return { ok: false, error: `Only ${offer.qtyAvailable} left in stock.` };
    }

    const code = `RQ-${Math.floor(1000 + Math.random() * 8999)}`;
    const now = new Date();
    const holdUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const reservation: Reservation = {
      id: `res-${Date.now()}`,
      offerId: offer.id,
      shopId: offer.shopId,
      shopName: offer.shopName,
      productName: offer.productName,
      offerPrice: offer.offerPrice,
      originalPrice: offer.originalPrice,
      customerId: `cust-${Date.now()}`,
      customerName: customerName || 'Local Shopper',
      customerPhone: customerPhone || '+91 98000 00000',
      qty,
      code,
      holdUntil,
      status: 'HELD',
      createdAt: now.toISOString(),
    };

    const act: ActivityEvent = {
      id: `act-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'offer',
      message: `Customer reserved ${qty}x ${offer.productName} (Code ${code})`,
      timestamp: 'Just now',
    };

    setState((prev) => ({
      ...prev,
      offers: prev.offers.map((o) =>
        o.id === offerId ? { ...o, qtyAvailable: o.qtyAvailable - qty } : o
      ),
      reservations: [reservation, ...prev.reservations],
      activities: offer.shopId === PRIMARY_SHOP_ID ? [act, ...prev.activities.slice(0, 14)] : prev.activities,
    }));

    return { ok: true, reservation };
  };

  const collectReservation = (codeOrId: string) => {
    const normalized = codeOrId.trim().toUpperCase();
    const res = state.reservations.find(
      (r) => (r.id === codeOrId || r.code.toUpperCase() === normalized) && r.status === 'HELD'
    );
    if (!res) {
      return { ok: false, error: 'Active reservation code not found.' };
    }

    const offer = state.offers.find((o) => o.id === res.offerId);
    let updatedBatches = state.batches;
    let newSales = state.sales;

    // If this reservation belongs to the primary shop, execute FEFO sale deduction
    if (res.shopId === PRIMARY_SHOP_ID && offer) {
      const fefo = deductStockFEFO(state.batches, offer.productId, res.qty);
      if (fefo.ok) {
        updatedBatches = fefo.updatedBatches;
        const sale: Sale = {
          id: `sale-${Date.now()}`,
          shopId: PRIMARY_SHOP_ID,
          customerName: res.customerName,
          total: res.qty * res.offerPrice,
          source: 'RESERVATION',
          createdAt: addDaysIso(new Date(), 0),
          items: fefo.saleItems.map((it) => ({ ...it, unitPrice: res.offerPrice })),
        };
        newSales = [sale, ...state.sales];
      }
    }

    const act: ActivityEvent = {
      id: `act-${Date.now()}`,
      shopId: PRIMARY_SHOP_ID,
      type: 'sale',
      message: `Collected reservation ${res.code}: ${res.qty}x ${res.productName} (₹${res.qty * res.offerPrice})`,
      timestamp: 'Just now',
    };

    setState((prev) => ({
      ...prev,
      batches: updatedBatches,
      sales: newSales,
      salesSeries:
        res.shopId === PRIMARY_SHOP_ID
          ? upsertDailySalesSeries(
              prev.salesSeries,
              res.qty * res.offerPrice,
              res.qty,
              res.qty * res.offerPrice
            )
          : prev.salesSeries,
      reservations: prev.reservations.map((r) =>
        r.id === res.id ? { ...r, status: 'COLLECTED' } : r
      ),
      activities: [act, ...prev.activities.slice(0, 14)],
    }));

    return { ok: true, reservation: { ...res, status: 'COLLECTED' as const } };
  };

  const releaseExpiredReservations = (): number => {
    const nowMs = Date.now();
    let releasedCount = 0;
    const restoredQtyByOffer = new Map<string, number>();

    const nextReservations = state.reservations.map((r) => {
      if (r.status === 'HELD' && new Date(r.holdUntil).getTime() <= nowMs) {
        releasedCount++;
        restoredQtyByOffer.set(r.offerId, (restoredQtyByOffer.get(r.offerId) ?? 0) + r.qty);
        return { ...r, status: 'RELEASED' as const };
      }
      return r;
    });

    if (releasedCount === 0) return 0;

    setState((prev) => ({
      ...prev,
      reservations: nextReservations,
      offers: prev.offers.map((o) => {
        const restore = restoredQtyByOffer.get(o.id);
        return restore ? { ...o, qtyAvailable: o.qtyAvailable + restore } : o;
      }),
    }));

    return releasedCount;
  };

  const updateShopSettings = (
    updates: Partial<Shop> & {
      aiBasicMode?: boolean;
      assistantEnabled?: boolean;
      notificationsEnabled?: boolean;
    }
  ) => {
    const { aiBasicMode, assistantEnabled, notificationsEnabled, ...shopFields } = updates;
    setState((prev) => ({
      ...prev,
      shop: { ...prev.shop, ...shopFields },
      aiBasicMode: aiBasicMode ?? prev.aiBasicMode,
      assistantEnabled: assistantEnabled ?? prev.assistantEnabled,
      notificationsEnabled: notificationsEnabled ?? prev.notificationsEnabled,
    }));
  };

  const resetDemoData = () => {
    const fresh = createInitialState();
    setState(fresh);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('retailiq-store-v1');
  };

  return (
    <RetailStoreContext.Provider
      value={{
        ...state,
        isHydrated,
        addProductWithBatch,
        addBatchToProduct,
        commitGeneratedBill,
        markBillPaid,
        archiveRecordsToReport,
        recordSaleFEFO,
        updateRecommendationStatus,
        createOffer,
        withdrawOffer,
        reserveOffer,
        collectReservation,
        releaseExpiredReservations,
        updateShopSettings,
        resetDemoData,
      }}
    >
      {children}
    </RetailStoreContext.Provider>
  );
}

export function useRetailStore() {
  const ctx = useContext(RetailStoreContext);
  if (!ctx) {
    throw new Error('useRetailStore must be used inside RetailStoreProvider');
  }
  return ctx;
}

