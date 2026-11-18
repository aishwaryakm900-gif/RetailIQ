import React from 'react';

export default function ShopkeeperLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 dark:bg-neutral-800 rounded-xl" />
          <div className="h-4 w-96 max-w-full bg-gray-100 dark:bg-neutral-800/60 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-200 dark:bg-neutral-800 rounded-xl" />
          <div className="h-9 w-32 bg-gray-200 dark:bg-neutral-800 rounded-xl" />
        </div>
      </div>

      {/* 4 Stat Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-100 dark:border-neutral-800 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-800 rounded" />
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800" />
            </div>
            <div className="h-7 w-20 bg-gray-200 dark:bg-neutral-800 rounded-md" />
            <div className="h-3 w-32 bg-gray-100 dark:bg-neutral-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Main content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-100 dark:border-neutral-800 shadow-xs space-y-4">
          <div className="h-5 w-48 bg-gray-200 dark:bg-neutral-800 rounded" />
          <div className="h-60 w-full bg-gray-100 dark:bg-neutral-800/50 rounded-xl" />
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-gray-100 dark:border-neutral-800 shadow-xs space-y-4">
          <div className="h-5 w-36 bg-gray-200 dark:bg-neutral-800 rounded" />
          <div className="space-y-3">
            <div className="h-16 w-full bg-gray-100 dark:bg-neutral-800/50 rounded-xl" />
            <div className="h-16 w-full bg-gray-100 dark:bg-neutral-800/50 rounded-xl" />
            <div className="h-16 w-full bg-gray-100 dark:bg-neutral-800/50 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

