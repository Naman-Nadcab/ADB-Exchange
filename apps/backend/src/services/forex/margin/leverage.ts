import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { effectiveDefaultAccountLeverage, effectiveGlobalMaxLeverage } from '../admin/effective-config.js';
import { forexConfig } from '../config.js';

export interface LeverageInputs {
  globalMax: string;
  accountMax: string;
  instrumentMax: string;
}

/**
 * Effective leverage is the minimum (strictest) of:
 *   global policy → account policy → instrument policy
 * A looser outer limit never overrides a tighter inner limit.
 */
export function effectiveLeverage(inputs: LeverageInputs): string {
  const g = fxDecimal(inputs.globalMax);
  const a = fxDecimal(inputs.accountMax);
  const i = fxDecimal(inputs.instrumentMax);
  let min = g;
  if (a.lt(min)) min = a;
  if (i.lt(min)) min = i;
  if (!min.gt(0)) return '1';
  return min.toFixed();
}

export function resolveEffectiveLeverage(symbol: string, accountMaxLeverage?: string): string {
  const instrument = getForexInstrumentBySymbol(symbol);
  return effectiveLeverage({
    globalMax: effectiveGlobalMaxLeverage(),
    accountMax: accountMaxLeverage ?? effectiveDefaultAccountLeverage(),
    instrumentMax: instrument?.maxLeverage ?? effectiveDefaultAccountLeverage(),
  });
}
