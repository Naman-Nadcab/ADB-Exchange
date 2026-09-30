/**
 * Deterministic swap amount. Triple-swap multiplies on the configured weekday.
 * Does not invent history. Caller decides whether the rollover condition is met.
 */
import { fxDecimal } from '../decimal-fx.js';
import { resolveForexSwap } from './policy.js';

export interface ForexSwapCalcInput {
  symbol: string;
  side: 'long' | 'short';
  volume: string;
  at: Date;
  accountId?: string;
}

export interface ForexSwapCalcResult {
  amount: string;
  rate: string;
  multiplier: string;
  triple: boolean;
  currency: 'USD';
  model: 'points' | 'account_currency';
  rolloverDate: string;
  source: 'SIMULATED';
}

export function rolloverDateKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function isTripleSwapDay(at: Date, tripleSwapDay: number): boolean {
  return at.getUTCDay() === tripleSwapDay;
}

export function calculateForexSwap(input: ForexSwapCalcInput): ForexSwapCalcResult {
  const rule = resolveForexSwap(input.symbol, input.accountId);
  const rate = fxDecimal(input.side === 'long' ? rule.longSwap : rule.shortSwap);
  const triple = isTripleSwapDay(input.at, rule.tripleSwapDay);
  const multiplier = triple ? fxDecimal(3) : fxDecimal(1);
  const amount = fxDecimal(input.volume).times(rate).times(multiplier);
  return {
    amount: amount.toFixed(),
    rate: rate.toFixed(),
    multiplier: multiplier.toFixed(),
    triple,
    currency: 'USD',
    model: rule.model,
    rolloverDate: rolloverDateKey(input.at),
    source: 'SIMULATED',
  };
}

/** True only at/after the configured rollover time on that UTC date, once per day. */
export function isRolloverMoment(at: Date, rolloverTime = resolveForexSwap('EURUSD').rolloverTime): boolean {
  const parts = rolloverTime.split(':');
  const hh = Number(parts[0] ?? 21);
  const mm = Number(parts[1] ?? 0);
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  const target = (Number.isFinite(hh) ? hh : 21) * 60 + (Number.isFinite(mm) ? mm : 0);
  return minutes >= target;
}
