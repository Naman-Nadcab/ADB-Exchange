/**
 * Run: npx tsx apps/frontend/src/lib/forex/models/journal.test.ts
 */
import { customerJournalLine } from './journal';
import { formatForexPair } from './pair-label';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(formatForexPair('GBPUSD') === 'GBP/USD', 'pair label');
assert(formatForexPair('XAUUSD') === 'XAU/USD', 'metal pair');
assert(customerJournalLine('SELL market GBPUSD 0.01 filled') === 'Sell 0.01 GBP/USD filled', 'filled order');
assert(
  customerJournalLine('TAKE_PROFIT EURUSD 0.1 @ 1.124 cancelled') === 'Take profit EUR/USD 0.10 at 1.124 cancelled',
  'cancelled protection'
);
assert(
  customerJournalLine('BUY limit EURUSD 0.10 rejected · INSUFFICIENT_MARGIN') === 'Buy limit 0.10 EUR/USD rejected · INSUFFICIENT_MARGIN',
  'rejected limit keeps the reason'
);
assert(customerJournalLine('Hydrate ready · socket open') === 'Hydrate ready · socket open', 'unknown lines stay');
assert(customerJournalLine('Sell 0.01 GBP/USD filled') === 'Sell 0.01 GBP/USD filled', 'already readable');

console.log('journal.test.ts ok');
