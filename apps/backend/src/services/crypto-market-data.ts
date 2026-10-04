/**
 * Pure helpers for the crypto spot oracle.
 * Live prices come from one Chainlink multicall on the configured EVM RPC.
 * Hourly history comes from one CoinGecko markets response for assets that
 * have no on-chain feed, and is also used as the chart backfill.
 * Forex is not part of this path.
 */

export type ChainlinkFeed = {
  asset: string;
  proxy: string;
  decimals: number;
};

/** Ethereum mainnet Chainlink USD proxies (reference-data-directory, crypto / USD). */
export const CHAINLINK_USD_FEEDS: ChainlinkFeed[] = [
  { asset: 'AAVE', proxy: '0xbd7F896e60B650C01caf2d7279a1148189A68884', decimals: 8 },
  { asset: 'ARB', proxy: '0x31697852a68433DbCc2Ff612c516d69E3D9bd08F', decimals: 8 },
  { asset: 'AVAX', proxy: '0xFF3EEb22B5E3dE6e705b44749C2559d704923FD7', decimals: 8 },
  { asset: 'BNB', proxy: '0x14e613AC84a31f709eadbdF89C6CC390fDc9540A', decimals: 8 },
  { asset: 'BTC', proxy: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', decimals: 8 },
  { asset: 'DAI', proxy: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', decimals: 8 },
  { asset: 'ETH', proxy: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', decimals: 8 },
  { asset: 'GRT', proxy: '0x86cF33a451dE9dc61a2862FD94FF4ad4Bd65A5d2', decimals: 8 },
  { asset: 'IMX', proxy: '0xBAEbEFc1D023c0feCcc047Bff42E75F15Ff213E6', decimals: 8 },
  { asset: 'LINK', proxy: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c', decimals: 8 },
  { asset: 'MKR', proxy: '0xec1D1B3b0443256cc3860e24a46F108e699484Aa', decimals: 8 },
  { asset: 'MATIC', proxy: '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676', decimals: 8 },
  { asset: 'SOL', proxy: '0x4ffC43a60e009B551865A93d232E33Fce9f01507', decimals: 8 },
  { asset: 'UNI', proxy: '0x553303d460EE0afB37EdFf9bE42922D8FF63220e', decimals: 8 },
  { asset: 'USDC', proxy: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', decimals: 8 },
  { asset: 'USDT', proxy: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', decimals: 8 },
];

export const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana',
  XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOT: 'polkadot',
  ATOM: 'cosmos', NEAR: 'near', SUI: 'sui', APT: 'aptos',
  SEI: 'sei-network', TRX: 'tron', LTC: 'litecoin', MATIC: 'matic-network',
  ARB: 'arbitrum', OP: 'optimism', IMX: 'immutable-x', UNI: 'uniswap',
  AAVE: 'aave', LINK: 'chainlink', MKR: 'maker', LDO: 'lido-dao',
  INJ: 'injective-protocol', DOGE: 'dogecoin', SHIB: 'shiba-inu',
  PEPE: 'pepe', WIF: 'dogwifcoin', FLOKI: 'floki', BONK: 'bonk',
  FET: 'fetch-ai', RENDER: 'render-token', WLD: 'worldcoin-wld',
  FIL: 'filecoin', GRT: 'the-graph', AR: 'arweave', ICP: 'internet-computer',
  HBAR: 'hedera-hashgraph', VET: 'vechain',
  USDT: 'tether', USDC: 'usd-coin', DAI: 'dai',
};

export const CANDLE_INTERVALS: Array<{ intervalType: string; seconds: number }> = [
  { intervalType: '1m', seconds: 60 },
  { intervalType: '5m', seconds: 300 },
  { intervalType: '15m', seconds: 900 },
  { intervalType: '30m', seconds: 1800 },
  { intervalType: '1h', seconds: 3600 },
  { intervalType: '4h', seconds: 14400 },
  { intervalType: '1d', seconds: 86400 },
];

export type PricePoint = { t: number; p: number };

export type FoldedCandle = {
  openTimeSec: number;
  closeTimeSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const WORD = 64;

/** Decode Chainlink latestRoundData ABI words. Answer uses the feed decimals. */
export function decodeChainlinkRound(hex: string, decimals: number, nowSec: number, maxAgeSec: number): number | null {
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (raw.length < WORD * 4) return null;
  const answer = BigInt('0x' + raw.slice(WORD, WORD * 2));
  const updatedAt = Number(BigInt('0x' + raw.slice(WORD * 3, WORD * 4)));
  if (answer <= 0n || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  if (nowSec - updatedAt > maxAgeSec) return null;
  const scale = 10 ** decimals;
  const price = Number(answer) / scale;
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function formatOraclePrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '';
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(6);
  return price.toFixed(8);
}

/** USDT price, or BTC price when the market is quoted in BTC. Same snapshot, no extra request. */
export function priceInQuote(baseUsd: number, quote: string, usdtUsd: number, btcUsd: number): number | null {
  if (!Number.isFinite(baseUsd) || baseUsd <= 0) return null;
  const q = quote.toUpperCase();
  if (q === 'USDT' || q === 'USDC' || q === 'USD') {
    const unit = Number.isFinite(usdtUsd) && usdtUsd > 0 ? usdtUsd : 1;
    return baseUsd / unit;
  }
  if (q === 'BTC') {
    if (!Number.isFinite(btcUsd) || btcUsd <= 0) return null;
    return baseUsd / btcUsd;
  }
  return null;
}

/** Hourly sparkline: the last sample is "now", each earlier sample is one hour back. */
export function sparklineToPoints(prices: number[], nowMs: number): PricePoint[] {
  const hour = 3_600_000;
  const out: PricePoint[] = [];
  for (let i = 0; i < prices.length; i++) {
    const p = prices[i]!;
    if (!Number.isFinite(p) || p <= 0) continue;
    out.push({ t: Math.floor((nowMs - (prices.length - 1 - i) * hour) / 1000), p });
  }
  return out;
}

export function foldCandles(points: PricePoint[], intervalSec: number): FoldedCandle[] {
  const buckets = new Map<number, FoldedCandle>();
  const ordered = [...points].sort((a, b) => a.t - b.t);
  for (const pt of ordered) {
    if (!Number.isFinite(pt.p) || pt.p <= 0 || !Number.isFinite(pt.t)) continue;
    const openTimeSec = Math.floor(pt.t / intervalSec) * intervalSec;
    const existing = buckets.get(openTimeSec);
    if (!existing) {
      buckets.set(openTimeSec, {
        openTimeSec,
        closeTimeSec: openTimeSec + intervalSec,
        open: pt.p,
        high: pt.p,
        low: pt.p,
        close: pt.p,
      });
      continue;
    }
    existing.high = Math.max(existing.high, pt.p);
    existing.low = Math.min(existing.low, pt.p);
    existing.close = pt.p;
  }
  return [...buckets.values()].sort((a, b) => a.openTimeSec - b.openTimeSec);
}

export function window24h(points: PricePoint[], nowSec: number): { open: number; high: number; low: number; close: number } | null {
  const cutoff = nowSec - 86_400;
  const window = points.filter((pt) => pt.t >= cutoff && Number.isFinite(pt.p) && pt.p > 0).sort((a, b) => a.t - b.t);
  if (!window.length) return null;
  let high = window[0]!.p;
  let low = window[0]!.p;
  for (const pt of window) {
    high = Math.max(high, pt.p);
    low = Math.min(low, pt.p);
  }
  return { open: window[0]!.p, high, low, close: window[window.length - 1]!.p };
}
