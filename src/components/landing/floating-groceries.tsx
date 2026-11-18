import React from 'react';
import {
  Apple,
  Banana,
  Carrot,
  Milk,
  Egg,
  Wheat,
  Citrus,
  Grape,
  Cherry,
  Croissant,
  Coffee,
  Candy,
  type LucideIcon,
} from 'lucide-react';

type GroceryItem = {
  Icon: LucideIcon;
  /** Position within the hero section, in percent. */
  top: string;
  left: string;
  size: number;
  /** Slow drift cycle length. */
  duration: string;
  /** Stagger so items don't bob in sync. */
  delay: string;
  className: string;
  /** Hide on small screens to keep the hero uncluttered. */
  hideOnMobile?: boolean;
};

// Well-spaced around the hero's flanks and edges — the centered
// headline/CTA area (roughly 20–80% horizontal, 20–70% vertical)
// is intentionally left clear so nothing sits behind the text.
const GROCERY_ITEMS: GroceryItem[] = [
  // Left flank
  { Icon: Apple, top: '12%', left: '6%', size: 30, duration: '7s', delay: '0s', className: 'text-emerald-600/20 dark:text-emerald-400/25', hideOnMobile: true },
  { Icon: Milk, top: '34%', left: '12%', size: 26, duration: '9s', delay: '1.2s', className: 'text-blue-600/15 dark:text-blue-400/20', hideOnMobile: true },
  { Icon: Carrot, top: '58%', left: '7%', size: 28, duration: '8s', delay: '2.4s', className: 'text-amber-600/20 dark:text-amber-400/25', hideOnMobile: true },
  { Icon: Wheat, top: '82%', left: '13%', size: 24, duration: '10s', delay: '0.6s', className: 'text-emerald-600/15 dark:text-emerald-400/20', hideOnMobile: true },
  // Right flank
  { Icon: Banana, top: '10%', left: '90%', size: 28, duration: '8.5s', delay: '0.8s', className: 'text-amber-600/20 dark:text-amber-400/25', hideOnMobile: true },
  { Icon: Croissant, top: '36%', left: '94%', size: 26, duration: '9.5s', delay: '2s', className: 'text-emerald-600/20 dark:text-emerald-400/25', hideOnMobile: true },
  { Icon: Grape, top: '60%', left: '89%', size: 26, duration: '7.5s', delay: '1.5s', className: 'text-purple-600/15 dark:text-purple-400/20', hideOnMobile: true },
  { Icon: Cherry, top: '84%', left: '93%', size: 24, duration: '10.5s', delay: '3s', className: 'text-red-600/15 dark:text-red-400/20', hideOnMobile: true },
  // Top edge, flanking the badge
  { Icon: Citrus, top: '6%', left: '28%', size: 24, duration: '9s', delay: '0.4s', className: 'text-emerald-600/15 dark:text-emerald-400/20', hideOnMobile: true },
  { Icon: Coffee, top: '5%', left: '70%', size: 24, duration: '8s', delay: '1.8s', className: 'text-amber-700/15 dark:text-amber-400/20', hideOnMobile: true },
  // Bottom edge, below the KPI pills
  { Icon: Egg, top: '94%', left: '32%', size: 22, duration: '11s', delay: '1s', className: 'text-emerald-600/15 dark:text-emerald-400/20', hideOnMobile: true },
  { Icon: Candy, top: '92%', left: '66%', size: 22, duration: '9.5s', delay: '2.6s', className: 'text-pink-600/15 dark:text-pink-400/20', hideOnMobile: true },
  // A couple visible on mobile, tucked into the corners
  { Icon: Apple, top: '4%', left: '10%', size: 22, duration: '8s', delay: '0.5s', className: 'text-emerald-600/15 dark:text-emerald-400/20' },
  { Icon: Cherry, top: '90%', left: '88%', size: 22, duration: '9s', delay: '2.2s', className: 'text-red-600/15 dark:text-red-400/20' },
];

/**
 * Decorative layer of small grocery icons that drift gently behind the
 * section content. Pure CSS animation (see .animate-float-drift in
 * globals.css) — no client JS. Non-interactive and behind the text.
 *
 * Use `mirror` on alternating sections to flip the layout horizontally,
 * so consecutive sections don't look like a copy-paste of each other.
 */
export function FloatingGroceries({ mirror = false }: { mirror?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {GROCERY_ITEMS.map(({ Icon, top, left, size, duration, delay, className, hideOnMobile }, i) => {
        const finalLeft = mirror ? `${100 - parseFloat(left)}%` : left;
        return (
          <div
            key={i}
            className={`absolute animate-float-drift ${hideOnMobile ? 'hidden sm:block' : ''} ${className}`}
            style={
              {
                top,
                left: finalLeft,
                '--float-duration': duration,
                '--float-delay': delay,
              } as React.CSSProperties
            }
          >
            <Icon style={{ width: size, height: size }} strokeWidth={1.75} />
          </div>
        );
      })}
    </div>
  );
}
