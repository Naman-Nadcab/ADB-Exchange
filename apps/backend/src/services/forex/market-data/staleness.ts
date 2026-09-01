import { forexConfig } from '../config.js';
import type { ForexFreshness, ForexQuoteQuality, ForexQuoteSource } from '../types.js';

export interface StalenessInput {
  providerTimestamp: Date;
  receivedTimestamp: Date;
  now: Date;
  staleMs?: number;
  providerStaleMs?: number;
}

export interface StalenessResult {
  freshness: ForexFreshness;
  receivedAgeMs: number;
  providerAgeMs: number;
}

export function evaluateStaleness(input: StalenessInput): StalenessResult {
  const staleMs = input.staleMs ?? forexConfig.quoteStaleMs;
  const providerStaleMs = input.providerStaleMs ?? forexConfig.quoteProviderStaleMs;
  const receivedAgeMs = input.now.getTime() - input.receivedTimestamp.getTime();
  const providerAgeMs = input.now.getTime() - input.providerTimestamp.getTime();
  const stale = receivedAgeMs > staleMs || providerAgeMs > providerStaleMs;
  return {
    freshness: stale ? 'STALE' : 'FRESH',
    receivedAgeMs,
    providerAgeMs,
  };
}

/**
 * Simulated quotes never become LIVE. Stale quotes never become FRESH.
 * Crossing/halt take precedence over simulated/ok.
 */
export function resolveQuoteQuality(args: {
  source: ForexQuoteSource;
  freshness: ForexFreshness;
  halted: boolean;
  crossed: boolean;
}): ForexQuoteQuality {
  if (args.crossed) return 'CROSSED';
  if (args.halted) return 'HALTED';
  if (args.freshness === 'STALE') return 'STALE';
  if (args.source === 'SIMULATED') return 'SIMULATED';
  return 'OK';
}
