/**
 * Authoritative Forex chart timeframe resolution (Yahoo native + deterministic aggregation).
 */
import type { YahooForexTimeframe } from './ohlc-yahoo.js';

export type ForexCandleTimeframePlan =
  | { kind: 'yahoo'; timeframe: YahooForexTimeframe; mt5Label: string }
  | {
      kind: 'aggregate';
      targetTimeframe: string;
      sourceTimeframe: YahooForexTimeframe;
      bucketMs: number;
      mt5Label: string;
      note: string;
      bucketFn?: 'week' | 'month';
    };

const MIN = 60_000;
const H = 3_600_000;
const D = 24 * H;

function agg(
  target: string,
  source: YahooForexTimeframe,
  bucketMs: number,
  mt5Label: string,
  note: string,
  bucketFn?: 'week' | 'month'
): ForexCandleTimeframePlan {
  return { kind: 'aggregate', targetTimeframe: target, sourceTimeframe: source, bucketMs, mt5Label, note, bucketFn };
}

export const FOREX_CANDLE_TIMEFRAME_PLANS: Record<string, ForexCandleTimeframePlan> = {
  '1m': { kind: 'yahoo', timeframe: '1m', mt5Label: 'M1' },
  '2m': agg('2m', '1m', 2 * MIN, 'M2', 'Aggregated from Yahoo 1m OHLC'),
  '3m': agg('3m', '1m', 3 * MIN, 'M3', 'Aggregated from Yahoo 1m OHLC'),
  '4m': agg('4m', '1m', 4 * MIN, 'M4', 'Aggregated from Yahoo 1m OHLC'),
  '5m': { kind: 'yahoo', timeframe: '5m', mt5Label: 'M5' },
  '6m': agg('6m', '1m', 6 * MIN, 'M6', 'Aggregated from Yahoo 1m OHLC'),
  '10m': agg('10m', '5m', 10 * MIN, 'M10', 'Aggregated from Yahoo 5m OHLC'),
  '12m': agg('12m', '1m', 12 * MIN, 'M12', 'Aggregated from Yahoo 1m OHLC'),
  '15m': { kind: 'yahoo', timeframe: '15m', mt5Label: 'M15' },
  '20m': agg('20m', '5m', 20 * MIN, 'M20', 'Aggregated from Yahoo 5m OHLC'),
  '30m': agg('30m', '15m', 30 * MIN, 'M30', 'Aggregated from Yahoo 15m OHLC'),
  '1h': { kind: 'yahoo', timeframe: '1h', mt5Label: 'H1' },
  '2h': agg('2h', '1h', 2 * H, 'H2', 'Aggregated from Yahoo 1h OHLC'),
  '3h': agg('3h', '1h', 3 * H, 'H3', 'Aggregated from Yahoo 1h OHLC'),
  '4h': agg('4h', '1h', 4 * H, 'H4', 'Aggregated from Yahoo 1h OHLC'),
  '6h': agg('6h', '1h', 6 * H, 'H6', 'Aggregated from Yahoo 1h OHLC'),
  '8h': agg('8h', '1h', 8 * H, 'H8', 'Aggregated from Yahoo 1h OHLC'),
  '12h': agg('12h', '1h', 12 * H, 'H12', 'Aggregated from Yahoo 1h OHLC'),
  '1D': { kind: 'yahoo', timeframe: '1D', mt5Label: 'D1' },
  '1W': agg('1W', '1D', 7 * D, 'W1', 'Aggregated from Yahoo 1D OHLC (Monday UTC)', 'week'),
  '1M': agg('1M', '1D', 30 * D, 'MN1', 'Aggregated from Yahoo 1D OHLC (calendar month UTC)', 'month'),
};

export function listForexCustomerCandleTimeframes(): string[] {
  return Object.keys(FOREX_CANDLE_TIMEFRAME_PLANS);
}

export function resolveForexCandleTimeframePlan(timeframe: string): ForexCandleTimeframePlan | null {
  return FOREX_CANDLE_TIMEFRAME_PLANS[timeframe] ?? null;
}
