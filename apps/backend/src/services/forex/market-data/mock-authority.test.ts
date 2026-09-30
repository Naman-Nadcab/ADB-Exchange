/**
 * Run: FOREX_SILENT_LOG=1 npx tsx apps/backend/src/services/forex/market-data/mock-authority.test.ts
 */
import type { ForexQuoteDto } from '../types.js';
import { mergeMockAuthorityLiveBar } from './mock-authority.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const quote: ForexQuoteDto = {
  symbol: 'EURUSD',
  displaySymbol: 'EUR/USD',
  instrumentId: 'i',
  bid: '1.15000',
  ask: '1.15002',
  mid: '1.15001',
  spread: '0.00002',
  spreadPips: '0.2',
  spreadTicks: '2',
  providerId: 'p',
  providerCode: 'MOCK-C',
  providerTimestamp: '2026-09-18T12:00:00.000Z',
  receivedTimestamp: '2026-09-18T12:00:00.000Z',
  sequence: '1',
  edaReceiveSequence: '1',
  quality: 'SIMULATED',
  status: 'TRADEABLE',
  source: 'SIMULATED',
  freshness: 'FRESH',
};

{
  const ref = [
    {
      timestamp: '2026-09-18T11:45:00.000Z',
      open: '1.14000',
      high: '1.14100',
      low: '1.13900',
      close: '1.14050',
    },
    {
      timestamp: '2026-09-18T12:00:00.000Z',
      open: '1.14050',
      high: '1.14500',
      low: '1.14000',
      close: '1.14400',
    },
  ];
  const merged = mergeMockAuthorityLiveBar({
    symbol: 'EURUSD',
    timeframe: '15m',
    referenceBars: ref,
    quote,
    nowMs: Date.parse('2026-09-18T12:07:00.000Z'),
  });
  assert(merged.merged, 'must merge live bar');
  assert(merged.candles.length === 2, 'settled + live');
  const live = merged.candles[merged.candles.length - 1]!;
  assert(live.timestamp === '2026-09-18T12:00:00.000Z', 'live bucket start');
  assert(live.close.startsWith('1.1500'), `live close must track quote mid, got ${live.close}`);
  assert(Number(live.close) !== 1.144, 'must not keep Yahoo forming close as executable');
  console.log('  PASS  mergeMockAuthorityLiveBar replaces forming bucket with SIMULATED close');
}

console.log('\nmock-authority.test.ts — all passed\n');
