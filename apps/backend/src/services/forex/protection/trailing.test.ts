/**
 * Run: FOREX_SILENT_LOG=1 npx tsx apps/backend/src/services/forex/protection/trailing.test.ts
 */
import { initialTrailingStop, ratchetTrailingStop } from './trailing.js';
import type { ForexQuoteDto } from '../types.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function q(over: Partial<ForexQuoteDto> = {}): ForexQuoteDto {
  return {
    symbol: 'EURUSD',
    displaySymbol: 'EUR/USD',
    instrumentId: 'i',
    bid: '1.10000',
    ask: '1.10000',
    mid: '1.10000',
    spread: '0',
    spreadPips: '0',
    spreadTicks: '0',
    providerId: 'p',
    providerCode: 'MOCK',
    providerTimestamp: 't',
    receivedTimestamp: 't',
    sequence: '1',
    edaReceiveSequence: '1',
    quality: 'SIMULATED',
    status: 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
    ...over,
  };
}

function testLongRatchetUpOnly(): void {
  const moved = ratchetTrailingStop({
    protection: { type: 'STOP_LOSS', positionSide: 'long', triggerPrice: '1.09800', trailingDistance: '0.00100' },
    quote: q({ bid: '1.10200', ask: '1.10200' }),
  });
  assert(moved.moved && Number(moved.triggerPrice) === 1.101, `long up ${JSON.stringify(moved)}`);
  const down = ratchetTrailingStop({
    protection: { type: 'STOP_LOSS', positionSide: 'long', triggerPrice: '1.10100', trailingDistance: '0.00100' },
    quote: q({ bid: '1.10000', ask: '1.10000' }),
  });
  assert(!down.moved, 'long never down');
}

function testShortRatchetDownOnly(): void {
  const moved = ratchetTrailingStop({
    protection: { type: 'STOP_LOSS', positionSide: 'short', triggerPrice: '1.10200', trailingDistance: '0.00100' },
    quote: q({ bid: '1.09800', ask: '1.09800' }),
  });
  assert(moved.moved && Number(moved.triggerPrice) === 1.099, `short down ${JSON.stringify(moved)}`);
  const up = ratchetTrailingStop({
    protection: { type: 'STOP_LOSS', positionSide: 'short', triggerPrice: '1.09900', trailingDistance: '0.00100' },
    quote: q({ bid: '1.10100', ask: '1.10100' }),
  });
  assert(!up.moved, 'short never up');
}

function testInitial(): void {
  const sl = initialTrailingStop({ positionSide: 'long', quote: q({ bid: '1.10000', ask: '1.10000' }), distance: '0.00200' });
  assert(sl != null && Number(sl) === 1.098, sl ?? '');
}

testLongRatchetUpOnly();
testShortRatchetDownOnly();
testInitial();
console.log('trailing.test.ts ok');
