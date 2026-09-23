'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

/** @deprecated Portal navigation lives in ForexPortalNav (layout). Kept for reference/tests. */
const ITEMS = [
  { href: FOREX_ROUTES.account, labelKey: 'accountNav.overview' as const },
  { href: FOREX_ROUTES.accounts, labelKey: 'accountNav.accounts' as const },
  { href: FOREX_ROUTES.funds, labelKey: 'accountNav.funds' as const },
  { href: FOREX_ROUTES.ledger, labelKey: 'accountNav.ledger' as const },
] as const;

export function ForexAccountNav() {
  const pathname = usePathname() ?? '';
  const tf = useTranslations('forex');
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label={tf('accountNav.sectionsAria')}>
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('eda-tab', active && 'eda-tab-active')}
          >
            {tf(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
