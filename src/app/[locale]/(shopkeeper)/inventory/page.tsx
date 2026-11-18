import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { InventoryView } from '@/components/inventory/inventory-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function InventoryPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <InventoryView />;
}

