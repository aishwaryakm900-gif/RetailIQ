'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  ClockAlert,
  AlertTriangle,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  Tag,
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
import {
  addDaysIso,
  assessBatchExpiryRisk,
  calculateProtectedDiscount,
  computeWithdrawAt,
  ExpiryRiskAssessment,
} from '@/lib/retail-rules';
import { Batch, Product } from '@/lib/retail-types';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

interface ConfirmationTarget {
  assessment: ExpiryRiskAssessment;
  product: Product;
  batch: Batch;
  recId?: string;
}

export function ExpiryView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const {
    products,
    batches,
    recommendations,
    offers,
    createOffer,
    updateRecommendationStatus,
  } = useRetailStore();

  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(30);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmationTarget | null>(null);
  const [customDiscountPct, setCustomDiscountPct] = useState<number>(15);
  const [offerQty, setOfferQty] = useState<number>(10);
  const [shareStockRescue, setShareStockRescue] = useState<boolean>(true);
  const [shareWhatsapp, setShareWhatsapp] = useState<boolean>(true);

  const assessments = useMemo(() => {
    const prodMap = new Map(products.map((p) => [p.id, p]));
    return batches
      .filter((b) => b.qtyOnHand > 0)
      .map((b) => {
        const p = prodMap.get(b.productId);
        if (!p) return null;
        return {
          assessment: assessBatchExpiryRisk(b, p),
          batch: b,
          product: p,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => item.assessment.daysLeft <= windowDays)
      .sort((a, b) => {
        const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const diff = rank[a.assessment.riskLevel] - rank[b.assessment.riskLevel];
        return diff !== 0 ? diff : b.assessment.estimatedLoss - a.assessment.estimatedLoss;
      });
  }, [batches, products, windowDays]);

  const stats = useMemo(() => {
    const critical = assessments.filter((a) => a.assessment.riskLevel === 'Critical').length;
    const high = assessments.filter((a) => a.assessment.riskLevel === 'High').length;
    const totalRiskRs = assessments.reduce((s, a) => s + a.assessment.estimatedLoss, 0);
    const potentialRecoveryRs = assessments.reduce((s, a) => {
      const sim = calculateProtectedDiscount(
        a.product.sellingPrice,
        a.product.purchasePrice,
        a.batch.qtyOnHand,
        a.product.dailyDemandAvg,
        a.assessment.daysLeft
      );
      return s + sim.estimatedRecoveryRs;
    }, 0);

    return { critical, high, totalRiskRs, potentialRecoveryRs };
  }, [assessments]);

  const stackedChartData = useMemo(() => {
    return assessments.slice(0, 8).map((item) => ({
      name:
        item.product.name.length > 14
          ? `${item.product.name.slice(0, 14)}…`
          : item.product.name,
      soldNormal: item.assessment.predictedSold,
      leftoverRisk: item.assessment.predictedLeftover,
    }));
  }, [assessments]);

  const expiryRecs = useMemo(
    () => recommendations.filter((r) => r.kind !== 'REORDER'),
    [recommendations]
  );

  const openConfirmationSheet = (target: ConfirmationTarget) => {
    const sim = calculateProtectedDiscount(
      target.product.sellingPrice,
      target.product.purchasePrice,
      target.batch.qtyOnHand,
      target.product.dailyDemandAvg,
      target.assessment.daysLeft
    );
    setConfirmTarget(target);
    setCustomDiscountPct(sim.recommendedDiscountPct || 10);
    setOfferQty(Math.max(1, target.assessment.predictedLeftover || target.batch.qtyOnHand));
    setShareStockRescue(true);
    setShareWhatsapp(true);
  };

  // Live simulation inside confirmation sheet obeying Hard Rule R3
  const sheetSimulation = useMemo(() => {
    if (!confirmTarget) return null;
    const { product, batch, assessment } = confirmTarget;
    const effectiveDays = Math.max(1, assessment.daysLeft);
    const baselineSim = calculateProtectedDiscount(
      product.sellingPrice,
      product.purchasePrice,
      batch.qtyOnHand,
      product.dailyDemandAvg,
      assessment.daysLeft
    );

    const candidatePrice = Math.round(product.sellingPrice * (1 - customDiscountPct / 100));
    const belowFloor = candidatePrice < product.purchasePrice;
    const safePrice = Math.max(product.purchasePrice, candidatePrice);
    const demandBoost = 1 + (customDiscountPct / 100) * 1.65;
    const soldWith = Math.min(
      batch.qtyOnHand,
      Math.round(product.dailyDemandAvg * demandBoost * effectiveDays)
    );
    const leftoverWith = Math.max(0, batch.qtyOnHand - soldWith);
    const clearedExtra = Math.max(0, baselineSim.expectedLeftoverWithout - leftoverWith);
    const recoveredRs = Math.round(clearedExtra * safePrice);
    const withdrawAt = computeWithdrawAt(batch.expiryDate, product.category);

    return {
      withoutLeftover: baselineSim.expectedLeftoverWithout,
      withoutLossRs: Math.round(baselineSim.expectedLeftoverWithout * batch.costPrice),
      leftoverWith,
      withLossRs: Math.round(leftoverWith * batch.costPrice),
      safePrice,
      belowFloor,
      recoveredRs,
      withdrawAt,
    };
  }, [confirmTarget, customDiscountPct]);

  const handlePublishOffer = () => {
    if (!confirmTarget || !sheetSimulation) return;
    if (sheetSimulation.belowFloor) {
      toast.error(
        `Discount violates purchase price floor (${formatINR(confirmTarget.product.purchasePrice, intlLocale)}). Choose bundle or smaller discount.`
      );
      return;
    }

    const channels: ('WHATSAPP' | 'STOCK_RESCUE')[] = [];
    if (shareStockRescue) channels.push('STOCK_RESCUE');
    if (shareWhatsapp) channels.push('WHATSAPP');
    if (channels.length === 0) channels.push('STOCK_RESCUE');

    const res = createOffer({
      batchId: confirmTarget.batch.id,
      type: confirmTarget.assessment.priceFloorCleared ? 'DISCOUNT' : 'BUNDLE',
      bundleWithName: confirmTarget.assessment.priceFloorCleared ? undefined : 'Tea / Staple Pack',
      discountPct: confirmTarget.assessment.priceFloorCleared ? customDiscountPct : 0,
      qty: Math.min(offerQty, confirmTarget.batch.qtyOnHand),
      validFrom: addDaysIso(new Date(), 0),
      validTo: sheetSimulation.withdrawAt,
      channels,
      recommendedByAi: true,
    });

    if (!res.ok) {
      toast.error(res.error ?? 'Could not create offer');
      return;
    }

    if (confirmTarget.recId) {
      updateRecommendationStatus(confirmTarget.recId, 'ACCEPTED');
    }

    toast.success(
      `Published ${confirmTarget.product.name} offer (auto-withdraw ${sheetSimulation.withdrawAt})`
    );
    setConfirmTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('expiry')} Analysis
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Expiry Risk identifies products nearing their expiry date so you can sell them first and prevent wastage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindowDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                windowDays === d
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-neutral-800'
              }`}
            >
              &le; {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Critical (&le; 3 Days)</span>
            <ClockAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-3 tabular-nums">
            {stats.critical} batches
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Immediate clearance priority
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>High Risk (&le; 7 Days)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3 tabular-nums">
            {stats.high} batches
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Escalated if leftover share &gt; 35%
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Capital at Risk</span>
            <IndianRupee className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {formatINR(stats.totalRiskRs, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cost of projected unsold units
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Est. Recoverable Value</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">
            {formatINR(stats.potentialRecoveryRs, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Protected above purchase floor (R3)
          </p>
        </div>
      </div>

      {/* Stacked Bar Chart + AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Remaining Stock Projection at Batch Expiry
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Expected normal sales vs unsold leftover units before expiry date
              </p>
            </div>
            <Link
              href="/discounts"
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 hover:underline"
            >
              Open Smart Discounts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedChartData}
                margin={{ top: 8, right: 12, left: -12, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.45} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="soldNormal"
                  name="Sold Normally"
                  stackId="stock"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="leftoverRisk"
                  name="Projected Unsold Leftover"
                  stackId="stock"
                  fill="#ef4444"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Expiry Action Cards */}
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>AI Expiry Actions</span>
            </div>
            <Badge variant="outline">{expiryRecs.length} tracked</Badge>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {expiryRecs.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                No active AI expiry actions. System will alert automatically when batches approach risk thresholds.
              </p>
            ) : (
              expiryRecs.map((rec) => {
              const prod = products.find((p) => p.id === rec.productId);
              const batch = batches.find((b) => b.id === rec.batchId);
              const matchedAssessment = assessments.find((a) => a.batch.id === rec.batchId);

              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      {prod?.imageEmoji} {rec.title}
                    </div>
                    <Badge
                      variant={
                        rec.status === 'ACCEPTED'
                          ? 'healthy'
                          : rec.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {rec.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    {rec.description}
                  </p>
                  {rec.status === 'PENDING' && matchedAssessment && prod && batch && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() =>
                          openConfirmationSheet({
                            assessment: matchedAssessment.assessment,
                            product: prod,
                            batch,
                            recId: rec.id,
                          })
                        }
                      >
                        Compare & Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          updateRecommendationStatus(rec.id, 'REJECTED');
                          toast.info('Dismissed expiry recommendation');
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
        </div>
      </div>

      {/* Products at Risk Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Batches at Risk (&le; {windowDays} Days)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Click &ldquo;Review Offer&rdquo; to inspect With vs Without Discount leftover impact.
            </p>
          </div>
          <Badge variant="outline">{assessments.length} batches</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Product & Batch</th>
                <th className="py-3 px-4">Days Left</th>
                <th className="py-3 px-4">On Hand</th>
                <th className="py-3 px-4">Est. Leftover</th>
                <th className="py-3 px-4">Loss Risk</th>
                <th className="py-3 px-4">Risk Tier</th>
                <th className="py-3 px-4">Suggested Action</th>
                <th className="py-3 px-4 text-right">Confirm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-gray-500">
                    No batches expiring within {windowDays} days. All stock is fresh or inventory is clean.
                  </td>
                </tr>
              ) : (
                assessments.map(({ assessment, product, batch }) => {
                const riskVariant =
                  assessment.riskLevel === 'Critical'
                    ? 'danger'
                    : assessment.riskLevel === 'High' || assessment.riskLevel === 'Medium'
                      ? 'warning'
                      : 'healthy';
                const hasOffer = offers.some(
                  (o) => o.batchId === batch.id && o.status === 'PUBLISHED'
                );

                return (
                  <tr
                    key={batch.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{product.imageEmoji}</span>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {batch.batchNo} • Exp {batch.expiryDate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold text-gray-900 dark:text-white">
                      {assessment.daysLeft}d
                    </td>
                    <td className="py-3 px-4 tabular-nums text-xs text-gray-600 dark:text-gray-300">
                      {assessment.onHand} units
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold text-red-600 dark:text-red-400">
                      {assessment.predictedLeftover} unsold
                    </td>
                    <td className="py-3 px-4 tabular-nums font-medium text-gray-900 dark:text-white">
                      {formatINR(assessment.estimatedLoss, intlLocale)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={riskVariant}>{assessment.riskLevel}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                      {assessment.recommendedAction}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasOffer ? (
                        <Badge variant="healthy">Offer Live</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => openConfirmationSheet({ assessment, product, batch })}
                        >
                          <Tag className="w-3 h-3" />
                          Review Offer
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Sheet Modal comparing WITH vs WITHOUT discount */}
      {confirmTarget && sheetSimulation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Confirm Expiry Action: {confirmTarget.product.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Batch {confirmTarget.batch.batchNo} • Cost Floor:{' '}
                  {formatINR(confirmTarget.product.purchasePrice, intlLocale)} • Sell:{' '}
                  {formatINR(confirmTarget.product.sellingPrice, intlLocale)}
                </p>
              </div>
              <button
                onClick={() => setConfirmTarget(null)}
                aria-label="Close confirmation sheet"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 space-y-1">
                  <div className="text-xs font-bold uppercase text-red-700 dark:text-red-400">
                    Without Discount
                  </div>
                  <div className="text-lg font-bold text-red-800 dark:text-red-300 tabular-nums">
                    {sheetSimulation.withoutLeftover} leftover units
                  </div>
                  <p className="text-xs text-red-700/80 dark:text-red-300/80">
                    Projected expiry write-off:{' '}
                    {formatINR(sheetSimulation.withoutLossRs, intlLocale)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-1">
                  <div className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                    With {customDiscountPct}% Discount
                  </div>
                  <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {sheetSimulation.leftoverWith} leftover units
                  </div>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    Est. revenue recovered:{' '}
                    {formatINR(sheetSimulation.recoveredRs, intlLocale)}
                  </p>
                </div>
              </div>

              {/* Editable controls (Rule R8 + Rule R3 guard) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Discount % (5% steps)
                  </label>
                  <select
                    value={customDiscountPct}
                    onChange={(e) => setCustomDiscountPct(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                  >
                    {[5, 10, 15, 20, 25, 30, 35, 40].map((pct) => {
                      const p = Math.round(confirmTarget.product.sellingPrice * (1 - pct / 100));
                      const safe = p >= confirmTarget.product.purchasePrice;
                      return (
                        <option key={pct} value={pct} disabled={!safe}>
                          {pct}% ({formatINR(p, intlLocale)}) {safe ? '' : '— Below Cost Floor'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Offer Quantity (max {confirmTarget.batch.qtyOnHand})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={confirmTarget.batch.qtyOnHand}
                    value={offerQty}
                    onChange={(e) =>
                      setOfferQty(
                        Math.max(1, Math.min(confirmTarget.batch.qtyOnHand, Number(e.target.value) || 1))
                      )
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-xs flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Category Safety Auto-Withdraw Date (Rule R2):
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {sheetSimulation.withdrawAt}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={shareWhatsapp}
                    onChange={(e) => setShareWhatsapp(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600"
                  />
                  Generate WhatsApp Campaign
                </label>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-end gap-2 bg-gray-50/70 dark:bg-neutral-950/60">
              <Button variant="outline" size="sm" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handlePublishOffer} className="gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Publish Offer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

