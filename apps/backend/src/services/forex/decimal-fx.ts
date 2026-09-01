import { Decimal, type DecimalInstance } from '../../lib/decimal.js';

export function fxDecimal(value: string | number | DecimalInstance): DecimalInstance {
  return value instanceof Decimal ? (value as DecimalInstance) : new Decimal(value);
}

export function fxPositive(value: DecimalInstance): boolean {
  return value.isFinite() && value.gt(0);
}

export function fxRoundToDigits(value: DecimalInstance, digits: number): DecimalInstance {
  return value.toDecimalPlaces(digits, Decimal.ROUND_HALF_EVEN);
}

export function fxDecimalPlaces(value: DecimalInstance): number {
  const fixed = value.toFixed();
  const dot = fixed.indexOf('.');
  if (dot < 0) return 0;
  return fixed.length - dot - 1;
}

export function fxToPriceString(value: DecimalInstance, digits: number): string {
  return fxRoundToDigits(value, digits).toFixed(digits);
}

export function fxToPlainString(value: DecimalInstance): string {
  return value.toFixed();
}
