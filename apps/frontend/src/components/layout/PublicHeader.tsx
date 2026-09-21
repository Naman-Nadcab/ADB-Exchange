'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, Wallet, ClipboardList, User as UserIcon, LogOut, LayoutDashboard, Shield, ChevronDown } from 'lucide-react';
import { ROUTES, SPOT_TRADE_HREF, WALLET_HREF, ORDERS_HREF, walletPath } from '@/lib/routes';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';
import { performLogout } from '@/lib/authLogout';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { EdaProductSwitcher } from '@/components/eda/EdaProductSwitcher';
import { LocaleLanguageSelector } from '@/components/i18n/LocaleLanguageSelector';
import { useTranslations } from 'next-intl';

/**
 * Global top header for public-viewable feature routes (markets, earn, p2p, trade).
 * Auth-aware: logged-out shows Log in / Register; logged-in shows the user actions
 * (Wallet / Orders / account menu) so the "Log in" button never leaks into an
 * authenticated session. Keeps the dark marketing palette for visual continuity.
 */
export function PublicHeader() {
  const tn = useTranslations('navigation');
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const { user, _hasHydrated, isAuthenticated } = useAuthStore();
  const authed = _hasHydrated && isAuthenticated;

  useEffect(() => {
    if (!userOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [userOpen]);

  const handleLogout = async () => {
    setUserOpen(false);
    await performLogout('/');
  };

  const maskEmail = (email: string) => {
    if (!email) return '***@****';
    const [local, domain] = email.split('@');
    if (!domain) return '***@****';
    return `${local.slice(0, 3)}**@****`;
  };

  return (
    <header className="mobile-app-topbar sticky top-0 z-50 overflow-x-clip border-b border-[#F5B8001F] bg-[#05070B]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1320px] min-w-0 items-center justify-between px-3 py-3.5 sm:px-6 lg:px-8">
        <BrandLogo
          variant="horizontal-gold"
          size="header"
          href={ROUTES.home}
        />

        <nav className="hidden min-w-0 items-center gap-5 overflow-x-clip text-sm text-[#9CA3AF] lg:flex" aria-label="Primary">
          {authed ? (
            <>
              <EdaProductSwitcher />
              <Link href={ROUTES.home} prefetch className="tap-target inline-flex items-center transition hover:text-white">{tn('overview')}</Link>
              <Link href={ROUTES.markets} prefetch className="tap-target inline-flex items-center transition hover:text-white">{tn('markets')}</Link>
              <div className="relative shrink-0 group">
                <button type="button" className="tap-target inline-flex items-center transition hover:text-white" aria-haspopup="true">
                  {tn('trade')}
                </button>
                <div className="invisible absolute left-0 top-full z-40 mt-1 w-56 max-w-[min(14rem,calc(100vw-2rem))] rounded-lg border border-[#F5B8001F] bg-[#0D1118] py-1 opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <Link href={SPOT_TRADE_HREF} className="block px-3 py-2 hover:bg-white/5 hover:text-white">
                    {tn('cryptoSpot')}
                    <span className="mt-0.5 block text-[11px] text-[#6B7280]">{tn('digitalAssetTrading')}</span>
                  </Link>
                  <Link href={FOREX_ROUTES.trade} className="block px-3 py-2 hover:bg-white/5 hover:text-white">
                    {tn('forex')}
                    <span className="mt-0.5 block text-[11px] text-[#6B7280]">{tn('globalFxTrading')}</span>
                  </Link>
                </div>
              </div>
              <Link href={WALLET_HREF} prefetch className="tap-target inline-flex items-center transition hover:text-white">{tn('portfolio')}</Link>
              <Link href={ORDERS_HREF} prefetch className="tap-target inline-flex items-center transition hover:text-white">{tn('orders')}</Link>
              <Link href={walletPath.history} prefetch className="tap-target inline-flex items-center transition hover:text-white">{tn('activity')}</Link>
            </>
          ) : (
            <>
              <Link href={ROUTES.markets} prefetch className="tap-target inline-flex items-center transition hover:text-white">Markets</Link>
              <Link href={SPOT_TRADE_HREF} prefetch className="tap-target inline-flex items-center transition hover:text-white">Crypto</Link>
              <Link href={FOREX_ROUTES.root} prefetch className="tap-target inline-flex items-center transition hover:text-white">Forex</Link>
              <div className="relative shrink-0 group">
                <button type="button" className="tap-target inline-flex items-center transition hover:text-white" aria-haspopup="true">
                  {tn('trade')}
                </button>
                <div className="invisible absolute left-0 top-full z-40 mt-1 w-56 max-w-[min(14rem,calc(100vw-2rem))] rounded-lg border border-[#F5B8001F] bg-[#0D1118] py-1 opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <Link href={SPOT_TRADE_HREF} className="block px-3 py-2 hover:bg-white/5 hover:text-white">
                    {tn('cryptoSpot')}
                    <span className="mt-0.5 block text-[11px] text-[#6B7280]">{tn('digitalAssetTrading')}</span>
                  </Link>
                  <Link href={FOREX_ROUTES.trade} className="block px-3 py-2 hover:bg-white/5 hover:text-white">
                    {tn('forex')}
                    <span className="mt-0.5 block text-[11px] text-[#6B7280]">{tn('globalFxTrading')}</span>
                  </Link>
                </div>
              </div>
              <Link href={ROUTES.p2p} prefetch className="tap-target inline-flex items-center transition hover:text-white">P2P</Link>
              <Link href={ROUTES.earn} prefetch className="tap-target inline-flex items-center transition hover:text-white">Earn</Link>
              <Link href={ROUTES.dashboard.api} prefetch className="tap-target inline-flex items-center transition hover:text-white">API</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleLanguageSelector className="hidden sm:block" />
          {authed ? (
            <>
              <Link href={WALLET_HREF} prefetch className="tap-target hidden items-center gap-2 rounded-lg border border-[#F5B8001F] px-3 py-2 text-sm text-[#9CA3AF] transition hover:text-white sm:inline-flex">
                <Wallet className="h-4 w-4" /> <span className="hidden md:inline">Funds</span>
              </Link>
              <Link href={ORDERS_HREF} prefetch className="tap-target hidden items-center gap-2 rounded-lg border border-[#F5B8001F] px-3 py-2 text-sm text-[#9CA3AF] transition hover:text-white sm:inline-flex">
                <ClipboardList className="h-4 w-4" /> <span className="hidden md:inline">Orders</span>
              </Link>

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserOpen((v) => !v)}
                  aria-label="Open account menu"
                  aria-expanded={userOpen}
                  className="tap-target inline-flex items-center gap-2 rounded-lg border border-[#F5B8001F] px-3 py-2 text-sm text-[#9CA3AF] transition hover:text-white"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F5B800]/15 text-[#F5B800]">
                    <UserIcon className="h-3.5 w-3.5" />
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${userOpen ? 'rotate-180' : ''}`} />
                </button>

                {userOpen ? (
                  <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-xl border border-[#F5B8001F] bg-[#0D1118] shadow-xl">
                    <div className="border-b border-[#F5B8001F] px-4 py-3">
                      <p className="truncate text-sm font-medium text-white">{maskEmail(user?.email || '')}</p>
                      <p className="mt-0.5 text-[11px] text-[#9CA3AF]">UID: {user?.id?.slice(0, 8) || '******'}</p>
                    </div>
                    <div className="p-1.5">
                      {[
                        { href: ROUTES.dashboard.root, label: 'Dashboard', icon: LayoutDashboard },
                        { href: WALLET_HREF, label: 'Wallet', icon: Wallet },
                        { href: ORDERS_HREF, label: 'Orders', icon: ClipboardList },
                        { href: ROUTES.dashboard.account, label: 'Account', icon: UserIcon },
                        { href: ROUTES.dashboard.security, label: 'Security', icon: Shield },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch
                          onClick={() => setUserOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#9CA3AF] transition hover:bg-white/5 hover:text-white"
                        >
                          <item.icon className="h-4 w-4" /> {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-[#F5B8001F] p-1.5">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
                      >
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link href={ROUTES.login} prefetch className="tap-target hidden rounded-lg border border-[#F5B8001F] px-4 py-2 text-sm text-[#9CA3AF] transition hover:text-white sm:inline-flex items-center">
                {tn('logIn')}
              </Link>
              <Link href={ROUTES.signup} prefetch className="tap-target inline-flex items-center rounded-lg bg-[#F5B800] px-4 py-2 text-sm font-semibold text-[#05070B] transition hover:bg-[#FFD54A]">
                {tn('createAccount')}
              </Link>
            </>
          )}

          <button
            type="button"
            className="tap-target rounded-md border border-[#F5B8001F] p-2 text-[#9CA3AF] lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-[#F5B8001F] bg-[#0D1118] px-4 py-3 text-sm text-[#9CA3AF] lg:hidden">
          <div className="flex flex-wrap gap-4">
            {authed ? (
              <>
                <Link href={ROUTES.home} prefetch className="tap-target inline-flex items-center">Overview</Link>
                <Link href={ROUTES.markets} prefetch className="tap-target inline-flex items-center">Markets</Link>
                <Link href={SPOT_TRADE_HREF} prefetch className="tap-target inline-flex items-center">Crypto Spot</Link>
                <Link href={FOREX_ROUTES.trade} prefetch className="tap-target inline-flex items-center">Forex</Link>
                <Link href={WALLET_HREF} prefetch className="tap-target inline-flex items-center">Portfolio</Link>
                <Link href={ORDERS_HREF} prefetch className="tap-target inline-flex items-center">Orders</Link>
              </>
            ) : (
              <>
                <Link href={ROUTES.markets} prefetch className="tap-target inline-flex items-center">Markets</Link>
                <Link href={SPOT_TRADE_HREF} prefetch className="tap-target inline-flex items-center">Crypto</Link>
                <Link href={FOREX_ROUTES.root} prefetch className="tap-target inline-flex items-center">Forex</Link>
                <Link href={ROUTES.p2p} prefetch className="tap-target inline-flex items-center">P2P</Link>
                <Link href={ROUTES.earn} prefetch className="tap-target inline-flex items-center">Earn</Link>
                <Link href={ROUTES.dashboard.api} prefetch className="tap-target inline-flex items-center">API</Link>
                <Link href={ROUTES.login} prefetch className="tap-target inline-flex items-center">Log in</Link>
                <Link href={ROUTES.signup} prefetch className="tap-target inline-flex items-center text-[#F5B800]">Create account</Link>
              </>
            )}
          </div>
          {authed ? (
            <div className="mt-3 flex flex-wrap gap-4 border-t border-[#F5B8001F] pt-3">
              <Link href={WALLET_HREF} prefetch className="tap-target inline-flex items-center">Funds</Link>
              <Link href={ROUTES.dashboard.account} prefetch className="tap-target inline-flex items-center">Account</Link>
              <button type="button" onClick={handleLogout} className="tap-target inline-flex items-center text-red-400">Logout</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
