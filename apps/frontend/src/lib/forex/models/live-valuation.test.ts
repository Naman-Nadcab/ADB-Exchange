/**
 * Run: npx tsx apps/frontend/src/lib/forex/models/live-valuation.test.ts
 */
import { composeAccountMetrics } from './account-metrics';
import { computePerformance, ledgerCashDrawdown, periodBounds } from './history-analytics';
import { formatMarginLevel, livePositionValuation } from './live-valuation';
import type { ForexPublicPosition, ForexQuoteDto } from './types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pos(over: Partial<ForexPublicPosition> = {}): ForexPublicPosition {
  return {
    positionId: 'p1',
    symbol: 'EURUSD',
    side: 'long',
    volume: '1.00',
    entryPrice: '1.10000',
    averageEntryPrice: '1.10000',
    currentPrice: '1.10000',
    contractSize: '100000',
    leverage: '50',
    initialMargin: '2200',
    maintenanceMargin: '1100',
    exposure: '110000',
    status: 'OPEN',
    mode: 'NETTING',
    version: 1,
    source: 'SIMULATED',
    valuationKind: 'CALCULATED',
    openedAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    closedAt: null,
    ...over,
  };
}

function q(over: Partial<ForexQuoteDto> = {}): ForexQuoteDto {
  return {
    symbol: 'EURUSD',
    displaySymbol: 'EUR/USD',
    instrumentId: 'i',
    bid: '1.10100',
    ask: '1.10100',
    mid: '1.10100',
    spread: '0',
    spreadPips: '0',
    spreadTicks: '0',
    providerId: 'p',
    providerCode: 'MOCK',
    providerTimestamp: '2026-09-02T00:00:00.000Z',
    receivedTimestamp: '2026-09-02T00:00:00.000Z',
    sequence: '2',
    edaReceiveSequence: '2',
    quality: 'SIMULATED',
    status: 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
    ...over,
  };
}

function testLongBid(): void {
  const v = livePositionValuation({ position: pos(), quote: q({ bid: '1.10100', ask: '1.10200' }) });
  assert(v.status === 'CALCULATED', 'calc');
  assert(v.markSource === 'BID', 'long marks bid');
  assert(v.floating === '100.00', `long pnl ${v.floating}`);
}

function testShortAsk(): void {
  const v = livePositionValuation({
    position: pos({ side: 'short', entryPrice: '1.10000', averageEntryPrice: '1.10000' }),
    quote: q({ bid: '1.09800', ask: '1.09900' }),
  });
  assert(v.markSource === 'ASK', 'short marks ask');
  assert(v.floating === '100.00', `short pnl ${v.floating}`);
}

function testStale(): void {
  const v = livePositionValuation({ position: pos(), quote: q({ freshness: 'STALE' }) });
  assert(v.status === 'STALE_PRICE', 'stale');
  assert(v.floating == null, 'no fake pnl');
}

function testMarginNa(): void {
  assert(formatMarginLevel('10000', '0') === '—', 'zero used');
  assert(formatMarginLevel('10000', '2000') === '500.00%', 'level');
}

function testAccountNet(): void {
  const m = composeAccountMetrics({
    balance: '10000',
    floating: '50',
    realized: '20',
    commission: '0',
    swap: '0',
    usedMargin: '2000',
    equity: '10050',
  });
  assert(m.marginLevel === '502.50%', m.marginLevel);
  assert(m.net === '70.00', m.net ?? '');
}

function testPerfNa(): void {
  const empty = computePerformance([]);
  assert(empty.winRate == null, 'no trades');
  assert(empty.profitFactor == null, 'no loss');
  const onlyWins = computePerformance([{ ticket: '1', symbol: 'EURUSD', gross: 10, commission: 0, swap: 0, net: 10, timestamp: '2026-09-01T00:00:00.000Z' }]);
  assert(onlyWins.profitFactor == null, 'gross loss 0');
  assert(onlyWins.winRate === '100.00', 'win rate');
}

function testDrawdown(): void {
  const d = ledgerCashDrawdown([
    { transactionId: '1', type: 'DEPOSIT', debit: '0', credit: '10000', net: '10000', currency: 'USD', timestamp: '2026-09-01T00:00:00.000Z', status: 'POSTED', source: 'SIMULATED', balanceAfter: '10000' },
    { transactionId: '2', type: 'REALIZED_PNL', debit: '2000', credit: '0', net: '-2000', currency: 'USD', timestamp: '2026-09-01T01:00:00.000Z', status: 'POSTED', source: 'SIMULATED', balanceAfter: '8000' },
  ]);
  assert(d.maxDrawdown === '2000.00', d.maxDrawdown ?? '');
  assert(d.source === 'LEDGER_CASH', 'honest source');
}

function testPeriod(): void {
  const b = periodBounds('all');
  assert(b.from === 0, 'all from');
}

testLongBid();
testShortAsk();
testStale();
testMarginNa();
testAccountNet();
testPerfNa();
testDrawdown();
testPeriod();
console.log('live-valuation.test.ts ok');
