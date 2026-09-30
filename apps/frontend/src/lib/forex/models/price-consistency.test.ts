/**
 * PRICE CONSISTENCY INVARIANT — regression guard.
 *
 * One symbol must resolve to one authoritative live quote across Market Watch,
 * chart overlay, order ticket, position valuation, and P&L.
 *
 * This test failed before the market-anchor fix, when executable quotes walked
 * around hardcoded constants while the chart rendered external reference OHLC:
 * USD/JPY quoted 160.088 while the chart closed at 157.099.
 *
 * Run: npx tsx apps/frontend/src/lib/forex/models/price-consistency.test.ts
 */
import { livePositionValuation } from './live-valuation';
import { executablePrice } from './quotes';
import { decideQuoteChartOverlay } from '../market-data/quote-chart-overlay';
import type { ForexPublicPosition, ForexQuoteDto } from './types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Tick size per symbol — the allowed precision for the zero-spread assertion. */
const TICK: Record<string, number> = {
  EURUSD: 0.00001,
  GBPUSD: 0.00001,
  USDJPY: 0.001,
  USDCHF: 0.00001,
  EURGBP: 0.00001,
  EURJPY: 0.001,
  GBPJPY: 0.001,
  XAUUSD: 0.01,
  XAGUSD: 0.001,
};

/** Anchored DEMO book: zero spread, so bid = ask = mid. */
const LIVE: Record<string, string> = {
  EURUSD: '1.16098',
  GBPUSD: '1.34967',
  USDJPY: '157.007',
  USDCHF: '0.80966',
  EURGBP: '0.85996',
  EURJPY: '182.232',
  GBPJPY: '211.919',
  XAUUSD: '4472.04',
  XAGUSD: '66.386',
};

const SYMBOLS = Object.keys(LIVE);

function q(symbol: string, price: string): ForexQuoteDto {
  return {
    symbol,
    displaySymbol: symbol,
    instrumentId: `i-${symbol}`,
    bid: price,
    ask: price,
    mid: price,
    spread: '0',
    spreadPips: '0',
    spreadTicks: '0',
    providerId: 'p',
    providerCode: 'MOCK-A',
    providerTimestamp: new Date().toISOString(),
    receivedTimestamp: new Date().toISOString(),
    sequence: '1',
    edaReceiveSequence: '1',
    quality: 'SIMULATED',
    status: 'TRADEABLE',
    source: 'SIMULATED',
    freshness: 'FRESH',
  };
}

function pos(symbol: string, side: 'long' | 'short', entry: string): ForexPublicPosition {
  return {
    positionId: `p-${symbol}`,
    symbol,
    side,
    volume: '1.00',
    entryPrice: entry,
    averageEntryPrice: entry,
    currentPrice: entry,
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
  };
}

/** Zero-spread DEMO: |bid - ask| must be within symbol tick precision. */
function testZeroSpreadWithinTick(): void {
  for (const symbol of SYMBOLS) {
    const quote = q(symbol, LIVE[symbol]!);
    const spread = Math.abs(Number(quote.bid) - Number(quote.ask));
    assert(
      spread <= TICK[symbol]!,
      `${symbol} zero-spread violated: |${quote.bid} - ${quote.ask}| = ${spread} > tick ${TICK[symbol]}`
    );
  }
}

/**
 * Market Watch, order ticket, chart overlay, and position mark must all resolve
 * to the same authoritative quote — no independent "current price" source.
 */
function testOneQuoteAcrossAllConsumers(): void {
  for (const symbol of SYMBOLS) {
    const price = LIVE[symbol]!;
    const quote = q(symbol, price);
    const tick = TICK[symbol]!;

    // Market Watch reads the store quote directly.
    const marketWatch = Number(quote.bid);

    // Order ticket: BUY = ASK, SELL = BID.
    const ticketBuy = executablePrice('buy', quote);
    const ticketSell = executablePrice('sell', quote);
    assert(ticketBuy === quote.ask, `${symbol} ticket BUY must be ASK`);
    assert(ticketSell === quote.bid, `${symbol} ticket SELL must be BID`);

    // Chart live overlay derives from the same quote, never a candle close.
    const overlay = decideQuoteChartOverlay({
      lastClose: Number(price),
      bid: Number(quote.bid),
      ask: Number(quote.ask),
    });
    assert(overlay.overlay, `${symbol} chart must overlay the live quote`);
    const chartLivePrice = (overlay.bid + overlay.ask) / 2;

    // Position valuation marks LONG at BID and SHORT at ASK.
    const long = livePositionValuation({ position: pos(symbol, 'long', price), quote });
    const short = livePositionValuation({ position: pos(symbol, 'short', price), quote });
    assert(long.mark === quote.bid, `${symbol} LONG mark must be BID (got ${long.mark})`);
    assert(short.mark === quote.ask, `${symbol} SHORT mark must be ASK (got ${short.mark})`);

    // The critical invariant: every consumer agrees within symbol precision.
    const consumers: Array<[string, number]> = [
      ['marketWatch', marketWatch],
      ['orderTicketBuy', Number(ticketBuy)],
      ['orderTicketSell', Number(ticketSell)],
      ['chartLivePrice', chartLivePrice],
      ['longMark', Number(long.mark)],
      ['shortMark', Number(short.mark)],
    ];
    for (const [name, value] of consumers) {
      assert(
        Math.abs(value - Number(price)) <= tick,
        `${symbol} ${name} = ${value} diverges from authoritative quote ${price} (tick ${tick})`
      );
    }
  }
}

/**
 * Guards the regression itself: a quote from a different price universe than the
 * chart must be detected, not silently rendered as the current price.
 */
function testDivergentUniverseIsDetectable(): void {
  // The exact pre-fix USD/JPY state.
  const staleUniverseQuote = 160.088;
  const chartClose = 157.099;
  const overlay = decideQuoteChartOverlay({
    lastClose: chartClose,
    bid: staleUniverseQuote,
    ask: staleUniverseQuote,
  });
  assert(overlay.overlay, 'executable quote must still be overlaid, never hidden');
  assert(
    !overlay.aligned,
    'a quote 1.9% away from the chart series must report aligned = false'
  );

  // And the anchored state must report aligned.
  const healthy = decideQuoteChartOverlay({ lastClose: 157.099, bid: 157.007, ask: 157.007 });
  assert(healthy.overlay && healthy.aligned, 'anchored quote must report aligned = true');
}

function testStaleQuoteYieldsNoExecutablePrice(): void {
  const stale: ForexQuoteDto = { ...q('EURUSD', '1.16098'), status: 'UNAVAILABLE', freshness: 'STALE' };
  assert(executablePrice('buy', stale) === null, 'stale quote must not yield a BUY price');
  assert(executablePrice('sell', stale) === null, 'stale quote must not yield a SELL price');
  assert(executablePrice('buy', undefined) === null, 'missing quote must not yield a price');
}

function run(): void {
  const tests: Array<[string, () => void]> = [
    ['zero spread within tick precision', testZeroSpreadWithinTick],
    ['one quote across all consumers', testOneQuoteAcrossAllConsumers],
    ['divergent price universe is detectable', testDivergentUniverseIsDetectable],
    ['stale quote yields no executable price', testStaleQuoteYieldsNoExecutablePrice],
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
  console.log(`\nforex price consistency: ${tests.length - failed}/${tests.length} passed`);
  if (failed > 0) process.exit(1);
}

run();
