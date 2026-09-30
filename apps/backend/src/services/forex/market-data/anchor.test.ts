/**
 * Price-universe invariant.
 *
 * The chart renders external reference OHLC while executable quotes come from
 * the deterministic MOCK walk. Regression guard: those two must share one base
 * per symbol, so no component can show a different "current" price.
 *
 * Run: FOREX_SILENT_LOG=1 npx tsx apps/backend/src/services/forex/market-data/anchor.test.ts
 */
import {
  anchorSanityOk,
  getForexMockBasePrice,
  resetForexMockAnchorsForTests,
  setForexMockAnchorForTests,
  staticMockBase,
} from './anchor.js';
import { mockPriceAt } from './mock-provider.js';
import { forexConfig } from '../config.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'XAUUSD'] as const;

/** Reference closes observed from the chart provider. */
const REFERENCE: Record<string, string> = {
  EURUSD: '1.16104',
  GBPUSD: '1.34969',
  USDJPY: '157.099',
  USDCHF: '0.80938',
  XAUUSD: '4470.90',
};

function testSanityBandAcceptsRealDrift(): void {
  assert(anchorSanityOk('160.080', '157.099'), 'USDJPY drift must be accepted');
  assert(anchorSanityOk('1.15780', '1.16104'), 'EURUSD drift must be accepted');
  assert(anchorSanityOk('4354.00', '4470.90'), 'XAUUSD drift must be accepted');
}

function testSanityBandRejectsUnitErrors(): void {
  // Silver quoted in cents rather than dollars.
  assert(!anchorSanityOk('64.345', '6434.50'), 'cent-scaled silver must be rejected');
  assert(!anchorSanityOk('160.080', '1.6008'), 'de-scaled JPY must be rejected');
  for (const bad of ['0', '-1', 'abc', 'NaN', '']) {
    assert(!anchorSanityOk('160.080', bad), `bad candidate ${bad} must be rejected`);
  }
}

function testFallsBackToStaticConstant(): void {
  resetForexMockAnchorsForTests();
  for (const symbol of SYMBOLS) {
    assert(
      getForexMockBasePrice(symbol) === staticMockBase(symbol),
      `${symbol} must fall back to the authored constant without an anchor`
    );
  }
}

function testAnchoredQuoteSharesChartUniverse(): void {
  resetForexMockAnchorsForTests();
  for (const symbol of SYMBOLS) {
    const close = REFERENCE[symbol]!;
    assert(setForexMockAnchorForTests(symbol, close), `${symbol} anchor must apply`);
    assert(getForexMockBasePrice(symbol) === close, `${symbol} base must be the reference close`);

    const instrument = getForexInstrumentBySymbol(symbol);
    assert(instrument, `${symbol} instrument must exist`);
    const tick = Number(instrument.tickSize);

    // The deterministic walk spans +/-8 ticks around the anchored base.
    for (const seq of [1n, 7n, 12345n, 999999n]) {
      const { bid, ask } = mockPriceAt(symbol, seq, 0);
      const mid = (Number(bid) + Number(ask)) / 2;
      const drift = Math.abs(mid - Number(close));
      assert(
        drift <= tick * 8 + tick / 2,
        `${symbol} seq ${seq} mid ${mid} drifted ${drift} from anchor ${close}`
      );
    }
  }
}

function testZeroSpreadDemo(): void {
  resetForexMockAnchorsForTests();
  assert(forexConfig.demoZeroSpread, 'DEMO must run zero spread');
  for (const symbol of SYMBOLS) {
    setForexMockAnchorForTests(symbol, REFERENCE[symbol]!);
    const { bid, ask } = mockPriceAt(symbol, 42n, 0);
    assert(bid === ask, `${symbol} zero-spread DEMO must print bid === ask (${bid} vs ${ask})`);
  }
}

function testAllProvidersShareAnchoredBase(): void {
  resetForexMockAnchorsForTests();
  setForexMockAnchorForTests('USDJPY', REFERENCE.USDJPY!);
  const a = mockPriceAt('USDJPY', 5n, 0);
  const b = mockPriceAt('USDJPY', 5n, 1);
  const c = mockPriceAt('USDJPY', 5n, 2);
  assert(a.bid === b.bid && b.bid === c.bid, 'DEMO providers must agree on one book');
}

function testPrecisionPreserved(): void {
  resetForexMockAnchorsForTests();
  setForexMockAnchorForTests('USDJPY', REFERENCE.USDJPY!);
  const { bid } = mockPriceAt('USDJPY', 9n, 0);
  const precision = getForexInstrumentBySymbol('USDJPY')!.pricePrecision;
  assert(
    (bid.split('.')[1] ?? '').length <= precision,
    `anchored bid ${bid} must respect ${precision} dp`
  );
}

function run(): void {
  const tests: Array<[string, () => void]> = [
    ['sanity band accepts real drift', testSanityBandAcceptsRealDrift],
    ['sanity band rejects unit errors', testSanityBandRejectsUnitErrors],
    ['falls back to static constant', testFallsBackToStaticConstant],
    ['anchored quote shares chart universe', testAnchoredQuoteSharesChartUniverse],
    ['zero-spread demo bid = ask', testZeroSpreadDemo],
    ['all providers share anchored base', testAllProvidersShareAnchoredBase],
    ['precision preserved', testPrecisionPreserved],
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
  console.log(`\nforex anchor: ${tests.length - failed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
}

run();
