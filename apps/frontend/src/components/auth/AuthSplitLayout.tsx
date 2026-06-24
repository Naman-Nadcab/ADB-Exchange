'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DollarSign, Users, Coins } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ROUTES } from '@/lib/routes';
import { BrandLogo } from '@/components/brand/BrandLogo';

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
  const [cookiesAccepted, setCookiesAccepted] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Brand panel (desktop) */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden bg-gradient-to-br from-muted via-card to-card p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} className="relative" />
        <div className="relative flex-1 flex flex-col items-center justify-center py-8">
          <BrandLogo variant="marketing" size="marketing" priority className="relative mb-10" />
          <h1 className="text-3xl xl:text-4xl font-semibold text-foreground leading-tight mb-3 text-center max-w-md">
            Trade crypto with <span className="text-primary">confidence</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-12 max-w-sm text-center">
            Secure spot trading and P2P — built for speed and reliability.
          </p>
          <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
            {[
              { icon: DollarSign, label: 'Fiat', value: 'Coming Soon', sub: 'Fiat rails in rollout' },
              { icon: Users, label: 'Security', value: '2FA + sessions', sub: 'Account protection' },
              { icon: Coins, label: 'Spot markets', value: 'Live pairs', sub: 'From exchange API' },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="group">
                <div className="w-11 h-11 rounded-xl bg-card/5 border border-white/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:border-primary/30 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-muted-foreground text-xs">© 2018-2026 Metherium. All rights reserved.</p>
      </div>

      {/* Right - Form area */}
      <div className="flex-1 flex flex-col bg-card dark:bg-background min-w-0">
        <div className="flex items-center justify-between p-5 lg:p-6">
          <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} className="lg:hidden" />
          <div className="ml-auto flex items-center gap-2">
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
                We use cookies. <Link href={ROUTES.cookies} className="text-primary hover:underline">Cookie Policy</Link>
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
