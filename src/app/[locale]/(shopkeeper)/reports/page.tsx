import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { ReportsView } from '@/components/reports/reports-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function ReportsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ReportsView />;
}

