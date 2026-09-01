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
    case 'NETWORK_ERROR':
      return `${err.code}: ${err.message}. Connection to the Forex API failed.`;
    default:
      return `${err.code}: ${err.message}`;
  }
}
