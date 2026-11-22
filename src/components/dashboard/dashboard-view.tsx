'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClockAlert,
  Filter,
  IndianRupee,
  Minus,
  Package,
  Plus,
  Receipt,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn, formatINR } from '@/lib/utils';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES } from '@/lib/retail-config';
import { addDaysIso, daysUntil } from '@/lib/retail-rules';
import { type Batch } from '@/lib/retail-types';
import { useTheme } from '@/components/theme/theme-context';
import { AddProductModal } from '@/components/inventory/add-product-modal';
import {
  DashboardSkeleton,
  EmptyState,
  KpiStrip,
  Panel,
  PanelHeader,
  SectionTitle,
  StatusPill,
  TextLink,
  type KpiItem,
  type StatusPillTone,
} from '@/components/dashboard/dashboard-widgets';

type AttentionIssue =
  | 'expired'
  | 'outOfStock'
  | 'lowStock'
  | 'reorder'
  | 'expiring'
  | 'expiringToday'
  | 'expiringTomorrow'
  | 'overstock';

type AttentionAction = 'restock' | 'expiry' | 'offer';
type AttentionTone = 'danger' | 'warning' | 'neutral';

interface AttentionItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  issue: AttentionIssue;
  tone: AttentionTone;
  detail: string;
  action: AttentionAction;
  rank: number;
}

interface InsightItem {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  tone: 'success' | 'warning' | 'neutral';
}

interface SalesDay {
  date: string;
  label: string;
  revenue: number;
  units: number;
}

interface InventoryPoint {
  name: string;
  fullName: string;
  units: number;
  value: number;
}

interface TooltipPoint {
  date?: string;
  revenue?: number;
  units?: number;
  fullName?: string;
  value?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: TooltipPoint }>;
  intlLocale: string;
}

function formatCategory(category: string) {
  return category
    .replace('Oils and Fats', 'Oils')
    .replace('Daily Essentials', 'Essentials')
    .replace('Packaged Foods', 'Packaged')
    .replace('Spices and Condiments', 'Spices')
    .replace('Personal Care', 'Personal');
}

function shortenName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function formatPercentValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(Math.abs(value));
}

function compactINR(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

const attentionToneText: Record<AttentionTone, string> = {
  danger: 'text-red-700 dark:text-red-400',
  warning: 'text-amber-700 dark:text-amber-400',
  neutral: 'text-gray-600 dark:text-gray-400',
};

const attentionToneDot: Record<AttentionTone, string> = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  neutral: 'bg-gray-400',
};

const insightToneClasses: Record<InsightItem['tone'], string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  neutral: 'text-gray-400 dark:text-neutral-500',
};

function SalesTooltip({
  active,
  payload,
  intlLocale,
  revenueLabel,
  unitsLabel,
}: ChartTooltipProps & { revenueLabel: string; unitsLabel: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const dateLabel = point.date
    ? new Date(`${point.date}T00:00:00`).toLocaleDateString(intlLocale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <div className="min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <p className="font-semibold text-gray-900 dark:text-white">{dateLabel}</p>
      <div className="mt-1.5 flex items-center justify-between gap-4">
        <span className="text-gray-500 dark:text-gray-400">{revenueLabel}</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {formatINR(point.revenue ?? 0, intlLocale)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-gray-500 dark:text-gray-400">{unitsLabel}</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {point.units ?? 0}
        </span>
      </div>
    </div>
  );
}

function InventoryTooltip({
  active,
  payload,
  intlLocale,
  unitsLabel,
  valueLabel,
}: ChartTooltipProps & { unitsLabel: string; valueLabel: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <p className="font-semibold text-gray-900 dark:text-white">{point.fullName}</p>
      <div className="mt-1.5 flex items-center justify-between gap-4">
        <span className="text-gray-500 dark:text-gray-400">{unitsLabel}</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {point.units ?? 0}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-gray-500 dark:text-gray-400">{valueLabel}</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {formatINR(point.value ?? 0, intlLocale)}
        </span>
      </div>
    </div>
  );
}

function AttentionRow({
  item,
  issueLabel,
  actionLabel,
  onRestock,
}: {
  item: AttentionItem;
  issueLabel: string;
  actionLabel: string;
  onRestock: (productId: string) => void;
}) {
  const action =
    item.action === 'restock' ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={() => onRestock(item.productId)}
      >
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    ) : (
      <Link
        href={item.action === 'expiry' ? '/expiry' : '/discounts'}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'h-8 gap-1.5 px-2.5 text-xs'
        )}
      >
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    );

  const issue = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        attentionToneText[item.tone]
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', attentionToneDot[item.tone])}
        aria-hidden="true"
      />
      {issueLabel}
    </span>
  );

  return (
    <li
      data-product-id={item.productId}
      className="px-5 py-3.5 md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_auto] md:items-center md:gap-4"
    >
      <div className="flex items-start justify-between gap-3 md:block">
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-gray-900 dark:text-white"
            title={item.name}
          >
            {item.name}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{item.category}</p>
        </div>
        <span className="shrink-0 md:hidden">{issue}</span>
      </div>

      <div className="hidden md:block">{issue}</div>

      <div className="mt-2 flex items-center justify-between gap-3 md:mt-0 md:block">
        <p className="text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
        <div className="md:hidden">{action}</div>
      </div>

      <div className="hidden md:block md:justify-self-end">{action}</div>
    </li>
  );
}

export function DashboardView() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { shop, products, batches, sales, salesSeries, isHydrated } = useRetailStore();

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showIntake, setShowIntake] = useState(false);
  const [intakeProductId, setIntakeProductId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const openIntake = (productId?: string) => {
    setIntakeProductId(productId ?? null);
    setShowIntake(true);
  };

  const closeIntake = () => {
    setShowIntake(false);
    setIntakeProductId(null);
  };

  const hour = now?.getHours() ?? 9;
  let greetingKey: 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' =
    'greetingMorning';
  if (hour >= 12 && hour < 17) greetingKey = 'greetingAfternoon';
  else if (hour >= 17) greetingKey = 'greetingEvening';
  const greeting = t(greetingKey, { name: shop.ownerName.split(' ')[0] || shop.name });

  const formattedDate = useMemo(() => {
    if (!now) return '';
    return new Intl.DateTimeFormat(intlLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  }, [now, intlLocale]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(PRODUCT_CATEGORIES);
    products.forEach((product) => set.add(product.category));
    return Array.from(set);
  }, [products]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const scopedProducts = useMemo(() => {
    if (selectedCategory === 'ALL') return products;
    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  const scopedProductIds = useMemo(
    () => new Set(scopedProducts.map((product) => product.id)),
    [scopedProducts]
  );

  const scopedBatches = useMemo(() => {
    if (selectedCategory === 'ALL') return batches;
    return batches.filter((batch) => scopedProductIds.has(batch.productId));
  }, [batches, selectedCategory, scopedProductIds]);

  const metrics = useMemo(() => {
    const baseDate = now ?? new Date();
    const stockByProduct = new Map<string, number>();
    let inventoryValue = 0;

    scopedBatches.forEach((batch) => {
      stockByProduct.set(
        batch.productId,
        (stockByProduct.get(batch.productId) ?? 0) + batch.qtyOnHand
      );
      if (batch.qtyOnHand > 0) {
        inventoryValue += batch.qtyOnHand * batch.costPrice;
      }
    });

    scopedProducts.forEach((product) => {
      if (!stockByProduct.has(product.id)) stockByProduct.set(product.id, 0);
    });

    const lowStockProducts = scopedProducts.filter(
      (product) => (stockByProduct.get(product.id) ?? 0) < product.minStock
    );
    const outOfStockCount = lowStockProducts.filter(
      (product) => (stockByProduct.get(product.id) ?? 0) === 0
    ).length;

    const expiryBatches = scopedBatches.filter(
      (batch) => batch.qtyOnHand > 0 && daysUntil(batch.expiryDate, baseDate) <= 7
    );

    const expiryByProduct = new Map<string, { batch: Batch; days: number }>();
    expiryBatches.forEach((batch) => {
      const days = daysUntil(batch.expiryDate, baseDate);
      const previous = expiryByProduct.get(batch.productId);
      if (!previous || days < previous.days) {
        expiryByProduct.set(batch.productId, { batch, days });
      }
    });

    const expiringProductIds = new Set(expiryBatches.map((batch) => batch.productId));
    const criticalExpiringProductIds = new Set(
      expiryBatches
        .filter((batch) => daysUntil(batch.expiryDate, baseDate) <= 3)
        .map((batch) => batch.productId)
    );

    return {
      totalProducts: scopedProducts.length,
      inventoryValue,
      stockByProduct,
      lowStockProducts,
      outOfStockCount,
      expiringProductIds,
      criticalExpiringProductIds,
      expiryByProduct,
    };
  }, [scopedProducts, scopedBatches, now]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    scopedProducts.forEach((product) => {
      const stock = metrics.stockByProduct.get(product.id) ?? 0;
      const expiry = metrics.expiryByProduct.get(product.id);
      const min = Math.max(1, product.minStock);

      const isExpired = expiry ? expiry.days < 0 : false;
      const isOutOfStock = stock === 0;
      const isCriticalExpiry = expiry ? expiry.days >= 0 && expiry.days <= 3 : false;
      const isWeekExpiry = expiry ? expiry.days > 3 && expiry.days <= 7 : false;
      const isLowStock = stock < product.minStock;
      const isReorder =
        stock >= product.minStock && stock <= product.reorderLevel;
      const isExcess =
        stock > Math.max(product.minStock * 4, product.reorderLevel * 2);

      let issue: AttentionIssue | null = null;
      let tone: AttentionTone = 'neutral';
      let detail = '';
      let action: AttentionAction = 'restock';
      let rank = 0;

      if (isExpired && expiry) {
        issue = 'expired';
        tone = 'danger';
        action = 'expiry';
        rank = expiry.days;
        detail = t('attention.detailExpired', {
          qty: expiry.batch.qtyOnHand,
          days: Math.abs(expiry.days),
        });
      } else if (isOutOfStock) {
        issue = 'outOfStock';
        tone = 'danger';
        action = 'restock';
        rank = 1;
        detail = t('attention.detailStock', { stock, min: product.minStock });
      } else if (isCriticalExpiry && expiry) {
        issue =
          expiry.days === 0
            ? 'expiringToday'
            : expiry.days === 1
              ? 'expiringTomorrow'
              : 'expiring';
        tone = 'danger';
        action = 'expiry';
        rank = 2 + expiry.days;
        detail =
          expiry.days === 0
            ? t('attention.detailExpiryToday', { qty: expiry.batch.qtyOnHand })
            : expiry.days === 1
              ? t('attention.detailExpiryTomorrow', { qty: expiry.batch.qtyOnHand })
              : t('attention.detailExpiry', {
                  qty: expiry.batch.qtyOnHand,
                  days: expiry.days,
                });
      } else if (isLowStock) {
        issue = 'lowStock';
        tone = 'warning';
        action = 'restock';
        rank = 10 + stock / min;
        detail = t('attention.detailStock', { stock, min: product.minStock });
      } else if (isWeekExpiry && expiry) {
        issue = 'expiring';
        tone = 'warning';
        action = 'expiry';
        rank = 11 + expiry.days;
        detail = t('attention.detailExpiry', {
          qty: expiry.batch.qtyOnHand,
          days: expiry.days,
        });
      } else if (isReorder) {
        issue = 'reorder';
        tone = 'warning';
        action = 'restock';
        rank = 12 + stock / Math.max(1, product.reorderLevel);
        detail = t('attention.detailReorder', {
          stock,
          reorder: product.reorderLevel,
        });
      } else if (isExcess) {
        issue = 'overstock';
        tone = 'neutral';
        action = 'offer';
        rank = 20;
        detail = t('attention.detailOverstock', {
          stock,
          multiple: Math.max(2, Math.round(stock / min)),
        });
      }

      if (issue) {
        items.push({
          id: product.id,
          productId: product.id,
          name: product.name,
          category: product.category,
          issue,
          tone,
          detail,
          action,
          rank,
        });
      }
    });

    return items.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }, [scopedProducts, metrics, t]);

  const salesWindow = useMemo(() => {
    const baseDate = now ?? new Date();
    const todayIso = addDaysIso(baseDate, 0);
    const startIso = addDaysIso(baseDate, -6);
    const previousStartIso = addDaysIso(baseDate, -13);
    const seriesMap = new Map(salesSeries.map((point) => [point.date, point]));
    const dailyMap = new Map<string, { revenue: number; units: number }>();
    const productUnits = new Map<string, number>();
    let saleCount = 0;

    sales.forEach((sale) => {
      const date = (sale.createdAt || '').slice(0, 10);
      const items =
        selectedCategory === 'ALL'
          ? sale.items
          : sale.items.filter((item) => scopedProductIds.has(item.productId));
      if (items.length === 0) return;

      const inCurrent = date >= startIso && date <= todayIso;
      if (inCurrent) saleCount += 1;

      if (date >= previousStartIso && date <= todayIso) {
        const entry = dailyMap.get(date) ?? { revenue: 0, units: 0 };
        items.forEach((item) => {
          entry.revenue += item.qty * item.unitPrice;
          entry.units += item.qty;
          if (inCurrent) {
            productUnits.set(
              item.productId,
              (productUnits.get(item.productId) ?? 0) + item.qty
            );
          }
        });
        dailyMap.set(date, entry);
      }
    });

    const useSeries = selectedCategory === 'ALL' && salesSeries.length > 0;
    const buildDay = (date: string): SalesDay => {
      const point = useSeries ? seriesMap.get(date) : dailyMap.get(date);
      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString(intlLocale, {
          weekday: 'short',
        }),
        revenue: point?.revenue ?? 0,
        units: point?.units ?? 0,
      };
    };

    const current = Array.from({ length: 7 }, (_, index) =>
      buildDay(addDaysIso(baseDate, -(6 - index)))
    );
    const previous = Array.from({ length: 7 }, (_, index) =>
      buildDay(addDaysIso(baseDate, -(13 - index)))
    );

    const currentRevenue = current.reduce((sum, day) => sum + day.revenue, 0);
    const currentUnits = current.reduce((sum, day) => sum + day.units, 0);
    const previousRevenue = previous.reduce((sum, day) => sum + day.revenue, 0);
    const previousUnits = previous.reduce((sum, day) => sum + day.units, 0);

    return {
      current,
      currentRevenue,
      currentUnits,
      previousRevenue,
      previousUnits,
      productUnits,
      saleCount,
      hasCurrentSales: currentRevenue > 0 || currentUnits > 0,
      hasAnySales: sales.length > 0,
    };
  }, [sales, salesSeries, selectedCategory, scopedProductIds, now, intlLocale]);

  const revenueDeltaPct =
    salesWindow.previousRevenue > 0
      ? ((salesWindow.currentRevenue - salesWindow.previousRevenue) /
          salesWindow.previousRevenue) *
        100
      : null;

  const inventoryChart = useMemo<InventoryPoint[]>(() => {
    if (selectedCategory === 'ALL') {
      const totals = new Map<string, InventoryPoint>();

      scopedBatches.forEach((batch) => {
        if (batch.qtyOnHand <= 0) return;
        const product = productById.get(batch.productId);
        if (!product) return;

        const entry = totals.get(product.category) ?? {
          name: formatCategory(product.category),
          fullName: product.category,
          units: 0,
          value: 0,
        };
        entry.units += batch.qtyOnHand;
        entry.value += batch.qtyOnHand * batch.costPrice;
        totals.set(product.category, entry);
      });

      return Array.from(totals.values())
        .filter((entry) => entry.units > 0)
        .sort((a, b) => b.units - a.units)
        .slice(0, 7);
    }

    return scopedProducts
      .map((product) => {
        const units = metrics.stockByProduct.get(product.id) ?? 0;
        return {
          name: shortenName(product.name, 18),
          fullName: product.name,
          units,
          value: units * product.purchasePrice,
        };
      })
      .filter((entry) => entry.units > 0)
      .sort((a, b) => b.units - a.units)
      .slice(0, 7);
  }, [selectedCategory, scopedBatches, scopedProducts, productById, metrics.stockByProduct]);

  const categoryValueAll = useMemo(() => {
    const totals = new Map<string, number>();
    batches.forEach((batch) => {
      if (batch.qtyOnHand <= 0) return;
      const product = productById.get(batch.productId);
      if (!product) return;
      totals.set(
        product.category,
        (totals.get(product.category) ?? 0) + batch.qtyOnHand * batch.costPrice
      );
    });
    return totals;
  }, [batches, productById]);

  const totalInventoryValueAll = useMemo(
    () => Array.from(categoryValueAll.values()).reduce((sum, value) => sum + value, 0),
    [categoryValueAll]
  );

  const topCategoryEntry = useMemo(
    () => Array.from(categoryValueAll.entries()).sort((a, b) => b[1] - a[1])[0],
    [categoryValueAll]
  );

  const focusCategory =
    selectedCategory === 'ALL' ? topCategoryEntry?.[0] : selectedCategory;

  const slowCapital = useMemo(
    () =>
      scopedProducts.reduce((sum, product) => {
        const unitsSold = salesWindow.productUnits.get(product.id) ?? 0;
        const stock = metrics.stockByProduct.get(product.id) ?? 0;
        return unitsSold === 0 ? sum + stock * product.purchasePrice : sum;
      }, 0),
    [scopedProducts, salesWindow.productUnits, metrics.stockByProduct]
  );

  const fastMovers = useMemo(
    () =>
      scopedProducts
        .map((product) => ({
          product,
          units: salesWindow.productUnits.get(product.id) ?? 0,
        }))
        .filter((entry) => entry.units > 0)
        .sort((a, b) => b.units - a.units)
        .slice(0, 4),
    [scopedProducts, salesWindow.productUnits]
  );

  const slowMovers = useMemo(() => {
    if (!salesWindow.hasAnySales) return [];
    return scopedProducts
      .map((product) => {
        const stock = metrics.stockByProduct.get(product.id) ?? 0;
        return {
          product,
          stock,
          units: salesWindow.productUnits.get(product.id) ?? 0,
          value: stock * product.purchasePrice,
        };
      })
      .filter((entry) => entry.stock > 0 && entry.units === 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [
    scopedProducts,
    metrics.stockByProduct,
    salesWindow.productUnits,
    salesWindow.hasAnySales,
  ]);

  const insights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = [];
    const revenue = salesWindow.currentRevenue;
    const delta = revenueDeltaPct;

    if (revenue <= 0) {
      list.push({
        id: 'momentum',
        icon: Minus,
        title: t('insights.momentumTitle'),
        text: t('insights.momentumNoSales'),
        tone: 'neutral',
      });
    } else if (delta === null) {
      list.push({
        id: 'momentum',
        icon: TrendingUp,
        title: t('insights.momentumTitle'),
        text: t('insights.momentumNoPrior', {
          revenue: formatINR(revenue, intlLocale),
        }),
        tone: 'neutral',
      });
    } else if (Math.abs(delta) < 2) {
      list.push({
        id: 'momentum',
        icon: Minus,
        title: t('insights.momentumTitle'),
        text: t('insights.momentumFlat'),
        tone: 'neutral',
      });
    } else if (delta > 0) {
      list.push({
        id: 'momentum',
        icon: TrendingUp,
        title: t('insights.momentumTitle'),
        text: t('insights.momentumUp', {
          percent: formatPercentValue(delta, intlLocale),
        }),
        tone: 'success',
      });
    } else {
      list.push({
        id: 'momentum',
        icon: TrendingDown,
        title: t('insights.momentumTitle'),
        text: t('insights.momentumDown', {
          percent: formatPercentValue(delta, intlLocale),
        }),
        tone: 'warning',
      });
    }

    if (focusCategory && totalInventoryValueAll > 0) {
      const focusValue = categoryValueAll.get(focusCategory) ?? 0;
      if (focusValue > 0) {
        const share = (focusValue / totalInventoryValueAll) * 100;
        const percent = formatPercentValue(share, intlLocale);
        const value = formatINR(focusValue, intlLocale);

        let text: string;
        if (categoryValueAll.size <= 1) {
          text = t('insights.categoryShare', {
            category: focusCategory,
            percent,
            value,
          });
        } else if (share >= 40) {
          text = t('insights.categoryConcentrated', {
            category: focusCategory,
            percent,
            value,
          });
        } else {
          text = t('insights.categorySpread', {
            count: categoryValueAll.size,
            category: focusCategory,
            percent,
          });
        }

        list.push({
          id: 'category',
          icon: Boxes,
          title: t('insights.categoryTitle'),
          text,
          tone: 'neutral',
        });
      }
    }

    if (salesWindow.hasAnySales) {
      if (slowCapital > 0) {
        list.push({
          id: 'cash',
          icon: Package,
          title: t('insights.cashTitle'),
          text: t('insights.cashSlow', {
            value: formatINR(slowCapital, intlLocale),
          }),
          tone: 'warning',
        });
      } else {
        list.push({
          id: 'cash',
          icon: CheckCircle2,
          title: t('insights.cashTitle'),
          text: t('insights.cashClear'),
          tone: 'success',
        });
      }
    }

    return list.slice(0, 3);
  }, [
    salesWindow,
    revenueDeltaPct,
    focusCategory,
    totalInventoryValueAll,
    categoryValueAll,
    slowCapital,
    t,
    intlLocale,
  ]);

  const issueLabels: Record<AttentionIssue, string> = {
    expired: t('attention.issueExpired'),
    outOfStock: t('attention.issueOutOfStock'),
    lowStock: t('attention.issueLowStock'),
    reorder: t('attention.issueReorder'),
    expiring: t('attention.issueExpiring'),
    expiringToday: t('attention.issueExpiringToday'),
    expiringTomorrow: t('attention.issueExpiringTomorrow'),
    overstock: t('attention.issueOverstock'),
  };

  const actionLabels: Record<AttentionAction, string> = {
    restock: t('attention.actionRestock'),
    expiry: t('attention.actionReviewExpiry'),
    offer: t('attention.actionCreateOffer'),
  };

  const urgentCount = attentionItems.filter((item) => item.tone === 'danger').length;
  const reviewCount = attentionItems.length - urgentCount;
  const visibleAttention = attentionItems.slice(0, 6);
  const moreAttentionCount = attentionItems.length - visibleAttention.length;

  const attentionPillTone: StatusPillTone =
    urgentCount > 0 ? 'danger' : attentionItems.length > 0 ? 'warning' : 'success';
  const attentionPillLabel =
    attentionItems.length === 0
      ? t('attention.allClear')
      : urgentCount > 0 && reviewCount > 0
        ? t('attention.urgentReview', { urgent: urgentCount, review: reviewCount })
        : urgentCount > 0
          ? t('attention.urgentCount', { count: urgentCount })
          : t('attention.reviewCount', { count: attentionItems.length });

  const lowStockTone =
    metrics.lowStockProducts.length === 0
      ? 'default'
      : metrics.outOfStockCount > 0
        ? 'danger'
        : 'warning';
  const expiringTone =
    metrics.expiringProductIds.size === 0
      ? 'default'
      : metrics.criticalExpiringProductIds.size > 0
        ? 'danger'
        : 'warning';

  const kpiItems: KpiItem[] = [
    {
      label: t('kpi.inventoryValue'),
      value: formatINR(metrics.inventoryValue, intlLocale),
      hint: t('kpi.inventoryValueHint'),
      icon: IndianRupee,
    },
    {
      label: t('kpi.totalProducts'),
      value: String(metrics.totalProducts),
      hint: t('kpi.totalProductsHint'),
      icon: Package,
    },
    {
      label: t('kpi.lowStock'),
      value: String(metrics.lowStockProducts.length),
      hint:
        metrics.outOfStockCount > 0
          ? t('kpi.lowStockOutHint', { count: metrics.outOfStockCount })
          : t('kpi.lowStockHint'),
      icon: AlertTriangle,
      tone: lowStockTone,
    },
    {
      label: t('kpi.expiring'),
      value: String(metrics.expiringProductIds.size),
      hint:
        metrics.criticalExpiringProductIds.size > 0
          ? t('kpi.expiringCriticalHint', {
              count: metrics.criticalExpiringProductIds.size,
            })
          : t('kpi.expiringHint'),
      icon: ClockAlert,
      tone: expiringTone,
    },
  ];

  const chartTheme = useMemo(
    () => ({
      grid: isDark ? '#262626' : '#E5E7EB',
      tick: isDark ? '#A3A3A3' : '#6B7280',
      accent: isDark ? '#34D399' : '#10B981',
      cursor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    }),
    [isDark]
  );

  const inventoryTitle =
    selectedCategory === 'ALL'
      ? t('inventory.distributionTitle')
      : t('inventory.categoryDistributionTitle', { category: selectedCategory });
  const inventorySubtitle =
    selectedCategory === 'ALL'
      ? t('inventory.distributionSubtitle')
      : t('inventory.categoryDistributionSubtitle');

  const topFastUnits = fastMovers[0]?.units ?? 1;

  const trend =
    !salesWindow.hasCurrentSales ? null : revenueDeltaPct === null ? (
      <span className="text-[11px] text-gray-500 dark:text-gray-400">
        {t('sales.noPrior')}
      </span>
    ) : (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <StatusPill
          tone={
            Math.abs(revenueDeltaPct) < 2
              ? 'neutral'
              : revenueDeltaPct > 0
                ? 'success'
                : 'warning'
          }
        >
          {Math.abs(revenueDeltaPct) < 2 ? (
            t('sales.flat')
          ) : revenueDeltaPct > 0 ? (
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              {t('sales.up', {
                percent: formatPercentValue(revenueDeltaPct, intlLocale),
              })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
              {t('sales.down', {
                percent: formatPercentValue(revenueDeltaPct, intlLocale),
              })}
            </span>
          )}
        </StatusPill>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {t('sales.vsPrevious')}
        </span>
      </div>
    );

  const setupSteps = [
    { title: t('empty.step1Title'), description: t('empty.step1Desc') },
    { title: t('empty.step2Title'), description: t('empty.step2Desc') },
    { title: t('empty.step3Title'), description: t('empty.step3Desc') },
  ];

  if (!isHydrated || !now) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-[28px]">
            {greeting}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{shop.name}</span>
            </span>
            {formattedDate && (
              <>
                <span className="text-gray-300 dark:text-neutral-700" aria-hidden="true">
                  •
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t('todayLabel')}: {formattedDate}
                  </span>
                </span>
              </>
            )}
          </div>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{t('subtext')}</p>
        </div>

        <div className="relative w-full sm:w-56">
          <Filter
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-neutral-500"
            aria-hidden="true"
          />
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            aria-label={t('filterLabel')}
            className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white pl-9 pr-8 text-xs font-medium text-gray-700 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <option value="ALL" className="dark:bg-neutral-900">
              {t('allCategories')}
            </option>
            {availableCategories.map((category) => (
              <option key={category} value={category} className="dark:bg-neutral-900">
                {category}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-neutral-500"
            aria-hidden="true"
          />
        </div>
      </header>

      {products.length > 0 && <KpiStrip items={kpiItems} />}

      {products.length === 0 ? (
        <Panel>
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
                    {t('empty.title')}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('empty.description')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-2 px-3.5 text-xs"
                  onClick={() => openIntake()}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('empty.addFirst')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-2 px-3.5 text-xs"
                  onClick={() => openIntake()}
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  {t('empty.scanPack')}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 dark:border-neutral-800 sm:grid-cols-3">
              {setupSteps.map((step, index) => (
                <div key={step.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 dark:bg-neutral-800 dark:text-gray-300">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title={t('attention.title')}
              subtitle={t('attention.subtitle')}
              action={<StatusPill tone={attentionPillTone}>{attentionPillLabel}</StatusPill>}
            />

            {attentionItems.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={CheckCircle2}
                  title={t('attention.emptyTitle')}
                  description={t('attention.emptyDescription')}
                />
              </div>
            ) : (
              <>
                <div className="hidden border-y border-gray-100 bg-gray-50/50 px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-950/30 dark:text-gray-400 md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_auto] md:gap-4">
                  <span>{t('attention.columnProduct')}</span>
                  <span>{t('attention.columnIssue')}</span>
                  <span>{t('attention.columnStatus')}</span>
                  <span className="sr-only">{t('attention.columnAction')}</span>
                </div>

                <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {visibleAttention.map((item) => (
                    <AttentionRow
                      key={item.id}
                      item={item}
                      issueLabel={issueLabels[item.issue]}
                      actionLabel={actionLabels[item.action]}
                      onRestock={openIntake}
                    />
                  ))}
                </ul>

                {moreAttentionCount > 0 && (
                  <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-neutral-800 dark:text-gray-400">
                    {t('attention.more', { count: moreAttentionCount })}
                  </p>
                )}
              </>
            )}
          </Panel>

          <Panel>
            <div className="grid grid-cols-1 xl:grid-cols-3">
              <div className="border-gray-100 p-5 dark:border-neutral-800 xl:col-span-2 xl:border-r">
                <SectionTitle
                  title={t('sales.title')}
                  subtitle={t('sales.subtitle')}
                  action={trend}
                />

                <div className="mt-4 grid grid-cols-2 gap-4 border-b border-gray-100 pb-4 dark:border-neutral-800">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t('sales.revenue')}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatINR(salesWindow.currentRevenue, intlLocale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t('sales.units')}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                      {salesWindow.currentUnits}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 h-56 w-full sm:h-64"
                  role="img"
                  aria-label={t('sales.chartLabel')}
                >
                  {salesWindow.hasCurrentSales ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={salesWindow.current}
                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={chartTheme.accent}
                              stopOpacity={0.28}
                            />
                            <stop
                              offset="95%"
                              stopColor={chartTheme.accent}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke={chartTheme.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          interval={0}
                          tickMargin={8}
                          tick={{ fontSize: 10, fill: chartTheme.tick }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: chartTheme.tick }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value: number) => compactINR(value, intlLocale)}
                          width={56}
                        />
                        <Tooltip
                          content={
                            <SalesTooltip
                              intlLocale={intlLocale}
                              revenueLabel={t('sales.tooltipRevenue')}
                              unitsLabel={t('sales.tooltipUnits')}
                            />
                          }
                          cursor={{ stroke: chartTheme.grid, strokeWidth: 1 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke={chartTheme.accent}
                          strokeWidth={2}
                          fill="url(#salesGradient)"
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      icon={Receipt}
                      title={t('sales.emptyTitle')}
                      description={t('sales.emptyDescription')}
                      action={
                        <TextLink href="/billing">
                          <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('sales.emptyAction')}
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </TextLink>
                      }
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 p-5 dark:border-neutral-800 xl:border-t-0">
                <SectionTitle
                  title={t('insights.title')}
                  subtitle={t('insights.subtitle')}
                  action={
                    <Sparkles
                      className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  }
                />

                <ul className="mt-4 divide-y divide-gray-100 dark:divide-neutral-800">
                  {insights.map((insight) => {
                    const Icon = insight.icon;
                    return (
                      <li key={insight.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <Icon
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            insightToneClasses[insight.tone]
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {insight.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            {insight.text}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title={t('inventory.title')} subtitle={t('inventory.subtitle')} />

            <div className="grid grid-cols-1 divide-y divide-gray-100 border-t border-gray-100 dark:divide-neutral-800 dark:border-neutral-800 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] xl:divide-x xl:divide-y-0">
              <div className="p-5">
                <SectionTitle title={inventoryTitle} subtitle={inventorySubtitle} />
                <div
                  className="mt-4 h-60 w-full"
                  role="img"
                  aria-label={inventoryTitle}
                >
                  {inventoryChart.length === 0 ? (
                    <EmptyState
                      icon={Boxes}
                      title={t('inventory.distributionEmptyTitle')}
                      description={t('inventory.distributionEmptyDescription')}
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={inventoryChart}
                        layout="vertical"
                        margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid
                          stroke={chartTheme.grid}
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: chartTheme.tick }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={104}
                          tick={{ fontSize: 10, fill: chartTheme.tick }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={
                            <InventoryTooltip
                              intlLocale={intlLocale}
                              unitsLabel={t('inventory.unitsLabel')}
                              valueLabel={t('inventory.tooltipValue')}
                            />
                          }
                          cursor={{ fill: chartTheme.cursor }}
                        />
                        <Bar
                          dataKey="units"
                          fill={chartTheme.accent}
                          radius={[0, 4, 4, 0]}
                          barSize={16}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="p-5">
                <SectionTitle
                  title={t('inventory.fastTitle')}
                  subtitle={t('inventory.fastSubtitle')}
                />
                {fastMovers.length === 0 ? (
                  <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('inventory.fastEmpty')}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {fastMovers.map(({ product, units }) => (
                      <li key={product.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className="min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-200"
                            title={product.name}
                          >
                            {product.name}
                          </p>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-white">
                            {t('inventory.fastUnits', { count: units })}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.max(8, (units / topFastUnits) * 100)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-5">
                <SectionTitle
                  title={t('inventory.slowTitle')}
                  subtitle={t('inventory.slowSubtitle')}
                />
                {!salesWindow.hasAnySales ? (
                  <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('inventory.slowNoSales')}
                  </p>
                ) : slowMovers.length === 0 ? (
                  <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('inventory.slowEmpty')}
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-gray-100 dark:divide-neutral-800">
                    {slowMovers.map(({ product, stock, value }) => (
                      <li
                        key={product.id}
                        className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-xs font-medium text-gray-800 dark:text-gray-200"
                            title={product.name}
                          >
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            {t('inventory.slowStock', { count: stock })}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium tabular-nums text-gray-500 dark:text-gray-400">
                          {t('inventory.slowValue', {
                            value: formatINR(value, intlLocale),
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        </>
      )}

      {showIntake && (
        <AddProductModal
          initialProductId={intakeProductId ?? undefined}
          intlLocale={intlLocale}
          onClose={closeIntake}
        />
      )}
    </div>
  );
}
