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
    <nav className="flex flex-wrap gap-1.5" aria-label="Account sections">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('eda-tab', active && 'eda-tab-active')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
