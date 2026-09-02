/**
 * Decide whether Bid/Ask may be drawn on historical candles.
 * Never merge Yahoo OHLC with simulated ticks into a forming candle.
 * Overlay only when quote mid sits inside a tight band of last close.
 */

/** Max relative distance between quote mid and last close before overlay is suppressed. */
export const FOREX_QUOTE_OVERLAY_MAX_REL = 0.0025; // 0.25%

export type QuoteOverlayDecision =
  | { overlay: true; bid: number; ask: number }
  | { overlay: false; reason: string; bid: number; ask: number };

export function decideQuoteChartOverlay(args: {
  lastClose: number | null;
  bid: number;
  ask: number;
}): QuoteOverlayDecision {
  const { bid, ask } = args;
  if (![bid, ask].every((n) => Number.isFinite(n) && n > 0) || ask < bid) {
    return { overlay: false, reason: 'INVALID_QUOTE', bid, ask };
  }
  const close = args.lastClose;
  if (close == null || !Number.isFinite(close) || close <= 0) {
    return { overlay: false, reason: 'NO_CANDLES', bid, ask };
  }
  const mid = (bid + ask) / 2;
  const rel = Math.abs(mid - close) / close;
  if (rel > FOREX_QUOTE_OVERLAY_MAX_REL) {
    return { overlay: false, reason: 'QUOTE_CANDLE_DIVERGENCE', bid, ask };
  }
  return { overlay: true, bid, ask };
}
