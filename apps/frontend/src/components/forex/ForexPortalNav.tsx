'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { FOREX_PORTAL_NAV, isForexPortalNavActive } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';

export function ForexPortalNav() {
  const pathname = usePathname() ?? '';
  const tf = useTranslations('forex');

  return (
    <nav
      className="sticky top-12 z-30 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm"
      aria-label={tf('portalNav.sectionsAria')}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-1.5 overflow-x-auto px-3 py-2 sm:px-4">
        {FOREX_PORTAL_NAV.map((item) => {
          const exact = 'exact' in item && item.exact;
          const active = isForexPortalNavActive(pathname, item.href, exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('eda-tab shrink-0 !normal-case !tracking-normal', active && 'eda-tab-active')}
            >
              {tf(item.labelKey)}
            </Link>
          );
        })}
        <div className="ml-auto shrink-0 sm:hidden">
          <ForexAccountSwitcher compact />
        </div>
      </div>
    </nav>
  );
}
