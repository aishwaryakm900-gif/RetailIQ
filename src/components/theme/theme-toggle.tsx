'use client';

import React from 'react';
import { useTheme } from './theme-context';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ThemeToggle({ showLabels = false }: { showLabels?: boolean }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const t = useTranslations('theme');

  if (showLabels) {
    return (
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium">
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
            theme === 'light'
              ? 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold'
              : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          aria-label={t('light')}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{t('light')}</span>
        </button>

        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
            theme === 'dark'
              ? 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold'
              : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          aria-label={t('dark')}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>{t('dark')}</span>
        </button>

        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
            theme === 'system'
              ? 'bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold'
              : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
          }`}
          aria-label={t('system')}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>{t('system')}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent p-2 text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-100 hover:text-gray-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white"
      aria-label={t('toggle')}
      title={t('toggle')}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-90" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
      <span className="hidden text-xs font-semibold sm:inline">
        {resolvedTheme === 'dark' ? t('dark') : t('light')}
      </span>
    </button>
  );
}

