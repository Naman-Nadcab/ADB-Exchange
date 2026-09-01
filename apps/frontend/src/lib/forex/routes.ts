export const FOREX_ROUTES = {
  root: '/forex',
  trade: '/forex',
  markets: '/forex/markets',
  portfolio: '/forex/portfolio',
  orders: '/forex/orders',
  analysis: '/forex/analysis',
  alerts: '/forex/alerts',
  account: '/forex/account',
} as const;

export const FOREX_NAV = [
  { href: FOREX_ROUTES.markets, label: 'Markets' },
  { href: FOREX_ROUTES.trade, label: 'Trade' },
  { href: FOREX_ROUTES.portfolio, label: 'Portfolio' },
  { href: FOREX_ROUTES.orders, label: 'Orders' },
  { href: FOREX_ROUTES.analysis, label: 'Analysis' },
  { href: FOREX_ROUTES.alerts, label: 'Alerts' },
  { href: FOREX_ROUTES.account, label: 'Account' },
] as const;
