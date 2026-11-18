'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  Package,
  IndianRupee,
  AlertTriangle,
  ClockAlert,
  ArrowUpRight,
  Sparkles,
  Calendar,
  ShoppingCart,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import {
  assessBatchExpiryRisk,
  daysUntil,
} from '@/lib/retail-rules';

export function DashboardView() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const {
    shop,
    products,
    batches,
    salesSeries,
    offers,
  } = useRetailStore();

  const [range, setRange] = useState<'7d' | '14d'>('7d');

  // Time-aware greeting
  const hour = new Date().getHours();
  let greetingKey: 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' = 'greetingMorning';
  if (hour >= 12 && hour < 17) greetingKey = 'greetingAfternoon';
  else if (hour >= 17) greetingKey = 'greetingEvening';
  const greeting = t(greetingKey, { name: shop.ownerName.split(' ')[0] });

  // Live aggregated metrics from store
  const metrics = useMemo(() => {
    const stockByProduct = new Map<string, number>();
    let inventoryValue = 0;

    batches.forEach((b) => {
      if (b.qtyOnHand > 0) {
        stockByProduct.set(b.productId, (stockByProduct.get(b.productId) ?? 0) + b.qtyOnHand);
        inventoryValue += b.qtyOnHand * b.costPrice;
      }
    });

    const lowStockProducts = products.filter(
      (p) => (stockByProduct.get(p.id) ?? 0) < p.minStock
    );

    const nearExpiryBatches = batches.filter(
      (b) => b.qtyOnHand > 0 && daysUntil(b.expiryDate) <= 7
    );

    const nearExpiryProductIds = new Set(nearExpiryBatches.map((b) => b.productId));

    const assessments = nearExpiryBatches
      .map((b) => {
        const p = products.find((pr) => pr.id === b.productId);
        return p ? assessBatchExpiryRisk(b, p) : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.estimatedLoss - a.estimatedLoss);

    const totalWasteAvoided = salesSeries.reduce((s, d) => s + d.wasteAvoided, 0);

    // Top-selling product categories (from daily demand * 7)
    const categoryTotals = new Map<string, number>();
    products.forEach((p) => {
      const weeklyUnits = Math.round(p.dailyDemandAvg * 7);
      categoryTotals.set(p.category, (categoryTotals.get(p.category) ?? 0) + weeklyUnits);
    });
    const topCategories = Array.from(categoryTotals.entries())
      .map(([category, units]) => ({
        category: category.replace('Oils and Fats', 'Oils').replace('Daily Essentials', 'Essentials'),
        units,
      }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 6);

    return {
      totalProducts: products.length,
      inventoryValue,
      lowStockCount: lowStockProducts.length,
      nearExpiryCount: nearExpiryProductIds.size,
      lowStockProducts,
      assessments,
      totalWasteAvoided,
      topCategories,
    };
  }, [products, batches, salesSeries]);

  const displayedSeries = range === '7d' ? salesSeries.slice(-7) : salesSeries;

  const statCards = [
    {
      title: t('stats.totalProducts'),
      value: String(metrics.totalProducts),
      delta: t('stats.deltaProducts'),
      icon: Package,
      tint: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/60',
    },
    {
      title: t('stats.inventoryValue'),
      value: formatINR(metrics.inventoryValue, intlLocale),
      delta: t('stats.deltaValue'),
      icon: IndianRupee,
      tint: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/60',
    },
    {
      title: t('stats.lowStockItems'),
      value: String(metrics.lowStockCount),
      delta: t('stats.deltaLowStock'),
      icon: AlertTriangle,
      tint: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/60',
    },
    {
      title: t('stats.nearExpiryProducts'),
      value: String(metrics.nearExpiryCount),
      delta: t('stats.deltaNearExpiry'),
      icon: ClockAlert,
      tint: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800/60',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Greeting Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {greeting}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {shop.name} — {t('subtext')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-2xs text-xs font-medium text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as '7d' | '14d')}
              aria-label="Select date range"
              className="bg-transparent focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="7d" className="dark:bg-neutral-900">
                {t('charts.last7Days')}
              </option>
              <option value="14d" className="dark:bg-neutral-900">
                Last 14 Days
              </option>
            </select>
          </div>
          <Link href="/inventory">
            <Button size="sm" className="h-9 text-xs gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Quick POS / Intake</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Four Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card flex flex-col justify-between hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border ${card.tint}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight tabular-nums">
                  {card.value}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{card.delta}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row: Sales Trend & Top-Selling Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sales Trend Area Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('charts.salesTrend')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Daily store revenue ({range === '7d' ? '7 days' : '14 days'})
              </p>
            </div>
            <Badge variant="healthy">{offers.filter((o) => o.status === 'PUBLISHED').length} Active Offers</Badge>
          </div>

          <div className="h-60 w-full" aria-label="Sales Trend Area Chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatINR(Number(value), intlLocale), 'Revenue']}
                  contentStyle={{ borderRadius: '10px', borderColor: '#E5E7EB', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#16A34A"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top-selling Product Categories Bar Chart */}
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('charts.topCategories')}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Weekly units sold across categories
              </p>
            </div>
            <Link
              href="/reports"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Reports →
            </Link>
          </div>

          <div className="h-60 w-full" aria-label="Top-selling Product Categories Bar Chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topCategories} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`${value} units`, 'Weekly Sold']}
                  contentStyle={{ borderRadius: '10px', borderColor: '#E5E7EB', fontSize: '12px' }}
                />
                <Bar dataKey="units" fill="#16A34A" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

