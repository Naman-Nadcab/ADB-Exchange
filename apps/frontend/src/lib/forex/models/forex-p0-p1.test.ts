/**
 * Run: npx tsx apps/frontend/src/lib/forex/models/forex-p0-p1.test.ts
 */
import { composeAccountMetrics } from './account-metrics';
import { buildExposureBook } from './exposure-view';
import { computePerformance, ledgerCashDrawdown, periodBounds } from './history-analytics';
import { formatMarginLevel, livePositionValuation } from './live-valuation';
import { estimateTicketRisk } from './ticket-risk';
import type { ForexInstrument, ForexPublicPosition, ForexQuoteDto } from './types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const inst: ForexInstrument = {
  id: '1',
  symbol: 'EURUSD',
  displaySymbol: 'EUR/USD',
  baseCurrency: 'EUR',
  quoteCurrency: 'USD',
  assetClass: 'fx_major',
  digits: 5,
  pricePrecision: 5,
  pipSize: '0.0001',
  tickSize: '0.00001',
  contractSize: '100000',
  minVolume: '0.01',
  maxVolume: '100',
  volumeStep: '0.01',
  tradingStatus: 'active',
  sessionCalendarId: 'c',
  maxLeverage: '50',
  marginPercent: '2',
  commission: '0',
  commissionType: 'per_lot',
  swapLong: '0',
  swapShort: '0',
  swap3day: '0',
};

function pos(over: Partial<ForexPublicPosition> = {}): ForexPublicPosition {
  return {
    positionId: 'p1',
    symbol: 'EURUSD',
    side: 'long',
    volume: '1',
    entryPrice: '1.10000',
    averageEntryPrice: '1.10000',
    currentPrice: '1.10100',
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
    openedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    closedAt: null,
    ...over,
  };
}

function q(over: Partial<ForexQuoteDto> = {}): ForexQuoteDto {
  return {
    symbol: 'EURUSD',
    displaySymbol: 'EUR/USD',
    instrumentId: '1',
    bid: '1.10100',
    ask: '1.10100',
    mid: '1.10100',
    spread: '0',
    spreadPips: '0',
    spreadTicks: '0',
    providerId: 'm',
    providerCode: 'MOCK',
    providerTimestamp: new Date().toISOString(),
    receivedTimestamp: new Date().toISOString(),
    sequence: '1',
    edaReceiveSequence: '1',
    quality: 'OK',
    status: 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
    ...over,
  };
}

function testLiveLongBid(): void {
  const v = livePositionValuation({ position: pos(), quote: q({ bid: '1.10100', ask: '1.10200' }), instrument: inst });
  assert(v.status === 'CALCULATED', 'calc');
  assert(v.markSource === 'BID', 'long uses bid');
  assert(v.floating === '100.00', `float ${v.floating}`);
  assert(v.commission === '0', 'comm 0');
}

function testLiveShortAsk(): void {
  const v = livePositionValuation({
    position: pos({ side: 'short' }),
    quote: q({ bid: '1.09900', ask: '1.09950' }),
    instrument: inst,
  });
  assert(v.markSource === 'ASK', 'short uses ask');
  assert(v.floating === '50.00', `short float ${v.floating}`);
}

function testMarginNa(): void {
  assert(formatMarginLevel('10000', '0') === '—', 'zero used');
  assert(formatMarginLevel('10000', '2000') === '500.00%', 'level');
}

function testAccount(): void {
  const m = composeAccountMetrics({
    balance: '10000',
    equity: '10050',
    usedMargin: '0',
    freeMargin: '10050',
    floating: '50',
    realized: '0',
    commission: '0',
    swap: '0',
  });
  assert(m.marginLevel === '—', 'no infinity');
  assert(m.net === '50.00', `net ${m.net}`);
}

function testExposure(): void {
  const book = buildExposureBook(
    [pos(), pos({ positionId: 'p2', side: 'short', volume: '0.40', exposure: '44000' })],
    [
      livePositionValuation({ position: pos(), quote: q({ bid: '1.10100', ask: '1.10100' }), instrument: inst }),
      livePositionValuation({
        position: pos({ positionId: 'p2', side: 'short', volume: '0.40', exposure: '44000' }),
        quote: q({ bid: '1.10100', ask: '1.10100' }),
        instrument: inst,
      }),
    ]
  );
  assert(book.bySymbol[0]?.symbol === 'EURUSD', 'symbol');
  assert(Number(book.longNotional) > 0, 'long');
}

function testPerf(): void {
  const empty = computePerformance([]);
  assert(empty.winRate == null, 'n/a win');
  assert(empty.profitFactor == null, 'n/a pf');
  const stats = computePerformance([
    { ticket: '1', symbol: 'EURUSD', gross: 10, commission: 0, swap: 0, net: 10, timestamp: '2026-09-01T00:00:00.000Z' },
    { ticket: '2', symbol: 'EURUSD', gross: -5, commission: 0, swap: 0, net: -5, timestamp: '2026-09-01T01:00:00.000Z' },
  ]);
  assert(stats.winRate === '50.00', stats.winRate ?? '');
  assert(stats.profitFactor === '2.00', stats.profitFactor ?? '');
}

function testDrawdown(): void {
  const dd = ledgerCashDrawdown([]);
  assert(dd.peak == null, 'empty');
  assert(dd.source === 'LEDGER_CASH', 'honest source');
}

function testTicketRisk(): void {
  const r = estimateTicketRisk({ instrument: inst, side: 'buy', entry: '1.10000', sl: '1.09900', tp: '1.10200', volume: '1' });
  assert(r.slDistancePips != null && r.slDistancePips > 0, 'sl pips');
  assert(r.riskReward != null && r.riskReward > 1, 'rr');
}

function testPeriod(): void {
  const b = periodBounds('all');
  assert(b.from === 0, 'all from');
}

testLiveLongBid();
testLiveShortAsk();
testMarginNa();
testAccount();
testExposure();
testPerf();
testDrawdown();
testTicketRisk();
testPeriod();
console.log('forex-p0-p1.test.ts ok');
