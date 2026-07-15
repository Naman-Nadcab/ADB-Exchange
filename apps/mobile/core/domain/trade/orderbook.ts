import type { OrderbookDelta, OrderbookSnapshot, PlaceOrderRequest, SpotMarket } from '@exchange/mobile-types';
import { isPositive, multiplyDecimal, roundDown } from './decimal';

export function applyOrderbookDelta(
  snapshot: OrderbookSnapshot,
  delta: OrderbookDelta,
): OrderbookSnapshot {
  const bidMap = new Map(snapshot.bids.map((l) => [l.price, l.quantity]));
  for (const [p, q] of delta.bids) {
    if (!isPositive(q)) bidMap.delete(p);
    else bidMap.set(p, q);
  }
  const askMap = new Map(snapshot.asks.map((l) => [l.price, l.quantity]));
  for (const [p, q] of delta.asks) {
    if (!isPositive(q)) askMap.delete(p);
    else askMap.set(p, q);
  }
  const bids = Array.from(bidMap.entries())
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    .map(([price, quantity]) => ({ price, quantity }));
  const asks = Array.from(askMap.entries())
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([price, quantity]) => ({ price, quantity }));
  return { symbol: delta.symbol, bids, asks, lastUpdateId: delta.seq };
}

export type OrderValidationResult = { valid: true } | { valid: false; field: string; message: string };

export function validateOrder(
  req: PlaceOrderRequest,
  market: SpotMarket,
): OrderValidationResult {
  if (!isPositive(req.quantity)) {
    return { valid: false, field: 'quantity', message: 'Quantity must be greater than 0' };
  }
  const qtyPrec = market.qty_precision ?? 8;
  const pricePrec = market.price_precision ?? 8;
  const qty = roundDown(req.quantity, qtyPrec);
  if (market.min_qty && parseFloat(qty) < parseFloat(market.min_qty)) {
    return { valid: false, field: 'quantity', message: `Min quantity ${market.min_qty}` };
  }
  if (req.type === 'limit' || req.type === 'stop_limit') {
    if (!req.price || !isPositive(req.price)) {
      return { valid: false, field: 'price', message: 'Price required' };
    }
    const price = roundDown(req.price, pricePrec);
    const notional = multiplyDecimal(price, qty);
    if (market.min_notional && parseFloat(notional) < parseFloat(market.min_notional)) {
      return { valid: false, field: 'quantity', message: `Min notional ${market.min_notional}` };
    }
  }
  if (req.type === 'stop_loss' || req.type === 'stop_limit') {
    if (!req.stop_price || !isPositive(req.stop_price)) {
      return { valid: false, field: 'stop_price', message: 'Stop price required' };
    }
  }
  if (req.type === 'trailing_stop_market') {
    if (!req.trailing_delta || parseFloat(req.trailing_delta) <= 0 || parseFloat(req.trailing_delta) > 100) {
      return { valid: false, field: 'trailing_delta', message: 'Trailing delta 0–100%' };
    }
  }
  if (req.post_only) {
    if (req.type !== 'limit') {
      return { valid: false, field: 'post_only', message: 'Post-only applies to limit orders only' };
    }
    if (req.time_in_force && req.time_in_force !== 'gtc') {
      return { valid: false, field: 'time_in_force', message: 'Post-only requires GTC' };
    }
  }
  return { valid: true };
}

export function computeSpread(bestBid: string | undefined, bestAsk: string | undefined): string | null {
  if (!bestBid || !bestAsk) return null;
  const spread = parseFloat(bestAsk) - parseFloat(bestBid);
  if (!Number.isFinite(spread)) return null;
  return spread.toFixed(8).replace(/\.?0+$/, '');
}

export function estimateReceive(
  side: 'buy' | 'sell',
  type: 'market' | 'limit',
  quantity: string,
  price: string,
): string {
  if (side === 'buy') return quantity;
  return multiplyDecimal(quantity, price);
}
