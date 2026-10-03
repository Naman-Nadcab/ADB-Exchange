'use client';

import { useTranslations } from 'next-intl';
import { maskAccountEmail } from '@/lib/account-email';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import RequireAuth from '@/components/RequireAuth';
import Link from 'next/link';
import {
  LayoutDashboard,
  User,
  Gift,
  Users,
  Key,
  Receipt,
  ChevronDown,
  Bell,
  Menu,
  X,
  LogOut,
  Wallet,
  ArrowDownUp,
  Copy,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Shield,
  Download,
  Settings,
  FileText,
  HelpCircle,
} from 'lucide-react';
import SessionManager from '@/components/SessionManager';
import ThemeToggle from '@/components/ThemeToggle';
import { toast } from '@/components/ui/toaster';
import { performLogout } from '@/lib/authLogout';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { useBalancesSummary, useBalancesByAccount } from '@/lib/balances';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { UserRouteWarmup } from '@/components/performance/UserRouteWarmup';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { SPOT_TRADE_HREF } from '@/lib/tier1-canonical-routes';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import {
  MARKETS_HREF,
  ORDERS_HREF,
  WALLET_HREF,
  P2P_HREF,
  walletPath,
  ROUTES,
  LEGACY_PATH_PREFIXES,
} from '@/lib/routes';
import { useDisplayCurrency } from '@/context/DisplayCurrencyProvider';

const MOBILE_NAV_PAD = 'pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0';

const navItems = [
  { labelKey: 'markets' as const, href: MARKETS_HREF },
  { labelKey: 'trade' as const, href: SPOT_TRADE_HREF },
  { labelKey: 'forex' as const, href: FOREX_ROUTES.root },
  { labelKey: 'p2p' as const, href: P2P_HREF },
  { labelKey: 'earn' as const, href: ROUTES.earn },
];

function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === ROUTES.dashboard.root) return false;
  if (
    href === MARKETS_HREF &&
    (pathname.startsWith(MARKETS_HREF) || pathname.startsWith('/dashboard/markets'))
  ) return true;
  if (href === SPOT_TRADE_HREF) {
    return pathname === SPOT_TRADE_HREF || pathname === '/dashboard/spot';
  }
  if (
    href === ORDERS_HREF &&
    (pathname.startsWith('/orders') || pathname.startsWith('/dashboard/orders'))
  ) return true;
  if (
    href === WALLET_HREF &&
    (pathname.startsWith('/wallet') ||
      pathname.startsWith('/dashboard/assets') ||
      pathname.startsWith('/dashboard/deposit') ||
      pathname.startsWith('/dashboard/withdraw') ||
      pathname.startsWith('/dashboard/transfer'))
  ) return true;
  if (
    href === ROUTES.earn &&
    (pathname.startsWith(ROUTES.earn) || pathname.startsWith(LEGACY_PATH_PREFIXES.dashboardEarn))
  ) return true;
  if (href === P2P_HREF && (pathname.startsWith(P2P_HREF) || pathname.startsWith(LEGACY_PATH_PREFIXES.p2pV2))) return true;
  return pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {

  const tn = useTranslations('common.notifications');
  const tc = useTranslations('common');
  const tt = useTranslations('account.toasts');
  const tNav = useTranslations('navigation');
  const tShell = useTranslations('account.shell');
  const tOrders = useTranslations('orders');
  const tw = useTranslations('wallet.nav');
  const tPanel = useTranslations('common.notificationPanel');
  const pathname = usePathname();
  const { user, accessToken, _hasHydrated, isAuthenticated } = useAuthStore();
  const { displayCurrency, formatFromUsdt } = useDisplayCurrency();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; is_read: boolean; created_at: string; notification_type: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [uidCopied, setUidCopied] = useState(false);
  const [kycVerified, setKycVerified] = useState(false);
  const [kycLoading, setKycLoading] = useState(true);
  const [kycBannerDismissed, setKycBannerDismissed] = useState(false);
  const [kycEnforcementRequired, setKycEnforcementRequired] = useState(false);

  const { data: balanceSummary } = useBalancesSummary(!!_hasHydrated && isAuthenticated);
  const { data: balancesByAccount } = useBalancesByAccount(!!_hasHydrated && isAuthenticated);
  const totalEquityUsd = (balanceSummary?.fundingBalance?.totalUsd ?? 0) + (balanceSummary?.tradingBalance?.totalUsd ?? 0);
  const totalEquityBtc = (balanceSummary?.fundingBalance?.totalBtc ?? 0) + (balanceSummary?.tradingBalance?.totalBtc ?? 0);
  const previewBalances = Array.isArray(balancesByAccount) ? balancesByAccount.slice(0, 6) : [];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setKycBannerDismissed(window.sessionStorage.getItem('kyc_banner_dismissed') === '1');
  }, []);

  useEffect(() => {
    void fetch(`${getApiBaseUrl()}/api/v1/public/compliance-policy`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const kyc = data?.data?.kyc as Record<string, string> | undefined;
        if (!kyc) {
          setKycEnforcementRequired(true);
          return;
        }
        const anyRequired = Object.values(kyc).some((mode) => mode === 'required');
        setKycEnforcementRequired(anyRequired);
      })
      .catch(() => setKycEnforcementRequired(true));
  }, []);

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated) {
      setKycVerified(false);
      setKycLoading(false);
      return;
    }
    (async () => {
      setKycLoading(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/wallet/kyc-status`, {
          credentials: 'include',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) setKycVerified(Boolean(data.data.verified));
        }
      } catch {
        setKycVerified(false);
      } finally { setKycLoading(false); }
    })();
  }, [_hasHydrated, isAuthenticated, accessToken]);

  const toggleDropdown = (name: string) => setActiveDropdown((d) => (d === name ? null : name));

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/user/notifications?limit=20`, {
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Notifications request failed (${res.status})`);
      }
      const data = await res.json();
      if (data?.success && data?.data) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount ?? 0);
        return;
      }
      throw new Error(data?.error?.message || 'Unable to fetch notifications.');
    } catch {
      setNotificationsError(tPanel('fetchFailed'));
      toast({ title: tt('notificationsUnavailableTitle'), description: tt('notificationsUnavailableDesc'), variant: 'destructive' });
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!isAuthenticated) return;
    setMarkingNotificationsRead(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/user/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Mark read failed (${res.status})`);
      }
      const result = await res.json();
      if (!result?.success) {
        throw new Error(result?.error?.message || 'Could not mark notifications as read.');
      }
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      toast({ title: tn('errorTitle'), description: tt('markReadFailedDesc'), variant: 'destructive' });
    } finally {
      setMarkingNotificationsRead(false);
    }
  };

  const handleLogout = async () => {
    await performLogout('/login');
  };

  const maskEmail = (email: string | null | undefined) => maskAccountEmail(email, tc('states.notAdded'));

  const copyUID = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setUidCopied(true);
      toast({ title: tn('copiedTitle'), description: tt('userIdCopiedDesc'), variant: 'default' });
      setTimeout(() => setUidCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!activeDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.hdr-dropdown') && !target.closest('.hdr-trigger')) setActiveDropdown(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeDropdown]);

  const isExchangeFullScreen = pathname === '/dashboard/spot' || pathname?.startsWith('/dashboard/p2p');
  const isDashboardSpot = pathname === '/dashboard/spot';

  if (isExchangeFullScreen) {
    return (
      <RequireAuth>
        <UserRouteWarmup />
        <SessionManager redirectPath="/login" />
        <div className="mobile-app-shell min-h-screen bg-background">
          <main
            id="main-content"
            tabIndex={-1}
            className={
              isDashboardSpot
                ? `flex min-h-screen w-full flex-col overflow-y-auto overflow-x-hidden ${MOBILE_NAV_PAD}`
                : `flex h-screen w-full flex-col overflow-hidden ${MOBILE_NAV_PAD}`
            }
          >
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <UserRouteWarmup />
      <SessionManager redirectPath="/login" />
      <div className="mobile-app-shell min-h-screen bg-background">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[200] px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg -translate-y-16 focus:translate-y-0 outline-none transition-transform duration-200"
        >
          {tc('a11y.skipToMain')}
        </a>

        {/* Binance-style top header */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center justify-between h-14 px-4">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-1.5 hover:bg-accent rounded-lg" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? tc('a11y.closeMenu') : tc('a11y.openMenu')}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} />

              <nav className="hidden lg:flex items-center gap-1" aria-label={tc('a11y.primaryNav')}>
                {navItems.map((item) => {
                  const active = isNavItemActive(pathname ?? null, item.href);
                  return (
                    <Link
                      key={item.labelKey}
                      href={item.href}
                      prefetch
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {tNav(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleDropdown('deposit')}
                className="hdr-trigger hidden sm:flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/85 transition-colors"
              >
                {tShell('depositButton')}
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'deposit' ? 'rotate-180' : ''}`} />
              </button>

              <button onClick={() => toggleDropdown('wallet')} className="hdr-trigger hidden sm:flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                <Wallet className="w-4 h-4" /> <span className="hidden md:inline">{tNav('wallet')}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'wallet' ? 'rotate-180' : ''}`} />
              </button>

              <button onClick={() => toggleDropdown('orders')} className="hdr-trigger hidden sm:flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                <FileText className="w-4 h-4" /> <span className="hidden md:inline">{tNav('orders')}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === 'orders' ? 'rotate-180' : ''}`} />
              </button>

              <button
                aria-label={unreadCount > 0 ? tShell('notificationsUnread', { count: unreadCount }) : tPanel('title')}
                onClick={() => { toggleDropdown('notifications'); if (activeDropdown !== 'notifications') fetchNotifications(); }}
                className="hdr-trigger relative p-2 hover:bg-accent rounded-lg"
              >
                <Bell className="w-[18px] h-[18px] text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-destructive text-white text-[9px] font-medium rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <ThemeToggle variant="icon" size="sm" />

              <button
                aria-label={tc('a11y.userMenu')}
                onClick={() => toggleDropdown('user')}
                className="hdr-trigger p-2 hover:bg-accent rounded-lg"
              >
                <User className="w-[18px] h-[18px] text-muted-foreground" />
              </button>
            </div>

            {/* Dropdowns */}
            {activeDropdown === 'deposit' && (
              <div className="hdr-dropdown fixed right-4 top-14 w-72 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-fade-in">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-semibold">{tShell('selectPaymentMethod')}</p>
                </div>
                <div className="p-2 space-y-0.5">
                  <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tShell('alreadyHaveCrypto')}</p>
                  <Link href={walletPath.depositCrypto} prefetch className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded-lg" onClick={() => setActiveDropdown(null)}>
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><Wallet className="w-4 h-4 text-primary" /></div>
                    <div><p className="font-medium text-foreground">{tShell('depositCrypto')}</p><p className="text-xs text-muted-foreground">{tShell('depositCryptoHint')}</p></div>
                  </Link>
                  <Link href={P2P_HREF} prefetch className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded-lg" onClick={() => setActiveDropdown(null)}>
                    <div className="w-8 h-8 bg-buy/10 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-buy" /></div>
                    <div><p className="font-medium text-foreground">{tShell('p2pTrading')}</p><p className="text-xs text-muted-foreground">{tShell('zeroFees')}</p></div>
                  </Link>
                  <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">{tShell('dontHaveCrypto')}</p>
                  <Link href={walletPath.convert} prefetch className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent rounded-lg" onClick={() => setActiveDropdown(null)}>
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4 text-primary" /></div>
                    <div><p className="font-medium text-foreground">{tShell('buyWithInr')}</p><p className="text-xs text-muted-foreground">{tShell('buyWithCard')}</p></div>
                  </Link>
                </div>
              </div>
            )}

            {activeDropdown === 'wallet' && (
              <div className="hdr-dropdown fixed right-4 top-14 w-80 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-fade-in">
                <Link href={WALLET_HREF} prefetch onClick={() => setActiveDropdown(null)} className="block p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{tShell('estimatedBalance')}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold font-mono tabular-nums">
                    {Number.isFinite(totalEquityUsd) ? formatFromUsdt(totalEquityUsd, 2) : '—'}{' '}
                    <span className="text-sm font-normal text-muted-foreground">{displayCurrency}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 font-mono tabular-nums">≈ {Number.isFinite(totalEquityBtc) ? totalEquityBtc.toFixed(8) : '—'} BTC</p>
                  {previewBalances.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      {previewBalances.map((row) => (
                        <div key={row.symbol} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{row.symbol}</span>
                          <span className="font-mono tabular-nums font-medium">{row.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
                <div className="p-3 border-t border-border">
                  <div className="grid grid-cols-3 gap-2">
                    <Link href={walletPath.depositCrypto} prefetch onClick={() => setActiveDropdown(null)} className="flex flex-col items-center gap-1 px-2 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/85 transition-colors">
                      <Download className="w-4 h-4" /> {tw('deposit')}
                    </Link>
                    <Link href={walletPath.withdrawCrypto} prefetch onClick={() => setActiveDropdown(null)} className="flex flex-col items-center gap-1 px-2 py-2 bg-accent text-foreground text-xs font-medium rounded-lg hover:bg-accent/80 transition-colors">
                      <ArrowDownUp className="w-4 h-4" /> {tw('withdraw')}
                    </Link>
                    <Link href={walletPath.transfer} prefetch onClick={() => setActiveDropdown(null)} className="flex flex-col items-center gap-1 px-2 py-2 bg-accent text-foreground text-xs font-medium rounded-lg hover:bg-accent/80 transition-colors">
                      <ArrowDownUp className="w-4 h-4 rotate-90" /> {tw('transfer')}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeDropdown === 'orders' && (
              <div className="hdr-dropdown fixed right-4 top-14 w-56 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-fade-in">
                <div className="p-1.5">
                  {[
                    { href: ORDERS_HREF, labelKey: 'allOrders' as const, icon: FileText },
                    { href: `${ORDERS_HREF}/spot`, labelKey: 'spotOrders' as const, icon: TrendingUp },
                    { href: `${ORDERS_HREF}/p2p`, labelKey: 'p2pOrders' as const, icon: Users },
                    { href: `${ORDERS_HREF}/history`, labelKey: 'orderHistory' as const, icon: FileText },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} prefetch onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg">
                      <item.icon className="w-4 h-4 text-muted-foreground" /> {tOrders(item.labelKey)}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeDropdown === 'notifications' && (
              <div className="hdr-dropdown fixed right-4 top-14 w-80 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-fade-in">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-semibold">{tPanel('title')}</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      disabled={markingNotificationsRead}
                      onClick={markAllRead}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {markingNotificationsRead ? tPanel('markingRead') : tPanel('markAllRead')}
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">{tPanel('loading')}</div>
                  ) : notificationsError ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">{notificationsError}</p>
                      <button
                        type="button"
                        onClick={() => void fetchNotifications()}
                        className="mt-2 text-xs font-medium text-primary hover:underline"
                      >
                        {tc('actions.retry')}
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">{tPanel('empty')}</div>
                  ) : notifications.map((n) => (
                    <div key={n.id} className={`p-4 border-b border-border last:border-0 ${!n.is_read ? 'bg-primary/5' : ''}`}>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-border">
                  <Link href={ROUTES.dashboard.announcements} onClick={() => setActiveDropdown(null)} className="block text-center text-sm text-primary hover:underline py-2">{tPanel('viewAll')}</Link>
                </div>
              </div>
            )}

            {activeDropdown === 'user' && (
              <div className="hdr-dropdown fixed right-4 top-14 w-72 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{maskEmail(user?.email || '')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>UID: {user?.id?.slice(0, 8) || '******'}</span>
                        <button onClick={copyUID} className="p-0.5 hover:text-primary" aria-label={uidCopied ? tc('a11y.copiedUserId') : tc('a11y.copyUserId')}>
                          {uidCopied ? <span className="text-buy">✓</span> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {!kycLoading && !kycVerified && (
                    <Link href={ROUTES.dashboard.identity} onClick={() => setActiveDropdown(null)} className="flex items-center justify-between mt-3 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/85 transition-colors">
                      <span>{tShell('completeVerification')}</span><ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
                <div className="p-1.5 max-h-64 overflow-y-auto">
                  {[
                    { href: ROUTES.dashboard.root, labelKey: 'overview' as const, icon: LayoutDashboard },
                    { href: ROUTES.dashboard.account, labelKey: 'account' as const, icon: User },
                    { href: ROUTES.dashboard.security, labelKey: 'security' as const, icon: Shield },
                    { href: '/dashboard/support', labelKey: 'support' as const, icon: HelpCircle },
                    { href: ROUTES.dashboard.referral, labelKey: 'referral' as const, icon: Gift },
                    { href: ROUTES.dashboard.api, labelKey: 'apiManagement' as const, icon: Key },
                    { href: ROUTES.dashboard.feeRates, labelKey: 'feeTier' as const, icon: Receipt },
                    { href: ROUTES.dashboard.preferences, labelKey: 'preferences' as const, icon: Settings },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} prefetch onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded-lg">
                      <item.icon className="w-4 h-4 text-muted-foreground" /> {tNav(item.labelKey)}
                    </Link>
                  ))}
                </div>
                <div className="p-1.5 border-t border-border">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg">
                    <LogOut className="w-4 h-4" /> {tNav('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {!kycLoading && !kycVerified && kycEnforcementRequired && !kycBannerDismissed && (
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{tShell('kycBanner')}</span>
                <Link href={ROUTES.dashboard.identity} className="text-primary font-medium hover:underline">{tShell('verifyNow')}</Link>
              </div>
              <button
                onClick={() => {
                  setKycBannerDismissed(true);
                  if (typeof window !== 'undefined') window.sessionStorage.setItem('kyc_banner_dismissed', '1');
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label={tc('a11y.dismiss')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </header>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border overflow-y-auto animate-slide-up">
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-medium">{maskEmail(user?.email || '')}</p>
                  <p className="text-[10px] text-muted-foreground">UID: {user?.id?.slice(0, 8)}</p>
                </div>
              </div>
              <nav className="py-2">
                {navItems.map((item) => {
                  const active = isNavItemActive(pathname ?? null, item.href);
                  return (
                    <Link key={item.labelKey} href={item.href} prefetch onClick={() => setMobileMenuOpen(false)} className={`block px-4 py-3 text-sm font-medium ${active ? 'text-primary bg-primary/5' : 'text-foreground hover:bg-accent'}`}>
                      {tNav(item.labelKey)}
                    </Link>
                  );
                })}
                <div className="my-2 mx-4 border-t border-border" />
                {[
                  { href: ROUTES.dashboard.root, labelKey: 'dashboard' as const, icon: LayoutDashboard },
                  { href: WALLET_HREF, labelKey: 'wallet' as const, icon: Wallet },
                  { href: ORDERS_HREF, labelKey: 'orders' as const, icon: FileText },
                  { href: ROUTES.dashboard.account, labelKey: 'account' as const, icon: User },
                  { href: ROUTES.dashboard.security, labelKey: 'security' as const, icon: Shield },
                  { href: '/dashboard/support', labelKey: 'support' as const, icon: HelpCircle },
                  { href: ROUTES.dashboard.referral, labelKey: 'referral' as const, icon: Gift },
                  { href: ROUTES.dashboard.feeRates, labelKey: 'fees' as const, icon: Receipt },
                ].map((item) => (
                  <Link key={item.href} href={item.href} prefetch onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent">
                    <item.icon className="w-4 h-4" /> {tNav(item.labelKey)}
                  </Link>
                ))}
                <div className="my-2 mx-4 border-t border-border" />
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4" /> {tNav('logout')}
                </button>
              </nav>
            </aside>
          </div>
        )}

        {/* Main content — no sidebar, full width */}
        <main id="main-content" tabIndex={-1} className={`min-h-[calc(100vh-3.5rem)] ${MOBILE_NAV_PAD}`}>
          <div className="dashboard-page-wrap mx-auto max-w-[1200px]">
            {children}
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </RequireAuth>
  );
}
