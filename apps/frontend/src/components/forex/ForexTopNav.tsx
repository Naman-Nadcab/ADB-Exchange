'use client';

import Link from 'next/link';
import { useState } from 'react';
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
  const [pagesOpen, setPagesOpen] = useState(false);

  return (
    <header className="mobile-app-topbar sticky top-0 z-40 shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className={cn('flex min-w-0 items-center gap-2 px-2', compact ? 'h-10' : 'h-12 gap-2 px-3')}>
        <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />
        <div className="shrink-0">
          <EdaProductSwitcher variant="terminal" />
        </div>
        {compact ? (
          <div
            className="relative hidden md:block"
            onMouseLeave={() => setPagesOpen(false)}
          >
            <button
              type="button"
              className="rounded px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={pagesOpen}
              aria-label={tf('chrome.terminalNavAria')}
              onClick={() => setPagesOpen((open) => !open)}
            >
              {tf('chrome.pagesMenu')}
            </button>
            {pagesOpen ? (
              <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[160px] border border-border bg-card py-1 shadow-lg">
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
                        'block px-2.5 py-1 text-[12px] font-medium',
                        active ? 'text-primary' : 'text-foreground hover:bg-muted'
                      )}
                      onClick={() => setPagesOpen(false)}
                    >
                      {tf(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <nav
            className="hidden min-w-[13rem] flex-1 items-center gap-1 overflow-x-auto md:flex"
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
                    'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tf(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {compact ? (
            <ForexPortalUserMenu compact />
          ) : (
            <>
              <div className="hidden sm:block">
                <ForexAccountSwitcher compact />
              </div>
              <ForexPortalUserMenu />
              <span className="hidden font-mono text-[9px] uppercase tracking-wide text-muted-foreground xl:inline">
                {tf('chrome.simulated')}
              </span>
            </>
          )}
          <LocaleLanguageSelector variant="compact" compactFrom="xl" />
          <ForexConnectionStatus />
          {!compact ? <ThemeToggle size="sm" /> : null}
        </div>
      </div>
    </header>
  );
}
