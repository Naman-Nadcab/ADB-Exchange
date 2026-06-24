import type { Metadata } from 'next';

const SITE = 'Metherium';

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
    'Metherium — Spot & P2P Crypto Exchange',
    'Trade spot and P2P markets on Metherium. View live prices, manage your wallet, and access account security controls.'
  ),
  markets: pageMeta(
    'Crypto Markets — Live Prices & Pairs | Metherium',
    'Browse live crypto market prices, 24h change, and volume across all spot trading pairs on Metherium.'
  ),
  trade: pageMeta(
    'Spot Trading Terminal | Metherium',
    'Place spot orders with live charts, order book depth, and trade history on the Metherium exchange.'
  ),
  p2p: pageMeta(
    'P2P Crypto Trading — Buy & Sell | Metherium',
    'Buy and sell crypto peer-to-peer with escrow protection, verified merchants, and local payment methods.'
  ),
  earn: pageMeta(
    'Earn — Crypto Yield Products | Metherium',
    'Earn yield on supported assets. Metherium yield products launch in phased rollout with clear disclosures.'
  ),
  convert: pageMeta(
    'Convert Crypto — Instant Swap | Metherium',
    'Swap between supported assets from your Metherium wallet with transparent rates and balance previews.'
  ),
  wallet: pageMeta(
    'Crypto Wallet — Deposits & Withdrawals | Metherium',
    'Manage crypto deposits, withdrawals, transfers, and balances across your Metherium accounts.'
  ),
  api: pageMeta(
    'API Keys — Trading Integration | Metherium',
    'Create and manage Metherium API keys for automated spot trading, market data, and account integrations.'
  ),
  login: pageMeta(
    'Log In — Metherium Exchange',
    'Sign in to your Metherium account to trade spot, use P2P, and manage your wallet.'
  ),
  register: pageMeta(
    'Create Account — Metherium Exchange',
    'Register for a Metherium account to access spot trading, P2P markets, wallet, and security controls.'
  ),
} as const satisfies Record<string, Metadata>;
