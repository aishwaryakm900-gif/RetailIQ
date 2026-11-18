'use client';

import React from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  Receipt,
  Store,
  User,
  Phone,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bill } from '@/lib/retail-types';
import { formatINR } from '@/lib/utils';

interface InvoiceModalProps {
  bill: Bill;
  intlLocale: string;
  onClose: () => void;
  onMarkPaid?: (billId: string) => void;
}

function buildPrintableInvoiceHtml(bill: Bill, intlLocale: string): string {
  const formattedDate = new Date(bill.createdAt).toLocaleString(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const rowsHtml = bill.items
    .map((item, idx) => {
      const batchesText = item.batchDeductions
        .map((b) => `${b.batchNo} (${b.qty})`)
        .join(', ');
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#475569;">${idx + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:600;color:#0f172a;">${item.productName}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">SKU: ${item.sku}${batchesText ? ` • Batch: ${batchesText}` : ''}</div>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${item.qty}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatINR(item.unitPrice, intlLocale)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${formatINR(item.subtotal, intlLocale)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${bill.invoiceNumber} — ${bill.shopName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 28px;
      max-width: 780px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #059669;padding-bottom:16px;margin-bottom:20px;">
    <div>
      <div style="font-size:22px;font-weight:800;color:#065f46;">${bill.shopName}</div>
      ${bill.shopAddress ? `<div style="font-size:12px;color:#475569;margin-top:4px;">${bill.shopAddress}</div>` : ''}
      ${bill.shopPhone ? `<div style="font-size:12px;color:#475569;margin-top:2px;">Phone: ${bill.shopPhone}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Tax / Retail Invoice</div>
      <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:2px;font-family:monospace;">${bill.invoiceNumber}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;">${formattedDate}</div>
      <div style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${bill.paymentStatus === 'PAID' ? '#dcfce7' : '#fef3c7'};color:${bill.paymentStatus === 'PAID' ? '#166534' : '#92400e'};">
        ${bill.paymentStatus} • ${bill.paymentMethod}
      </div>
    </div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:18px;display:flex;justify-content:space-between;">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;font-weight:700;">Billed To</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${bill.customerName || 'Walk-in Customer'}</div>
      ${bill.customerPhone ? `<div style="font-size:12px;color:#475569;margin-top:2px;">Phone: ${bill.customerPhone}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;font-weight:700;">Stock Dispatch</div>
      <div style="font-size:12px;font-weight:600;color:#065f46;margin-top:4px;">FEFO – First Expired, First Out</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
    <thead>
      <tr style="background:#f1f5f9;text-align:left;">
        <th style="padding:10px 8px;border-bottom:1.5px solid #cbd5e1;width:36px;">#</th>
        <th style="padding:10px 8px;border-bottom:1.5px solid #cbd5e1;">Product</th>
        <th style="padding:10px 8px;border-bottom:1.5px solid #cbd5e1;text-align:right;width:70px;">Qty</th>
        <th style="padding:10px 8px;border-bottom:1.5px solid #cbd5e1;text-align:right;width:110px;">Unit Price</th>
        <th style="padding:10px 8px;border-bottom:1.5px solid #cbd5e1;text-align:right;width:120px;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;">
    <div style="width:280px;font-size:13px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;color:#475569;">
        <span>Subtotal</span>
        <span>${formatINR(bill.subtotal, intlLocale)}</span>
      </div>
      ${
        bill.discountAmount > 0
          ? `<div style="display:flex;justify-content:space-between;padding:5px 0;color:#059669;">
              <span>Discount (${bill.discountPct}%)</span>
              <span>-${formatINR(bill.discountAmount, intlLocale)}</span>
            </div>`
          : ''
      }
      ${
        bill.taxAmount > 0
          ? `<div style="display:flex;justify-content:space-between;padding:5px 0;color:#475569;">
              <span>Tax</span>
              <span>${formatINR(bill.taxAmount, intlLocale)}</span>
            </div>`
          : ''
      }
      <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:6px;border-top:2px solid #0f172a;font-size:16px;font-weight:800;color:#0f172a;">
        <span>Grand Total</span>
        <span>${formatINR(bill.grandTotal, intlLocale)}</span>
      </div>
    </div>
  </div>

  <div style="margin-top:28px;padding-top:12px;border-top:1px dashed #cbd5e1;text-align:center;font-size:11px;color:#64748b;">
    Thank you for shopping at ${bill.shopName}! Powered by RetailIQ.
  </div>
</body>
</html>`;
}

export function InvoiceModal({ bill, intlLocale, onClose, onMarkPaid }: InvoiceModalProps) {
  const formattedDate = new Date(bill.createdAt).toLocaleString(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrintOrPdf = (mode: 'print' | 'pdf') => {
    const html = buildPrintableInvoiceHtml(bill, intlLocale);
    const printWin = window.open('', '_blank', 'width=850,height=900');
    if (!printWin) {
      // Fallback if pop-ups are blocked
      window.print();
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      if (mode === 'print') {
        printWin.onafterprint = () => printWin.close();
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Invoice {bill.invoiceNumber}</span>
                <Badge variant={bill.paymentStatus === 'PAID' ? 'healthy' : 'warning'}>
                  {bill.paymentStatus}
                </Badge>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generated {formattedDate} • Saved to Billing History &amp; Inventory updated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close invoice modal"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Invoice Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Store & Invoice Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-200 dark:border-neutral-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-lg">
                <Store className="w-4 h-4" />
                <span>{bill.shopName}</span>
              </div>
              {bill.shopAddress && (
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                  {bill.shopAddress}
                </p>
              )}
              {bill.shopPhone && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone: {bill.shopPhone}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                Invoice Number
              </div>
              <div className="font-mono font-bold text-base text-gray-900 dark:text-white">
                {bill.invoiceNumber}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bill.paymentMethod}</span>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 text-xs">
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Customer Details
              </div>
              <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>{bill.customerName || 'Walk-in Customer'}</span>
              </div>
              {bill.customerPhone && (
                <div className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>{bill.customerPhone}</span>
                </div>
              )}
            </div>
            <div className="sm:text-right space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Inventory Deduction
              </div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                FEFO – First Expired, First Out
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Nearest expiry batches deducted automatically
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 text-[11px] uppercase text-gray-500 dark:text-gray-400">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {bill.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-3 text-gray-400 tabular-nums">{index + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        SKU: {item.sku}
                        {item.batchDeductions.length > 0 && (
                          <span>
                            {' '}
                            • FEFO Batch:{' '}
                            {item.batchDeductions
                              .map((b) => `${b.batchNo} (-${b.qty})`)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                      {item.qty}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                      {formatINR(item.unitPrice, intlLocale)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatINR(item.subtotal, intlLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium">
                  {formatINR(bill.subtotal, intlLocale)}
                </span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Discount ({bill.discountPct}%)</span>
                  <span className="tabular-nums font-medium">
                    -{formatINR(bill.discountAmount, intlLocale)}
                  </span>
                </div>
              )}
              {bill.taxAmount > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Tax</span>
                  <span className="tabular-nums font-medium">
                    {formatINR(bill.taxAmount, intlLocale)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2.5 mt-1 border-t border-gray-200 dark:border-neutral-700 text-base font-bold text-gray-900 dark:text-white">
                <span>Grand Total</span>
                <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatINR(bill.grandTotal, intlLocale)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {bill.paymentStatus === 'PENDING' && onMarkPaid && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => onMarkPaid(bill.id)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark as Paid
              </Button>
            )}
            {bill.paymentStatus === 'PAID' && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Payment Confirmed
              </span>
            )}
            {bill.paymentStatus === 'PENDING' && !onMarkPaid && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Payment Pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handlePrintOrPdf('print')}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Bill
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handlePrintOrPdf('pdf')}
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </Button>
            <Button type="button" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

