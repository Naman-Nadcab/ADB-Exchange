import type { OrderbookLevel } from '@/hooks/useSpotWs';

export type SpotTradeLike = { price: string; time?: string };

/** Best-effort mid from top of book; falls back to one-sided quote when the other side is empty. */
export function orderbookMid(
  bids?: OrderbookLevel[] | null,
  asks?: OrderbookLevel[] | null
): string | null {
  const bid = bids?.[0]?.price;
  const ask = asks?.[0]?.price;
  const b = bid != null && bid !== '' ? Number(bid) : NaN;
  const a = ask != null && ask !== '' ? Number(ask) : NaN;
  if (Number.isFinite(b) && Number.isFinite(a) && a >= b) return String((b + a) / 2);
  if (Number.isFinite(b) && b > 0) return bid!;
  if (Number.isFinite(a) && a > 0) return ask!;
  return null;
}

export function isPriceNearReference(
  price: string | number | null | undefined,
  ref: number | null | undefined,
  maxDeviationPct = 0.2
): boolean {
  if (ref == null || !Number.isFinite(ref) || ref <= 0) return true;
  const p = typeof price === 'string' ? Number(price) : price;
  if (p == null || !Number.isFinite(p) || p <= 0) return false;
  return Math.abs(p - ref) / ref <= maxDeviationPct;
}

/**
 * Canonical spot last price for terminal widgets.
 * Prefer live ticker (oracle/trade) over stale tape; validate tape against reference.
 */
export function resolveSpotDisplayLastPrice(opts: {
  tickerLast?: string | null;
  orderbook?: { bids?: OrderbookLevel[]; asks?: OrderbookLevel[] } | null;
  recentTrades?: SpotTradeLike[];
}): string | null {
  const ticker = opts.tickerLast?.trim() || null;
  const mid = orderbookMid(opts.orderbook?.bids, opts.orderbook?.asks);
  const tape = opts.recentTrades?.[0]?.price?.trim() || null;

  const refNum =
    ticker && Number.isFinite(Number(ticker)) && Number(ticker) > 0
      ? Number(ticker)
      : mid && Number.isFinite(Number(mid)) && Number(mid) > 0
        ? Number(mid)
        : null;

  if (ticker && Number.isFinite(Number(ticker)) && Number(ticker) > 0) {
    if (!tape || isPriceNearReference(tape, Number(ticker), 0.15)) return ticker;
  }

  if (mid) return mid;

  if (tape && refNum != null && isPriceNearReference(tape, refNum, 0.15)) return tape;
  if (ticker) return ticker;
  return tape;
}

/** Hide synthetic / QA fills that are far from the live reference price. */
export function filterTradesForDisplay<T extends SpotTradeLike>(
  trades: T[],
  referencePrice: string | null,
  maxDeviationPct = 0.2
): T[] {
  const ref = referencePrice ? Number(referencePrice) : NaN;
  if (!Number.isFinite(ref) || ref <= 0) return trades;
  const filtered = trades.filter((t) => isPriceNearReference(t.price, ref, maxDeviationPct));
  return filtered;
}

/**
 * Stream freshness for chart badge — oracle/reference markets may have no recent tape
 * while ticker and book remain live.
 */
export function resolveStreamFreshnessSec(opts: {
  recentTrades?: SpotTradeLike[];
  streamPhase?: string;
  tickerLast?: string | null;
  maxTapeAgeForReferenceSec?: number;
}): number | null {
  const maxTapeAge = opts.maxTapeAgeForReferenceSec ?? 60;
  let tapeAge: number | null = null;
  const raw = opts.recentTrades?.[0]?.time;
  if (raw) {
    const ts = Date.parse(raw);
    if (Number.isFinite(ts) && ts > 0) tapeAge = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  }

  const hasLiveTicker =
    opts.streamPhase === 'live' &&
    opts.tickerLast != null &&
    opts.tickerLast.trim() !== '' &&
    Number.isFinite(Number(opts.tickerLast)) &&
    Number(opts.tickerLast) > 0;

  if (hasLiveTicker && tapeAge != null && tapeAge > maxTapeAge) {
    return 1;
  }

  return tapeAge;
}
