'use client';

import Link from 'next/link';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { SPOT_TRADE_HREF } from '@/lib/routes';
import { cn } from '@/lib/utils';

export function ForexProductSwitcher() {
  return (
    <nav aria-label="Product" className="inline-flex items-center gap-0.5 rounded border border-stone-200 p-0.5 dark:border-stone-700">
      <Link
        href={SPOT_TRADE_HREF}
        className="rounded px-2 py-1 text-[11px] font-medium text-stone-500 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:hover:text-stone-100"
      >
        Crypto Spot
      </Link>
      <Link
        href={FOREX_ROUTES.root}
        aria-current="page"
        className={cn(
          'rounded bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:bg-stone-800 dark:text-white'
        )}
      >
        Forex
      </Link>
    </nav>
  );
}
