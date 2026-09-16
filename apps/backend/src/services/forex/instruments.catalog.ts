import type { ForexInstrument } from './types.js';
import { getForexInstrumentTradingStatusOverride } from './admin/runtime-controls.js';

/** Default FX session calendar (24x5 UTC). Holidays/DST/exceptions are additive later. */
export const FOREX_DEFAULT_CALENDAR_ID = 'f0000000-0000-4000-8000-0000000000c1';

export const FOREX_PROVIDER_IDS = {
  MOCK_A: 'f0000000-0000-4000-8000-0000000000a1',
  MOCK_B: 'f0000000-0000-4000-8000-0000000000a2',
  MOCK_C: 'f0000000-0000-4000-8000-0000000000a3',
} as const;

function fxPair(
  idSuffix: string,
  symbol: string,
  display: string,
  base: string,
  quote: string,
  assetClass: ForexInstrument['assetClass'],
  digits: number,
  pipSize: string,
  tickSize: string
): ForexInstrument {
  return {
    id: `f0000000-0000-4000-8000-00000000${idSuffix}`,
    symbol,
    displaySymbol: display,
    baseCurrency: base,
    quoteCurrency: quote,
    assetClass,
    digits,
    pricePrecision: digits,
    pipSize,
    tickSize,
    contractSize: '100000',
    minVolume: '0.01',
    maxVolume: '100.00',
    volumeStep: '0.01',
    tradingStatus: 'active',
    sessionCalendarId: FOREX_DEFAULT_CALENDAR_ID,
    maxLeverage: '50',
    marginPercent: '2.00',
    commission: '0',
    commissionType: 'per_lot',
    swapLong: '0',
    swapShort: '0',
    swap3day: '0',
  };
}

function metal(
  idSuffix: string,
  symbol: string,
  display: string,
  base: string,
  digits: number,
  pipSize: string,
  tickSize: string,
  contractSize: string,
  maxVolume: string
): ForexInstrument {
  return {
    id: `f0000000-0000-4000-8000-00000000${idSuffix}`,
    symbol,
    displaySymbol: display,
    baseCurrency: base,
    quoteCurrency: 'USD',
    assetClass: 'metal',
    digits,
    pricePrecision: digits,
    pipSize,
    tickSize,
    contractSize,
    minVolume: '0.01',
    maxVolume,
    volumeStep: '0.01',
    tradingStatus: 'active',
    sessionCalendarId: FOREX_DEFAULT_CALENDAR_ID,
    maxLeverage: '20',
    marginPercent: '5.00',
    commission: '0',
    commissionType: 'per_lot',
    swapLong: '0',
    swapShort: '0',
    swap3day: '0',
  };
}

/**
 * Canonical Phase 1 instrument set. Seed and runtime both use this list.
 * Pip/tick/contract values are per-instrument — never assume 0.0001 globally.
 */
export const FOREX_INSTRUMENT_CATALOG: readonly ForexInstrument[] = [
  fxPair('e001', 'EURUSD', 'EUR/USD', 'EUR', 'USD', 'fx_major', 5, '0.0001', '0.00001'),
  fxPair('e002', 'GBPUSD', 'GBP/USD', 'GBP', 'USD', 'fx_major', 5, '0.0001', '0.00001'),
  fxPair('e003', 'USDJPY', 'USD/JPY', 'USD', 'JPY', 'fx_major', 3, '0.01', '0.001'),
  fxPair('e004', 'USDCHF', 'USD/CHF', 'USD', 'CHF', 'fx_major', 5, '0.0001', '0.00001'),
  fxPair('e005', 'AUDUSD', 'AUD/USD', 'AUD', 'USD', 'fx_major', 5, '0.0001', '0.00001'),
  fxPair('e006', 'USDCAD', 'USD/CAD', 'USD', 'CAD', 'fx_major', 5, '0.0001', '0.00001'),
  fxPair('e007', 'NZDUSD', 'NZD/USD', 'NZD', 'USD', 'fx_major', 5, '0.0001', '0.00001'),
  fxPair('e008', 'EURGBP', 'EUR/GBP', 'EUR', 'GBP', 'fx_cross', 5, '0.0001', '0.00001'),
  fxPair('e009', 'EURJPY', 'EUR/JPY', 'EUR', 'JPY', 'fx_cross', 3, '0.01', '0.001'),
  fxPair('e00a', 'GBPJPY', 'GBP/JPY', 'GBP', 'JPY', 'fx_cross', 3, '0.01', '0.001'),
  metal('e00b', 'XAUUSD', 'XAU/USD', 'XAU', 2, '0.01', '0.01', '100', '50.00'),
  metal('e00c', 'XAGUSD', 'XAG/USD', 'XAG', 3, '0.01', '0.001', '5000', '50.00'),
];

const bySymbol = new Map(FOREX_INSTRUMENT_CATALOG.map((i) => [i.symbol, i]));
const byId = new Map(FOREX_INSTRUMENT_CATALOG.map((i) => [i.id, i]));

export function getForexInstrumentBySymbol(symbol: string): ForexInstrument | undefined {
  const base = bySymbol.get(normalizeForexSymbol(symbol));
  if (!base) return undefined;
  const tradingStatus = getForexInstrumentTradingStatusOverride(symbol);
  return tradingStatus ? { ...base, tradingStatus } : base;
}

export function getForexInstrumentById(id: string): ForexInstrument | undefined {
  return byId.get(id);
}

export function normalizeForexSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function listForexSymbols(): string[] {
  return FOREX_INSTRUMENT_CATALOG.map((i) => i.symbol);
}

/**
 * Deterministic mock mid anchors for SIMULATED LP quotes.
 * Not live market data and not used for historical OHLC.
 * Kept near current external FX/metal levels so demo Bid/Ask
 * does not sit hundreds of pips away from Yahoo chart history.
 */
export const FOREX_MOCK_BASE_PRICES: Readonly<Record<string, string>> = {
  EURUSD: '1.15780',
  GBPUSD: '1.34965',
  USDJPY: '160.080',
  USDCHF: '0.81324',
  AUDUSD: '0.71357',
  USDCAD: '1.39213',
  NZDUSD: '0.58299',
  EURGBP: '0.85760',
  EURJPY: '185.290',
  GBPJPY: '216.051',
  XAUUSD: '4354.00',
  XAGUSD: '64.345',
};

/** Deterministic bid/ask width in ticks (instrument tick_size). */
export const FOREX_MOCK_SPREAD_TICKS: Readonly<Record<string, number>> = {
  EURUSD: 6,
  GBPUSD: 8,
  USDJPY: 6,
  USDCHF: 8,
  AUDUSD: 8,
  USDCAD: 10,
  NZDUSD: 10,
  EURGBP: 8,
  EURJPY: 10,
  GBPJPY: 14,
  XAUUSD: 20,
  XAGUSD: 20,
};
