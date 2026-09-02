import type { ForexError } from './types';

const FALLBACK: ForexError = {
  code: 'FOREX_REQUEST_FAILED',
  message: 'Forex request failed',
};

/** Map backend envelope / network failures. Never collapse to a generic-only string. */
export function normalizeForexError(input: unknown, fallbackMessage?: string): ForexError {
  if (!input || typeof input !== 'object') {
    return { ...FALLBACK, message: fallbackMessage ?? FALLBACK.message };
  }
  const rec = input as Record<string, unknown>;
  const nested = rec.error && typeof rec.error === 'object' ? (rec.error as Record<string, unknown>) : rec;
  const code = typeof nested.code === 'string' && nested.code.trim() ? nested.code : FALLBACK.code;
  const message =
    typeof nested.message === 'string' && nested.message.trim()
      ? nested.message
      : fallbackMessage ?? FALLBACK.message;
  const source = typeof nested.source === 'string' ? nested.source : undefined;
  return source ? { code, message, source } : { code, message };
}

export function formatForexError(err: ForexError): string {
  return `${err.code}: ${err.message}`;
}

export function describeForexError(err: ForexError): string {
  switch (err.code) {
    case 'UNAUTHORIZED':
    case 'UNAUTHENTICATED':
    case 'SESSION_EXPIRED':
    case 'AUTH_REQUIRED':
    case 'INVALID_TOKEN':
      return `${err.code}: ${err.message}. Sign in with a user JWT to use private Forex.`;
    case 'SESSION_CLOSED':
    case 'HOLIDAY_UNCONFIGURED':
      return `${err.code}: ${err.message}. Market is not eligible for new orders.`;
    case 'STALE_MARKET':
      return `${err.code}: ${err.message}. Quote is stale — live execution is disabled.`;
    case 'ACCOUNT_RESTRICTED':
    case 'LIQUIDATION_ONLY':
    case 'FOREX_HALTED':
    case 'RISK_REJECTED':
    case 'MAX_MARGIN_UTILIZATION':
    case 'MAX_ACCOUNT_EXPOSURE':
      return `${err.code}: ${err.message}`;
    case 'FOREX_NOT_READY':
      return `${err.code}: ${err.message}. Forex economic state is not hydrated.`;
    case 'FOREX_CANDLES_UNAVAILABLE':
    case 'NO_DURABLE_OHLC':
      return `${err.code}: ${err.message}. Historical Forex OHLC is currently unavailable.`;
    case 'FOREX_CANDLES_INVALID':
    case 'FOREX_CANDLES_OHLC_INVALID':
    case 'FOREX_CANDLES_ORDER_INVALID':
    case 'FOREX_CANDLES_DUPLICATE_TIMESTAMP':
    case 'FOREX_CANDLES_SYMBOL_MISMATCH':
    case 'FOREX_CANDLES_TIMEFRAME_MISMATCH':
    case 'FOREX_CANDLES_INVALID_TIMESTAMP':
    case 'FOREX_TIMEFRAME_UNSUPPORTED':
    case 'FOREX_SYMBOL_REQUIRED':
    case 'FOREX_PREVIEW_UNAVAILABLE':
    case 'FOREX_PREVIEW_INVALID':
    case 'FOREX_CLOSE_UNAVAILABLE':
    case 'CLOSE_VOLUME_EXCEEDS_POSITION':
    case 'NOT_A_CLOSE':
    case 'STALE_POSITION':
    case 'POSITION_NOT_FOUND':
    case 'POSITION_CLOSED':
    case 'POSITION_NOT_OPEN':
    case 'INVALID_PROTECTION':
    case 'INVALID_PROTECTION_TYPE':
    case 'INVALID_TRIGGER_PRICE':
    case 'INVALID_TRIGGER_DIRECTION':
    case 'TRIGGER_ALREADY_MET':
    case 'DUPLICATE_PROTECTION':
    case 'PROTECTION_NOT_FOUND':
    case 'FOREX_DEMO_FUNDING_DISABLED':
    case 'FOREX_DEMO_FUNDING_BLOCKED':
    case 'FOREX_FUNDING_TEST_FORBIDDEN':
    case 'INSUFFICIENT_MARGIN':
    case 'INSUFFICIENT_FOREX_BALANCE':
    case 'INVALID_VOLUME':
    case 'INVALID_VOLUME_STEP':
    case 'INVALID_PRICE':
    case 'STALE_MARKET':
    case 'RISK_REJECTED':
    case 'DEALING_RESTRICTED':
      return `${err.code}: ${err.message}`;
    case 'NETWORK_ERROR':
      return `${err.code}: ${err.message}. Connection to the Forex API failed.`;
    default:
      return `${err.code}: ${err.message}`;
  }
}
