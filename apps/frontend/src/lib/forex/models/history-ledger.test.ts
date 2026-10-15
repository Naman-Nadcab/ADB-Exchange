/**
 * Run: npx tsx apps/frontend/src/lib/forex/models/history-ledger.test.ts
 */
import { postedFeeByFill, postedSwapByPosition } from './history-analytics';
import type { ForexLedgerRow } from './types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function row(over: Partial<ForexLedgerRow>): ForexLedgerRow {
  return {
    transactionId: 't',
    type: 'FEE',
    debit: '0',
    credit: '0',
    net: '0',
    currency: 'USD',
    timestamp: '2026-01-01T00:00:00.000Z',
    status: 'POSTED',
    source: 'SIMULATED',
    ...over,
  };
}

const swap = postedSwapByPosition([
  row({ type: 'FUNDING', net: '-1.25', reference: { positionId: 'p1' } }),
  row({ type: 'FUNDING', net: '-0.75', reference: { positionId: 'p1' } }),
  row({ type: 'DEPOSIT', net: '1000', reference: { positionId: 'p1' } }),
  row({ type: 'FUNDING', net: '-3', reference: {} }),
]);
assert(swap.p1 === -2, `posted swap should sum the position, got ${swap.p1}`);
assert(Object.keys(swap).length === 1, 'swap rows without a position id stay off the ticket');

const fees = postedFeeByFill([
  row({ type: 'FEE', net: '-2.5', reference: { fillId: 'f1' } }),
  row({ type: 'FEE', net: '-1', reference: { fillId: 'f1' } }),
  row({ type: 'FEE', net: '-9', reference: { symbol: 'EURUSD' } }),
]);
assert(fees.f1 === -3.5, `posted commission should sum the fill, got ${fees.f1}`);
assert(Object.keys(fees).length === 1, 'fee rows without a fill id stay off the ticket');

console.log('history-ledger.test.ts ok');
