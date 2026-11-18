'use client';

import React, { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  Store,
  Clock,
  CheckCircle2,
  QrCode,
  ExternalLink,
  RefreshCw,
  IndianRupee,
  Ban,
  TicketCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { isOfferEligibleForMarketplace } from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

export function ShopkeeperRescueView() {
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const {
    shop,
    batches,
    offers,
    reservations,
    collectReservation,
    releaseExpiredReservations,
    withdrawOffer,
  } = useRetailStore();

  const [pickupCodeInput, setPickupCodeInput] = useState('');

  const storeOffers = useMemo(
    () => offers.filter((o) => o.shopId === shop.id),
    [offers, shop.id]
  );

  const storeReservations = useMemo(
    () =>
      reservations
        .filter((r) => r.shopId === shop.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reservations, shop.id]
  );

  const stats = useMemo(() => {
    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const liveOffers = storeOffers.filter((o) =>
      isOfferEligibleForMarketplace(o, batchMap.get(o.batchId))
    ).length;
    const heldCount = storeReservations.filter((r) => r.status === 'HELD').length;
    const collected = storeReservations.filter((r) => r.status === 'COLLECTED');
    const rescuedRevenue = collected.reduce((sum, r) => sum + r.qty * r.offerPrice, 0);

    return {
      liveOffers,
      heldCount,
      collectedCount: collected.length,
      rescuedRevenue,
    };
  }, [storeOffers, storeReservations, batches]);

  const handleVerifyPickup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pickupCodeInput.trim();
    if (!cleaned) {
      toast.error('Enter a customer pickup code first.');
      return;
    }
    const res = collectReservation(cleaned);
    if (!res.ok) {
      toast.error(res.error ?? 'Invalid pickup code');
      return;
    }
    toast.success(
      `Collected ${res.reservation?.qty}x ${res.reservation?.productName} via FEFO (${res.reservation?.code})`
    );
    setPickupCodeInput('');
  };

  const handleQuickCollect = (code: string) => {
    const res = collectReservation(code);
    if (!res.ok) {
      toast.error(res.error ?? 'Could not mark collected');
      return;
    }
    toast.success(`Marked ${code} collected & deducted stock via FEFO`);
  };

  const handleReleaseExpired = () => {
    const count = releaseExpiredReservations();
    if (count > 0) {
      toast.success(`Released ${count} expired reservation hold(s) back into offer stock.`);
    } else {
      toast.info('No expired 2-hour reservation holds found.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {tNav('rescue')} Console
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Verify customer pickup codes (FEFO deduction), monitor 2-hour holds, and manage
            marketplace deals for {shop.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReleaseExpired}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Release Expired Holds</span>
          </Button>
          <Link href="/marketplace">
            <Button size="sm" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Public Marketplace</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Live Deals</span>
            <Store className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {stats.liveOffers}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Visible within customer radius (Rule R2)
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Active 2h Holds</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3 tabular-nums">
            {stats.heldCount}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Awaiting counter collection
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Collected Pickups</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-3 tabular-nums">
            {stats.collectedCount}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Completed FEFO counter handoffs
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
            <span>Revenue Rescued</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">
            {formatINR(stats.rescuedRevenue, intlLocale)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            From collected Stock Rescue orders
          </p>
        </div>
      </div>

      {/* Pickup Code Verification Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card">
        <form
          onSubmit={handleVerifyPickup}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Verify Customer Pickup Code
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Entering a pickup code deducts units via earliest-expiry FEFO and marks the hold
                collected.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={pickupCodeInput}
              onChange={(e) => setPickupCodeInput(e.target.value)}
              placeholder="e.g. RQ-4821"
              className="flex-1 sm:w-44 px-3 py-2 text-sm uppercase font-mono rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-white"
            />
            <Button type="submit" size="sm" className="gap-1.5 shrink-0">
              <TicketCheck className="w-4 h-4" />
              Verify & Collect
            </Button>
          </div>
        </form>
      </div>

      {/* Reservations Queue Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-card border border-surface-border dark:border-neutral-800 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Customer Reservations ({storeReservations.length})
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Orders reserved from nearby neighborhood shoppers with a 2-hour hold lock.
            </p>
          </div>
          <Badge variant="outline">2h auto-expiry guard</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-950/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Pickup Code</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Item & Qty</th>
                <th className="py-3 px-4">Order Total</th>
                <th className="py-3 px-4">Hold Window</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
              {storeReservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-gray-500">
                    No customer reservations for your shop yet. Share offers via Campaign Pack or
                    place a test order on /marketplace.
                  </td>
                </tr>
              ) : (
                storeReservations.map((res) => {
                  const statusVariant =
                    res.status === 'COLLECTED'
                      ? 'healthy'
                      : res.status === 'HELD'
                        ? 'warning'
                        : 'outline';
                  const holdTime = new Date(res.holdUntil).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={res.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {res.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {res.customerName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {res.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {res.productName}
                        </div>
                        <div>{res.qty} pack(s)</div>
                      </td>
                      <td className="py-3 px-4 tabular-nums font-semibold text-gray-900 dark:text-white">
                        {formatINR(res.qty * res.offerPrice, intlLocale)}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                        Till {holdTime}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusVariant}>{res.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {res.status === 'HELD' ? (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => handleQuickCollect(res.code)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Collected
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
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

      {/* Store Rescue Listings Status */}
      <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Marketplace Offer Listings ({storeOffers.length})
          </h2>
          <Link
            href="/discounts"
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            + Add Offer in Smart Discounts
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {storeOffers.length === 0 ? (
            <p className="col-span-2 text-xs text-gray-500 py-6 text-center">
              No store offers published to marketplace yet. Add inventory stock and launch offers in Smart Discounts.
            </p>
          ) : (
            storeOffers.map((offer) => {
            const batch = batches.find((b) => b.id === offer.batchId);
            const eligible = isOfferEligibleForMarketplace(offer, batch);

            return (
              <div
                key={offer.id}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{offer.imageEmoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {offer.productName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatINR(offer.offerPrice, intlLocale)} ({offer.discountPct}% off) •{' '}
                      {offer.qtyAvailable}/{offer.qtyTotal} left • Withdraw {offer.withdrawAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={eligible ? 'healthy' : 'danger'}>
                    {eligible ? 'Visible' : offer.status === 'PUBLISHED' ? 'Past Margin' : offer.status}
                  </Badge>
                  {offer.status === 'PUBLISHED' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-600"
                      onClick={() => {
                        withdrawOffer(offer.id);
                        toast.info(`Withdrew ${offer.productName} from marketplace`);
                      }}
                      title="Withdraw offer"
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
    </div>
  );
}

