/**
 * Server-side Forex commission calculator. Decimal only.
 * Does not debit Crypto balances.
 */
import { fxDecimal } from '../decimal-fx.js';
import { resolveForexCommission, type ForexCommissionRule } from './policy.js';

export interface ForexCommissionInput {
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: string;
  price?: string;
}

export interface ForexCommissionResult {
  amount: string;
  currency: 'USD';
  model: ForexCommissionRule['model'];
  rate: string;
  side: 'buy' | 'sell';
  volume: string;
  source: 'SIMULATED';
}

export function calculateForexCommission(input: ForexCommissionInput): ForexCommissionResult {
  const rule = resolveForexCommission(input.accountId, input.symbol);
  const volume = fxDecimal(input.volume);
  const rate =
    rule.model === 'per_side'
      ? fxDecimal(input.side === 'buy' ? (rule.buyRate ?? rule.rate) : (rule.sellRate ?? rule.rate))
      : fxDecimal(rule.rate);
  let raw = fxDecimal(0);
  if (rule.model === 'none' || !rate.gt(0) || !volume.gt(0)) {
    raw = fxDecimal(0);
  } else if (rule.model === 'percentage') {
    const notional = volume.times(fxDecimal(input.price ?? '0'));
    raw = notional.times(rate);
  } else {
    raw = volume.times(rate);
  }
  const minimum = fxDecimal(rule.minimum ?? '0');
  const amount = raw.gt(0) && minimum.gt(raw) ? minimum : raw;
  return {
    amount: amount.toFixed(),
    currency: 'USD',
    model: rule.model,
    rate: rate.toFixed(),
    side: input.side,
    volume: volume.toFixed(),
    source: 'SIMULATED',
  };
}
