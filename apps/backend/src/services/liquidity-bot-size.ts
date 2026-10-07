import { Decimal } from '../lib/decimal.js';

const ROUND_DOWN = 1;
const ROUND_UP = 0;

/**
 * Keep the configured size when it already clears the market minimum.
 * Otherwise lift it so a real limit order is not rejected for MIN_NOTIONAL / MIN_QTY.
 * Volume stays in base units. The 2% pad survives the order route rounding the price down.
 */
export function liftQtyToMarketMinimum(params: {
  quantity: string;
  price: string;
  minQty: string;
  minNotional: string;
  qtyPrecision: number;
}): string {
  const prec = Number.isFinite(params.qtyPrecision)
    ? Math.max(0, Math.min(18, Math.trunc(params.qtyPrecision)))
    : 8;
  let qty: InstanceType<typeof Decimal>;
  let px: InstanceType<typeof Decimal>;
  let minQty: InstanceType<typeof Decimal>;
  let minNotional: InstanceType<typeof Decimal>;
  try {
    qty = new Decimal(params.quantity);
    px = new Decimal(params.price);
    minQty = new Decimal(params.minQty || '0');
    minNotional = new Decimal(params.minNotional || '0');
  } catch {
    return params.quantity;
  }
  if (!qty.isFinite() || qty.lte(0) || !px.isFinite() || px.lte(0)) return params.quantity;

  let need = minQty.isFinite() && minQty.gt(0) ? minQty : new Decimal(0);
  if (minNotional.isFinite() && minNotional.gt(0)) {
    const notionalQty = minNotional.times('1.02').div(px);
    if (notionalQty.gt(need)) need = notionalQty;
  }
  const sized = qty.gte(need) ? qty : need;
  let rounded = sized.toDecimalPlaces(prec, qty.gte(need) ? ROUND_DOWN : ROUND_UP);
  const meets = (value: InstanceType<typeof Decimal>) =>
    value.gt(0) &&
    (minQty.lte(0) || value.gte(minQty)) &&
    (minNotional.lte(0) || value.times(px).gte(minNotional));
  if (!meets(rounded)) {
    rounded = sized.toDecimalPlaces(prec, ROUND_UP);
  }
  if (!meets(rounded)) {
    const step = new Decimal(10).pow(-prec);
    rounded = rounded.plus(step);
  }
  if (!rounded.isFinite() || rounded.lte(0)) return params.quantity;
  return rounded.toFixed(prec);
}
