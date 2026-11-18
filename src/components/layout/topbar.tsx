'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/navigation';
import {
  Search,
  Bell,
  Menu,
  ClockAlert,
  AlertTriangle,
  Package,
  ArrowRight,
  X,
} from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { daysUntil } from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';

interface TopbarProps {
  onOpenMobileNav: () => void;
  userName?: string;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const tTopbar = useTranslations('topbar');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const { shop, products, batches, aiBasicMode } = useRetailStore();

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const userName = shop.ownerName || 'Ramesh Kumar';
  const intlLocale = locale === 'kn' ? 'kn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const { stockMap, matchingProducts, alerts } = useMemo(() => {
    const stockMap = new Map<string, number>();
    batches.forEach((b) => {
      stockMap.set(b.productId, (stockMap.get(b.productId) ?? 0) + b.qtyOnHand);
    });

    const matches = query.trim()
      ? products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.category.toLowerCase().includes(query.toLowerCase()) ||
              p.sku.toLowerCase().includes(query.toLowerCase()) ||
              p.barcode.includes(query.trim())
          )
          .slice(0, 6)
      : [];

    const expiringAlerts = batches
      .filter((b) => b.qtyOnHand > 0 && daysUntil(b.expiryDate) <= 5)
      .slice(0, 3)
      .map((b) => {
        const p = products.find((pr) => pr.id === b.productId);
        const dLeft = Math.max(0, daysUntil(b.expiryDate));
        return {
          id: b.id,
          kind: 'expiry' as const,
          title: `${p?.name ?? 'Item'} expires in ${dLeft}d`,
          sub: `Batch ${b.batchNo} • ${b.qtyOnHand} units on hand`,
          href: '/expiry',
        };
      });

    const lowStockAlerts = products
      .filter((p) => (stockMap.get(p.id) ?? 0) < p.minStock)
      .slice(0, 2)
      .map((p) => ({
        id: p.id,
        kind: 'low' as const,
        title: `Low stock: ${p.name}`,
        sub: `${stockMap.get(p.id) ?? 0} left (min ${p.minStock})`,
        href: '/inventory',
      }));

    return {
      stockMap,
      matchingProducts: matches,
      alerts: [...expiringAlerts, ...lowStockAlerts],
    };
  }, [batches, products, query]);

  return (
    <header
      ref={containerRef}
      className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs border-b border-gray-200 dark:border-neutral-800 px-4 sm:px-6 flex items-center justify-between transition-colors duration-200"
    >
      {/* Mobile Hamburger & Search Box */}
      <div className="flex items-center gap-3 flex-1 max-w-xl relative">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg focus:outline-hidden"
          aria-label="Open navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Input */}
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="w-4 h-4 text-gray-400 dark:text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchFocused(true);
            }}
            placeholder={tTopbar('searchPlaceholder')}
            className="w-full pl-9 pr-14 py-2 text-sm bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:bg-white dark:focus:bg-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-400 dark:text-neutral-500 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded">
              Ctrl+K
            </kbd>
          )}

          {/* Live Search Popover */}
          {searchFocused && (query.trim().length > 0) && (
            <div className="absolute left-0 right-0 top-12 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xl overflow-hidden z-50">
              {matchingProducts.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {matchingProducts.map((p) => {
                    const qty = stockMap.get(p.id) ?? 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSearchFocused(false);
                          setQuery('');
                          router.push('/inventory');
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-emerald-50/60 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg">{p.imageEmoji}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {p.sku} • {p.category} • {p.barcode}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-bold text-gray-900 dark:text-white block">
                            {formatINR(p.sellingPrice, intlLocale)}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              qty < p.minStock ? 'text-amber-600' : 'text-emerald-600'
                            }`}
                          >
                            {qty} in stock
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  <Package className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                  No matching products found.
                </div>
              )}
              <Link
                href="/inventory"
                onClick={() => setSearchFocused(false)}
                className="block px-3.5 py-2 bg-gray-50 dark:bg-neutral-800/80 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between"
              >
                <span>Open full {tNav('inventory')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Basic Mode badge, Theme Toggle, Language Switcher, Notifications, User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {aiBasicMode && (
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            Basic Mode
          </span>
        )}

        {/* Theme Toggle Bar / Button */}
        <ThemeToggle />

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Notification Bell with red dot */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative p-2 text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg focus:outline-hidden transition-colors"
            aria-label={tTopbar('notifications')}
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full ring-2 ring-white dark:ring-neutral-900 animate-pulse" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {tTopbar('notifications')} ({alerts.length})
                </span>
                <Link
                  href="/expiry"
                  onClick={() => setNotifOpen(false)}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-72 overflow-y-auto">
                {alerts.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/70 transition-colors"
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        a.kind === 'expiry'
                          ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {a.kind === 'expiry' ? (
                        <ClockAlert className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {a.title}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-neutral-800 hidden sm:block" />

        {/* User Avatar Chip */}
        <Link href="/settings" className="flex items-center gap-2.5 pl-1 group">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-semibold flex items-center justify-center text-sm shadow-2xs group-hover:bg-emerald-700 transition-colors">
            {userName.charAt(0)}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">
              {userName}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-neutral-400 leading-none">
              {tTopbar('ownerRole')}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
