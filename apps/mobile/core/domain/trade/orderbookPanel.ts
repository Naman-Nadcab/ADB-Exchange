import type { OrderbookLevel } from '@exchange/mobile-types';

export type BookLevel = { price: string; quantity: string; rawPrice: string };

export const DEPTH_OPTIONS = [15, 20, 30] as const;
export const TICK_PRESETS = [2, 4, 6, 8] as const;

export function tickOptionsForInstrument(pricePrecision: number): number[] {
  const maxP = Math.min(8, Math.max(2, pricePrecision));
  return [...TICK_PRESETS.filter((p) => p <= maxP)];
}

export function defaultDisplayPricePrecision(pricePrecision: number): number {
  const opts = tickOptionsForInstrument(pricePrecision);
  if (opts.includes(2)) return 2;
  return opts[0] ?? 2;
}

export function qtyToNum(q: string): number {
  const n = parseFloat(q);
  return Number.isFinite(n) ? n : 0;
}

export function groupBookLevels(
  levels: OrderbookLevel[],
  displayPrecision: number,
  side: 'buy' | 'sell',
): BookLevel[] {
  const factor = 10 ** displayPrecision;
  const map = new Map<number, { price: number; qty: number; rawPrice: string }>();
  for (const lv of levels) {
    const p = parseFloat(lv.price);
    if (!Number.isFinite(p)) continue;
    const bucket =
      side === 'buy'
        ? Math.floor(p * factor) / factor
        : Math.ceil(p * factor) / factor;
    const key = Math.round(bucket * factor);
    const existing = map.get(key);
    const q = qtyToNum(lv.quantity);
    if (existing) {
      existing.qty += q;
    } else {
      map.set(key, { price: bucket, qty: q, rawPrice: lv.price });
    }
  }
  const rows = Array.from(map.values()).map((r) => ({
    price: r.price.toFixed(displayPrecision),
    quantity: String(r.qty),
    rawPrice: r.rawPrice,
  }));
  return side === 'buy'
    ? rows.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    : rows.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
}

export function cumulativeTotals(levels: BookLevel[]): { totals: number[]; maxCum: number } {
  const totals: number[] = [];
  let cum = 0;
  for (const lv of levels) {
    cum += parseFloat(lv.price) * qtyToNum(lv.quantity);
    totals.push(cum);
  }
  return { totals, maxCum: Math.max(cum, 1) };
}

export type BookSentiment = { buyPct: number; sellPct: number; bidNotional: number; askNotional: number };

export function computeBookSentiment(bids: BookLevel[], asks: BookLevel[]): BookSentiment {
  const bidNotional = bids.reduce((s, l) => s + parseFloat(l.price) * qtyToNum(l.quantity), 0);
  const askNotional = asks.reduce((s, l) => s + parseFloat(l.price) * qtyToNum(l.quantity), 0);
  const total = bidNotional + askNotional;
  if (total <= 0) return { buyPct: 50, sellPct: 50, bidNotional: 0, askNotional: 0 };
  return {
    buyPct: (bidNotional / total) * 100,
    sellPct: (askNotional / total) * 100,
    bidNotional,
    askNotional,
  };
}

export type BookIntelligence = {
  spreadAbs: string;
  spreadPct: string;
  spreadBps: string;
  dominance: string;
  imbalancePct: number;
  largestBid: string;
  largestAsk: string;
};

export function computeBookIntelligence(
  bids: BookLevel[],
  asks: BookLevel[],
  lastPrice?: string | null,
): BookIntelligence {
  const bestBid = parseFloat(bids[0]?.price ?? 'NaN');
  const bestAsk = parseFloat(asks[0]?.price ?? 'NaN');
  const spreadAbs =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestAsk > bestBid
      ? (bestAsk - bestBid).toFixed(8)
      : '—';
  const mid =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) ? (bestBid + bestAsk) / 2 : parseFloat(lastPrice ?? 'NaN');
  const spreadPct =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) && mid > 0
      ? (((bestAsk - bestBid) / mid) * 100).toFixed(3)
      : '—';
  const spreadBps =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) && mid > 0
      ? (((bestAsk - bestBid) / mid) * 10000).toFixed(1)
      : '—';

  const bidNotional = bids.reduce((s, l) => s + parseFloat(l.price) * qtyToNum(l.quantity), 0);
  const askNotional = asks.reduce((s, l) => s + parseFloat(l.price) * qtyToNum(l.quantity), 0);
  const total = bidNotional + askNotional;
  const imbalancePct = total > 0 ? ((bidNotional - askNotional) / total) * 100 : 0;
  const dominance =
    imbalancePct > 8 ? 'Bid-heavy' : imbalancePct < -8 ? 'Ask-heavy' : 'Balanced';

  const largestBid = bids.reduce(
    (best, l) => {
      const n = parseFloat(l.price) * qtyToNum(l.quantity);
      return n > best.n ? { n, label: l.price } : best;
    },
    { n: 0, label: '—' },
  ).label;
  const largestAsk = asks.reduce(
    (best, l) => {
      const n = parseFloat(l.price) * qtyToNum(l.quantity);
      return n > best.n ? { n, label: l.price } : best;
    },
    { n: 0, label: '—' },
  ).label;

  return { spreadAbs, spreadPct, spreadBps, dominance, imbalancePct, largestBid, largestAsk };
}
