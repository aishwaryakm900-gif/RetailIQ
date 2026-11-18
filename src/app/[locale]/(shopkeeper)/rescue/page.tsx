import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { ShopkeeperRescueView } from '@/components/rescue/shopkeeper-rescue-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function RescueConsolePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ShopkeeperRescueView />;
}

