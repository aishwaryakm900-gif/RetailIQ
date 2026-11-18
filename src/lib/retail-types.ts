import { ProductCategory } from './retail-config';

export type UserRole = 'ADMIN' | 'SHOPKEEPER' | 'CUSTOMER';

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  lat: number;
  lng: number;
  defaultRadiusM: number;
  phone: string;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  leadTimeDays: number;
  packSize: number;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  barcode: string;
  sku: string;
  category: ProductCategory;
  mrp: number;
  purchasePrice: number;
  sellingPrice: number;
  minStock: number;
  reorderLevel: number;
  supplierId: string;
  shelfLifeDays: number;
  dailyDemandAvg: number; // Derived from 90-day series
  moverState: 'fresh' | 'normal' | 'slow-moving' | 'near-expiry' | 'dead stock';
  imageEmoji: string;
}

export interface Batch {
  id: string;
  shopId: string;
  productId: string;
  batchNo: string;
  mfgDate: string; // ISO YYYY-MM-DD
  expiryDate: string; // ISO YYYY-MM-DD
  qtyReceived: number;
  qtyOnHand: number;
  costPrice: number;
}

export interface SaleItem {
  productId: string;
  batchId: string;
  qty: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  shopId: string;
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  total: number;
  source: 'POS' | 'RESERVATION' | 'BILLING';
  createdAt: string;
  items: SaleItem[];
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface BatchDeductionDetail {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  costPrice: number;
}

export interface BillItem {
  id: string;
  billId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  category: ProductCategory;
  qty: number;
  unitPrice: number;
  subtotal: number;
  batchDeductions: BatchDeductionDetail[];
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  idempotencyKey: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: BillItem[];
  saleId: string;
}

export interface Offer {
  id: string;
  shopId: string;
  shopName: string;
  batchId: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  imageEmoji: string;
  type: 'DISCOUNT' | 'BUNDLE';
  bundleWithName?: string;
  discountPct: number;
  originalPrice: number;
  purchasePrice: number;
  offerPrice: number;
  qtyTotal: number;
  qtyAvailable: number;
  validFrom: string;
  validTo: string;
  withdrawAt: string; // Hard Rule R2
  channels: ('WHATSAPP' | 'STOCK_RESCUE')[];
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN' | 'EXPIRED';
  recommendedByAi: boolean;
  distanceKm: number; // Computed via Haversine for nearby shops (Hard Rule R7)
}

export interface Reservation {
  id: string;
  offerId: string;
  shopId: string;
  shopName: string;
  productName: string;
  offerPrice: number;
  originalPrice: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  qty: number;
  code: string;
  holdUntil: string;
  status: 'HELD' | 'COLLECTED' | 'RELEASED';
  createdAt: string;
}

export interface Recommendation {
  id: string;
  shopId: string;
  kind: 'REORDER' | 'DISCOUNT' | 'BUNDLE' | 'EXPIRY_ACTION';
  productId?: string;
  batchId?: string;
  title: string;
  description: string;
  suggestedQty?: number;
  suggestedDiscountPct?: number;
  expectedLeftoverWithout?: number;
  expectedLeftoverWith?: number;
  estimatedRecoveryRs?: number;
  status: 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  shopId: string;
  type: 'stock' | 'product' | 'expiry' | 'low_stock' | 'offer' | 'sale';
  message: string;
  timestamp: string;
}

export interface DailySalesPoint {
  date: string;
  label: string;
  revenue: number;
  units: number;
  wasteAvoided: number;
}

export interface ArchivedReport {
  id: string;
  reportCode: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  totalUnits: number;
  totalRevenue: number;
  wasteAvoided: number;
  createdAt: string;
}

