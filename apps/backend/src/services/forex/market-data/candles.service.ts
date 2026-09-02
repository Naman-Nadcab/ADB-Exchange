/**
 * Forex OHLC contract.
 *
 * Production mock market data does not persist durable history:
 * - forex_quotes is latest-snapshot only
 * - FOREX_QUOTE_TICKS_PERSIST defaults to false
 * - forex_quote_ticks is empty when persist is off
 * - there is no forex_candles table
 *
 * This endpoint MUST NOT synthesize OHLC from the current quote,
 * mock mid walk, or any Crypto candle store.
 */
import { getForexInstrumentBySymbol, normalizeForexSymbol } from '../instruments.catalog.js';

export const FOREX_CANDLE_RESERVED_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const;
export type ForexReservedTimeframe = (typeof FOREX_CANDLE_RESERVED_TIMEFRAMES)[number];

/**
 * Durable EDA OHLC store is still empty. External Yahoo history is optional.
 * FOREX_OHLC_PROVIDER=off keeps the original UNAVAILABLE contract.
 */
export const FOREX_SUPPORTED_CANDLE_TIMEFRAMES: readonly ForexReservedTimeframe[] = [];

export function forexOhlcProviderName(): 'yahoo' | 'off' {
  const raw = (process.env.FOREX_OHLC_PROVIDER ?? 'yahoo').trim().toLowerCase();
  return raw === 'off' || raw === '0' || raw === 'false' ? 'off' : 'yahoo';
}

export const FOREX_CANDLE_DEFAULT_LIMIT = 300;
export const FOREX_CANDLE_MAX_LIMIT = 500;

export type ForexCandleQuery = {
  symbol?: string;
  timeframe?: string;
  from?: string;
  to?: string;
  limit?: string;
};

export type ForexCandleRecord = {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

function isReservedTimeframe(value: string): value is ForexReservedTimeframe {
  return (FOREX_CANDLE_RESERVED_TIMEFRAMES as readonly string[]).includes(value);
}

function parseOptionalIso(name: string, raw: string | undefined): { ok: true; value?: string } | { ok: false; message: string } {
  if (raw == null || raw.trim() === '') return { ok: true };
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    return { ok: false, message: `${name} must be an ISO-8601 timestamp` };
  }
  return { ok: true, value: new Date(ms).toISOString() };
}

function parseLimit(raw: string | undefined): { ok: true; value: number } | { ok: false; message: string } {
  if (raw == null || raw.trim() === '') return { ok: true, value: FOREX_CANDLE_DEFAULT_LIMIT };
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, message: 'limit must be a positive integer' };
  }
  return { ok: true, value: Math.min(n, FOREX_CANDLE_MAX_LIMIT) };
}

export function forexCandlesPayload(query: ForexCandleQuery): {
  status: 200 | 400 | 404;
  body:
    | {
        success: true;
        data: {
          symbol: string;
          timeframe: string | null;
          source: 'SIMULATED';
          availability: 'UNAVAILABLE';
          reason: 'NO_DURABLE_OHLC';
          supportedTimeframes: readonly string[];
          count: number;
          limit: number;
          from: string | null;
          to: string | null;
          candles: ForexCandleRecord[];
        };
      }
    | { success: false; error: { code: string; message: string; source: 'SIMULATED' } };
} {
  const symbol = normalizeForexSymbol(query.symbol ?? '');
  if (!symbol) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: 'FOREX_SYMBOL_REQUIRED', message: 'symbol is required', source: 'SIMULATED' },
      },
    };
  }
  const instrument = getForexInstrumentBySymbol(symbol);
  if (!instrument) {
    return {
      status: 404,
      body: {
        success: false,
        error: { code: 'FOREX_INSTRUMENT_NOT_FOUND', message: `Unknown Forex symbol ${symbol}`, source: 'SIMULATED' },
      },
    };
  }

  const rawTf = query.timeframe?.trim() ?? '';
  if (rawTf && !isReservedTimeframe(rawTf)) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'FOREX_TIMEFRAME_UNSUPPORTED',
          message: `Unknown Forex timeframe ${rawTf}`,
          source: 'SIMULATED',
        },
      },
    };
  }

  const from = parseOptionalIso('from', query.from);
  if (!from.ok) {
    return {
      status: 400,
      body: { success: false, error: { code: 'FOREX_CANDLE_RANGE_INVALID', message: from.message, source: 'SIMULATED' } },
    };
  }
  const to = parseOptionalIso('to', query.to);
  if (!to.ok) {
    return {
      status: 400,
      body: { success: false, error: { code: 'FOREX_CANDLE_RANGE_INVALID', message: to.message, source: 'SIMULATED' } },
    };
  }
  if (from.value && to.value && Date.parse(from.value) > Date.parse(to.value)) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: 'FOREX_CANDLE_RANGE_INVALID', message: 'from must be less than or equal to to', source: 'SIMULATED' },
      },
    };
  }

  const limit = parseLimit(query.limit);
  if (!limit.ok) {
    return {
      status: 400,
      body: { success: false, error: { code: 'FOREX_CANDLE_LIMIT_INVALID', message: limit.message, source: 'SIMULATED' } },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        symbol: instrument.symbol,
        timeframe: rawTf || null,
        source: 'SIMULATED',
        availability: 'UNAVAILABLE',
        reason: 'NO_DURABLE_OHLC',
        supportedTimeframes: FOREX_SUPPORTED_CANDLE_TIMEFRAMES,
        count: 0,
        limit: limit.value,
        from: from.value ?? null,
        to: to.value ?? null,
        candles: [],
      },
    },
  };
}

export async function forexCandlesResolve(query: ForexCandleQuery): Promise<{
  status: 200 | 400 | 404;
  body:
    | {
        success: true;
        data: {
          symbol: string;
          timeframe: string | null;
          source: 'SIMULATED' | 'EXTERNAL';
          provider?: string;
          availability: 'UNAVAILABLE' | 'AVAILABLE';
          reason: string;
          supportedTimeframes: readonly string[];
          count: number;
          limit: number;
          from: string | null;
          to: string | null;
          candles: ForexCandleRecord[];
          providerNote?: string;
        };
      }
    | { success: false; error: { code: string; message: string; source: 'SIMULATED' } };
}> {
  const base = forexCandlesPayload(query);
  if (!base.body.success) return base;
  if (forexOhlcProviderName() !== 'yahoo') return base;

  const yahoo = await import('./ohlc-yahoo.js');
  const supported = [...yahoo.YAHOO_SUPPORTED_TIMEFRAMES, '30m', '4h', '1W'] as const;
  const rawTf = query.timeframe?.trim() || '1D';
  type AggPlan = {
    sourceTf: '15m' | '1h' | '1D';
    aggregate: (bars: import('./ohlc-yahoo.js').ExternalOhlcBar[]) => import('./ohlc-yahoo.js').ExternalOhlcBar[];
    reason: string;
    note: string;
  };
  const aggregated: Record<string, AggPlan> = {
    '30m': {
      sourceTf: '15m',
      aggregate: yahoo.aggregateFifteenTo30m,
      reason: 'EXTERNAL_YAHOO_AGGREGATED_30M',
      note: '30m aggregated from valid 15m Yahoo OHLC',
    },
    '4h': {
      sourceTf: '1h',
      aggregate: yahoo.aggregateHourlyTo4h,
      reason: 'EXTERNAL_YAHOO_AGGREGATED_4H',
      note: '4h aggregated from valid 1h Yahoo OHLC',
    },
    '1W': {
      sourceTf: '1D',
      aggregate: yahoo.aggregateDailyTo1W,
      reason: 'EXTERNAL_YAHOO_AGGREGATED_1W',
      note: '1W aggregated from valid 1D Yahoo OHLC (Monday UTC weeks)',
    },
  };
  const agg = aggregated[rawTf];
  if (!yahoo.isYahooTimeframe(rawTf) && !agg) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'FOREX_TIMEFRAME_UNSUPPORTED',
          message: `Yahoo OHLC does not serve ${rawTf}`,
          source: 'SIMULATED',
        },
      },
    };
  }

  try {
    const fetchTf = agg ? agg.sourceTf : (rawTf as import('./ohlc-yahoo.js').YahooForexTimeframe);
    const fetched = await yahoo.fetchYahooOhlc({
      symbol: base.body.data.symbol,
      timeframe: fetchTf,
      limit: agg ? FOREX_CANDLE_MAX_LIMIT : base.body.data.limit,
      from: base.body.data.from ?? undefined,
      to: base.body.data.to ?? undefined,
    });
    let bars = yahoo.alignBarsToTimeframe(fetched.bars, agg ? agg.sourceTf : rawTf);
    let reason = 'EXTERNAL_YAHOO';
    let providerNote = fetched.note;
    if (agg) {
      bars = agg.aggregate(bars);
      bars = yahoo.alignBarsToTimeframe(bars, rawTf);
      if (bars.length > base.body.data.limit) {
        bars = bars.slice(bars.length - base.body.data.limit);
      }
      reason = agg.reason;
      providerNote = [fetched.note, agg.note].filter(Boolean).join(' · ');
    } else {
      bars = yahoo.alignBarsToTimeframe(bars, rawTf);
    }
    if (bars.length === 0) {
      return {
        status: 200,
        body: {
          success: true,
          data: {
            ...base.body.data,
            timeframe: rawTf,
            source: 'EXTERNAL',
            provider: 'yahoo',
            availability: 'UNAVAILABLE',
            reason: 'PROVIDER_EMPTY',
            supportedTimeframes: supported,
            candles: [],
            count: 0,
            providerNote,
          },
        },
      };
    }
    return {
      status: 200,
      body: {
        success: true,
        data: {
          ...base.body.data,
          timeframe: rawTf,
          source: 'EXTERNAL',
          provider: 'yahoo',
          availability: 'AVAILABLE',
          reason,
          supportedTimeframes: supported,
          candles: bars,
          count: bars.length,
          providerNote,
        },
      },
    };
  } catch {
    return {
      status: 200,
      body: {
        success: true,
        data: {
          ...base.body.data,
          timeframe: rawTf,
          source: 'EXTERNAL',
          provider: 'yahoo',
          availability: 'UNAVAILABLE',
          reason: 'PROVIDER_UNAVAILABLE',
          supportedTimeframes: supported,
          candles: [],
          count: 0,
        },
      },
    };
  }
}
