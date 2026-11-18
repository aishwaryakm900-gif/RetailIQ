import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { executeAtomicBillingFEFO } from '@/lib/retail-rules';
import { Batch, Bill, Product, Sale } from '@/lib/retail-types';

const billingRequestSchema = z.object({
  idempotencyKey: z.string().min(6).max(128),
  shop: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    address: z.string().default(''),
    phone: z.string().default(''),
  }),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).default('CASH'),
  paymentStatus: z.enum(['PAID', 'PENDING']).default('PAID'),
  discountPct: z.number().min(0).max(50).default(0),
  // Strictly accept productId + qty only — never trust client prices or totals
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive(),
      })
    )
    .min(1, 'At least one product is required to generate a bill.'),
  inventorySnapshot: z.object({
    products: z.array(z.any()),
    batches: z.array(z.any()),
  }),
});

interface PersistedBillRecord {
  bill: Bill;
  sale: Sale;
  updatedBatches: Batch[];
  updatedProducts: Product[];
}

// In-memory idempotency guard + optional local JSON ledger for persistence across restarts
const processedBillsMap = new Map<string, PersistedBillRecord>();
const LEDGER_DIR = path.join(process.cwd(), '.retailiq-data');
const LEDGER_FILE = path.join(LEDGER_DIR, 'bills.json');

function readBillLedger(): Bill[] {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    const raw = fs.readFileSync(LEDGER_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendBillToLedger(bill: Bill): boolean {
  try {
    if (!fs.existsSync(LEDGER_DIR)) {
      fs.mkdirSync(LEDGER_DIR, { recursive: true });
    }
    const existing = readBillLedger();
    if (existing.some((b) => b.idempotencyKey === bill.idempotencyKey || b.id === bill.id)) {
      return true;
    }
    const next = [bill, ...existing];
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(next, null, 2), 'utf-8');
    return true;
  } catch {
    // Gracefully degrade on read-only serverless environments
    return false;
  }
}

function generateInvoiceNumber(existingBills: Bill[], now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `INV-${datePart}-`;

  let maxSeq = 0;
  for (const b of existingBills) {
    if (b.invoiceNumber?.startsWith(prefix)) {
      const num = parseInt(b.invoiceNumber.slice(prefix.length), 10);
      if (!Number.isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  // Add a time-derived suffix fallback if ledger is unavailable
  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(4, '0');
  return `${prefix}${seqStr}`;
}

export async function GET() {
  const bills = readBillLedger();
  return NextResponse.json({
    ok: true,
    count: bills.length,
    bills,
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = billingRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          errorType: 'VALIDATION_ERROR',
          error: firstIssue?.message || 'Invalid billing payload.',
        },
        { status: 400 }
      );
    }

    const {
      idempotencyKey,
      shop,
      customerName,
      customerPhone,
      paymentMethod,
      paymentStatus,
      discountPct,
      items,
      inventorySnapshot,
    } = parsed.data;

    // 1. Idempotency Guard: prevent duplicate stock deductions if submitted more than once
    const existingInMemory = processedBillsMap.get(idempotencyKey);
    if (existingInMemory) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        ...existingInMemory,
      });
    }

    const persistedBills = readBillLedger();
    const existingOnDisk = persistedBills.find((b) => b.idempotencyKey === idempotencyKey);
    if (existingOnDisk) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        bill: existingOnDisk,
        sale: {
          id: existingOnDisk.saleId,
          shopId: existingOnDisk.shopId,
          customerName: existingOnDisk.customerName || 'Walk-in Customer',
          invoiceNumber: existingOnDisk.invoiceNumber,
          total: existingOnDisk.grandTotal,
          source: 'BILLING' as const,
          createdAt: existingOnDisk.createdAt,
          items: existingOnDisk.items.flatMap((it) =>
            it.batchDeductions.map((bd) => ({
              productId: it.productId,
              batchId: bd.batchId,
              qty: bd.qty,
              unitPrice: it.unitPrice,
            }))
          ),
        },
        updatedBatches: inventorySnapshot.batches,
        updatedProducts: inventorySnapshot.products,
      });
    }

    // 2. Atomic multi-item FEFO validation, authoritative pricing, and batch deduction
    const now = new Date();
    const billId = `bill-${now.getTime()}`;
    const saleId = `sale-${now.getTime()}`;
    const invoiceNumber = generateInvoiceNumber(persistedBills, now);

    const tx = executeAtomicBillingFEFO(
      inventorySnapshot.products as Product[],
      inventorySnapshot.batches as Batch[],
      items,
      discountPct,
      billId,
      now
    );

    if (!tx.ok) {
      return NextResponse.json(
        {
          ok: false,
          errorType: 'INSUFFICIENT_STOCK',
          error: tx.error,
          failedProductId: tx.failedProductId,
        },
        { status: 400 }
      );
    }

    const cleanCustomerName = customerName?.trim() || undefined;
    const cleanCustomerPhone = customerPhone?.trim() || undefined;
    const createdAtIso = now.toISOString();

    const bill: Bill = {
      id: billId,
      invoiceNumber,
      idempotencyKey,
      shopId: shop.id,
      shopName: shop.name,
      shopAddress: shop.address,
      shopPhone: shop.phone,
      customerName: cleanCustomerName,
      customerPhone: cleanCustomerPhone,
      subtotal: tx.subtotal,
      discountPct: tx.discountPct,
      discountAmount: tx.discountAmount,
      taxAmount: tx.taxAmount,
      grandTotal: tx.grandTotal,
      paymentMethod,
      paymentStatus,
      createdAt: createdAtIso,
      items: tx.billItems,
      saleId,
    };

    const sale: Sale = {
      id: saleId,
      shopId: shop.id,
      customerName: cleanCustomerName || 'Walk-in Customer',
      invoiceNumber,
      total: tx.grandTotal,
      source: 'BILLING',
      createdAt: createdAtIso,
      items: tx.saleItems,
    };

    const resultPayload: PersistedBillRecord = {
      bill,
      sale,
      updatedBatches: tx.updatedBatches,
      updatedProducts: tx.updatedProducts,
    };

    // 3. Persist server-side & register idempotency key
    appendBillToLedger(bill);
    processedBillsMap.set(idempotencyKey, resultPayload);

    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        ...resultPayload,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Billing generation error:', error);
    return NextResponse.json(
      {
        ok: false,
        errorType: 'SERVER_ERROR',
        error: error?.message || 'Unable to generate bill. No stock was deducted.',
      },
      { status: 500 }
    );
  }
}

