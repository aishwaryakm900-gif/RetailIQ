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
  Archive,
  FolderCheck,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { addDaysIso } from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

type WeekWindow = '1d' | '3d' | '7d';

export function ReportsView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const {
    shop,
    salesSeries,
    sales,
    archivedReports,
    reservations,
    products,
    archiveRecordsToReport,
  } = useRetailStore();

  // Filter tracks detailed records strictly up to 1 week (1d, 3d, or 7d)
  const [windowFilter, setWindowFilter] = useState<WeekWindow>('7d');

  const windowDays = windowFilter === '1d' ? 1 : windowFilter === '3d' ? 3 : 7;

  // Partition active sales into: within selected window (<= 7d) vs older than 7 days
  const { filteredSales, olderThanWeekSales, weekSeries } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const selectedCutoffMs = startOfToday - (windowDays - 1) * 24 * 60 * 60 * 1000;
    const sevenDayCutoffMs = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const selectedCutoffIso = addDaysIso(now, -(windowDays - 1));

    const withinSelected = sales.filter(
      (s) => new Date(s.createdAt).getTime() >= selectedCutoffMs
    );
    const olderThanSeven = sales.filter(
      (s) => new Date(s.createdAt).getTime() < sevenDayCutoffMs
    );
    const seriesWithinSelected = salesSeries.filter((pt) => pt.date >= selectedCutoffIso);

    return {
      filteredSales: withinSelected,
      olderThanWeekSales: olderThanSeven,
      weekSeries: seriesWithinSelected,
    };
  }, [sales, salesSeries, windowDays]);

  // Metrics for selected <= 1-week window
  const windowMetrics = useMemo(() => {
    const revenueFromSales = filteredSales.reduce((s, sale) => s + sale.total, 0);
    const revenueFromSeries = weekSeries.reduce((s, pt) => s + pt.revenue, 0);
    const totalRevenue = filteredSales.length > 0 ? revenueFromSales : revenueFromSeries;

    const unitsFromSales = filteredSales.reduce(
      (s, sale) => s + sale.items.reduce((sum, it) => sum + it.qty, 0),
      0
    );
    const unitsFromSeries = weekSeries.reduce((s, pt) => s + pt.units, 0);
    const totalUnits = filteredSales.length > 0 ? unitsFromSales : unitsFromSeries;

    const totalWasteAvoided = weekSeries.reduce((s, d) => s + d.wasteAvoided, 0);

    const storeRes = reservations.filter((r) => r.shopId === shop.id);
    const collected = storeRes.filter((r) => r.status === 'COLLECTED').length;
    const conversionRate =
      storeRes.length > 0 ? Math.round((collected / storeRes.length) * 100) : 0;

    return {
      totalRevenue,
      totalUnits,
      totalWasteAvoided,
      txCount: filteredSales.length,
      reservationsCount: storeRes.length,
      collectedCount: collected,
      conversionRate,
    };
  }, [filteredSales, weekSeries, reservations, shop.id]);

  // Daily Sales Trend series synced with selected <= 1-week filter
  const salesTrendSeries = useMemo(() => {
    const byDate = new Map<string, { revenue: number; units: number }>();

    weekSeries.forEach((pt) => {
      byDate.set(pt.date, { revenue: pt.revenue, units: pt.units });
    });

    if (filteredSales.length > 0 && weekSeries.length === 0) {
      filteredSales.forEach((sale) => {
        const dateKey = sale.createdAt.slice(0, 10);
        const cur = byDate.get(dateKey) ?? { revenue: 0, units: 0 };
        cur.revenue += sale.total;
        cur.units += sale.items.reduce((s, it) => s + it.qty, 0);
        byDate.set(dateKey, cur);
      });
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, val]) => ({
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        }),
        revenue: Math.round(val.revenue * 100) / 100,
        units: val.units,
      }));
  }, [weekSeries, filteredSales]);

  // Cumulative Total Records (All Active Sales + All Compiled/Archived Reports)
  const totalRecords = useMemo(() => {
    const activeRevenue = sales.reduce((s, sale) => s + sale.total, 0);
    const activeUnits = sales.reduce(
      (s, sale) => s + sale.items.reduce((sum, it) => sum + it.qty, 0),
      0
    );
    const activeWaste = salesSeries.reduce((s, pt) => s + pt.wasteAvoided, 0);

    const archivedRevenue = archivedReports.reduce((s, r) => s + r.totalRevenue, 0);
    const archivedUnits = archivedReports.reduce((s, r) => s + r.totalUnits, 0);
    const archivedTxns = archivedReports.reduce((s, r) => s + r.transactionCount, 0);
    const archivedWaste = archivedReports.reduce((s, r) => s + r.wasteAvoided, 0);

    return {
      allTimeRevenue: Math.round((activeRevenue + archivedRevenue) * 100) / 100,
      allTimeUnits: activeUnits + archivedUnits,
      allTimeTransactions: sales.length + archivedTxns,
      allTimeWasteAvoided: Math.round((activeWaste + archivedWaste) * 100) / 100,
      compiledReportsCount: archivedReports.length,
      archivedRevenue,
      archivedTxns,
    };
  }, [sales, salesSeries, archivedReports]);

  const handleArchiveOlder = () => {
    const res = archiveRecordsToReport('OLDER_THAN_7D');
    if (!res.ok) {
      toast.info(res.error ?? 'No records older than 7 days to archive.');
      return;
    }
    toast.success(
      `Compiled report ${res.report?.reportCode} (${res.report?.transactionCount} older txns) and updated Total Records!`
    );
  };

  const handleCompileCurrentReport = () => {
    const res = archiveRecordsToReport('ALL_CURRENT');
    if (!res.ok) {
      toast.info(res.error ?? 'No active sales records available to compile into a report.');
      return;
    }
    toast.success(
      `Created report ${res.report?.reportCode} (${formatINR(res.report?.totalRevenue ?? 0, intlLocale)}) and updated Total Records!`
    );
  };

  const handleExportCsv = () => {
    const summaryHeader = [
      'Section',
      'ID / Code',
      'Channel / Period',
      'Customer / Txns',
      'Units',
      'Total_INR',
      'Timestamp',
    ];

    const activeRows = filteredSales.map((sale) => [
      'ACTIVE_WEEK_RECORD',
      sale.invoiceNumber ?? sale.id,
      sale.source,
      `"${(sale.customerName ?? 'Walk-in').replace(/"/g, '""')}"`,
      sale.items.reduce((s, it) => s + it.qty, 0),
      sale.total,
      sale.createdAt,
    ]);

    const archivedRows = archivedReports.map((rpt) => [
      'COMPILED_REPORT',
      rpt.reportCode,
      `${rpt.periodStart} to ${rpt.periodEnd}`,
      `${rpt.transactionCount} txns`,
      rpt.totalUnits,
      rpt.totalRevenue,
      rpt.createdAt,
    ]);

    const totalRow = [
      'TOTAL_RECORDS',
      'ALL-TIME',
      `${archivedReports.length} report(s) + ${sales.length} active`,
      `${totalRecords.allTimeTransactions} total txns`,
      totalRecords.allTimeUnits,
      totalRecords.allTimeRevenue,
      new Date().toISOString(),
    ];

    const csv = [
      summaryHeader.join(','),
      ...activeRows.map((r) => r.join(',')),
      ...archivedRows.map((r) => r.join(',')),
      totalRow.join(','),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retailiq-report-${shop.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported 1-week records and Total Records CSV report.');
  };

  const windowLabel =
    windowFilter === '1d'
      ? 'Today'
      : windowFilter === '3d'
        ? 'Last 3 Days'
        : 'Last 7 Days (1 Week)';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('reports')} &amp; Total Records
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track detailed sales records for up to 1 week and compile older records into Total Records reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Up to 1 Week Filter */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 text-xs font-medium">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <select
              value={windowFilter}
              onChange={(e) => setWindowFilter(e.target.value as WeekWindow)}
              aria-label="Filter records up to 1 week"
              className="bg-transparent focus:outline-hidden text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
            >
              <option value="1d" className="dark:bg-neutral-900">
                Today (1 Day)
              </option>
              <option value="3d" className="dark:bg-neutral-900">
                Last 3 Days
              </option>
              <option value="7d" className="dark:bg-neutral-900">
                Last 7 Days (Up to 1 Week)
              </option>
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleCompileCurrentReport}
            disabled={sales.length === 0 && salesSeries.length === 0}
          >
            <Archive className="w-4 h-4 text-emerald-600" />
            <span>Make Report &amp; Update Total</span>
          </Button>

          <Button size="sm" className="gap-1.5" onClick={handleExportCsv}>
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Auto-detect Records Older Than 7 Days Banner */}
      {olderThanWeekSales.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                {olderThanWeekSales.length} record(s) are older than 1 week
              </div>
              <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Detailed tracking covers up to 7 days. Compile older records into a summary report to
                keep your weekly ledger clean and update Total Records.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleArchiveOlder}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Make Report for Older Records</span>
          </Button>
        </div>
      )}

      {/* 4 KPI Cards for Selected <= 1 Week Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Revenue ({windowLabel})</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {formatINR(windowMetrics.totalRevenue, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {windowMetrics.totalUnits.toLocaleString()} units sold in period
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Waste Loss Avoided</span>
            <Leaf className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">
            {formatINR(windowMetrics.totalWasteAvoided, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Saved via FEFO &amp; timely offers
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Collection Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {windowMetrics.conversionRate}%
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {windowMetrics.collectedCount} of {windowMetrics.reservationsCount} reservations picked up
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Records ({windowLabel})</span>
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {windowMetrics.txCount}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Billing, POS &amp; pickup transactions
          </p>
        </div>
      </div>

      {/* Sales Trend Graph (Up to 1 Week) */}
      <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Sales Trend
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Daily store revenue ({windowLabel})
            </p>
          </div>
          <Badge variant="healthy">{formatINR(windowMetrics.totalRevenue, intlLocale)}</Badge>
        </div>

        <div className="h-64 w-full" aria-label="Sales Trend Area Chart">
          {salesTrendSeries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                No sales trend data in {windowLabel.toLowerCase()} yet
              </p>
              <p className="mt-1">
                Sales recorded in Billing or POS will automatically plot on this graph.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={salesTrendSeries}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="reportsRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `₹${(Number(v) / 1000).toFixed(1)}k` : `₹${v}`
                  }
                />
                <Tooltip
                  formatter={(value) => [formatINR(Number(value), intlLocale), 'Revenue']}
                  contentStyle={{
                    borderRadius: '10px',
                    borderColor: '#E5E7EB',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#16A34A"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#reportsRevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Total Records (All-Time Cumulative Summary) */}
      <div className="bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-neutral-900 rounded-card p-5 border border-emerald-200/80 dark:border-emerald-900/60 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <FolderCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Total Records (All-Time Cumulative)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Combines active 1-week transactions with all compiled historical reports.
              </p>
            </div>
          </div>
          <Badge variant="healthy">
            {totalRecords.compiledReportsCount} Compiled Report(s)
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200/80 dark:border-neutral-800">
            <div className="text-gray-500">All-Time Total Revenue</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
              {formatINR(totalRecords.allTimeRevenue, intlLocale)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200/80 dark:border-neutral-800">
            <div className="text-gray-500">All-Time Transactions</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
              {totalRecords.allTimeTransactions}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200/80 dark:border-neutral-800">
            <div className="text-gray-500">All-Time Units Sold</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
              {totalRecords.allTimeUnits.toLocaleString()}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200/80 dark:border-neutral-800">
            <div className="text-gray-500">Archived Report Revenue</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
              {formatINR(totalRecords.archivedRevenue, intlLocale)}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales Ledger (Filtered Up to 1 Week) */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Sales Records — {windowLabel}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Detailed transactions tracked up to 7 days. Older entries are rolled into Compiled Reports below.
              </p>
            </div>
          </div>
          <Badge variant="outline">{filteredSales.length} transaction(s)</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Sale / Invoice ID</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items Breakdown</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500">
                    No sales transactions recorded within {windowLabel.toLowerCase()}.
                  </td>
                </tr>
              ) : (
                filteredSales.slice(0, 25).map((sale) => {
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
                        {sale.invoiceNumber ?? sale.id}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            sale.source === 'RESERVATION'
                              ? 'info'
                              : sale.source === 'BILLING'
                                ? 'healthy'
                                : 'outline'
                          }
                        >
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

      {/* Compiled Reports (Archived Periods Included in Total Records) */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Compiled Period Reports (Saved to Total Records)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Records older than 1 week or manually compiled summaries remain permanently counted in Total Records.
              </p>
            </div>
          </div>
          <Badge variant="outline">{archivedReports.length} report(s)</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Report Code</th>
                <th className="py-3 px-4">Covered Period</th>
                <th className="py-3 px-4">Transactions</th>
                <th className="py-3 px-4">Units Sold</th>
                <th className="py-3 px-4">Compiled On</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {archivedReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500">
                    No compiled reports yet. Click &ldquo;Make Report &amp; Update Total&rdquo; to
                    archive records into Total Records.
                  </td>
                </tr>
              ) : (
                archivedReports.map((rpt) => (
                  <tr
                    key={rpt.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                      {rpt.reportCode}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 font-medium">
                      {rpt.periodStart === rpt.periodEnd
                        ? rpt.periodStart
                        : `${rpt.periodStart} → ${rpt.periodEnd}`}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 tabular-nums">
                      {rpt.transactionCount}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 tabular-nums">
                      {rpt.totalUnits.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                      {new Date(rpt.createdAt).toLocaleString(intlLocale, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                      {formatINR(rpt.totalRevenue, intlLocale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
