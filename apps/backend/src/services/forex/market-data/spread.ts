import { Decimal, type DecimalInstance } from '../../../lib/decimal.js';
import { fxDecimal, fxToPlainString } from '../decimal-fx.js';
import type { ForexInstrument } from '../types.js';

export interface SpreadBreakdown {
  spread: DecimalInstance;
  spreadPips: DecimalInstance;
  spreadTicks: DecimalInstance;
}

/**
 * Spread is always derived from the instrument's pip_size / tick_size.
 * Never assume 0.0001 or 10,000 contract globally.
 */
export function calculateSpread(
  bid: string | DecimalInstance,
  ask: string | DecimalInstance,
  instrument: ForexInstrument
): SpreadBreakdown {
  const bidD = fxDecimal(bid);
  const askD = fxDecimal(ask);
  const spread = askD.minus(bidD);
  const pipSize = fxDecimal(instrument.pipSize);
  const tickSize = fxDecimal(instrument.tickSize);
  if (!pipSize.gt(0) || !tickSize.gt(0)) {
    throw new Error(`Invalid pip/tick metadata for ${instrument.symbol}`);
  }
  return {
    spread,
    spreadPips: spread.div(pipSize),
    spreadTicks: spread.div(tickSize),
  };
}

export function calculateMid(bid: string | DecimalInstance, ask: string | DecimalInstance): DecimalInstance {
  return fxDecimal(bid).plus(fxDecimal(ask)).div(new Decimal(2));
}

export function spreadStrings(breakdown: SpreadBreakdown, digits: number): {
  spread: string;
  spreadPips: string;
  spreadTicks: string;
} {
  return {
    spread: breakdown.spread.toFixed(digits),
    spreadPips: fxToPlainString(breakdown.spreadPips),
    spreadTicks: fxToPlainString(breakdown.spreadTicks),
  };
}
