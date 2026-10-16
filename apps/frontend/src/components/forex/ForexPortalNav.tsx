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
      <div className="mx-auto flex max-w-[1400px] items-stretch px-1 sm:px-2">
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {FOREX_PORTAL_NAV.map((item) => {
            const exact = 'exact' in item && item.exact;
            const active = isForexPortalNavActive(pathname, item.href, exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:h-11',
                  active && 'border-primary text-primary'
                )}
              >
                {tf(item.labelKey)}
              </Link>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center pr-1 sm:hidden">
          <ForexAccountSwitcher compact />
        </div>
      </div>
    </nav>
  );
}
