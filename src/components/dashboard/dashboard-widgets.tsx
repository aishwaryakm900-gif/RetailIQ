'use client';

import React from 'react';
import { Link } from '@/navigation';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTone = 'default' | 'warning' | 'danger';

export interface KpiItem {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: KpiTone;
}

const kpiToneClasses: Record<KpiTone, string> = {
  default: 'text-gray-900 dark:text-white',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <section className="overflow-hidden rounded-card border border-gray-200 bg-white shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <div className="grid grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                'border-gray-100 p-4 dark:border-neutral-800 sm:p-5',
                index < 2 && 'border-b',
                index % 2 === 0 && 'border-r',
                index === 1 && 'xl:border-r',
                'xl:border-b-0'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {item.label}
                </p>
                <Icon
                  className="h-4 w-4 shrink-0 text-gray-400 dark:text-neutral-500"
                  aria-hidden="true"
                />
              </div>
              <p
                className={cn(
                  'mt-2 text-xl font-semibold leading-tight tracking-tight tabular-nums sm:text-2xl',
                  kpiToneClasses[item.tone ?? 'default']
                )}
              >
                {item.value}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                {item.hint}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-card border border-gray-200 bg-white shadow-card dark:border-neutral-800 dark:bg-neutral-900',
        className
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-5 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type StatusPillTone = 'success' | 'warning' | 'danger' | 'neutral';

const pillToneClasses: Record<StatusPillTone, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400',
  neutral:
    'border-gray-200 bg-gray-50 text-gray-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-gray-300',
};

export function StatusPill({
  tone,
  children,
}: {
  tone: StatusPillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        pillToneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[170px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/40 p-5 text-center dark:border-neutral-800 dark:bg-neutral-950/30',
        className
      )}
    >
      <Icon className="h-5 w-5 text-gray-400 dark:text-neutral-500" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {description}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full rounded-lg bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-neutral-800/60" />
          <div className="h-4 w-64 max-w-full rounded bg-gray-100 dark:bg-neutral-800/60" />
        </div>
        <div className="h-9 w-full rounded-lg bg-gray-200 dark:bg-neutral-800 sm:w-56" />
      </div>

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="space-y-3 border-gray-100 p-5 dark:border-neutral-800 [&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r"
            >
              <div className="h-3 w-24 rounded bg-gray-200 dark:bg-neutral-800" />
              <div className="h-7 w-24 rounded bg-gray-200 dark:bg-neutral-800" />
              <div className="h-3 w-20 rounded bg-gray-100 dark:bg-neutral-800/60" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-neutral-800" />
        <div className="mt-2 h-3 w-64 rounded bg-gray-100 dark:bg-neutral-800/60" />
        <div className="mt-5 space-y-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-14 w-full rounded-lg bg-gray-100 dark:bg-neutral-800/50" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-card border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 xl:col-span-2">
          <div className="h-5 w-40 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="mt-2 h-3 w-52 rounded bg-gray-100 dark:bg-neutral-800/60" />
          <div className="mt-5 h-60 w-full rounded-lg bg-gray-100 dark:bg-neutral-800/50" />
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="h-5 w-36 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="mt-2 h-3 w-44 rounded bg-gray-100 dark:bg-neutral-800/60" />
          <div className="mt-5 space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-28 rounded bg-gray-200 dark:bg-neutral-800" />
                <div className="h-3 w-full rounded bg-gray-100 dark:bg-neutral-800/60" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-neutral-800" />
        <div className="mt-5 h-60 w-full rounded-lg bg-gray-100 dark:bg-neutral-800/50" />
      </div>
    </div>
  );
}
