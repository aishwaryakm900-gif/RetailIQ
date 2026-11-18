import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function DashboardPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <DashboardView />;
}
