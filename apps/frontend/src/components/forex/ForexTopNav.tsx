'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { EdaProductSwitcher } from '@/components/eda/EdaProductSwitcher';
import { FOREX_NAV, FOREX_ROUTES, isForexTradePath } from '@/lib/forex/routes';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ForexConnectionStatus } from './ForexConnectionStatus';

export function ForexTopNav() {
  const pathname = usePathname() ?? '';

  return (
    <header className="mobile-app-topbar sticky top-0 z-40 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 px-3">
        <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
        <EdaProductSwitcher variant="terminal" />
        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex" aria-label="Forex terminal">
          {FOREX_NAV.map((item) => {
            const active = item.href === FOREX_ROUTES.trade ? isForexTradePath(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'tap-target inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ForexConnectionStatus />
          <ThemeToggle size="sm" />
        </div>
      </div>
    </header>
  );
}
