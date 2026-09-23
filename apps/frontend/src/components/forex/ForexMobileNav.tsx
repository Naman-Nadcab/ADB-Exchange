'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { FOREX_MOBILE_NAV, FOREX_ROUTES, isForexTradePath } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';
import { ForexPortalMobileMenu, isForexMobilePortalTabActive } from './ForexPortalMobileMenu';

export function ForexMobileNav() {
  const pathname = usePathname() ?? '';
  const tf = useTranslations('forex');
  const [portalOpen, setPortalOpen] = useState(false);

  return (
    <>
      <nav
        className="flex h-14 shrink-0 items-stretch border-t border-border bg-card md:hidden"
        aria-label={tf('chrome.mobileNavAria')}
      >
        {FOREX_MOBILE_NAV.map((item) => {
          if (item.kind === 'portal') {
            const active = isForexMobilePortalTabActive(pathname);
            return (
              <button
                key="portal"
                type="button"
                onClick={() => setPortalOpen(true)}
                className={cn(
                  'flex min-h-[44px] min-w-0 flex-1 items-center justify-center px-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {tf(item.labelKey)}
              </button>
            );
          }
          const active =
            item.href === FOREX_ROUTES.trade
              ? isForexTradePath(pathname)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[44px] min-w-0 flex-1 items-center justify-center px-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {tf(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <ForexPortalMobileMenu open={portalOpen} onOpenChange={setPortalOpen} />
    </>
  );
}
