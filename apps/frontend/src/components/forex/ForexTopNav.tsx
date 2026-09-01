'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { FOREX_NAV, FOREX_ROUTES } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';
import { ForexConnectionStatus } from './ForexConnectionStatus';

export function ForexTopNav() {
  const pathname = usePathname() ?? '';

  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-stone-200 bg-white px-3 dark:border-stone-800 dark:bg-[#0e1012]">
      <Link
        href={FOREX_ROUTES.trade}
        className="shrink-0 font-semibold tracking-[0.14em] text-stone-900 dark:text-stone-100"
      >
        EDA FOREX
      </Link>
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Forex terminal">
        {FOREX_NAV.map((item) => {
          const active =
            item.href === FOREX_ROUTES.trade
              ? pathname === FOREX_ROUTES.trade
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                'rounded px-2.5 py-1 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
                active
                  ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <span className="hidden text-[10px] font-mono uppercase tracking-wider text-stone-400 sm:inline">
        Simulated · Mock LP
      </span>
      <ForexConnectionStatus />
      <ThemeToggle size="sm" />
    </header>
  );
}
