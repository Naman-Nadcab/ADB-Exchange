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
  { href: FOREX_ROUTES.trade, label: 'Trade' },
  { href: FOREX_ROUTES.markets, label: 'Markets' },
  { href: FOREX_ROUTES.portfolio, label: 'Portfolio' },
  { href: FOREX_ROUTES.orders, label: 'Orders' },
  { href: FOREX_ROUTES.analysis, label: 'Analysis' },
  { href: FOREX_ROUTES.alerts, label: 'Alerts' },
  { href: FOREX_ROUTES.account, label: 'Account' },
] as const;

export const FOREX_MOBILE_NAV = [
  { href: FOREX_ROUTES.trade, label: 'Trade' },
  { href: FOREX_ROUTES.markets, label: 'Markets' },
  { href: FOREX_ROUTES.portfolio, label: 'Portfolio' },
  { href: FOREX_ROUTES.orders, label: 'Orders' },
  { href: FOREX_ROUTES.account, label: 'More' },
] as const;
