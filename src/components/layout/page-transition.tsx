'use client';

import React from 'react';
import { usePathname } from '@/navigation';

/**
 * Replays a fade + slide-up animation whenever the route changes.
 * Keying on the pathname forces a remount on navigation, which
 * restarts the CSS animation defined in globals.css (.page-enter).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
