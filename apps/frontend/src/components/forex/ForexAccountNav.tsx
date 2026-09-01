'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: FOREX_ROUTES.account, label: 'Overview' },
  { href: FOREX_ROUTES.funds, label: 'Funds' },
  { href: FOREX_ROUTES.ledger, label: 'Ledger' },
  { href: FOREX_ROUTES.portfolio, label: 'Portfolio' },
] as const;

export function ForexAccountNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Account sections">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
              active ? 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-white' : 'text-stone-500 hover:text-stone-900'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
