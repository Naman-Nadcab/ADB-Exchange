/**
 * Phase 11 frontend helpers — indicators and honest formatting.
 * Run: npx tsx apps/frontend/src/lib/forex/forex-phase11.test.ts
 */
import { latestIndicators, sma } from './analysis/indicators';
import { FOREX_ROUTES } from './routes';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testSma(): void {
  const out = sma([1, 2, 3, 4], 2);
  assert(out[0] == null, 'sma warmup');
  assert(out[1] === 1.5, 'sma 2');
}

function testIndicatorsNeedHistory(): void {
  const rows = [
    { timestamp: '2026-01-01T00:00:00.000Z', open: '1', high: '1.2', low: '0.9', close: '1.1' },
    { timestamp: '2026-01-02T00:00:00.000Z', open: '1.1', high: '1.3', low: '1.0', close: '1.2' },
  ];
  const ind = latestIndicators(rows);
  assert(ind.sma20 == null, 'sma20 unavailable on short series');
}

function testRoutes(): void {
  assert(FOREX_ROUTES.ledger === '/forex/account/ledger', 'ledger route');
  assert(FOREX_ROUTES.funds === '/forex/account/funds', 'funds route');
}

testSma();
testIndicatorsNeedHistory();
testRoutes();
console.log('forex-phase11.test.ts ok');
