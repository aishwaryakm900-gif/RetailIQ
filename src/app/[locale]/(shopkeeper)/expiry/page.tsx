import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { ExpiryView } from '@/components/expiry/expiry-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function ExpiryPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ExpiryView />;
}

