'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Store,
  MapPin,
  Cpu,
  Bell,
  MessageSquareText,
  Globe,
  RotateCcw,
  Save,
  ShieldCheck,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { toast } from 'sonner';

export function SettingsView() {
  const tNav = useTranslations('nav');
  const {
    shop,
    aiBasicMode,
    assistantEnabled,
    notificationsEnabled,
    updateShopSettings,
    resetDemoData,
  } = useRetailStore();

  const [name, setName] = useState(shop.name);
  const [ownerName, setOwnerName] = useState(shop.ownerName);
  const [phone, setPhone] = useState(shop.phone);
  const [address, setAddress] = useState(shop.address);
  const [defaultRadiusM, setDefaultRadiusM] = useState(shop.defaultRadiusM);
  const [lat, setLat] = useState(shop.lat);
  const [lng, setLng] = useState(shop.lng);
  const [geoUpdated, setGeoUpdated] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ownerName.trim()) {
      toast.error('Shop name and owner name are required.');
      return;
    }
    updateShopSettings({
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      defaultRadiusM,
      lat,
      lng,
    });
    toast.success('Store profile settings saved.');
  };

  const handleDetectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.info('Browser geolocation is unavailable.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setGeoUpdated(true);
        toast.success('Updated store pin from browser GPS (Click Save Profile to apply).');
      },
      () => {
        toast.info('Location permission declined; keeping current store coordinates.');
      },
      { timeout: 5000 }
    );
  };

  const handleResetDemo = () => {
    resetDemoData();
    toast.success('Store reset to fresh 48-SKU RetailIQ demo dataset.');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {tNav('settings')} &amp; Preferences
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure store details, discovery radius, language, appearance, and AI fallback modes.
        </p>
      </div>

      {/* Store Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-neutral-900 rounded-card p-6 border border-surface-border dark:border-neutral-800 shadow-card space-y-5"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Kirana Store Profile
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Appears on invoices, receipts, and WhatsApp offer shares
              </p>
            </div>
          </div>

          <Badge variant="healthy">Store ID: {shop.id}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Shop Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Owner Name
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Store Phone / WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Store Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Store location pin configured (customer UI displays only rounded distances per Rule
              R7)
              {geoUpdated && (
                <strong className="text-emerald-700 dark:text-emerald-400 ml-1">
                  • Updated via GPS
                </strong>
              )}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDetectLocation}
            className="gap-1.5 shrink-0"
          >
            <Navigation className="w-3.5 h-3.5" />
            Detect Store Location
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="sm" className="gap-1.5">
            <Save className="w-4 h-4" />
            Save Profile Changes
          </Button>
        </div>
      </form>

      {/* Appearance & Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Language &amp; Theme Mode
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Interface Language
              </span>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Color Theme
              </span>
              <ThemeToggle showLabels />
            </div>
          </div>
        </div>

        {/* AI, Assistant & Notifications Toggles */}
        <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card space-y-3.5">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Automation, Alerts &amp; AI Modes
          </h2>

          <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gray-100 dark:border-neutral-800 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <MessageSquareText className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  Store Assistant Widget
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  Read-only EN/KN/HI natural language assistant (Rule R4)
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={assistantEnabled}
              onChange={(e) => {
                updateShopSettings({ assistantEnabled: e.target.checked });
                toast.success(
                  e.target.checked ? 'Store Assistant enabled' : 'Store Assistant hidden'
                );
              }}
              className="h-4 w-4 text-emerald-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gray-100 dark:border-neutral-800 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  Basic Mode (Moving Avg Fallback)
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  Switch forecast engine to conservative 7-day moving average
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={aiBasicMode}
              onChange={(e) => {
                updateShopSettings({ aiBasicMode: e.target.checked });
                toast.info(e.target.checked ? 'Switched to Basic Mode fallback' : 'AI model restored');
              }}
              className="h-4 w-4 text-emerald-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gray-100 dark:border-neutral-800 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  Near-Expiry &amp; Low Stock Alerts
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  Show live badge count &amp; alert popover in top navigation
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => updateShopSettings({ notificationsEnabled: e.target.checked })}
              className="h-4 w-4 text-emerald-600 rounded"
            />
          </label>
        </div>
      </div>

      {/* Rules Summary & Demo Reset */}
      <div className="bg-white dark:bg-neutral-900 rounded-card p-5 border border-surface-border dark:border-neutral-800 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Active Business Safeguards (Rules R1–R8)
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              FEFO deductions, purchase-price discount floor, category safety withdrawal dates,
              confirmation previews, and role-scoped customer distances are enforced across all
              views.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleResetDemo}
          className="gap-1.5 shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Demo Data
        </Button>
      </div>
    </div>
  );
}

