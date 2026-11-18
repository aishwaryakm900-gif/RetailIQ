import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { DiscountsView } from '@/components/discounts/discounts-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function DiscountsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <DiscountsView />;
}

