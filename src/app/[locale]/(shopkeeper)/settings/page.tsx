import { setRequestLocale } from 'next-intl/server';
import { locales } from '@/navigation';
import { SettingsView } from '@/components/settings/settings-view';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function SettingsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <SettingsView />;
}

