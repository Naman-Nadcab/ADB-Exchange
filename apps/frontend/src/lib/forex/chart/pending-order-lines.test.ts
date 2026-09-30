/**
 * Run: npx tsx apps/frontend/src/lib/forex/chart/pending-order-lines.test.ts
 */
import { buildDraggablePendingLines } from './pending-order-lines';
import type { ForexPublicOrder } from '../models/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function order(partial: Partial<ForexPublicOrder> & Pick<ForexPublicOrder, 'orderId' | 'symbol' | 'type' | 'status'>): ForexPublicOrder {
  return {
    clientOrderId: 'c',
    clientExecId: 'e',
    side: 'buy',
    requestedVolume: '0.1',
    filledVolume: '0',
    remainingVolume: '0.1',
    requestedPrice: '1.1000',
    timeInForce: 'GTC',
    stopLoss: null,
    takeProfit: null,
    comment: null,
    failureReason: null,
    executionId: null,
    version: 1,
    source: 'SIMULATED',
    executionMode: 'MOCK',
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function testStopLimitBothLines(): void {
  const o = order({
    orderId: 'a',
    symbol: 'EURUSD',
    type: 'stop_limit',
    status: 'PENDING',
    requestedPrice: '1.1050',
    limitPrice: '1.1040',
  });
  const lines = buildDraggablePendingLines({ a: o }, 'EURUSD');
  assert(lines.length === 2, 'stop_limit exposes stop + limit lines');
  assert(lines.some((l) => l.field === 'requestedPrice'), 'stop price line');
  assert(lines.some((l) => l.field === 'limitPrice'), 'limit price line');
}

function testIgnoresFilled(): void {
  const o = order({ orderId: 'b', symbol: 'EURUSD', type: 'limit', status: 'FILLED' });
  assert(buildDraggablePendingLines({ b: o }, 'EURUSD').length === 0, 'filled not draggable');
}

function testSymbolFilter(): void {
  const o = order({ orderId: 'c', symbol: 'GBPUSD', type: 'limit', status: 'PENDING' });
  assert(buildDraggablePendingLines({ c: o }, 'EURUSD').length === 0, 'other symbol');
}

testStopLimitBothLines();
testIgnoresFilled();
testSymbolFilter();
console.log('pending-order-lines.test.ts OK');
