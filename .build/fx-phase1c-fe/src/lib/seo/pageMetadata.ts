import type { Metadata } from 'next';
import { BRAND_NAME, BRAND_NAME_SHORT, BRAND_PRODUCT } from '@/lib/brand';

const SITE = BRAND_NAME_SHORT;

function pageMeta(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE,
      type: 'website',
    },
  };
}

/** Page-specific SEO metadata for public exchange routes. */
export const PAGE_METADATA = {
  home: pageMeta(
    `${BRAND_NAME_SHORT} — ${BRAND_NAME}`,
    `${BRAND_NAME} (${BRAND_NAME_SHORT}). ${BRAND_PRODUCT.crypto} and ${BRAND_PRODUCT.forex} are first-class products on one professional platform.`
  ),
  markets: pageMeta(
    `${BRAND_PRODUCT.crypto} — Markets`,
    `Browse live crypto market prices, 24h change, and volume across all spot trading pairs on ${BRAND_NAME_SHORT}.`
  ),
  trade: pageMeta(
    `${BRAND_PRODUCT.crypto} — Trade`,
    `Place spot orders with live charts, order book depth, and trade history on ${BRAND_NAME_SHORT}.`
  ),
  p2p: pageMeta(
    `${BRAND_PRODUCT.p2p} — Buy & Sell`,
    'Buy and sell crypto peer-to-peer with escrow protection, verified merchants, and local payment methods.'
  ),
  earn: pageMeta(
    `Earn — Crypto Yield Products | ${BRAND_NAME_SHORT}`,
    `Earn yield on supported assets. ${BRAND_NAME_SHORT} yield products launch in phased rollout with clear disclosures.`
  ),
  convert: pageMeta(
    `Convert Crypto — Instant Swap | ${BRAND_NAME_SHORT}`,
    `Swap between supported assets from your ${BRAND_NAME_SHORT} wallet with transparent rates and balance previews.`
  ),
  wallet: pageMeta(
    `${BRAND_PRODUCT.wallet} — Deposits & Withdrawals`,
    `Manage crypto deposits, withdrawals, transfers, and balances across your ${BRAND_NAME_SHORT} accounts.`
  ),
  api: pageMeta(
    `${BRAND_PRODUCT.api} — Trading Integration`,
    `Create and manage ${BRAND_NAME_SHORT} API keys for automated spot trading, market data, and account integrations.`
  ),
  login: pageMeta(
    `Log In — ${BRAND_NAME_SHORT}`,
    `Sign in to your ${BRAND_NAME_SHORT} account to trade Crypto, Forex, use P2P, and manage your wallet.`
  ),
  register: pageMeta(
    `Create Account — ${BRAND_NAME_SHORT}`,
    `Register for a ${BRAND_NAME_SHORT} account to access Crypto, Forex, P2P, wallet, and security controls.`
  ),
} as const satisfies Record<string, Metadata>;
