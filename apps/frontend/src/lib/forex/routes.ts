export const FOREX_ROUTES = {
  root: '/forex',
  trade: '/forex/trade',
  markets: '/forex/markets',
  portfolio: '/forex/portfolio',
  orders: '/forex/orders',
  history: '/forex/history',
  analysis: '/forex/analysis',
  alerts: '/forex/alerts',
  follow: '/forex/follow',
  partner: '/forex/partner',
  rewards: '/forex/rewards',
  apps: '/forex/apps',
  account: '/forex/account',
  funds: '/forex/account/funds',
  fundsDeposit: '/forex/account/funds/deposit',
  fundsWithdraw: '/forex/account/funds/withdraw',
  fundsTransfer: '/forex/account/funds/transfer',
  fundsPaymentMethods: '/forex/account/funds/payment-methods',
  fundsHistory: '/forex/account/funds/history',
  ledger: '/forex/account/ledger',
  accounts: '/forex/account/accounts',
  openDemoAccount: '/forex/account/accounts/open-demo',
  openLiveAccount: '/forex/account/accounts/open-live',
  accountDetail: (accountId: string) => `/forex/account/accounts/${encodeURIComponent(accountId)}`,
} as const;

export function isForexTradePath(pathname: string): boolean {
  return pathname === FOREX_ROUTES.root || pathname === FOREX_ROUTES.trade;
}

export function isForexAnalysisPath(pathname: string): boolean {
  return pathname === FOREX_ROUTES.analysis || pathname.startsWith(`${FOREX_ROUTES.analysis}/`);
}

/** Ticker + session strip: terminal only (/forex, /forex/trade). Portal routes stay chart-free. */
export function showForexMarketChrome(pathname: string): boolean {
  return isForexTradePath(pathname);
}

/** Core trader destinations in the top header (portal-only items live in FOREX_PORTAL_NAV). */
export const FOREX_TOP_NAV = [
  { href: FOREX_ROUTES.trade, labelKey: 'nav.trade' as const },
  { href: FOREX_ROUTES.markets, labelKey: 'nav.markets' as const },
  { href: FOREX_ROUTES.portfolio, labelKey: 'nav.portfolio' as const },
  { href: FOREX_ROUTES.orders, labelKey: 'nav.orders' as const },
  { href: FOREX_ROUTES.history, labelKey: 'nav.history' as const },
] as const;

/** @deprecated Use FOREX_TOP_NAV — kept for audit references only. */
export const FOREX_NAV = FOREX_TOP_NAV;

export const FOREX_PORTAL_NAV = [
  { href: FOREX_ROUTES.account, labelKey: 'portalNav.overview' as const, exact: true },
  { href: FOREX_ROUTES.accounts, labelKey: 'portalNav.accounts' as const },
  { href: FOREX_ROUTES.funds, labelKey: 'portalNav.funds' as const },
  { href: FOREX_ROUTES.ledger, labelKey: 'portalNav.ledger' as const },
  { href: FOREX_ROUTES.analysis, labelKey: 'portalNav.research' as const },
  { href: FOREX_ROUTES.alerts, labelKey: 'portalNav.tools' as const },
  { href: FOREX_ROUTES.follow, labelKey: 'portalNav.follow' as const },
  { href: FOREX_ROUTES.partner, labelKey: 'portalNav.partner' as const },
  { href: FOREX_ROUTES.rewards, labelKey: 'portalNav.rewards' as const },
  { href: FOREX_ROUTES.apps, labelKey: 'portalNav.apps' as const },
] as const;

export function isForexPortalNavActive(
  pathname: string,
  href: string,
  exact?: boolean
): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isForexPortalSectionPath(pathname: string): boolean {
  if (isForexTradePath(pathname)) return false;
  return FOREX_PORTAL_NAV.some((item) =>
    isForexPortalNavActive(pathname, item.href, 'exact' in item ? item.exact : false)
  );
}

export const FOREX_MOBILE_NAV = [
  { href: FOREX_ROUTES.trade, labelKey: 'nav.trade' as const, kind: 'link' as const },
  { href: FOREX_ROUTES.markets, labelKey: 'nav.markets' as const, kind: 'link' as const },
  { href: FOREX_ROUTES.portfolio, labelKey: 'nav.portfolio' as const, kind: 'link' as const },
  { href: FOREX_ROUTES.orders, labelKey: 'nav.orders' as const, kind: 'link' as const },
  { href: FOREX_ROUTES.account, labelKey: 'portalNav.portal' as const, kind: 'portal' as const },
] as const;
