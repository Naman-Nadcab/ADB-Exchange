import { fxDecimal } from '../decimal-fx.js';

export function checkPriceDeviation(args: {
  requestedPrice: string | undefined;
  expectedPrice: string;
  maxDeviation: string;
}): { ok: true } | { ok: false; reason: 'PRICE_DEVIATION_LIMIT'; detail: string } {
  if (args.requestedPrice == null || args.requestedPrice === '') return { ok: true };
  const requested = fxDecimal(args.requestedPrice);
  const expected = fxDecimal(args.expectedPrice);
  const max = fxDecimal(args.maxDeviation);
  const delta = requested.minus(expected).abs();
  if (delta.gt(max)) {
    return {
      ok: false,
      reason: 'PRICE_DEVIATION_LIMIT',
      detail: `deviation ${delta.toFixed()} exceeds max ${max.toFixed()}`,
    };
  }
  return { ok: true };
}

export function checkSlippage(args: {
  side: 'buy' | 'sell';
  fillPrice: string;
  expectedPrice: string;
  maxSlippage: string;
}): { ok: true } | { ok: false; reason: 'SLIPPAGE_LIMIT'; detail: string } {
  const fill = fxDecimal(args.fillPrice);
  const expected = fxDecimal(args.expectedPrice);
  const max = fxDecimal(args.maxSlippage);
  if (args.side === 'buy') {
    const worst = expected.plus(max);
    if (fill.gt(worst)) {
      return {
        ok: false,
        reason: 'SLIPPAGE_LIMIT',
        detail: `buy fill ${fill.toFixed()} exceeds ${worst.toFixed()}`,
      };
    }
  } else {
    const worst = expected.minus(max);
    if (fill.lt(worst)) {
      return {
        ok: false,
        reason: 'SLIPPAGE_LIMIT',
        detail: `sell fill ${fill.toFixed()} below ${worst.toFixed()}`,
      };
    }
  }
  return { ok: true };
}
