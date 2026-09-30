/**
 * DEMO mid-pin lifecycle — must not become a permanent second price universe.
 *
 * Run: FOREX_SILENT_LOG=1 FOREX_DEMO_FUNDING=true FOREX_DEMO_ZERO_SPREAD=true \
 *   npx tsx src/services/forex/market-data/demo-pin.test.ts
 */
import {
  clearForexDemoPins,
  forexDemoPinTtlMs,
  getForexDemoPin,
  mockPriceAt,
  pinForexDemoMid,
  resetForexDemoPinsForTests,
  unpinForexDemoMid,
} from './mock-provider.js';
import {
  getForexMockBasePrice,
  resetForexMockAnchorsForTests,
  setForexMockAnchorForTests,
} from './anchor.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testNormalQuoteUsesAnchor(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  const { bid, ask } = mockPriceAt('EURUSD', 1n, 0);
  const base = Number(getForexMockBasePrice('EURUSD'));
  const mid = (Number(bid) + Number(ask)) / 2;
  assert(Math.abs(mid - base) <= 0.0001, `normal mid ${mid} must stay near anchor ${base}`);
}

function testPinCreatesExpectedQuote(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  pinForexDemoMid('EURUSD', '1.05000', 60_000);
  const pin = getForexDemoPin('EURUSD');
  assert(pin?.mid === '1.05000', 'pin mid must stick while active');
  const { bid } = mockPriceAt('EURUSD', 2n, 0);
  assert(Math.abs(Number(bid) - 1.05) <= 0.0001, `pinned bid ${bid}`);
}

function testUnpinResumesAnchor(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  pinForexDemoMid('EURUSD', '1.05000', 60_000);
  unpinForexDemoMid('EURUSD');
  assert(getForexDemoPin('EURUSD') === null, 'pin must be gone after unpin');
  const { bid } = mockPriceAt('EURUSD', 3n, 0);
  assert(Math.abs(Number(bid) - 1.16104) <= 0.0001, `after unpin bid ${bid} must resume anchor`);
}

function testClearAllResumesAnchor(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  assert(setForexMockAnchorForTests('GBPUSD', '1.34969'), 'anchor gbp');
  pinForexDemoMid('EURUSD', '1.05000', 60_000);
  pinForexDemoMid('GBPUSD', '1.20000', 60_000);
  const { cleared } = clearForexDemoPins();
  assert(cleared.includes('EURUSD') && cleared.includes('GBPUSD'), `cleared=${cleared.join(',')}`);
  assert(getForexDemoPin('EURUSD') === null && getForexDemoPin('GBPUSD') === null, 'all pins cleared');
  const e = mockPriceAt('EURUSD', 4n, 0);
  assert(Math.abs(Number(e.bid) - 1.16104) <= 0.0001, 'EURUSD resumes');
}

function testExpiryResumesAnchor(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  pinForexDemoMid('EURUSD', '1.05000', 1); // 1ms TTL
  // Busy-wait past expiry without depending on timers in the Map.
  const deadline = Date.now() + 20;
  while (Date.now() < deadline) {
    /* spin */
  }
  assert(getForexDemoPin('EURUSD') === null, 'expired pin must not be active');
  const { bid } = mockPriceAt('EURUSD', 5n, 0);
  assert(Math.abs(Number(bid) - 1.16104) <= 0.0001, `expired pin must resume anchor (got ${bid})`);
}

function testAnchorRefreshDoesNotCreatePin(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  assert(getForexDemoPin('EURUSD') === null, 'anchor alone must not create a demo pin');
  assert(setForexMockAnchorForTests('EURUSD', '1.16200'), 're-anchor');
  assert(getForexDemoPin('EURUSD') === null, 'anchor refresh must not create a demo pin');
}

function testDefaultTtlIsFinite(): void {
  const ttl = forexDemoPinTtlMs();
  assert(ttl >= 1_000 && ttl <= 300_000, `ttl ${ttl} must be finite and bounded`);
}

function testBidAskAuthorityWhilePinned(): void {
  resetForexDemoPinsForTests();
  resetForexMockAnchorsForTests();
  assert(setForexMockAnchorForTests('EURUSD', '1.16104'), 'anchor');
  pinForexDemoMid('EURUSD', '1.10000', 60_000);
  const { bid, ask } = mockPriceAt('EURUSD', 6n, 0);
  // Zero-spread DEMO: bid === ask at the pin mid (executable still Bid/Ask fields).
  assert(bid === ask, 'DEMO zero-spread must keep bid=ask');
  assert(Math.abs(Number(bid) - 1.1) <= 0.0001, 'pinned executable mid');
  unpinForexDemoMid('EURUSD');
}

function run(): void {
  const tests: Array<[string, () => void]> = [
    ['normal simulated quote uses anchor', testNormalQuoteUsesAnchor],
    ['create demo pin → pinned quote', testPinCreatesExpectedQuote],
    ['unpin → normal quote resumes', testUnpinResumesAnchor],
    ['clear all → no contamination', testClearAllResumesAnchor],
    ['pin expires → normal quote resumes', testExpiryResumesAnchor],
    ['anchor refresh does not leave stale pin', testAnchorRefreshDoesNotCreatePin],
    ['default TTL is finite', testDefaultTtlIsFinite],
    ['Bid/Ask remain authoritative while pinned', testBidAskAuthorityWhilePinned],
  ];
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`  PASS  ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAIL  ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\nforex demo-pin: ${tests.length - failed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
}

run();
