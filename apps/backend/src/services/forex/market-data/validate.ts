import { fxDecimal, fxDecimalPlaces, fxPositive } from '../decimal-fx.js';
import type { ForexInstrument, QuoteValidationResult } from '../types.js';

export interface QuoteValidateInput {
  symbol: string;
  bid: string;
  ask: string;
  providerTimestamp: Date;
  receivedTimestamp: Date;
  providerSequence: bigint;
  maxFutureSkewMs: number;
  instrument?: ForexInstrument;
}

/**
 * Fail closed. Never silently clamp, round, or uncross provider data.
 */
export function validateProviderQuote(input: QuoteValidateInput): QuoteValidationResult {
  const instrument = input.instrument;
  if (!instrument) {
    return { ok: false, reason: 'UNKNOWN_INSTRUMENT', detail: `Unknown Forex instrument ${input.symbol}` };
  }

  let bid;
  let ask;
  try {
    bid = fxDecimal(input.bid);
    ask = fxDecimal(input.ask);
  } catch {
    return { ok: false, reason: 'IMPOSSIBLE_PRECISION', detail: 'Bid/ask is not a decimal number' };
  }

  if (!bid.isFinite() || !ask.isFinite()) {
    return { ok: false, reason: 'IMPOSSIBLE_PRECISION', detail: 'Bid/ask is not finite' };
  }
  if (bid.isZero()) return { ok: false, reason: 'ZERO_BID', detail: 'bid is 0' };
  if (ask.isZero()) return { ok: false, reason: 'ZERO_ASK', detail: 'ask is 0' };
  if (bid.lt(0)) return { ok: false, reason: 'NEGATIVE_BID', detail: 'bid is negative' };
  if (ask.lt(0)) return { ok: false, reason: 'NEGATIVE_ASK', detail: 'ask is negative' };
  if (!fxPositive(bid) || !fxPositive(ask)) {
    return { ok: false, reason: 'IMPOSSIBLE_PRECISION', detail: 'bid/ask must be > 0' };
  }
  if (ask.lt(bid)) {
    return { ok: false, reason: 'CROSSED_MARKET', detail: `ask ${input.ask} < bid ${input.bid}` };
  }

  if (!(input.providerTimestamp instanceof Date) || Number.isNaN(input.providerTimestamp.getTime())) {
    return { ok: false, reason: 'INVALID_PROVIDER_TIMESTAMP', detail: 'provider timestamp is invalid' };
  }
  if (!(input.receivedTimestamp instanceof Date) || Number.isNaN(input.receivedTimestamp.getTime())) {
    return { ok: false, reason: 'INVALID_RECEIVED_TIMESTAMP', detail: 'received timestamp is invalid' };
  }
  const skew = input.providerTimestamp.getTime() - input.receivedTimestamp.getTime();
  if (skew > input.maxFutureSkewMs) {
    return {
      ok: false,
      reason: 'FUTURE_PROVIDER_TIMESTAMP',
      detail: `provider timestamp is ${skew}ms in the future`,
    };
  }

  if (typeof input.providerSequence !== 'bigint' || input.providerSequence < 0n) {
    return { ok: false, reason: 'MALFORMED_SEQUENCE', detail: 'sequence must be a non-negative integer' };
  }

  if (fxDecimalPlaces(bid) > instrument.pricePrecision || fxDecimalPlaces(ask) > instrument.pricePrecision) {
    return {
      ok: false,
      reason: 'IMPOSSIBLE_PRECISION',
      detail: `price exceeds ${instrument.pricePrecision} decimal places for ${instrument.symbol}`,
    };
  }

  return { ok: true };
}
