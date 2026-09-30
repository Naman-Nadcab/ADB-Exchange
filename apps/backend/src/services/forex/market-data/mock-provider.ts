import { forexConfig } from '../config.js';
import { fxDecimal, fxToPriceString } from '../decimal-fx.js';
import {
  FOREX_INSTRUMENT_CATALOG,
  FOREX_MOCK_SPREAD_TICKS,
  getForexInstrumentBySymbol,
} from '../instruments.catalog.js';
import { getForexMockBasePrice } from './anchor.js';
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

/** Relative bid offset in ticks so A/B/C never print the same book. Zero in DEMO. */
const PROVIDER_BID_OFFSET_TICKS = [0, 1, -1] as const;

type DemoPin = { mid: string; expiresAtMs: number };

/**
 * DEMO / MOCK only. Temporary mid override so LIMIT/STOP scenarios can trigger
 * without a real LP. Must NEVER become a permanent second price universe.
 *
 * Lifecycle:
 *   pin → holds for FOREX_DEMO_PIN_TTL_MS (default 30s) → auto-expire
 *   unpin / clear → immediate return to anchored MOCK walk
 *   process restart → map is empty (in-memory only)
 *
 * Anchor refresh does not create or extend pins.
 */
const demoPinnedMids = new Map<string, DemoPin>();

/** Default 30s covers pending fill polls; certs must clear pins, not rely on restart. */
export function forexDemoPinTtlMs(): number {
  const raw = Number.parseInt(process.env.FOREX_DEMO_PIN_TTL_MS ?? '', 10);
  if (Number.isFinite(raw) && raw >= 1_000 && raw <= 300_000) return raw;
  return 30_000;
}

function demoSymbolKey(symbol: string): string {
  return symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function nowMs(): number {
  return Date.now();
}

function activeDemoPin(symbol: string, atMs = nowMs()): DemoPin | undefined {
  const k = demoSymbolKey(symbol);
  const pin = demoPinnedMids.get(k);
  if (!pin) return undefined;
  if (pin.expiresAtMs <= atMs) {
    demoPinnedMids.delete(k);
    return undefined;
  }
  return pin;
}

/** Pin subsequent MOCK ticks around this mid (DEMO trigger / scenario only). */
export function pinForexDemoMid(symbol: string, mid: string, ttlMs = forexDemoPinTtlMs()): void {
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : forexDemoPinTtlMs();
  demoPinnedMids.set(demoSymbolKey(symbol), { mid, expiresAtMs: nowMs() + ttl });
}

export function unpinForexDemoMid(symbol: string): void {
  demoPinnedMids.delete(demoSymbolKey(symbol));
}

/** Clear one symbol or every demo mid pin (DEMO hygiene / cert isolation). */
export function clearForexDemoPins(symbol?: string): { cleared: string[] } {
  if (symbol) {
    const k = demoSymbolKey(symbol);
    const had = demoPinnedMids.has(k);
    demoPinnedMids.delete(k);
    return { cleared: had ? [k] : [] };
  }
  const cleared = [...demoPinnedMids.keys()].sort();
  demoPinnedMids.clear();
  return { cleared };
}

export function getForexDemoPin(symbol: string): { mid: string; expiresAtMs: number; remainingMs: number } | null {
  const pin = activeDemoPin(symbol);
  if (!pin) return null;
  return { mid: pin.mid, expiresAtMs: pin.expiresAtMs, remainingMs: Math.max(0, pin.expiresAtMs - nowMs()) };
}

/** Test hook: wipe pins without going through the HTTP clear route. */
export function resetForexDemoPinsForTests(): void {
  demoPinnedMids.clear();
}

export function mockPriceAt(symbol: string, sequence: bigint, providerIndex: number): { bid: string; ask: string } {
  const instrument = getForexInstrumentBySymbol(symbol);
  const pinned = activeDemoPin(symbol)?.mid;
  // Anchored to the same external reference series the chart renders, so one
  // symbol never has two "current" prices. Still SIMULATED / MOCK.
  // Expired / absent pin → authoritative MOCK walk base (never Yahoo candle as fill).
  const base = pinned ?? getForexMockBasePrice(symbol);
  if (!instrument || !base) {
    throw new Error(`No mock base price for ${symbol}`);
  }
  const demoFlat = forexConfig.demoZeroSpread;
  const idx = providerIndex === 0 || providerIndex === 1 || providerIndex === 2 ? providerIndex : 0;
  const spreadTicks = demoFlat ? 0 : (FOREX_MOCK_SPREAD_TICKS[symbol] ?? 8);
  const tick = fxDecimal(instrument.tickSize);
  const walk = deterministicOffsetTicks(symbol, sequence, 8);
  const mid = fxDecimal(base).plus(tick.times(walk));
  const bid = demoFlat ? mid : mid.plus(tick.times(PROVIDER_BID_OFFSET_TICKS[idx]));
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

  /** DEMO/test: emit the next monotonic sequence at an explicit Bid/Ask. */
  quoteAt(symbol: string, now: Date, bid: string, ask: string): ProviderRawQuote {
    this.sequence += 1n;
    this.lastQuoteTime = now;
    this.quoteCount += 1;
    return {
      providerId: this.id,
      providerCode: this.code,
      symbol,
      bid,
      ask,
      providerTimestamp: new Date(now.getTime() - this.providerLatencyMs),
      providerSequence: this.sequence,
      source: 'SIMULATED',
    };
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
