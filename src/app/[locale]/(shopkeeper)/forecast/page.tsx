import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { ForecastView } from '@/components/forecast/forecast-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function ForecastPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ForecastView />;
}

