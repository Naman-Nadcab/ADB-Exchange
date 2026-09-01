'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FOREX_MOBILE_NAV, FOREX_ROUTES, isForexTradePath } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

export function ForexMobileNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className="flex h-14 shrink-0 items-stretch border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-[#0e1012] md:hidden"
      aria-label="Forex mobile"
    >
      {FOREX_MOBILE_NAV.map((item) => {
        const active = item.href === FOREX_ROUTES.trade ? isForexTradePath(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-h-[44px] min-w-0 flex-1 items-center justify-center px-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-400',
              active ? 'text-stone-900 dark:text-white' : 'text-stone-500'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
