/**
 * Phase 10.1 targeted unit tests — quote sequence, errors, connection derive.
 * Run: npx tsx apps/frontend/src/lib/forex/forex-foundation.test.ts
 */
import { describeForexError, normalizeForexError } from './models/errors';
import { shouldAcceptQuote, isQuoteStale } from './models/quotes';
import { deriveDisplayConnection } from './selectors/connection';
import type { ForexQuoteDto } from './models/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function q(partial: Partial<ForexQuoteDto> & Pick<ForexQuoteDto, 'symbol' | 'sequence'>): ForexQuoteDto {
  return {
    displaySymbol: 'EUR/USD',
    instrumentId: 'x',
    bid: '1.08500',
    ask: '1.08506',
    mid: '1.08503',
    spread: '0.00006',
    spreadPips: '0.6',
    spreadTicks: '6',
    providerId: 'p',
    providerCode: 'MOCK_A',
    providerTimestamp: 't',
    receivedTimestamp: 't',
    edaReceiveSequence: partial.sequence,
    quality: 'OK',
    status: 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
    ...partial,
  };
}

function testQuoteSequence(): void {
  const a = q({ symbol: 'EURUSD', sequence: '10' });
  const b = q({ symbol: 'EURUSD', sequence: '11' });
  const c = q({ symbol: 'EURUSD', sequence: '9' });
  assert(shouldAcceptQuote(undefined, a), 'first quote accepted');
  assert(shouldAcceptQuote(a, b), 'newer sequence accepted');
  assert(!shouldAcceptQuote(b, c), 'older sequence dropped');
  assert(!shouldAcceptQuote(b, b), 'duplicate sequence dropped');
}

function testStale(): void {
  assert(isQuoteStale(q({ symbol: 'EURUSD', sequence: '1', freshness: 'STALE' })), 'freshness STALE');
  assert(isQuoteStale(q({ symbol: 'EURUSD', sequence: '1', quality: 'STALE' })), 'quality STALE');
  assert(isQuoteStale(q({ symbol: 'EURUSD', sequence: '1', status: 'HALTED' })), 'status HALTED');
  assert(!isQuoteStale(q({ symbol: 'EURUSD', sequence: '1' })), 'tradeable fresh is live');
}

function testErrors(): void {
  const e = normalizeForexError({ code: 'SESSION_CLOSED', message: 'Friday close' });
  assert(e.code === 'SESSION_CLOSED', 'code preserved');
  assert(describeForexError(e).includes('SESSION_CLOSED'), 'message includes code');
  assert(!describeForexError(e).includes('Something went wrong'), 'no generic-only copy');
}

function testConnection(): void {
  const live = q({ symbol: 'EURUSD', sequence: '1' });
  assert(
    deriveDisplayConnection({ socketState: 'CONNECTING', quotes: {}, selectedSymbol: 'EURUSD', providers: [] }) ===
      'CONNECTING',
    'connecting wins'
  );
  assert(
    deriveDisplayConnection({
      socketState: 'CONNECTED',
      quotes: { EURUSD: q({ symbol: 'EURUSD', sequence: '1', freshness: 'STALE' }) },
      selectedSymbol: 'EURUSD',
      providers: [],
    }) === 'STALE',
    'stale selected quote'
  );
  assert(
    deriveDisplayConnection({
      socketState: 'CONNECTED',
      quotes: { EURUSD: live },
      selectedSymbol: 'EURUSD',
      providers: [{ status: 'DEGRADED' }],
    }) === 'DEGRADED',
    'provider degraded'
  );
  assert(
    deriveDisplayConnection({
      socketState: 'CONNECTED',
      quotes: { EURUSD: live },
      selectedSymbol: 'EURUSD',
      providers: [{ status: 'HEALTHY' }],
    }) === 'CONNECTED',
    'healthy connected'
  );
  assert(
    deriveDisplayConnection({
      socketState: 'DISCONNECTED',
      quotes: {},
      selectedSymbol: 'EURUSD',
      providers: [],
      hydratePhase: 'idle',
    }) === 'CONNECTING',
    'ssr idle is connecting not disconnected'
  );
  assert(
    deriveDisplayConnection({
      socketState: 'DISCONNECTED',
      quotes: {},
      selectedSymbol: 'EURUSD',
      providers: [],
      hydratePhase: 'ready',
    }) === 'DISCONNECTED',
    'ready + disconnected stays disconnected'
  );
}

testQuoteSequence();
testStale();
testErrors();
testConnection();
console.log('forex-foundation.test.ts ok');
