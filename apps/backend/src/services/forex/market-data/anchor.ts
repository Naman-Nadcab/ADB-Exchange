/**
 * Market anchor for the SIMULATED quote base.
 *
 * The chart renders external reference OHLC (see ohlc-yahoo.ts) while executable
 * quotes come from the deterministic MOCK walk. When the walk is based on a
 * hardcoded constant it drifts away from the reference series over time, so the
 * same symbol ends up with two different "current" prices.
 *
 * The anchor pins the MOCK walk base to the latest validated reference close, so
 * chart history, Market Watch, order ticket, and position valuation share one
 * price universe.
 *
 * This does NOT make Forex real:
 *   source = SIMULATED, executionMode = MOCK, realForex = false.
 * The reference close is a starting point for a simulated walk, never an
 * executable price and never a financial authority.
 */
import { logger } from '../../../lib/logger.js';
import { fxDecimal, fxToPriceString } from '../decimal-fx.js';
import { FOREX_MOCK_BASE_PRICES, getForexInstrumentBySymbol, normalizeForexSymbol } from '../instruments.catalog.js';
import { forexOhlcProviderName } from './candles.service.js';

export type ForexMockAnchor = {
  symbol: string;
  base: string;
  staticBase: string;
  providerSymbol: string;
  asOf: string;
  refreshedAt: string;
};

const anchors = new Map<string, ForexMockAnchor>();
let lastRefreshAt: string | null = null;
let lastRefreshError: string | null = null;

/**
 * Widest drift accepted from the authored constant. Genuine multi-month FX drift
 * stays well inside this band; a unit/symbol error (silver quoted in cents, a
 * futures contract with a different multiplier) does not.
 */
const ANCHOR_MIN_RATIO = 0.5;
const ANCHOR_MAX_RATIO = 2;

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/** Anchoring is pointless when the chart serves no external reference series. */
export function forexMockAnchorEnabled(): boolean {
  return envBool('FOREX_MOCK_ANCHOR', forexOhlcProviderName() === 'yahoo');
}

export function forexMockAnchorRefreshMs(): number {
  const raw = Number.parseInt(process.env.FOREX_MOCK_ANCHOR_REFRESH_MS ?? '', 10);
  return Number.isFinite(raw) && raw >= 60_000 ? raw : 900_000;
}

function key(symbol: string): string {
  return normalizeForexSymbol(symbol) || symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function staticMockBase(symbol: string): string | undefined {
  const k = key(symbol);
  return FOREX_MOCK_BASE_PRICES[k] ?? FOREX_MOCK_BASE_PRICES[symbol];
}

/** Reject non-finite, non-positive, or out-of-band candidates. */
export function anchorSanityOk(staticBase: string | undefined, candidate: string): boolean {
  const c = Number(candidate);
  if (!Number.isFinite(c) || c <= 0) return false;
  if (!staticBase) return false;
  const s = Number(staticBase);
  if (!Number.isFinite(s) || s <= 0) return false;
  const ratio = c / s;
  return ratio >= ANCHOR_MIN_RATIO && ratio <= ANCHOR_MAX_RATIO;
}

/**
 * Base price for the deterministic MOCK walk.
 * Anchored reference close when available, else the authored constant.
 */
export function getForexMockBasePrice(symbol: string): string | undefined {
  const anchored = anchors.get(key(symbol));
  if (anchored) return anchored.base;
  return staticMockBase(symbol);
}

export function forexMockAnchorSnapshot(): {
  enabled: boolean;
  source: 'SIMULATED';
  reference: 'EXTERNAL_OHLC_CLOSE' | 'STATIC_CATALOG';
  refreshedAt: string | null;
  error: string | null;
  count: number;
  anchors: ForexMockAnchor[];
} {
  const list = [...anchors.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  return {
    enabled: forexMockAnchorEnabled(),
    source: 'SIMULATED',
    reference: list.length > 0 ? 'EXTERNAL_OHLC_CLOSE' : 'STATIC_CATALOG',
    refreshedAt: lastRefreshAt,
    error: lastRefreshError,
    count: list.length,
    anchors: list,
  };
}

export function resetForexMockAnchorsForTests(): void {
  anchors.clear();
  lastRefreshAt = null;
  lastRefreshError = null;
}

/** Test/DEMO hook. Applies the same sanity band as a live refresh. */
export function setForexMockAnchorForTests(symbol: string, base: string, asOf = new Date().toISOString()): boolean {
  const k = key(symbol);
  const staticBase = staticMockBase(k);
  if (!anchorSanityOk(staticBase, base)) return false;
  anchors.set(k, {
    symbol: k,
    base,
    staticBase: staticBase ?? base,
    providerSymbol: 'TEST',
    asOf,
    refreshedAt: new Date().toISOString(),
  });
  return true;
}

/**
 * Pull the latest validated reference close per symbol and re-anchor.
 * Fails closed: a symbol keeps its previous anchor, or the authored constant.
 */
export async function refreshForexMockAnchors(symbols: string[]): Promise<{
  updated: string[];
  skipped: Array<{ symbol: string; reason: string }>;
}> {
  const updated: string[] = [];
  const skipped: Array<{ symbol: string; reason: string }> = [];
  if (!forexMockAnchorEnabled()) {
    return { updated, skipped: symbols.map((symbol) => ({ symbol, reason: 'ANCHOR_DISABLED' })) };
  }

  const yahoo = await import('./ohlc-yahoo.js');
  for (const raw of symbols) {
    const symbol = key(raw);
    const instrument = getForexInstrumentBySymbol(symbol);
    const staticBase = staticMockBase(symbol);
    if (!instrument || !staticBase) {
      skipped.push({ symbol, reason: 'UNKNOWN_INSTRUMENT' });
      continue;
    }
    try {
      // 1h keeps the anchor close to the most recent session without paging daily history.
      const fetched = await yahoo.fetchYahooOhlc({ symbol, timeframe: '1h', limit: 2 });
      const bars = yahoo.alignBarsToTimeframe(fetched.bars, '1h');
      const last = bars[bars.length - 1];
      if (!last) {
        skipped.push({ symbol, reason: 'PROVIDER_EMPTY' });
        continue;
      }
      if (!anchorSanityOk(staticBase, last.close)) {
        skipped.push({ symbol, reason: 'OUT_OF_SANITY_BAND' });
        continue;
      }
      const base = fxToPriceString(fxDecimal(last.close), instrument.pricePrecision);
      anchors.set(symbol, {
        symbol,
        base,
        staticBase,
        providerSymbol: fetched.providerSymbol,
        asOf: last.timestamp,
        refreshedAt: new Date().toISOString(),
      });
      updated.push(symbol);
    } catch (err) {
      skipped.push({ symbol, reason: err instanceof Error ? err.message : 'PROVIDER_ERROR' });
    }
  }

  lastRefreshAt = new Date().toISOString();
  lastRefreshError = updated.length === 0 && skipped.length > 0 ? (skipped[0]?.reason ?? null) : null;
  logger.info('Forex mock anchors refreshed', {
    updated: updated.length,
    skipped: skipped.length,
    source: 'SIMULATED',
  });
  return { updated, skipped };
}
