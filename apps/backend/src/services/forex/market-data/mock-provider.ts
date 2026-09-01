import { fxDecimal, fxToPriceString } from '../decimal-fx.js';
import {
  FOREX_INSTRUMENT_CATALOG,
  FOREX_MOCK_BASE_PRICES,
  FOREX_MOCK_SPREAD_TICKS,
  getForexInstrumentBySymbol,
} from '../instruments.catalog.js';
import type {
  ForexMarketDataProvider,
  ForexProviderKind,
  ForexQuoteSource,
  ProviderHealthSnapshot,
  ProviderRawQuote,
} from '../types.js';

/**
 * Integer mix — no Math.random(), no live feeds.
 * Offset is an integer tick count so authoritative prices stay Decimal.
 */
export function deterministicOffsetTicks(symbol: string, sequence: bigint, amplitude: number): number {
  let h = 0x811c9dc5n;
  for (let i = 0; i < symbol.length; i += 1) {
    h = BigInt.asUintN(32, (h ^ BigInt(symbol.charCodeAt(i))) * 0x01000193n);
  }
  const mixed = BigInt.asUintN(64, (h ^ sequence) * 0x9e3779b97f4a7c15n);
  const span = BigInt(amplitude * 2 + 1);
  return Number(mixed % span) - amplitude;
}

/** Relative bid offset in ticks so A/B/C never print the same book. */
const PROVIDER_BID_OFFSET_TICKS = [0, 1, -1] as const;

export function mockPriceAt(symbol: string, sequence: bigint, providerIndex: number): { bid: string; ask: string } {
  const instrument = getForexInstrumentBySymbol(symbol);
  const base = FOREX_MOCK_BASE_PRICES[symbol];
  if (!instrument || !base) {
    throw new Error(`No mock base price for ${symbol}`);
  }
  const idx = providerIndex === 0 || providerIndex === 1 || providerIndex === 2 ? providerIndex : 0;
  const spreadTicks = FOREX_MOCK_SPREAD_TICKS[symbol] ?? 8;
  const tick = fxDecimal(instrument.tickSize);
  const walk = deterministicOffsetTicks(symbol, sequence, 8);
  const mid = fxDecimal(base).plus(tick.times(walk));
  const bid = mid.plus(tick.times(PROVIDER_BID_OFFSET_TICKS[idx]));
  const ask = bid.plus(tick.times(spreadTicks));
  return {
    bid: fxToPriceString(bid, instrument.pricePrecision),
    ask: fxToPriceString(ask, instrument.pricePrecision),
  };
}

export class MockForexProvider implements ForexMarketDataProvider {
  readonly kind: ForexProviderKind = 'market_data';
  readonly source: ForexQuoteSource = 'SIMULATED';
  private sequence = 0n;
  private symbols: string[] = FOREX_INSTRUMENT_CATALOG.map((i) => i.symbol);
  private running = false;
  private quoteCount = 0;
  private lastQuoteTime: Date | null = null;
  private providerLatencyMs = 0;

  constructor(
    readonly id: string,
    readonly code: string,
    readonly name: string,
    private readonly providerIndex: number
  ) {}

  start(symbols: string[]): void {
    this.symbols = symbols.slice();
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  /** Test hook: provider_timestamp is this many ms before EDA receive. */
  setProviderLatencyMs(ms: number): void {
    this.providerLatencyMs = Math.max(0, ms);
  }

  nextQuotes(now: Date): ProviderRawQuote[] {
    if (!this.running) return [];
    this.sequence += 1n;
    this.lastQuoteTime = now;
    const providerTs = new Date(now.getTime() - this.providerLatencyMs);
    const out: ProviderRawQuote[] = [];
    for (const symbol of this.symbols) {
      const px = mockPriceAt(symbol, this.sequence, this.providerIndex);
      this.quoteCount += 1;
      out.push({
        providerId: this.id,
        providerCode: this.code,
        symbol,
        bid: px.bid,
        ask: px.ask,
        providerTimestamp: providerTs,
        providerSequence: this.sequence,
        source: 'SIMULATED',
      });
    }
    return out;
  }

  health(): ProviderHealthSnapshot {
    return {
      providerId: this.id,
      providerCode: this.code,
      status: this.running ? (this.lastQuoteTime ? 'HEALTHY' : 'OFFLINE') : 'OFFLINE',
      lastQuoteTime: this.lastQuoteTime?.toISOString() ?? null,
      lastSequence: this.sequence === 0n ? null : this.sequence.toString(),
      latencyMs: 0,
      quoteCount: this.quoteCount,
      staleCount: 0,
      rejectedCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      outOfOrderCount: 0,
      rejectRate: 0,
    };
  }
}

export function createMockProviders(): MockForexProvider[] {
  return [
    new MockForexProvider(
      'f0000000-0000-4000-8000-0000000000a1',
      'MOCK-A',
      'EDA Mock Liquidity A',
      0
    ),
    new MockForexProvider(
      'f0000000-0000-4000-8000-0000000000a2',
      'MOCK-B',
      'EDA Mock Liquidity B',
      1
    ),
    new MockForexProvider(
      'f0000000-0000-4000-8000-0000000000a3',
      'MOCK-C',
      'EDA Mock Liquidity C',
      2
    ),
  ];
}
