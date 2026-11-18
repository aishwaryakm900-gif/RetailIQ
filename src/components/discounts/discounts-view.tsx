'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Tag,
  Sparkles,
  ShieldAlert,
  Share2,
  Copy,
  MessageCircle,
  QrCode,
  Plus,
  X,
  Gift,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCodeSvg } from '@/components/ui/qr-code-svg';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { RETAIL_CONFIG } from '@/lib/retail-config';
import {
  addDaysIso,
  assessBatchExpiryRisk,
  calculateProtectedDiscount,
  computeWithdrawAt,
  daysUntil,
} from '@/lib/retail-rules';
import { Batch, Offer, Product } from '@/lib/retail-types';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

const BUNDLE_PARTNERS = [
  'Tata Gold Tea 250g',
  'Parle-G Family Pack',
  'Amul Butter 100g',
  'Fresh Masala Packet',
];

export function DiscountsView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const { shop, products, batches, offers, createOffer, withdrawOffer } = useRetailStore();

  // Selected offer for Campaign Pack modal
  const [campaignOffer, setCampaignOffer] = useState<Offer | null>(
    offers.find((o) => o.status === 'PUBLISHED') ?? offers[0] ?? null
  );

  // Offer Creator Modal state
  const [creatorBatch, setCreatorBatch] = useState<{ batch: Batch; product: Product } | null>(null);
  const [offerType, setOfferType] = useState<'DISCOUNT' | 'BUNDLE'>('DISCOUNT');
  const [discountPct, setDiscountPct] = useState<number>(15);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customValidTo, setCustomValidTo] = useState<string>('');
  const [dealHeadline, setDealHeadline] = useState<string>('Special Clearance Deal');
  const [bundleWith, setBundleWith] = useState<string>(BUNDLE_PARTNERS[0]);
  const [offerQty, setOfferQty] = useState<number>(10);
  const [channelRescue, setChannelRescue] = useState<boolean>(true);
  const [channelWhatsapp, setChannelWhatsapp] = useState<boolean>(true);

  const candidates = useMemo(() => {
    const prodMap = new Map(products.map((p) => [p.id, p]));
    return batches
      .filter((b) => b.qtyOnHand > 0 && daysUntil(b.expiryDate) > 0)
      .map((batch) => {
        const product = prodMap.get(batch.productId);
        if (!product) return null;
        const risk = assessBatchExpiryRisk(batch, product);
        const sim = calculateProtectedDiscount(
          product.sellingPrice,
          product.purchasePrice,
          batch.qtyOnHand,
          product.dailyDemandAvg,
          risk.daysLeft
        );
        const marginDays = RETAIL_CONFIG.categoryWithdrawMarginDays[product.category] ?? 0;
        const withdrawAt = computeWithdrawAt(batch.expiryDate, product.category);
        return { batch, product, risk, sim, marginDays, withdrawAt };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(
        (x) =>
          x.risk.daysLeft <= 21 ||
          x.product.moverState === 'slow-moving' ||
          x.product.moverState === 'near-expiry'
      )
      .sort((a, b) => a.risk.daysLeft - b.risk.daysLeft);
  }, [batches, products]);

  const openCreator = (batch: Batch, product: Product, defaultPct?: number, forceBundle?: boolean) => {
    const daysLeft = Math.max(1, daysUntil(batch.expiryDate));
    const sim = calculateProtectedDiscount(
      product.sellingPrice,
      product.purchasePrice,
      batch.qtyOnHand,
      product.dailyDemandAvg,
      daysLeft
    );
    setCreatorBatch({ batch, product });
    const useBundle = forceBundle ?? (!sim.clearsFloor || sim.suggestBundle);
    setOfferType(useBundle ? 'BUNDLE' : 'DISCOUNT');
    const initialPct = defaultPct ?? (sim.recommendedDiscountPct || 10);
    setDiscountPct(initialPct);
    setCustomPrice(Math.round(product.sellingPrice * (1 - initialPct / 100)));
    setOfferQty(Math.min(batch.qtyOnHand, Math.max(4, sim.expectedLeftoverWithout || 6)));
    setCustomValidTo(computeWithdrawAt(batch.expiryDate, product.category));
    setDealHeadline(useBundle ? 'Combo Saver Deal' : 'Special Clearance Deal');
    setChannelRescue(true);
    setChannelWhatsapp(true);
  };

  const handleSelectProduct = (newProductId: string) => {
    const newProduct = products.find((p) => p.id === newProductId);
    if (!newProduct) return;
    const availableBatches = batches.filter((b) => b.productId === newProductId && b.qtyOnHand > 0);
    const chosenBatch =
      availableBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0] ||
      batches.find((b) => b.productId === newProductId);
    if (chosenBatch) {
      openCreator(chosenBatch, newProduct);
    }
  };

  const handleSelectBatch = (newBatchId: string) => {
    if (!creatorBatch) return;
    const chosenBatch = batches.find((b) => b.id === newBatchId);
    if (chosenBatch) {
      setCreatorBatch({ batch: chosenBatch, product: creatorBatch.product });
      setOfferQty((prev) => Math.min(prev, chosenBatch.qtyOnHand));
      setCustomValidTo(computeWithdrawAt(chosenBatch.expiryDate, creatorBatch.product.category));
    }
  };

  const creatorPreview = useMemo(() => {
    if (!creatorBatch) return null;
    const { batch, product } = creatorBatch;
    const calculatedPrice =
      customPrice > 0 ? customPrice : Math.round(product.sellingPrice * (1 - discountPct / 100));
    const safePrice = offerType === 'BUNDLE' ? product.sellingPrice : calculatedPrice;
    const belowFloor = offerType === 'DISCOUNT' && safePrice < product.purchasePrice;
    const marginDays = RETAIL_CONFIG.categoryWithdrawMarginDays[product.category] ?? 0;
    const defaultWithdrawAt = computeWithdrawAt(batch.expiryDate, product.category);
    const effectiveWithdrawAt = customValidTo || defaultWithdrawAt;
    const withdrawDaysLeft = daysUntil(effectiveWithdrawAt);
    const savings = Math.max(0, product.sellingPrice - safePrice);

    return {
      safePrice,
      belowFloor,
      marginDays,
      defaultWithdrawAt,
      withdrawAt: effectiveWithdrawAt,
      withdrawDaysLeft,
      savings,
    };
  }, [creatorBatch, discountPct, customPrice, customValidTo, offerType]);

  const handleSubmitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorBatch || !creatorPreview) return;
    if (creatorPreview.belowFloor) {
      toast.error('Price below purchase floor. Select Bundle or reduce discount % (Rule R3).');
      return;
    }

    const channels: ('WHATSAPP' | 'STOCK_RESCUE')[] = [];
    if (channelRescue) channels.push('STOCK_RESCUE');
    if (channelWhatsapp) channels.push('WHATSAPP');
    if (channels.length === 0) channels.push('STOCK_RESCUE');

    const res = createOffer({
      batchId: creatorBatch.batch.id,
      type: offerType,
      bundleWithName: offerType === 'BUNDLE' ? bundleWith : undefined,
      discountPct: offerType === 'BUNDLE' ? 10 : discountPct,
      qty: Math.min(offerQty, creatorBatch.batch.qtyOnHand),
      validFrom: addDaysIso(new Date(), 0),
      validTo: creatorPreview.withdrawAt,
      channels,
      recommendedByAi: true,
    });

    if (!res.ok) {
      toast.error(res.error ?? 'Failed to publish offer');
      return;
    }

    toast.success(`Published offer for ${creatorBatch.product.name}`);
    if (res.offer) setCampaignOffer(res.offer);
    setCreatorBatch(null);
  };

  const buildCaption = (offer: Offer) => {
    const dealText =
      offer.type === 'BUNDLE'
        ? `Combo Offer: ${offer.productName} + ${offer.bundleWithName ?? 'Combo Item'}`
        : `${offer.discountPct}% OFF on ${offer.productName} — Now ${formatINR(offer.offerPrice, 'en-IN')} (MRP ${formatINR(offer.originalPrice, 'en-IN')})`;
    return `Fresh neighborhood deal at ${shop.name}! ${dealText}. ${offer.qtyAvailable} packs left until ${offer.withdrawAt}. Visit our store or reply to reserve your pack!`;
  };

  const copyCaption = async (offer: Offer) => {
    try {
      await navigator.clipboard.writeText(buildCaption(offer));
      toast.success('WhatsApp / social caption copied!');
    } catch {
      toast.info('Copy selected caption manually.');
    }
  };

  const publishedOffers = offers.filter((o) => o.shopId === shop.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('discounts')} & Campaign Pack
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dynamic Discount suggests discounts to sell slow-moving or expiring products while protecting your purchase cost.
          </p>
        </div>

        {candidates[0] && (
          <Button
            size="sm"
            className="gap-1.5 self-start sm:self-auto"
            onClick={() => openCreator(candidates[0].batch, candidates[0].product)}
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Offer</span>
          </Button>
        )}
      </div>

      {/* Candidate Slow / Near-Expiry Optimizer Grid */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Price-Floor Safe Discount & Bundle Candidates
            </h2>
          </div>
          <Badge variant="outline">{candidates.length} batches eligible</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Product & Batch</th>
                <th className="py-3 px-4">Cost Floor / Sell</th>
                <th className="py-3 px-4">Expiry & Withdraw (R2)</th>
                <th className="py-3 px-4">Protected Plan (R3)</th>
                <th className="py-3 px-4">Est. Recovery</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-gray-500">
                    No near-expiry batches currently eligible for discount campaigns.
                  </td>
                </tr>
              ) : (
                candidates.slice(0, 8).map(({ batch, product, risk, sim, marginDays, withdrawAt }) => {
                const isLive = publishedOffers.some(
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
                            {batch.batchNo} • {batch.qtyOnHand} units • {product.moverState}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-xs">
                      <div className="text-gray-500 dark:text-gray-400">
                        Floor {formatINR(product.purchasePrice, intlLocale)}
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        Sell {formatINR(product.sellingPrice, intlLocale)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-gray-900 dark:text-white">
                        Exp {batch.expiryDate} ({risk.daysLeft}d)
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        Withdraw {withdrawAt} (-{marginDays}d rule)
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {sim.clearsFloor ? (
                        <div className="space-y-1">
                          <Badge variant="healthy">
                            {sim.recommendedDiscountPct}% OFF ({formatINR(sim.offerPrice, intlLocale)})
                          </Badge>
                          {sim.suggestBundle && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Gift className="w-3 h-3" /> Bundle recommended too
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="warning">Bundle / Combo Only</Badge>
                          <div className="text-[11px] text-gray-500">5% step breaches floor</div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {sim.clearsFloor ? formatINR(sim.estimatedRecoveryRs, intlLocale) : 'Combo Value'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLive ? (
                        <Badge variant="info">Published</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => openCreator(batch, product, sim.recommendedDiscountPct, !sim.clearsFloor)}
                        >
                          <Tag className="w-3 h-3" />
                          Launch Offer
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

      {/* Store Offers + Campaign Pack Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Store Offers List */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Store Offers ({publishedOffers.length})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select any offer to preview or share its Campaign Pack & QR poster.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {publishedOffers.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">
                No active store offers yet. Add inventory stock and launch campaigns from eligible batches.
              </p>
            ) : (
              publishedOffers.map((offer) => {
              const selected = campaignOffer?.id === offer.id;
              return (
                <div
                  key={offer.id}
                  onClick={() => setCampaignOffer(offer)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-gray-200 dark:border-neutral-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{offer.imageEmoji}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                          {offer.productName}
                        </span>
                        <Badge variant={offer.status === 'PUBLISHED' ? 'healthy' : 'outline'}>
                          {offer.status}
                        </Badge>
                        {offer.type === 'BUNDLE' ? (
                          <Badge variant="slow">Combo: +{offer.bundleWithName}</Badge>
                        ) : (
                          <Badge variant="warning">{offer.discountPct}% OFF</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Offer {formatINR(offer.offerPrice, intlLocale)} (Floor{' '}
                        {formatINR(offer.purchasePrice, intlLocale)}) • {offer.qtyAvailable}/
                        {offer.qtyTotal} left • Withdraw {offer.withdrawAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCampaignOffer(offer);
                      }}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Pack
                    </Button>
                    {offer.status === 'PUBLISHED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-red-600 dark:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          withdrawOffer(offer.id);
                          toast.info(`Withdrew offer for ${offer.productName}`);
                        }}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>

        {/* Campaign Pack Preview */}
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Share2 className="w-4 h-4" />
              <span>Campaign Pack</span>
            </div>
            {campaignOffer && <Badge variant="info">{campaignOffer.channels.join(' + ')}</Badge>}
          </div>

          {campaignOffer ? (
            <>
              {/* Poster Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white space-y-3 shadow-md">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider opacity-90">
                  <span>{shop.name}</span>
                  <span>Fresh Deal</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-2xl">{campaignOffer.imageEmoji}</div>
                    <div className="font-bold text-base leading-tight">
                      {campaignOffer.productName}
                    </div>
                    <div className="inline-block px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-extrabold text-xs">
                      {campaignOffer.type === 'BUNDLE'
                        ? `BUNDLE + ${campaignOffer.bundleWithName}`
                        : `SAVE ${campaignOffer.discountPct}% OFF`}
                    </div>
                    <div className="text-xl font-extrabold tabular-nums pt-1">
                      {formatINR(campaignOffer.offerPrice, intlLocale)}{' '}
                      <span className="text-xs line-through opacity-75 font-normal">
                        {formatINR(campaignOffer.originalPrice, intlLocale)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-xl shrink-0">
                    <QrCodeSvg
                      value={`https://retailiq.local/${locale}/marketplace?offer=${campaignOffer.id}`}
                      size={88}
                    />
                  </div>
                </div>
                <div className="text-[11px] opacity-90 border-t border-white/20 pt-2 flex justify-between">
                  <span>Qty left: {campaignOffer.qtyAvailable}</span>
                  <span>Valid till {campaignOffer.withdrawAt}</span>
                </div>
              </div>

              {/* Caption Box */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {buildCaption(campaignOffer)}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => copyCaption(campaignOffer)}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Caption
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(buildCaption(campaignOffer))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 h-9 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Share WhatsApp
                </a>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">Select or create an offer to preview its poster.</p>
          )}
        </div>
      </div>

      {/* Customizable Create Offer Modal */}
      {creatorBatch && creatorPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{creatorBatch.product.imageEmoji}</span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                    Customize Offer: {creatorBatch.product.name}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Adjust product, price floor, batch, quantity, headline, and auto-withdraw dates
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreatorBatch(null)}
                aria-label="Close offer modal"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Two-column layout on desktop */}
            <form onSubmit={handleSubmitOffer} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Form Controls Column (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Product & Batch Switcher */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-neutral-950/60 border border-gray-200 dark:border-neutral-800">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                        Select Product
                      </label>
                      <select
                        value={creatorBatch.product.id}
                        onChange={(e) => handleSelectProduct(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.imageEmoji} {p.name} ({formatINR(p.sellingPrice, intlLocale)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                        Select Batch
                      </label>
                      <select
                        value={creatorBatch.batch.id}
                        onChange={(e) => handleSelectBatch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      >
                        {batches
                          .filter((b) => b.productId === creatorBatch.product.id && b.qtyOnHand > 0)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batchNo} • {b.qtyOnHand} units (Exp {b.expiryDate})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Offer Type Switcher */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Offer Structure
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['DISCOUNT', 'BUNDLE'] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setOfferType(kind)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                            offerType === kind
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-neutral-950 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-neutral-700'
                          }`}
                        >
                          {kind === 'DISCOUNT' ? (
                            <>
                              <Tag className="w-3.5 h-3.5" />
                              <span>Custom % Discount</span>
                            </>
                          ) : (
                            <>
                              <Gift className="w-3.5 h-3.5" />
                              <span>Combo Bundle Deal</span>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Deal Headline */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Deal Headline / Tagline
                    </label>
                    <input
                      type="text"
                      value={dealHeadline}
                      onChange={(e) => setDealHeadline(e.target.value)}
                      placeholder="e.g. Weekend Flash Sale, Clearance Deal"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Custom Pricing Section */}
                  {offerType === 'DISCOUNT' ? (
                    <div className="space-y-3 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Discount Percentage
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={90}
                              value={discountPct}
                              onChange={(e) => {
                                const pct = Math.max(1, Math.min(90, Number(e.target.value) || 0));
                                setDiscountPct(pct);
                                setCustomPrice(
                                  Math.round(creatorBatch.product.sellingPrice * (1 - pct / 100))
                                );
                              }}
                              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-bold tabular-nums"
                            />
                            <span className="text-sm font-bold text-gray-500">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Offer Price (₹)
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-gray-500">₹</span>
                            <input
                              type="number"
                              min={1}
                              value={creatorPreview.safePrice}
                              onChange={(e) => {
                                const price = Number(e.target.value) || 0;
                                setCustomPrice(price);
                                if (creatorBatch.product.sellingPrice > 0) {
                                  const pct = Math.max(
                                    1,
                                    Math.min(
                                      90,
                                      Math.round(
                                        ((creatorBatch.product.sellingPrice - price) /
                                          creatorBatch.product.sellingPrice) *
                                          100
                                      )
                                    )
                                  );
                                  setDiscountPct(pct);
                                }
                              }}
                              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white font-bold tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cost Floor Safeguard (Rule R3) */}
                      <div className="text-[11px] flex items-center justify-between text-gray-600 dark:text-gray-300 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/40">
                        <span>Original Selling Price: {formatINR(creatorBatch.product.sellingPrice, intlLocale)}</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Cost Floor: {formatINR(creatorBatch.product.purchasePrice, intlLocale)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Bundle Configuration */
                    <div className="space-y-3 p-3.5 rounded-xl border border-purple-200/80 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bundle Partner Item Name
                        </label>
                        <input
                          type="text"
                          value={bundleWith}
                          onChange={(e) => setBundleWith(e.target.value)}
                          placeholder="e.g. Tata Gold Tea 250g"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-gray-500 self-center">Quick pick:</span>
                        {BUNDLE_PARTNERS.map((bp) => (
                          <button
                            key={bp}
                            type="button"
                            onClick={() => setBundleWith(bp)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:border-purple-500"
                          >
                            +{bp}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {creatorPreview.belowFloor && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>
                        Offer price cannot drop below purchase cost floor ({formatINR(creatorBatch.product.purchasePrice, intlLocale)}) per Rule R3.
                      </span>
                    </div>
                  )}

                  {/* Quantity & Dates Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Offer Quantity
                        </label>
                        <span className="text-[11px] text-gray-500">
                          Max {creatorBatch.batch.qtyOnHand} units
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={creatorBatch.batch.qtyOnHand}
                        value={offerQty}
                        onChange={(e) =>
                          setOfferQty(
                            Math.max(
                              1,
                              Math.min(creatorBatch.batch.qtyOnHand, Number(e.target.value) || 1)
                            )
                          )
                        }
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                      />
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setOfferQty(Math.min(creatorBatch.batch.qtyOnHand, 5))}
                          className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300"
                        >
                          5 units
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferQty(Math.max(1, Math.ceil(creatorBatch.batch.qtyOnHand / 2)))}
                          className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300"
                        >
                          Half ({Math.ceil(creatorBatch.batch.qtyOnHand / 2)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferQty(creatorBatch.batch.qtyOnHand)}
                          className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300"
                        >
                          All ({creatorBatch.batch.qtyOnHand})
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Valid Until (Auto-Withdraw)
                        </label>
                        <span className="text-[11px] text-gray-500">Rule R2</span>
                      </div>
                      <input
                        type="date"
                        value={creatorPreview.withdrawAt}
                        onChange={(e) => setCustomValidTo(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                      />
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        Batch expires {creatorBatch.batch.expiryDate}. Auto-withdraws {creatorPreview.withdrawDaysLeft}d ahead.
                      </p>
                    </div>
                  </div>

                  {/* Channels Checkboxes */}
                  <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={channelWhatsapp}
                        onChange={(e) => setChannelWhatsapp(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      WhatsApp Campaign Broadcast
                    </label>
                  </div>
                </div>

                {/* Right Column: Live Poster & Deal Card Preview (5 cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-gray-50 dark:bg-neutral-950 p-4 rounded-xl border border-gray-200 dark:border-neutral-800">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      <span>Live Customer Card Preview</span>
                      <Badge variant="healthy">Instant</Badge>
                    </div>

                    {/* Deal Card Preview */}
                    <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-xs space-y-2.5">
                      <div className="flex items-start justify-between">
                        <span className="text-3xl">{creatorBatch.product.imageEmoji}</span>
                        {offerType === 'DISCOUNT' ? (
                          <Badge variant="warning">{discountPct}% OFF</Badge>
                        ) : (
                          <Badge variant="slow">Combo Bundle</Badge>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {dealHeadline || 'Special Offer'}
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                          {creatorBatch.product.name}
                        </h4>
                        {offerType === 'BUNDLE' && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                            + Includes {bundleWith}
                          </p>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                          {formatINR(creatorPreview.safePrice, intlLocale)}
                        </span>
                        <span className="text-xs line-through text-gray-400 tabular-nums">
                          {formatINR(creatorBatch.product.sellingPrice, intlLocale)}
                        </span>
                        {creatorPreview.savings > 0 && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Save {formatINR(creatorPreview.savings, intlLocale)}
                          </span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-100 dark:border-neutral-800 text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
                        <span>{offerQty} pack(s) available</span>
                        <span>Till {creatorPreview.withdrawAt}</span>
                      </div>
                    </div>

                    {/* WhatsApp Text Preview Snippet */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-[11px] text-gray-700 dark:text-gray-300 space-y-1">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp Broadcast Snippet:
                      </div>
                      <p className="line-clamp-3 italic opacity-90">
                        &ldquo;{dealHeadline}: {creatorBatch.product.name} at {formatINR(creatorPreview.safePrice, intlLocale)} ({discountPct}% off) at {shop.name}! Reserve before {creatorPreview.withdrawAt}.&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 dark:text-gray-400 text-center">
                    Verified against purchase cost floor and auto-withdraw margin rules.
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-neutral-800 shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreatorBatch(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatorPreview.belowFloor}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm &amp; Launch Offer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

