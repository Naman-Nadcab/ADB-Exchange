import type { BrowserContext } from '@playwright/test';

export const CUSTOMER_LOCALES = ['en', 'zh-CN', 'id-ID'] as const;
export type CustomerLocale = (typeof CUSTOMER_LOCALES)[number];

export const I18N_VIEWPORTS = [
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1024, height: 768, name: '1024x768' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 390, height: 844, name: '390x844' },
] as const;

const LOCALE_COOKIE = 'mlive_locale';
const LOCALE_EXPLICIT_COOKIE = 'mlive_locale_explicit';

function cookieDomainFromBase(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return '127.0.0.1';
  }
}

/** Sets explicit locale cookies before navigation (matches apps/frontend middleware). */
export async function setCustomerLocale(
  context: BrowserContext,
  locale: CustomerLocale,
  baseUrl: string
): Promise<void> {
  const domain = cookieDomainFromBase(baseUrl);
  await context.addCookies([
    {
      name: LOCALE_COOKIE,
      value: locale,
      domain,
      path: '/',
    },
    {
      name: LOCALE_EXPLICIT_COOKIE,
      value: '1',
      domain,
      path: '/',
    },
  ]);
}

export const PUBLIC_I18N_ROUTES: Array<{ path: string; label: string; expectSelector?: string }> = [
  { path: '/login', label: 'login' },
  { path: '/p2p', label: 'p2p-marketplace' },
  { path: '/forex', label: 'forex-home' },
  { path: '/forex/trade', label: 'forex-trade' },
  { path: '/forex/markets', label: 'forex-markets' },
  { path: '/trade/spot', label: 'spot' },
];

export const AUTH_I18N_ROUTES: Array<{ path: string; label: string }> = [
  { path: '/dashboard/assets/overview', label: 'wallet-overview' },
  { path: '/wallet/deposit/crypto', label: 'wallet-deposit' },
  { path: '/wallet/withdraw/crypto', label: 'wallet-withdraw-crypto' },
  { path: '/wallet/withdraw/fiat', label: 'wallet-withdraw-fiat' },
  { path: '/p2p/create-ad', label: 'p2p-create-ad' },
  { path: '/p2p/orders', label: 'p2p-orders' },
  { path: '/p2p/my-ads', label: 'p2p-my-ads' },
  { path: '/p2p/payment-methods', label: 'p2p-payment-methods' },
  { path: '/wallet/history', label: 'wallet-history' },
  { path: '/dashboard/help', label: 'help-center' },
  { path: '/forex/portfolio', label: 'forex-portfolio' },
  { path: '/forex/orders', label: 'forex-orders' },
  { path: '/forex/account', label: 'forex-account' },
  { path: '/dashboard/account', label: 'account' },
  { path: '/dashboard/security', label: 'security' },
  { path: '/dashboard/preferences', label: 'preferences' },
];
