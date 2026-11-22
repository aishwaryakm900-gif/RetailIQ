import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

// Top-level root layout required by Next.js App Router for root error/not-found pages.
// Segment-specific <html>/<body> tags are managed in src/app/[locale]/layout.tsx.
export default function RootLayout({ children }: Props) {
  return children;
}
