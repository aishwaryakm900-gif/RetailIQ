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
  ShoppingCart,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/utils';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES } from '@/lib/retail-config';
import { daysUntil } from '@/lib/retail-rules';

export function DashboardView() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const { shop, products, batches, sales } = useRetailStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Time-aware greeting
  const hour = new Date().getHours();
  let greetingKey: 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' = 'greetingMorning';
  if (hour >= 12 && hour < 17) greetingKey = 'greetingAfternoon';
  else if (hour >= 17) greetingKey = 'greetingEvening';
  const greeting = t(greetingKey, { name: shop.ownerName.split(' ')[0] });

  // Available categories (all configured categories + any extra in catalog)
  const availableCategories = useMemo(() => {
    const set = new Set<string>(PRODUCT_CATEGORIES);
    products.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [products]);

  // Filtered products & batches based on selected category
  const scopedProducts = useMemo(() => {
    if (selectedCategory === 'ALL') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const scopedProductIds = useMemo(
    () => new Set(scopedProducts.map((p) => p.id)),
    [scopedProducts]
  );

  const scopedBatches = useMemo(() => {
    if (selectedCategory === 'ALL') return batches;
    return batches.filter((b) => scopedProductIds.has(b.productId));
  }, [batches, selectedCategory, scopedProductIds]);

  // Live aggregated KPI metrics & category/product chart data
  const metrics = useMemo(() => {
    const stockByProduct = new Map<string, number>();
    let inventoryValue = 0;

    scopedBatches.forEach((b) => {
      if (b.qtyOnHand > 0) {
        stockByProduct.set(b.productId, (stockByProduct.get(b.productId) ?? 0) + b.qtyOnHand);
        inventoryValue += b.qtyOnHand * b.costPrice;
      }
    });

    const lowStockProducts = scopedProducts.filter(
      (p) => (stockByProduct.get(p.id) ?? 0) < p.minStock
    );

    const nearExpiryBatches = scopedBatches.filter(
      (b) => b.qtyOnHand > 0 && daysUntil(b.expiryDate) <= 7
    );

    const nearExpiryProductIds = new Set(nearExpiryBatches.map((b) => b.productId));

    // Real units sold per product from sales history
    const soldUnitsByProduct = new Map<string, number>();
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        soldUnitsByProduct.set(
          item.productId,
          (soldUnitsByProduct.get(item.productId) ?? 0) + item.qty
        );
      });
    });

    // Category breakdown (for ALL view)
    const categoryTotals = new Map<string, { fullCategory: string; sold: number; stock: number }>();
    products.forEach((p) => {
      const existing = categoryTotals.get(p.category) ?? {
        fullCategory: p.category,
        sold: 0,
        stock: 0,
      };
      const prodStock = batches
        .filter((b) => b.productId === p.id && b.qtyOnHand > 0)
        .reduce((s, b) => s + b.qtyOnHand, 0);
      const sold = soldUnitsByProduct.get(p.id) ?? 0;
      existing.sold += sold;
      existing.stock += prodStock;
      categoryTotals.set(p.category, existing);
    });

    const topCategories = Array.from(categoryTotals.values())
      .map((entry) => ({
        category: entry.fullCategory
          .replace('Oils and Fats', 'Oils')
          .replace('Daily Essentials', 'Essentials')
          .replace('Packaged Foods', 'Packaged'),
        fullCategory: entry.fullCategory,
        sold: entry.sold,
        stock: entry.stock,
      }))
      .sort((a, b) => b.sold + b.stock - (a.sold + a.stock))
      .slice(0, 8);

    // Product breakdown (when a specific category is selected)
    const categoryProductsChart = scopedProducts
      .map((p) => ({
        name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
        fullName: p.name,
        stock: stockByProduct.get(p.id) ?? 0,
        sold: soldUnitsByProduct.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.sold + b.stock - (a.sold + a.stock))
      .slice(0, 10);

    return {
      totalProducts: scopedProducts.length,
      inventoryValue,
      lowStockCount: lowStockProducts.length,
      nearExpiryCount: nearExpiryProductIds.size,
      topCategories,
      categoryProductsChart,
    };
  }, [products, batches, scopedProducts, scopedBatches, sales]);

  const statCards = [
    {
      title: t('stats.totalProducts'),
      value: String(metrics.totalProducts),
      delta: selectedCategory === 'ALL' ? t('stats.deltaProducts') : `In ${selectedCategory}`,
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
          {/* Category Filter Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-2xs text-xs font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter dashboard graph by category"
              className="bg-transparent focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="ALL" className="dark:bg-neutral-900">
                All Categories
              </option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat} className="dark:bg-neutral-900">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <Link href="/billing">
            <Button size="sm" className="h-9 text-xs gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Open Billing</span>
            </Button>
          </Link>
          <Link href="/inventory">
            <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Inventory Intake</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Category Quick-Switch Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
            selectedCategory === 'ALL'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-neutral-800 hover:border-emerald-300'
          }`}
        >
          All Categories
        </button>
        {availableCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-neutral-800 hover:border-sky-300'
            }`}
          >
            {cat}
          </button>
        ))}
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

      {/* Category / Product Breakdown Graph (Updates Dynamically on Category Selection) */}
      <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedCategory === 'ALL'
                ? t('charts.topCategories')
                : `${selectedCategory} — Product Breakdown`}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedCategory === 'ALL'
                ? 'Click any category pill or bar to inspect products in that category'
                : `Units sold vs stock on hand in ${selectedCategory}`}
            </p>
          </div>
          {selectedCategory !== 'ALL' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-sky-600 dark:text-sky-400"
              onClick={() => setSelectedCategory('ALL')}
            >
              <RotateCcw className="w-3 h-3" />
              All Categories
            </Button>
          ) : (
            <Link
              href="/reports"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View Sales Trend in Reports →
            </Link>
          )}
        </div>

        <div
          className="h-72 w-full"
          aria-label={
            selectedCategory === 'ALL'
              ? 'Top-selling Product Categories Bar Chart'
              : `${selectedCategory} Products Bar Chart`
          }
        >
          {selectedCategory === 'ALL' ? (
            metrics.topCategories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-4">
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  No inventory categories yet
                </p>
                <p className="mt-1">Add products in Inventory to see category performance.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.topCategories}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      borderColor: '#E5E7EB',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="sold"
                    name="Units Sold"
                    fill="#16A34A"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                    className="cursor-pointer"
                    onClick={(barData: any) => {
                      if (barData?.fullCategory) {
                        setSelectedCategory(barData.fullCategory);
                      }
                    }}
                  />
                  <Bar
                    dataKey="stock"
                    name="In Stock"
                    fill="#94A3B8"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                    className="cursor-pointer"
                    onClick={(barData: any) => {
                      if (barData?.fullCategory) {
                        setSelectedCategory(barData.fullCategory);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )
          ) : metrics.categoryProductsChart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                No products in {selectedCategory} yet
              </p>
              <p className="mt-1">
                Add items under {selectedCategory} in Inventory to see their breakdown here.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.categoryProductsChart}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                  contentStyle={{
                    borderRadius: '10px',
                    borderColor: '#E5E7EB',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="sold"
                  name="Units Sold"
                  fill="#0284C7"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="stock"
                  name="Stock On Hand"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
