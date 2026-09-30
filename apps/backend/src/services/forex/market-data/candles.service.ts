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
import { getForexPricingService } from '../quotes.service.js';
import { mergeMockAuthorityLiveBar, type ForexMarketDataAuthorityMeta } from './mock-authority.js';
import { listForexCustomerCandleTimeframes, resolveForexCandleTimeframePlan } from './candle-timeframe-plans.js';

export const FOREX_CANDLE_RESERVED_TIMEFRAMES = listForexCustomerCandleTimeframes();
export type ForexReservedTimeframe = string;

/**
 * Durable EDA OHLC store is still empty. External Yahoo history is optional.
 * FOREX_OHLC_PROVIDER=off keeps the original UNAVAILABLE contract.
 */
export function forexSupportedCandleTimeframes(): readonly string[] {
  return forexOhlcProviderName() === 'yahoo' ? listForexCustomerCandleTimeframes() : [];
}

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
        supportedTimeframes: forexSupportedCandleTimeframes(),
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
          marketDataAuthority?: ForexMarketDataAuthorityMeta;
          /** Last bar is SIMULATED when mock authority merge applied. */
          liveCandleSource?: 'SIMULATED' | 'EXTERNAL';
          historicalCandleSource?: 'EXTERNAL';
        };
      }
    | { success: false; error: { code: string; message: string; source: 'SIMULATED' } };
}> {
  const base = forexCandlesPayload(query);
  if (!base.body.success) return base;
  if (forexOhlcProviderName() !== 'yahoo') return base;

  const yahoo = await import('./ohlc-yahoo.js');
  const supported = listForexCustomerCandleTimeframes();
  const rawTf = query.timeframe?.trim() || '1D';
  const plan = resolveForexCandleTimeframePlan(rawTf);
  if (!plan) {
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
    const fetchTf = plan.kind === 'yahoo' ? plan.timeframe : plan.sourceTimeframe;
    const fetched = await yahoo.fetchYahooOhlc({
      symbol: base.body.data.symbol,
      timeframe: fetchTf,
      limit: plan.kind === 'aggregate' ? FOREX_CANDLE_MAX_LIMIT : base.body.data.limit,
      from: base.body.data.from ?? undefined,
      to: base.body.data.to ?? undefined,
    });
    let bars = yahoo.alignBarsToTimeframe(fetched.bars, fetchTf);
    let reason = 'EXTERNAL_YAHOO';
    let providerNote = fetched.note;
    if (plan.kind === 'aggregate') {
      const bucketFn = plan.bucketFn === 'week' ? 'week' : plan.bucketFn === 'month' ? 'month' : 'floor';
      bars = yahoo.aggregateToBucketMs(bars, plan.bucketMs, bucketFn);
      bars = yahoo.alignBarsToTimeframe(bars, rawTf);
      if (bars.length > base.body.data.limit) {
        bars = bars.slice(bars.length - base.body.data.limit);
      }
      reason = `EXTERNAL_YAHOO_AGGREGATED_${plan.mt5Label}`;
      providerNote = [fetched.note, plan.note].filter(Boolean).join(' · ');
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

    const quote = getForexPricingService().getQuote(base.body.data.symbol);
    const merged = mergeMockAuthorityLiveBar({
      symbol: base.body.data.symbol,
      timeframe: rawTf,
      referenceBars: bars,
      quote,
    });
    const outCandles = merged.merged ? merged.candles : bars;
    const authorityNote = merged.meta
      ? 'Historical OHLC: EXTERNAL Yahoo · Current bucket: SIMULATED MOCK quote (executable authority)'
      : undefined;
    const combinedNote = [providerNote, authorityNote].filter(Boolean).join(' · ') || undefined;

    return {
      status: 200,
      body: {
        success: true,
        data: {
          ...base.body.data,
          timeframe: rawTf,
          source: merged.meta ? 'SIMULATED' : 'EXTERNAL',
          provider: merged.meta ? 'MOCK-C' : 'yahoo',
          availability: 'AVAILABLE',
          reason: merged.meta ? 'SIMULATED_MOCK_WITH_REFERENCE_HISTORY' : reason,
          supportedTimeframes: supported,
          candles: outCandles,
          count: outCandles.length,
          providerNote: combinedNote,
          marketDataAuthority: merged.meta ?? undefined,
          liveCandleSource: merged.meta ? 'SIMULATED' : 'EXTERNAL',
          historicalCandleSource: 'EXTERNAL',
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
