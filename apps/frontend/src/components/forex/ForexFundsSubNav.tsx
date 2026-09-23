'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: FOREX_ROUTES.funds, labelKey: 'overview' as const, exact: true },
  { href: FOREX_ROUTES.fundsDeposit, labelKey: 'deposit' as const },
  { href: FOREX_ROUTES.fundsWithdraw, labelKey: 'withdraw' as const },
  { href: FOREX_ROUTES.fundsTransfer, labelKey: 'transfer' as const },
  { href: FOREX_ROUTES.fundsPaymentMethods, labelKey: 'paymentMethods' as const },
  { href: FOREX_ROUTES.fundsHistory, labelKey: 'history' as const },
] as const;

export function ForexFundsSubNav() {
  const pathname = usePathname() ?? '';
  const t = useTranslations('forex.fundsNav');

  return (
    <nav className="flex flex-wrap gap-1.5" aria-label={t('aria')}>
      {ITEMS.map((item) => {
        const exact = 'exact' in item && item.exact;
        const active = exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('eda-tab !normal-case !tracking-normal', active && 'eda-tab-active')}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
