import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

const SITE = BRAND_NAME;

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
    BRAND_NAME,
    `${BRAND_NAME}. Crypto and Forex on one account, with separate balances and a simulated Forex workspace.`
  ),
  markets: pageMeta(
    `${BRAND_NAME} — Markets`,
    `Browse crypto prices, 24h change, and volume across spot markets on ${BRAND_NAME}.`
  ),
  trade: pageMeta(
    `${BRAND_NAME} — Spot`,
    `Place spot orders with live charts, order book depth, and trade history on ${BRAND_NAME}.`
  ),
  p2p: pageMeta(
    `${BRAND_NAME} — P2P`,
    'Buy and sell crypto peer-to-peer with escrow, verified merchants, and local payment methods.'
  ),
  earn: pageMeta(
    `${BRAND_NAME} — Earn`,
    `Earn yield on supported assets. ${BRAND_NAME} yield products launch in phases, with clear disclosures.`
  ),
  convert: pageMeta(
    `${BRAND_NAME} — Convert`,
    `Convert between supported assets in your ${BRAND_NAME} wallet. Rates and balances are shown before you confirm.`
  ),
  wallet: pageMeta(
    `${BRAND_NAME} — Wallet`,
    `Manage crypto deposits, withdrawals, transfers, and balances on ${BRAND_NAME}.`
  ),
  api: pageMeta(
    `${BRAND_NAME} — API`,
    `Create and manage ${BRAND_NAME} API keys for spot trading, market data, and account access.`
  ),
  login: pageMeta(
    `${BRAND_NAME} — Sign in`,
    `Sign in to ${BRAND_NAME} to use Crypto, Forex, P2P, and your wallet. Your sign-in wallet is not a deposit address.`
  ),
  register: pageMeta(
    `${BRAND_NAME} — Create account`,
    `Create an ${BRAND_NAME} account for Crypto, Forex, P2P, wallet, and security controls.`
  ),
} as const satisfies Record<string, Metadata>;
