import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { BillingView } from '@/components/billing/billing-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function BillingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <BillingView />;
}

