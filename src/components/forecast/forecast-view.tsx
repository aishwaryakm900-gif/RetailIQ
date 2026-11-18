'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  TrendingUp,
  AlertTriangle,
  PackageCheck,
  Check,
  Pencil,
  X,
  Truck,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

interface ForecastRow {
  recId: string | null;
  productId: string;
  productName: string;
  imageEmoji: string;
  category: string;
  onHand: number;
  minStock: number;
  dailyDemand: number;
  daysOfCover: number;
  leadTimeDays: number;
  supplierName: string;
  packSize: number;
  suggestedQty: number;
  purchasePrice: number;
  status: 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
}

export function ForecastView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const {
    products,
    batches,
    suppliers,
    recommendations,
    aiBasicMode,
    updateRecommendationStatus,
  } = useRetailStore();

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(10);
  // Local fallback statuses for dynamically computed reorder candidates without a seed rec row
  const [localDecisionMap, setLocalDecisionMap] = useState<
    Record<string, { status: 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED'; qty?: number }>
  >({});

  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    batches.forEach((b) => {
      if (b.qtyOnHand > 0) {
        map.set(b.productId, (map.get(b.productId) ?? 0) + b.qtyOnHand);
      }
    });
    return map;
  }, [batches]);

  const reorderRows: ForecastRow[] = useMemo(() => {
    const recByProduct = new Map(
      recommendations
        .filter((r) => r.kind === 'REORDER' && r.productId)
        .map((r) => [r.productId!, r])
    );

    return products
      .map((p) => {
        const onHand = stockByProduct.get(p.id) ?? 0;
        const supplier = suppliers.find((s) => s.id === p.supplierId);
        const leadTimeDays = supplier?.leadTimeDays ?? 2;
        const packSize = supplier?.packSize ?? 6;
        const effectiveDemand = aiBasicMode
          ? Math.max(0.5, Number((p.dailyDemandAvg * 0.92).toFixed(1)))
          : p.dailyDemandAvg;
        const daysOfCover =
          effectiveDemand > 0 ? Math.round((onHand / effectiveDemand) * 10) / 10 : 99;

        const rec = recByProduct.get(p.id);
        const rawNeeded = Math.max(0, Math.ceil((leadTimeDays + 7) * effectiveDemand - onHand));
        const alignedQty =
          rawNeeded > 0 ? Math.max(packSize, Math.ceil(rawNeeded / packSize) * packSize) : packSize;

        const localDecision = localDecisionMap[p.id];
        const status = rec?.status ?? localDecision?.status ?? 'PENDING';
        const suggestedQty = localDecision?.qty ?? rec?.suggestedQty ?? alignedQty;

        return {
          recId: rec?.id ?? null,
          productId: p.id,
          productName: p.name,
          imageEmoji: p.imageEmoji,
          category: p.category,
          onHand,
          minStock: p.minStock,
          dailyDemand: effectiveDemand,
          daysOfCover,
          leadTimeDays,
          supplierName: supplier?.name ?? 'Local Distributor',
          packSize,
          suggestedQty,
          purchasePrice: p.purchasePrice,
          status,
        };
      })
      .filter((row) => row.onHand < row.minStock || row.daysOfCover <= 6 || row.recId !== null)
      .sort((a, b) => a.daysOfCover - b.daysOfCover);
  }, [products, stockByProduct, suppliers, recommendations, aiBasicMode, localDecisionMap]);

  const stats = useMemo(() => {
    const lowCover = reorderRows.filter((r) => r.daysOfCover <= 5).length;
    const pendingRows = reorderRows.filter((r) => r.status === 'PENDING');
    const pendingCost = pendingRows.reduce(
      (sum, r) => sum + r.suggestedQty * r.purchasePrice,
      0
    );
    const totalDailyUnits = products.reduce((sum, p) => sum + p.dailyDemandAvg, 0);

    return {
      totalSkus: products.length,
      totalDailyUnits: Math.round(totalDailyUnits),
      lowCover,
      pendingCount: pendingRows.length,
      pendingCost,
    };
  }, [reorderRows, products]);

  const handleRowDecision = (
    row: ForecastRow,
    status: 'ACCEPTED' | 'EDITED' | 'REJECTED',
    customQty?: number
  ) => {
    const finalQty = customQty ?? row.suggestedQty;
    if (row.recId) {
      updateRecommendationStatus(row.recId, status, finalQty);
    } else {
      setLocalDecisionMap((prev) => ({
        ...prev,
        [row.productId]: { status, qty: finalQty },
      }));
    }

    setEditingRowId(null);
    if (status === 'ACCEPTED') {
      toast.success(`Accepted reorder of ${finalQty} units for ${row.productName}`);
    } else if (status === 'EDITED') {
      toast.success(`Updated & accepted ${finalQty} units for ${row.productName}`);
    } else {
      toast.info(`Dismissed reorder suggestion for ${row.productName}`);
    }
  };

  const handleReorderAllPending = () => {
    const pending = reorderRows.filter((r) => r.status === 'PENDING');
    if (pending.length === 0) {
      toast.info('All reorder recommendations have already been reviewed.');
      return;
    }
    pending.forEach((row) => {
      if (row.recId) {
        updateRecommendationStatus(row.recId, 'ACCEPTED', row.suggestedQty);
      } else {
        setLocalDecisionMap((prev) => ({
          ...prev,
          [row.productId]: { status: 'ACCEPTED', qty: row.suggestedQty },
        }));
      }
    });
    toast.success(`Approved ${pending.length} supplier reorder requests.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {tNav('forecast')} & Reorder
            </h1>
            <Badge variant={aiBasicMode ? 'warning' : 'healthy'}>
              {aiBasicMode ? 'Basic Mode: Moving Avg Fallback' : 'AI Demand Model Active'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Predict daily unit velocity with confidence intervals and approve pack-aligned supplier
            reorders.
          </p>
        </div>

        <Button
          size="sm"
          className="gap-1.5 self-start sm:self-auto"
          onClick={handleReorderAllPending}
          disabled={stats.pendingCount === 0}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Reorder All Needed ({stats.pendingCount})</span>
        </Button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>SKUs Tracked</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {stats.totalSkus}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Est. {stats.totalDailyUnits} total units sold/day
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Low Cover (&le; 5d)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3 tabular-nums">
            {stats.lowCover} SKUs
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Risk stockout before next cycle
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Pending Reorders</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {formatINR(stats.pendingCost, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Across {stats.pendingCount} awaiting approvals
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Model Engine</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-3">
            {aiBasicMode ? '7d Moving Avg' : 'Seasonal Velocity'}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {aiBasicMode ? 'Toggle off Basic Mode in Settings' : '90-day weighted + weekend lift'}
          </p>
        </div>
      </div>

      {/* Reorder Recommendations Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Reorder Recommendations (Rule R8)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Review supplier pack quantities before confirming purchase orders.
            </p>
          </div>
          <Badge variant="outline">{reorderRows.length} items needing attention</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Stock / Min</th>
                <th className="py-3 px-4">Daily Demand</th>
                <th className="py-3 px-4">Days Cover</th>
                <th className="py-3 px-4">Suggested Qty</th>
                <th className="py-3 px-4">Est. Cost</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {reorderRows.map((row) => {
                const isEditing = editingRowId === row.productId;
                const coverVariant =
                  row.daysOfCover <= 3
                    ? 'danger'
                    : row.daysOfCover <= row.leadTimeDays + 2
                      ? 'warning'
                      : 'healthy';
                const statusVariant =
                  row.status === 'ACCEPTED' || row.status === 'EDITED'
                    ? 'healthy'
                    : row.status === 'REJECTED'
                      ? 'danger'
                      : 'warning';

                return (
                  <tr
                    key={row.productId}
                    className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{row.imageEmoji}</span>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {row.productName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {row.supplierName} • {row.leadTimeDays}d lead
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {row.onHand}
                      </span>{' '}
                      <span className="text-xs text-gray-400">/ {row.minStock}</span>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-xs text-gray-700 dark:text-gray-300">
                      {row.dailyDemand.toFixed(1)}/day
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={coverVariant}>{row.daysOfCover}d cover</Badge>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editQty}
                          onChange={(e) => setEditQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-20 px-2 py-1 text-xs rounded-lg border border-emerald-500 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {row.suggestedQty} units
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-xs font-medium text-gray-700 dark:text-gray-200">
                      {formatINR(
                        (isEditing ? editQty : row.suggestedQty) * row.purchasePrice,
                        intlLocale
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={statusVariant}>{row.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleRowDecision(row, 'EDITED', editQty)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingRowId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-emerald-700 dark:text-emerald-400"
                            onClick={() => handleRowDecision(row, 'ACCEPTED')}
                            title="Accept recommendation"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setEditingRowId(row.productId);
                              setEditQty(row.suggestedQty);
                            }}
                            title="Edit quantity"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-red-600 dark:text-red-400"
                            onClick={() => handleRowDecision(row, 'REJECTED')}
                            title="Reject recommendation"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

