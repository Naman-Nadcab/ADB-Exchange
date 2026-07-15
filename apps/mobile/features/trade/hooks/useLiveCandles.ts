import { useMemo } from 'react';
import type { Candle, RecentTrade } from '@exchange/mobile-types';
import { useCandles } from './useTrade';

function parseTradeTs(trade: RecentTrade): number | null {
  if (trade.timestamp && Number.isFinite(trade.timestamp)) {
    return trade.timestamp > 1e12 ? Math.floor(trade.timestamp / 1000) : trade.timestamp;
  }
  const iso = trade.time ?? trade.created_at;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function bucketTime(tsSec: number, intervalSec: number): number {
  return Math.floor(tsSec / intervalSec) * intervalSec;
}

export function mergeTradesIntoCandles(
  candles: Candle[],
  trades: RecentTrade[],
  intervalSec: number,
): Candle[] {
  if (!candles.length) return candles;
  const out = candles.map((c) => ({ ...c }));
  const sortedTrades = [...trades].sort((a, b) => (parseTradeTs(a) ?? 0) - (parseTradeTs(b) ?? 0));

  for (const t of sortedTrades) {
    const ts = parseTradeTs(t);
    if (!ts) continue;
    const bucket = bucketTime(ts, intervalSec);
    const price = t.price;
    const qty = t.quantity;
    let idx = out.findIndex((c) => c.time === bucket);
    if (idx === -1) {
      const last = out[out.length - 1];
      if (!last || bucket < last.time) continue;
      out.push({
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty,
      });
      continue;
    }
    const c = out[idx]!;
    const h = Math.max(parseFloat(c.high), parseFloat(price));
    const l = Math.min(parseFloat(c.low), parseFloat(price));
    const vol = parseFloat(c.volume) + parseFloat(qty);
    out[idx] = { ...c, high: String(h), low: String(l), close: price, volume: String(vol) };
  }
  return out;
}

export function useLiveCandles(symbol: string, intervalSec: number, trades: RecentTrade[] = [], enabled = true) {
  const q = useCandles(symbol, intervalSec, enabled);
  const liveCandles = useMemo(
    () => mergeTradesIntoCandles(q.data ?? [], trades, intervalSec),
    [q.data, trades, intervalSec],
  );
  return { ...q, data: liveCandles };
}
