import type { OrderbookSnapshot, RecentTrade } from '@exchange/mobile-types';

function orderbookMid(
  bids?: OrderbookSnapshot['bids'] | null,
  asks?: OrderbookSnapshot['asks'] | null,
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

function isPriceNearReference(
  price: string | number | null | undefined,
  ref: number | null | undefined,
  maxDeviationPct = 0.2,
): boolean {
  if (ref == null || !Number.isFinite(ref) || ref <= 0) return true;
  const p = typeof price === 'string' ? Number(price) : price;
  if (p == null || !Number.isFinite(p) || p <= 0) return false;
  return Math.abs(p - ref) / ref <= maxDeviationPct;
}

/** Canonical spot last price — matches web terminal resolution. */
export function resolveSpotDisplayLastPrice(opts: {
  tickerLast?: string | null;
  orderbook?: Pick<OrderbookSnapshot, 'bids' | 'asks'> | null;
  recentTrades?: RecentTrade[];
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

export function marketRefPrice(
  side: 'buy' | 'sell',
  orderbook?: Pick<OrderbookSnapshot, 'bids' | 'asks'> | null,
  lastPrice?: string | null,
): number {
  const live = lastPrice ? parseFloat(lastPrice) : NaN;
  const bestAsk = parseFloat(orderbook?.asks?.[0]?.price ?? '');
  const bestBid = parseFloat(orderbook?.bids?.[0]?.price ?? '');
  if (side === 'buy') {
    if (Number.isFinite(bestAsk) && bestAsk > 0) return bestAsk;
    return Number.isFinite(live) ? live : 0;
  }
  if (Number.isFinite(bestBid) && bestBid > 0) return bestBid;
  return Number.isFinite(live) ? live : 0;
}

export function normalizeFeeRate(raw?: string): number {
  const n = Number(raw ?? '');
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}
