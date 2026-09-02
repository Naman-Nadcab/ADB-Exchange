import { describeForexError, normalizeForexError } from './errors';
import type { ForexError } from './types';

/** Reserved names only. None are served until the backend advertises them. */
export const FOREX_CANDLE_RESERVED_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const;
export type ForexTimeframe = (typeof FOREX_CANDLE_RESERVED_TIMEFRAMES)[number];

export type ForexCandleAvailability = 'AVAILABLE' | 'UNAVAILABLE';

export interface ForexCandle {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export interface ForexCandleQuery {
  symbol: string;
  timeframe?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface ForexCandleResponse {
  symbol: string;
  timeframe: string | null;
  source: string;
  availability: ForexCandleAvailability;
  reason?: string;
  supportedTimeframes: string[];
  count: number;
  limit?: number;
  candles: ForexCandle[];
  providerNote?: string;
  provider?: string;
}

export type ForexCandleViewStatus = 'LOADING' | 'NO_HISTORY' | 'READY' | 'INVALID' | 'ERROR';

export interface ForexCandleView {
  status: ForexCandleViewStatus;
  symbol: string;
  timeframe: string | null;
  supportedTimeframes: string[];
  candles: ForexCandle[];
  source?: string;
  reason?: string;
  providerNote?: string;
  error?: ForexError;
}

export function isReservedForexTimeframe(value: string): value is ForexTimeframe {
  return (FOREX_CANDLE_RESERVED_TIMEFRAMES as readonly string[]).includes(value);
}

export function decCmp(a: string, b: string): number {
  const norm = (s: string) => {
    const neg = s.startsWith('-');
    const raw = neg ? s.slice(1) : s;
    const [i = '0', f = ''] = raw.split('.');
    return { neg, i: i.replace(/^0+(?=\d)/, '') || '0', f };
  };
  const A = norm(a);
  const B = norm(b);
  if (A.neg !== B.neg) return A.neg ? -1 : 1;
  const scale = Math.max(A.f.length, B.f.length);
  const av = BigInt(A.i + A.f.padEnd(scale, '0'));
  const bv = BigInt(B.i + B.f.padEnd(scale, '0'));
  const cmp = av < bv ? -1 : av > bv ? 1 : 0;
  return A.neg ? -cmp : cmp;
}

const PRICE_RE = /^-?\d+(\.\d+)?$/;

export function isValidOhlcRelation(c: Pick<ForexCandle, 'open' | 'high' | 'low' | 'close'>): boolean {
  if (![c.open, c.high, c.low, c.close].every((p) => PRICE_RE.test(p))) return false;
  const maxOc = decCmp(c.open, c.close) >= 0 ? c.open : c.close;
  const minOc = decCmp(c.open, c.close) <= 0 ? c.open : c.close;
  return decCmp(c.high, maxOc) >= 0 && decCmp(c.low, minOc) <= 0;
}

export function candleTimeMs(timestamp: string): number | null {
  if (!timestamp) return null;
  if (/^\d+$/.test(timestamp)) {
    const n = Number(timestamp);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n < 1e12 ? n * 1000 : n;
  }
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? ms : null;
}

export type ForexCandleValidationFailure =
  | { ok: true; candles: ForexCandle[] }
  | { ok: false; code: string; message: string };

export function validateForexCandlePayload(
  raw: unknown,
  query: Pick<ForexCandleQuery, 'symbol' | 'timeframe'>
): ForexCandleValidationFailure {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'FOREX_CANDLES_INVALID', message: 'Candle payload is not an object' };
  }
  const data = raw as Partial<ForexCandleResponse>;
  const symbol = String(data.symbol ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const expected = query.symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!symbol || symbol !== expected) {
    return { ok: false, code: 'FOREX_CANDLES_SYMBOL_MISMATCH', message: `Candle symbol ${symbol || '∅'} does not match ${expected}` };
  }
  if (query.timeframe && data.timeframe && data.timeframe !== query.timeframe) {
    return {
      ok: false,
      code: 'FOREX_CANDLES_TIMEFRAME_MISMATCH',
      message: `Candle timeframe ${data.timeframe} does not match ${query.timeframe}`,
    };
  }
  if (!Array.isArray(data.candles)) {
    return { ok: false, code: 'FOREX_CANDLES_INVALID', message: 'candles must be an array' };
  }

  const out: ForexCandle[] = [];
  let prevMs = -1;
  const seen = new Set<number>();
  for (let i = 0; i < data.candles.length; i += 1) {
    const row = data.candles[i] as Partial<ForexCandle> | null;
    if (!row || typeof row !== 'object') {
      return { ok: false, code: 'FOREX_CANDLES_INVALID', message: `Candle ${i} is not an object` };
    }
    const candle: ForexCandle = {
      timestamp: String(row.timestamp ?? ''),
      open: String(row.open ?? ''),
      high: String(row.high ?? ''),
      low: String(row.low ?? ''),
      close: String(row.close ?? ''),
    };
    const ms = candleTimeMs(candle.timestamp);
    if (ms == null) {
      return { ok: false, code: 'FOREX_CANDLES_INVALID_TIMESTAMP', message: `Candle ${i} has an invalid timestamp` };
    }
    if (seen.has(ms)) {
      return { ok: false, code: 'FOREX_CANDLES_DUPLICATE_TIMESTAMP', message: `Duplicate candle timestamp at index ${i}` };
    }
    if (ms < prevMs) {
      return { ok: false, code: 'FOREX_CANDLES_ORDER_INVALID', message: `Candle timestamps must be ascending (index ${i})` };
    }
    if (!isValidOhlcRelation(candle)) {
      return { ok: false, code: 'FOREX_CANDLES_OHLC_INVALID', message: `Invalid OHLC relationship at index ${i}` };
    }
    seen.add(ms);
    prevMs = ms;
    out.push(candle);
  }
  return { ok: true, candles: out };
}

export function isStaleCandleRequest(
  active: { symbol: string; generation: number },
  incoming: { symbol: string; generation: number }
): boolean {
  return incoming.generation !== active.generation || incoming.symbol !== active.symbol;
}

export function missingRouteAsUnavailable(error: ForexError | undefined): boolean {
  if (!error) return false;
  if (error.code === 'FOREX_CANDLES_UNAVAILABLE' || error.code === 'NO_DURABLE_OHLC') return true;
  if (error.code === 'REQUEST_FAILED' || error.code === 'NOT_FOUND') return true;
  return /not found|route get:\/api\/v1\/forex\/candles/i.test(error.message);
}

export function interpretForexCandleResult(args: {
  symbol: string;
  timeframe?: string;
  ok: boolean;
  data?: unknown;
  error?: ForexError;
}): ForexCandleView {
  const symbol = args.symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!args.ok) {
    const error = args.error ?? normalizeForexError({ code: 'FOREX_REQUEST_FAILED', message: 'Forex candle request failed' });
    if (missingRouteAsUnavailable(error)) {
      return {
        status: 'NO_HISTORY',
        symbol,
        timeframe: args.timeframe ?? null,
        supportedTimeframes: [],
        candles: [],
        reason: 'FOREX_CANDLES_UNAVAILABLE',
      };
    }
    return {
      status: 'ERROR',
      symbol,
      timeframe: args.timeframe ?? null,
      supportedTimeframes: [],
      candles: [],
      error: { ...error, message: describeForexError(error) },
    };
  }

  const data = (args.data ?? {}) as Partial<ForexCandleResponse>;
  const supported = Array.isArray(data.supportedTimeframes)
    ? data.supportedTimeframes.filter((tf) => typeof tf === 'string' && isReservedForexTimeframe(tf))
    : [];

  if (data.availability === 'UNAVAILABLE' || (Array.isArray(data.candles) && data.candles.length === 0)) {
    const validatedEmpty = validateForexCandlePayload(
      { ...data, symbol: data.symbol ?? symbol, candles: data.candles ?? [] },
      { symbol, timeframe: args.timeframe }
    );
    if (!validatedEmpty.ok && Array.isArray(data.candles) && data.candles.length > 0) {
      return {
        status: 'INVALID',
        symbol,
        timeframe: args.timeframe ?? data.timeframe ?? null,
        supportedTimeframes: supported,
        candles: [],
        error: { code: validatedEmpty.code, message: validatedEmpty.message },
      };
    }
    return {
      status: 'NO_HISTORY',
      symbol,
      timeframe: args.timeframe ?? data.timeframe ?? null,
      supportedTimeframes: supported,
      candles: [],
      source: data.source,
      reason: data.reason ?? 'NO_DURABLE_OHLC',
    };
  }

  const validated = validateForexCandlePayload({ ...data, symbol: data.symbol ?? symbol }, { symbol, timeframe: args.timeframe });
  if (!validated.ok) {
    return {
      status: 'INVALID',
      symbol,
      timeframe: args.timeframe ?? data.timeframe ?? null,
      supportedTimeframes: supported,
      candles: [],
      error: { code: validated.code, message: validated.message },
    };
  }
  if (validated.candles.length === 0) {
    return {
      status: 'NO_HISTORY',
      symbol,
      timeframe: args.timeframe ?? data.timeframe ?? null,
      supportedTimeframes: supported,
      candles: [],
      source: data.source,
      reason: data.reason ?? 'NO_DURABLE_OHLC',
    };
  }
  return {
    status: 'READY',
    symbol,
    timeframe: args.timeframe ?? data.timeframe ?? null,
    supportedTimeframes: supported,
    candles: validated.candles,
    source: data.source,
    reason: data.reason,
    providerNote: typeof data.providerNote === 'string' ? data.providerNote : undefined,
  };
}

export function loadingForexCandleView(symbol: string, timeframe?: string): ForexCandleView {
  return {
    status: 'LOADING',
    symbol: symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
    timeframe: timeframe ?? null,
    supportedTimeframes: [],
    candles: [],
  };
}
