/**
 * Account-wide customer destinations.
 * Crypto and Forex venues link here. They do not own a second profile, security center, or KYC identity.
 */
export const CUSTOMER_ACCOUNT_ROUTES = {
  profile: '/dashboard/account',
  security: '/dashboard/security',
  identity: '/dashboard/identity',
  cryptoAssets: '/wallet',
  cryptoSpot: '/trade/spot',
  forexTrading: '/forex',
  support: '/dashboard/support',
  help: '/dashboard/help',
  dashboard: '/dashboard',
} as const;

export type CustomerAccountMenuKey = 'profile' | 'security' | 'identity' | 'cryptoAssets';

/** Menu entries that must stay on the exchange account, not a venue-specific user. */
export const CUSTOMER_ACCOUNT_MENU: ReadonlyArray<{
  key: CustomerAccountMenuKey;
  href: string;
}> = [
  { key: 'profile', href: CUSTOMER_ACCOUNT_ROUTES.profile },
  { key: 'security', href: CUSTOMER_ACCOUNT_ROUTES.security },
  { key: 'identity', href: CUSTOMER_ACCOUNT_ROUTES.identity },
  { key: 'cryptoAssets', href: CUSTOMER_ACCOUNT_ROUTES.cryptoAssets },
];

export function isVenueTradingRoute(href: string): boolean {
  return href.startsWith('/forex') || href.startsWith('/trade') || href.startsWith('/p2p');
}
