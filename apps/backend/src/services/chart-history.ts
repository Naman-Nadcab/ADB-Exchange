/**
 * Reference OHLC for the spot chart. These bars are not exchange prints:
 * volume and trade_count stay 0, and rows that already count a real trade
 * are left untouched.
 */
export const CHART_HISTORY_BARS = 1000;
export const CHART_HISTORY_URL = 'https://data-api.binance.vision/api/v3/klines';
/** Small public tail. Used only when stored history is already full but the newest bar has stopped moving. */
export const CHART_TAIL_BARS = 30;
export const CHART_TAIL_LAG_INTERVALS = 2;

export function needsChartHistoryBackfill(
  count: number,
  flat: number,
  target = CHART_HISTORY_BARS,
  recentFlat = 0
): boolean {
  const n = Number.isFinite(count) ? count : 0;
  const flatN = Number.isFinite(flat) ? flat : 0;
  const recent = Number.isFinite(recentFlat) ? recentFlat : 0;
  if (recent >= 5) return true;
  if (n < Math.floor(target * 0.8)) return true;
  if (n <= 0) return true;
  return flatN / n > 0.5;
}

/**
 * A full series can still be stuck: backfill stops once the window looks healthy,
 * so new minutes never arrive. Sync a short tail when the newest bar is at least
 * two intervals behind the current bucket.
 */
export function needsChartTailSync(
  newestOpenMs: number | null,
  intervalSec: number,
  nowMs = Date.now(),
  lagIntervals = CHART_TAIL_LAG_INTERVALS
): boolean {
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) return false;
  if (newestOpenMs == null || !Number.isFinite(newestOpenMs) || newestOpenMs <= 0) return true;
  const bucketMs = intervalSec * 1000;
  const currentOpenMs = Math.floor(nowMs / bucketMs) * bucketMs;
  return currentOpenMs - newestOpenMs >= lagIntervals * bucketMs;
}

export type ReferenceKline = {
  openTime: Date;
  closeTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
};

/** Binance kline tuple → display OHLC. Volume is intentionally dropped. */
export function referenceKline(row: Array<number | string>): ReferenceKline | null {
  const openTimeMs = Number(row[0]);
  const closeTimeMs = Number(row[6]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  if (![openTimeMs, closeTimeMs, open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (high < low || high < open || high < close || low > open || low > close) return null;
  return {
    openTime: new Date(openTimeMs),
    closeTime: new Date(closeTimeMs + 1),
    open: String(row[1]),
    high: String(row[2]),
    low: String(row[3]),
    close: String(row[4]),
  };
}
