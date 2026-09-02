/**
 * Current Bid/Ask always overlay the chart when the quote is valid.
 * Historical candle CLOSE may differ from the live DEMO quote — that is expected.
 * Never merge Yahoo OHLC with simulated ticks into a forming candle.
 * Never hide the executable quote behind a stale LAST/CLOSE marker.
 */

export const FOREX_QUOTE_OVERLAY_MAX_REL = 0.0025; // informational only

export type QuoteOverlayDecision =
  | { overlay: true; bid: number; ask: number; aligned: boolean }
  | { overlay: false; reason: string; bid: number; ask: number; aligned: false };

export function decideQuoteChartOverlay(args: {
  lastClose: number | null;
  bid: number;
  ask: number;
}): QuoteOverlayDecision {
  const { bid, ask } = args;
  if (![bid, ask].every((n) => Number.isFinite(n) && n > 0) || ask < bid) {
    return { overlay: false, reason: 'INVALID_QUOTE', bid, ask, aligned: false };
  }
  const close = args.lastClose;
  if (close == null || !Number.isFinite(close) || close <= 0) {
    return { overlay: true, bid, ask, aligned: false };
  }
  const mid = (bid + ask) / 2;
  const rel = Math.abs(mid - close) / close;
  return { overlay: true, bid, ask, aligned: rel <= FOREX_QUOTE_OVERLAY_MAX_REL };
}
