'use client';

import { useTranslations } from 'next-intl';
import { describeForexError } from '@/lib/forex/models/errors';
import type { ForexError } from '@/lib/forex/models/types';

const FOREX_CODE_TO_ERRORS_KEY: Record<string, string> = {
  INSUFFICIENT_MARGIN: 'forex.codes.INSUFFICIENT_MARGIN',
  INSUFFICIENT_FOREX_BALANCE: 'forex.codes.INSUFFICIENT_FOREX_BALANCE',
  SESSION_CLOSED: 'forex.codes.SESSION_CLOSED',
  STALE_MARKET: 'forex.codes.STALE_MARKET',
  UNAUTHORIZED: 'forex.codes.UNAUTHORIZED',
  UNAUTHENTICATED: 'forex.codes.UNAUTHORIZED',
  SESSION_EXPIRED: 'forex.codes.SESSION_EXPIRED',
  AUTH_REQUIRED: 'forex.authRequired',
  INVALID_TOKEN: 'forex.codes.UNAUTHORIZED',
  NETWORK_ERROR: 'forex.networkFailed',
};

/** Presentation-only Forex error copy; underlying codes unchanged. */
export function useForexErrorMessage(err: ForexError | null | undefined): string | null {
  const te = useTranslations('errors');
  if (!err) return null;
  const rel = FOREX_CODE_TO_ERRORS_KEY[err.code];
  if (rel) {
    try {
      const msg = te(rel);
      if (msg && msg !== rel) return msg;
    } catch {
      /* fall through */
    }
  }
  return describeForexError(err);
}
