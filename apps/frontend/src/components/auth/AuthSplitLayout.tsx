'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CandlestickChart, LineChart, Shield } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { LocaleLanguageSelector } from '@/components/i18n/LocaleLanguageSelector';
import { ROUTES } from '@/lib/routes';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useTranslations } from 'next-intl';

/** Shared auth layout — marketing logo on login/signup, brand panel on desktop. */
export default function AuthSplitLayout({
  children,
  showCookieBanner = true,
  showMarketingLogo = false,
}: {
  children: React.ReactNode;
  showCookieBanner?: boolean;
  /** Centered marketing logo above the form (login / signup). */
  showMarketingLogo?: boolean;
}) {
  const tm = useTranslations('auth.marketing');
  const [cookiesAccepted, setCookiesAccepted] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Brand panel (desktop) */}
      <div className="hidden lg:flex lg:w-[44%] relative overflow-hidden bg-gradient-to-br from-muted via-card to-card p-8 xl:p-10 flex-col justify-between">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} className="relative" />
        <div className="relative flex w-full max-w-md flex-col justify-center py-6">
          <h1 className="text-3xl font-semibold leading-tight text-foreground xl:text-[2rem]">
            {tm('headline', { highlight: tm('headlineHighlight') })}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {tm('subhead')}
          </p>
          <div className="mt-6 grid gap-2.5">
            {[
              { href: ROUTES.tradeSpot, icon: CandlestickChart, labelKey: 'spotLabel' as const, valueKey: 'spotValue' as const, subKey: 'spotSub' as const },
              { href: FOREX_ROUTES.root, icon: LineChart, labelKey: 'forexLabel' as const, valueKey: 'forexValue' as const, subKey: 'forexSub' as const },
              { href: ROUTES.dashboard.security, icon: Shield, labelKey: 'securityLabel' as const, valueKey: 'securityValue' as const, subKey: 'securitySub' as const },
            ].map(({ href, icon: Icon, labelKey, valueKey, subKey }) => (
              <Link
                key={labelKey}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card/70 px-3 py-3 transition-colors hover:border-primary/40 hover:bg-primary/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{tm(labelKey)}</p>
                  <p className="text-sm font-semibold text-foreground">{tm(valueKey)}</p>
                  <p className="truncate text-xs text-muted-foreground">{tm(subKey)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted-foreground">{tm('copyright')}</p>
      </div>

      {/* Right - Form area */}
      <div className="flex-1 flex flex-col bg-card dark:bg-background min-w-0">
        <div className="flex items-center justify-between p-5 lg:p-6">
          <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} className="lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <LocaleLanguageSelector variant="compact" />
            <ThemeToggle variant="icon" size="sm" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-5 lg:px-8 py-6">
          <div className="w-full max-w-[420px]">
            {showMarketingLogo ? (
              <div className="mb-8 flex justify-center lg:hidden">
                <BrandLogo variant="marketing" size="marketing" priority />
              </div>
            ) : null}
            {children}
          </div>
        </div>
        {showCookieBanner && !cookiesAccepted && (
          <div className="p-4 border-t border-border bg-gray-50/50 dark:bg-background">
            <div className="flex items-center justify-between max-w-4xl mx-auto gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                We use cookies. <Link href={ROUTES.cookies} className="text-primary underline underline-offset-2 hover:underline">Cookie Policy</Link>
              </p>
              <button type="button" onClick={() => setCookiesAccepted(true)} className="px-4 py-2 rounded-lg bg-accent text-foreground/80 text-sm font-medium hover:bg-gray-300 dark:hover:bg-accent transition-colors">
                Accept All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
