'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { EdaProductSwitcher } from '@/components/eda/EdaProductSwitcher';
import { FOREX_ROUTES, FOREX_TOP_NAV, isForexTradePath } from '@/lib/forex/routes';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';
import { ForexPortalUserMenu } from './ForexPortalUserMenu';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ForexConnectionStatus } from './ForexConnectionStatus';
import { LocaleLanguageSelector } from '@/components/i18n/LocaleLanguageSelector';

export function ForexTopNav(props?: { compact?: boolean }) {
  const pathname = usePathname() ?? '';
  const compact = Boolean(props?.compact);
  const tf = useTranslations('forex');

  return (
    <header className="mobile-app-topbar sticky top-0 z-40 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className={cn('flex items-center gap-2 px-2', compact ? 'h-10' : 'h-12 gap-3 px-3')}>
        <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
        <EdaProductSwitcher variant="terminal" />
        <nav
          className={cn(
            'hidden min-w-0 flex-1 items-center overflow-x-auto md:flex',
            compact ? 'gap-0.5' : 'gap-1'
          )}
          aria-label={tf('chrome.terminalNavAria')}
        >
          {FOREX_TOP_NAV.map((item) => {
            const active =
              item.href === FOREX_ROUTES.trade
                ? isForexTradePath(pathname)
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href + item.labelKey}
                href={item.href}
                className={cn(
                  'inline-flex items-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  compact
                    ? 'rounded px-2 py-1 text-[12px]'
                    : 'tap-target rounded-lg px-2.5 py-1.5 text-sm focus-visible:ring-offset-1',
                  active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tf(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          {!compact ? (
            <>
              <div className="hidden min-w-0 sm:block">
                <ForexAccountSwitcher />
              </div>
              <ForexPortalUserMenu />
            </>
          ) : null}
          {compact ? (
            <span className="hidden font-mono text-[9px] uppercase tracking-wide text-amber-200/90 sm:inline">
              {tf('chrome.demoSimulated')}
            </span>
          ) : (
            <span className="hidden font-mono text-[9px] uppercase tracking-wide text-muted-foreground sm:inline">
              {tf('chrome.simulated')}
            </span>
          )}
          <LocaleLanguageSelector variant="compact" />
          <ForexConnectionStatus />
          {!compact ? <ThemeToggle size="sm" /> : null}
        </div>
      </div>
    </header>
  );
}
