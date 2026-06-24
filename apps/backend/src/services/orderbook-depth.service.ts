/**
 * Orderbook depth percentages — notional-weighted bid/ask split for UI depth bars.
 */
import type { OrderbookSnapshot } from './spot-orderbook-cache.service.js';
import { Decimal, type DecimalInstance } from '../lib/decimal.js';

export type DepthPct = {
  bid: number;
  ask: number;
  levels: number[];
};

function levelNotional(price: string, quantity: string): DecimalInstance {
  const p = new Decimal(price || '0');
  const q = new Decimal(quantity || '0');
  if (!p.gt(0) || !q.gt(0)) return new Decimal(0);
  return p.times(q);
}

/** Compute bid/ask % and per-level depth % (top 4 levels) for depth preview UI. */
export function computeOrderbookDepthPct(ob: OrderbookSnapshot, levelCount = 4): DepthPct {
  const bidLevels = ob.bids.slice(0, levelCount);
  const askLevels = ob.asks.slice(0, levelCount);
  let bidTotal = new Decimal(0);
  let askTotal = new Decimal(0);
  for (const l of bidLevels) bidTotal = bidTotal.plus(levelNotional(l.price, l.quantity));
  for (const l of askLevels) askTotal = askTotal.plus(levelNotional(l.price, l.quantity));
  const grand = bidTotal.plus(askTotal);
  let bidPct = 50;
  let askPct = 50;
  if (grand.gt(0)) {
    bidPct = bidTotal.div(grand).times(100).toNumber();
    askPct = askTotal.div(grand).times(100).toNumber();
    if (!Number.isFinite(bidPct)) bidPct = 50;
    if (!Number.isFinite(askPct)) askPct = 50;
  }
  const levels: number[] = [];
  const allLevels = [...bidLevels.map((l) => levelNotional(l.price, l.quantity)), ...askLevels.map((l) => levelNotional(l.price, l.quantity))];
  const maxLevel = allLevels.reduce((m, v) => (v.gt(m) ? v : m), new Decimal(0));
  for (let i = 0; i < levelCount; i++) {
    const bidN = bidLevels[i] ? levelNotional(bidLevels[i]!.price, bidLevels[i]!.quantity) : new Decimal(0);
    const pct = maxLevel.gt(0) ? bidN.div(maxLevel).times(100).toNumber() : 0;
    levels.push(Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0))));
  }
  return { bid: Math.round(bidPct), ask: Math.round(askPct), levels };
}
