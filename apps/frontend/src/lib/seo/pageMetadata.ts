import type { Metadata } from 'next';
import { BRAND_NAME_SHORT } from '@/lib/brand';

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
    `${BRAND_NAME_SHORT} — Global markets. One platform.`,
    `Digital assets and global FX on ${BRAND_NAME_SHORT}. Crypto spot and Forex are first-class markets on one professional platform.`
  ),
  markets: pageMeta(
    `Crypto Markets — Live Prices & Pairs | ${BRAND_NAME_SHORT}`,
    `Browse live crypto market prices, 24h change, and volume across all spot trading pairs on ${BRAND_NAME_SHORT}.`
  ),
  trade: pageMeta(
    `Spot Trading Terminal | ${BRAND_NAME_SHORT}`,
    `Place spot orders with live charts, order book depth, and trade history on the ${BRAND_NAME_SHORT} exchange.`
  ),
  p2p: pageMeta(
    `P2P Crypto Trading — Buy & Sell | ${BRAND_NAME_SHORT}`,
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
    `Crypto Wallet — Deposits & Withdrawals | ${BRAND_NAME_SHORT}`,
    `Manage crypto deposits, withdrawals, transfers, and balances across your ${BRAND_NAME_SHORT} accounts.`
  ),
  api: pageMeta(
    `API Keys — Trading Integration | ${BRAND_NAME_SHORT}`,
    `Create and manage ${BRAND_NAME_SHORT} API keys for automated spot trading, market data, and account integrations.`
  ),
  login: pageMeta(
    `Log In — ${BRAND_NAME_SHORT}`,
    `Sign in to your ${BRAND_NAME_SHORT} account to trade spot, use P2P, and manage your wallet.`
  ),
  register: pageMeta(
    `Create Account — ${BRAND_NAME_SHORT}`,
    `Register for a ${BRAND_NAME_SHORT} account to access spot trading, P2P markets, wallet, and security controls.`
  ),
} as const satisfies Record<string, Metadata>;
