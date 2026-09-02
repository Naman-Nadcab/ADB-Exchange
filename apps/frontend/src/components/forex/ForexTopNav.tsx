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

export function ForexTopNav(props?: { compact?: boolean }) {
  const pathname = usePathname() ?? '';
  const compact = Boolean(props?.compact);

  return (
    <header className="mobile-app-topbar sticky top-0 z-40 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className={cn('flex items-center gap-2 px-2', compact ? 'h-9' : 'h-12 gap-3 px-3')}>
        <BrandLogo variant="horizontal-gold" size={compact ? 'icon' : 'header'} href={ROUTES.home} />
        <EdaProductSwitcher variant="terminal" />
        <nav
          className={cn(
            'hidden min-w-0 flex-1 items-center overflow-x-auto md:flex',
            compact ? 'gap-0.5' : 'gap-1'
          )}
          aria-label="Forex terminal"
        >
          {FOREX_NAV.map((item) => {
            const active =
              item.href === FOREX_ROUTES.trade
                ? isForexTradePath(pathname)
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'inline-flex items-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  compact
                    ? 'rounded px-2 py-1 text-[12px]'
                    : 'tap-target rounded-lg px-2.5 py-1.5 text-sm focus-visible:ring-offset-1',
                  active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {compact ? (
            <span className="hidden font-mono text-[9px] uppercase tracking-wide text-amber-200/90 sm:inline">
              SIMULATED · MOCK
            </span>
          ) : (
            <span className="hidden font-mono text-[9px] uppercase tracking-wide text-muted-foreground sm:inline">
              SIMULATED
            </span>
          )}
          <ForexConnectionStatus />
          {!compact ? <ThemeToggle size="sm" /> : null}
        </div>
      </div>
    </header>
  );
}
