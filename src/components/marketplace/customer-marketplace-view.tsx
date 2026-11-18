'use client';

import React, { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/navigation';
import {
  MapPin,
  ShoppingBag,
  Sparkles,
  Clock,
  Tag,
  CheckCircle2,
  QrCode,
  X,
  ArrowLeft,
  Leaf,
  Navigation,
  Store,
  HeartHandshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCodeSvg } from '@/components/ui/qr-code-svg';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES } from '@/lib/retail-config';
import { haversineDistanceKm, isOfferEligibleForMarketplace } from '@/lib/retail-rules';
import { Offer, Reservation } from '@/lib/retail-types';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';

const RADIUS_OPTIONS = [
  { label: '500m', km: 0.5 },
  { label: '1 km', km: 1 },
  { label: '2 km', km: 2 },
] as const;

export function CustomerMarketplaceView() {
  const locale = useLocale();
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  const { shop, nearbyShops, batches, offers, reservations, reserveOffer } = useRetailStore();

  const [activeTab, setActiveTab] = useState<'deals' | 'orders'>('deals');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [radiusKm, setRadiusKm] = useState<number>(2);
  // Used strictly in memory to recalculate Haversine distances — never rendered raw (Rule R7)
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('Indiranagar Neighborhood');

  // Cart / Reserve modal state
  const [selectedOffer, setSelectedOffer] = useState<(Offer & { computedDistanceKm: number }) | null>(
    null
  );
  const [reserveQty, setReserveQty] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('Ananya Rao');
  const [customerPhone, setCustomerPhone] = useState<string>('+91 98450 22190');
  const [confirmedTicket, setConfirmedTicket] = useState<Reservation | null>(null);

  const allShops = useMemo(() => [shop, ...nearbyShops], [shop, nearbyShops]);

  // Filter strictly by Rule R2 (never expired / past withdrawAt) & radius (Haversine)
  const eligibleDeals = useMemo(() => {
    const batchMap = new Map(batches.map((b) => [b.id, b]));
    const shopMap = new Map(allShops.map((s) => [s.id, s]));

    return offers
      .filter((o) => o.channels.includes('STOCK_RESCUE'))
      .filter((o) => isOfferEligibleForMarketplace(o, batchMap.get(o.batchId)))
      .map((o) => {
        const hostShop = shopMap.get(o.shopId);
        const computedDistanceKm =
          customerCoords && hostShop
            ? haversineDistanceKm(customerCoords.lat, customerCoords.lng, hostShop.lat, hostShop.lng)
            : o.distanceKm;
        return {
          ...o,
          computedDistanceKm,
        };
      })
      .filter((o) => o.computedDistanceKm <= radiusKm)
      .filter((o) => selectedCategory === 'ALL' || o.category === selectedCategory)
      .sort((a, b) => a.computedDistanceKm - b.computedDistanceKm);
  }, [offers, batches, allShops, customerCoords, radiusKm, selectedCategory]);

  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.info('Geolocation is unavailable in this browser; using neighborhood center.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLabel('Near Your Location');
        toast.success('Updated nearby deals distance using your current location.');
      },
      () => {
        toast.info('Location permission declined; keeping default Indiranagar radius.');
      },
      { timeout: 5000 }
    );
  };

  const openReserveModal = (deal: Offer & { computedDistanceKm: number }) => {
    setSelectedOffer(deal);
    setReserveQty(1);
    setConfirmedTicket(null);
  };

  const handleConfirmReserve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error('Please enter your name and mobile number.');
      return;
    }
    const res = reserveOffer(
      selectedOffer.id,
      reserveQty,
      customerName.trim(),
      customerPhone.trim()
    );
    if (!res.ok || !res.reservation) {
      toast.error(res.error ?? 'Could not complete reservation');
      return;
    }
    setConfirmedTicket(res.reservation);
    toast.success(`Reserved! Pickup Code ${res.reservation.code} (held for 2 hours)`);
  };

  const heldOrdersCount = reservations.filter((r) => r.status === 'HELD').length;

  return (
    <div className="min-h-screen bg-[#f6fbf7] dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 flex flex-col">
      {/* Green Public Header */}
      <header className="sticky top-0 z-30 bg-emerald-700 dark:bg-emerald-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Leaf className="w-5 h-5 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm sm:text-base truncate leading-tight">
                  RetailIQ Stock Rescue
                </div>
                <div className="text-[11px] text-emerald-100/90 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>
                    {locationLabel} • Within {radiusKm < 1 ? `${radiusKm * 1000}m` : `${radiusKm} km`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('deals')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'deals'
                  ? 'bg-white text-emerald-800'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              Deals ({eligibleDeals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-white text-emerald-800'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>My Orders</span>
              {heldOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold">
                  {heldOrdersCount}
                </span>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>

            <Link
              href="/login"
              className="hidden md:inline-flex items-center px-3 py-1.5 rounded-xl border border-white/25 text-xs font-medium hover:bg-white/10"
            >
              Shopkeeper Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'deals' ? (
          <>
            {/* Hero Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Fresh Kirana Deals • Zero Expiry Compromises</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Save up to 35% on fresh surplus &amp; near-date essentials nearby
                </h1>
                <p className="text-xs sm:text-sm text-emerald-50/90">
                  Every listing is safety-verified before store withdrawal dates. Reserve free with
                  a 2-hour counter pickup lock—pay directly at the shop.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleUseMyLocation}
                className="gap-1.5 bg-white text-emerald-800 hover:bg-emerald-50 shrink-0 self-start md:self-center"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Update Distance Radius</span>
              </Button>
            </div>

            {/* Category Chips & Distance Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-neutral-800'
                  }`}
                >
                  All Deals
                </button>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-neutral-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 500m / 1km / 2km radius filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 p-1 rounded-xl border border-gray-200 dark:border-neutral-800 self-start shrink-0">
                <span className="text-[11px] font-medium text-gray-500 px-2">Radius:</span>
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setRadiusKm(opt.km)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      radiusKm === opt.km
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deals Cards Grid */}
            {eligibleDeals.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-10 text-center space-y-2">
                <Tag className="w-8 h-8 text-gray-400 mx-auto" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  No verified deals within {radiusKm < 1 ? `${radiusKm * 1000}m` : `${radiusKm} km`}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Try widening your distance filter to 2 km or selecting All Deals.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {eligibleDeals.map((deal) => {
                  const savings = Math.max(0, deal.originalPrice - deal.offerPrice);
                  return (
                    <div
                      key={deal.id}
                      className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-3xl">{deal.imageEmoji}</span>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <Badge variant="healthy">
                              {deal.computedDistanceKm.toFixed(1)} km away
                            </Badge>
                            {deal.type === 'BUNDLE' ? (
                              <Badge variant="slow">Combo Deal</Badge>
                            ) : (
                              <Badge variant="warning">{deal.discountPct}% OFF</Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5" />
                            <span>{deal.shopName}</span>
                          </div>
                          <h3 className="font-bold text-base text-gray-900 dark:text-white mt-0.5">
                            {deal.productName}
                          </h3>
                          {deal.type === 'BUNDLE' && deal.bundleWithName && (
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                              Includes combo: +{deal.bundleWithName}
                            </p>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                            {formatINR(deal.offerPrice, intlLocale)}
                          </span>
                          <span className="text-xs line-through text-gray-400 tabular-nums">
                            {formatINR(deal.originalPrice, intlLocale)}
                          </span>
                          {savings > 0 && (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              Save {formatINR(savings, intlLocale)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                          <div>{deal.qtyAvailable} pack(s) left</div>
                          <div>Pickup before {deal.withdrawAt}</div>
                        </div>

                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openReserveModal(deal)}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Reserve Deal
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* How It Works & Benefit Tiles */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Pick Nearby Fresh Deals
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Only deals well ahead of category safety cutoffs appear here—never expired stock.
                </p>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  2-Hour Counter Hold + QR
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Lock your packs with a 6-character code and QR pass. Pay at the kirana counter on
                  pickup.
                </p>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Support Local Shops &amp; Cut Waste
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Every rescued pack prevents perfectly good groceries from turning into landfill
                  waste.
                </p>
              </div>
            </section>
          </>
        ) : (
          /* My Orders Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  My Stock Rescue Orders
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Show your pickup code or QR pass at the store counter within 2 hours.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveTab('deals')}>
                Browse More Deals
              </Button>
            </div>

            {reservations.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 border border-gray-200 dark:border-neutral-800 text-center text-sm text-gray-500">
                No reservations placed yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reservations.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 flex items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={
                            order.status === 'COLLECTED'
                              ? 'healthy'
                              : order.status === 'HELD'
                                ? 'warning'
                                : 'outline'
                          }
                        >
                          {order.status}
                        </Badge>
                        <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                          {order.code}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                        {order.qty}x {order.productName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {order.shopName} • Total {formatINR(order.qty * order.offerPrice, intlLocale)}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Hold valid until{' '}
                        {new Date(order.holdUntil).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {order.status === 'HELD' && (
                      <div className="bg-white p-2 rounded-xl border border-gray-200 shrink-0">
                        <QrCodeSvg value={`PICKUP:${order.code}:${order.id}`} size={76} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reserve Modal / Pickup Pass Ticket */}
      {selectedOffer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {confirmedTicket ? 'Pickup Pass Ready!' : 'Reserve 2-Hour Counter Hold'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOffer(null)}
                aria-label="Close reserve modal"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!confirmedTicket ? (
              <form onSubmit={handleConfirmReserve} className="p-5 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <span className="text-2xl">{selectedOffer.imageEmoji}</span>
                  <div>
                    <div className="font-bold text-sm text-gray-900 dark:text-white">
                      {selectedOffer.productName}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      {selectedOffer.shopName} ({selectedOffer.computedDistanceKm.toFixed(1)} km
                      away) • {formatINR(selectedOffer.offerPrice, intlLocale)} each
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity (Max {selectedOffer.qtyAvailable})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedOffer.qtyAvailable}
                    value={reserveQty}
                    onChange={(e) =>
                      setReserveQty(
                        Math.max(1, Math.min(selectedOffer.qtyAvailable, Number(e.target.value) || 1))
                      )
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-500">Pay at store counter:</span>
                  <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatINR(selectedOffer.offerPrice * reserveQty, intlLocale)}
                  </span>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOffer(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm 2-Hour Hold
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-5 space-y-4 text-center">
                <div className="mx-auto bg-white p-3 rounded-2xl border border-gray-200 inline-block shadow-xs">
                  <QrCodeSvg value={`PICKUP:${confirmedTicket.code}:${confirmedTicket.id}`} size={136} />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500">Pickup Code</div>
                  <div className="text-2xl font-mono font-extrabold text-emerald-700 dark:text-emerald-400 tracking-wider mt-0.5">
                    {confirmedTicket.code}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                    {confirmedTicket.qty}x {confirmedTicket.productName} reserved at{' '}
                    <strong>{confirmedTicket.shopName}</strong>
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Hold active until{' '}
                    {new Date(confirmedTicket.holdUntil).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    (auto-synced with Shopkeeper Rescue Console)
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOffer(null);
                      setActiveTab('orders');
                    }}
                  >
                    View My Orders
                  </Button>
                  <Button size="sm" onClick={() => setSelectedOffer(null)}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

