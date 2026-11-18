'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  FileSpreadsheet,
  IndianRupee,
  Leaf,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

export function ReportsView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const { shop, salesSeries, sales, offers, reservations, products } = useRetailStore();
  const [range, setRange] = useState<'7d' | '14d'>('14d');

  const series = useMemo(
    () => (range === '7d' ? salesSeries.slice(-7) : salesSeries),
    [salesSeries, range]
  );

  const metrics = useMemo(() => {
    const totalRevenue = series.reduce((s, d) => s + d.revenue, 0);
    const totalUnits = series.reduce((s, d) => s + d.units, 0);
    const totalWasteAvoided = series.reduce((s, d) => s + d.wasteAvoided, 0);

    const storeOffers = offers.filter((o) => o.shopId === shop.id);
    const storeRes = reservations.filter((r) => r.shopId === shop.id);
    const collected = storeRes.filter((r) => r.status === 'COLLECTED').length;
    const conversionRate =
      storeRes.length > 0 ? Math.round((collected / storeRes.length) * 100) : 0;

    return {
      totalRevenue,
      totalUnits,
      totalWasteAvoided,
      storeOffersCount: storeOffers.length,
      reservationsCount: storeRes.length,
      collectedCount: collected,
      conversionRate,
    };
  }, [series, offers, reservations, shop.id]);

  const funnelData = useMemo(() => {
    const storeOffers = offers.filter((o) => o.shopId === shop.id);
    const listedPacks = storeOffers.reduce((s, o) => s + o.qtyTotal, 0);
    const storeRes = reservations.filter((r) => r.shopId === shop.id);
    const reservedPacks = storeRes.reduce((s, r) => s + r.qty, 0);
    const collectedPacks = storeRes
      .filter((r) => r.status === 'COLLECTED')
      .reduce((s, r) => s + r.qty, 0);

    return [
      { stage: 'Offers Live', value: storeOffers.length },
      { stage: 'Packs Listed', value: listedPacks },
      { stage: 'Reserved', value: reservedPacks },
      { stage: 'Collected', value: collectedPacks },
    ];
  }, [offers, reservations, shop.id]);

  const handleExportCsv = () => {
    const header = ['Date', 'Revenue_INR', 'Units_Sold', 'Waste_Avoided_INR'];
    const rows = series.map((pt) => [pt.date, pt.revenue, pt.units, pt.wasteAvoided]);
    const ledgerHeader = ['', 'Sale_ID', 'Source', 'Customer', 'Items', 'Total_INR', 'Timestamp'];
    const ledgerRows = sales.map((sale) => [
      '',
      sale.id,
      sale.source,
      `"${(sale.customerName ?? 'Walk-in').replace(/"/g, '""')}"`,
      sale.items.reduce((s, it) => s + it.qty, 0),
      sale.total,
      sale.createdAt,
    ]);

    const csv = [
      header.join(','),
      ...rows.map((r) => r.join(',')),
      '',
      ledgerHeader.join(','),
      ...ledgerRows.map((r) => r.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retailiq-${shop.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported CSV performance & sales ledger report.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('reports')} &amp; Sustainability
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sales velocity, expiry waste avoided, Stock Rescue conversion rates, and CSV export.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 text-xs font-medium">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as '7d' | '14d')}
              aria-label="Select report range"
              className="bg-transparent focus:outline-hidden text-gray-700 dark:text-gray-200"
            >
              <option value="7d" className="dark:bg-neutral-900">
                Last 7 Days
              </option>
              <option value="14d" className="dark:bg-neutral-900">
                Last 14 Days
              </option>
            </select>
          </div>

          <Button size="sm" className="gap-1.5" onClick={handleExportCsv}>
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Gross Revenue ({range})</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {formatINR(metrics.totalRevenue, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {metrics.totalUnits.toLocaleString()} total units sold
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Waste Loss Avoided</span>
            <Leaf className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">
            {formatINR(metrics.totalWasteAvoided, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Capital rescued via FEFO &amp; early offers
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Collection Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {metrics.conversionRate}%
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {metrics.collectedCount} of {metrics.reservationsCount} reservations picked up
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Recorded Sales Txns</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {sales.length}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            POS + Stock Rescue counter pickups
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Daily Revenue vs Expiry Waste Recovered (₹)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Combines normal POS billing with pre-expiry discount recovery
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.45} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Daily Revenue (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="wasteAvoided"
                  name="Waste Recovered (₹)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Offers &amp; Pickup Funnel
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live packs listed vs reserved &amp; collected
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.45} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="stage" type="category" width={88} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" name="Count" fill="#0d9488" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Sales Ledger */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recent Sales &amp; FEFO Pickups
            </h2>
          </div>
          <Badge variant="outline">{sales.length} transactions</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Sale ID</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items Breakdown</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500">
                    No sales transactions recorded yet. Sales will appear here after POS or pickup checkout.
                  </td>
                </tr>
              ) : (
                sales.slice(0, 15).map((sale) => {
                const itemDesc = sale.items
                  .map((it) => {
                    const p = products.find((prod) => prod.id === it.productId);
                    return `${it.qty}x ${p?.name ?? it.productId}`;
                  })
                  .join(', ');

                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {sale.id}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={sale.source === 'RESERVATION' ? 'info' : 'healthy'}>
                        {sale.source}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                      {sale.customerName ?? 'Walk-in'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300 max-w-[280px] truncate">
                      {itemDesc}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(sale.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                      {formatINR(sale.total, intlLocale)}
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
  );
}

