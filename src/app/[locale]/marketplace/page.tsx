import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { CustomerMarketplaceView } from '@/components/marketplace/customer-marketplace-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function MarketplacePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <CustomerMarketplaceView />;
}

