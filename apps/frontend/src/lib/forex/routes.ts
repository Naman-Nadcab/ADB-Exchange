export const FOREX_ROUTES = {
  root: '/forex',
  trade: '/forex/trade',
  markets: '/forex/markets',
  portfolio: '/forex/portfolio',
  orders: '/forex/orders',
  analysis: '/forex/analysis',
  alerts: '/forex/alerts',
  account: '/forex/account',
  funds: '/forex/account/funds',
  ledger: '/forex/account/ledger',
  accounts: '/forex/account/accounts',
} as const;

export function isForexTradePath(pathname: string): boolean {
  return pathname === FOREX_ROUTES.root || pathname === FOREX_ROUTES.trade;
}

export function isForexAnalysisPath(pathname: string): boolean {
  return pathname === FOREX_ROUTES.analysis || pathname.startsWith(`${FOREX_ROUTES.analysis}/`);
}

/** Market strip + session bar: hide on Trade/Analysis (chart-first); keep on other Forex pages. */
export function showForexMarketChrome(pathname: string): boolean {
  return !isForexTradePath(pathname) && !isForexAnalysisPath(pathname);
}

export const FOREX_NAV = [
  { href: FOREX_ROUTES.trade, labelKey: 'nav.trade' as const },
  { href: FOREX_ROUTES.markets, labelKey: 'nav.markets' as const },
  { href: FOREX_ROUTES.portfolio, labelKey: 'nav.portfolio' as const },
  { href: FOREX_ROUTES.orders, labelKey: 'nav.orders' as const },
  { href: FOREX_ROUTES.analysis, labelKey: 'nav.analysis' as const },
  { href: FOREX_ROUTES.alerts, labelKey: 'nav.alerts' as const },
  { href: FOREX_ROUTES.account, labelKey: 'nav.account' as const },
] as const;

export const FOREX_MOBILE_NAV = [
  { href: FOREX_ROUTES.trade, labelKey: 'nav.trade' as const },
  { href: FOREX_ROUTES.markets, labelKey: 'nav.markets' as const },
  { href: FOREX_ROUTES.portfolio, labelKey: 'nav.portfolio' as const },
  { href: FOREX_ROUTES.orders, labelKey: 'nav.orders' as const },
  { href: FOREX_ROUTES.account, labelKey: 'nav.more' as const },
] as const;
