/**
 * Normalized Forex market-data facade.
 * Frontend consumes this contract — not a vendor-specific format.
 */
import { forexApi } from '../api/client';
import type { ForexCandleQuery } from '../models/candles';

export type ForexNormalizedQuote = {
  symbol: string;
  bid: string | null;
  ask: string | null;
  spreadPips: string | null;
  timestamp: string | null;
  source: string;
  freshness: string;
};

export const ForexMarketDataProvider = {
  getQuote: (symbol: string) => forexApi.quote(symbol),
  getQuotes: () => forexApi.quotes(),
  getCandles: (query: ForexCandleQuery, signal?: AbortSignal) => forexApi.candles(query, signal),
  getMarketStatus: () => forexApi.sessions(),
};

export const FOREX_MARKET_DATA_NOTES = {
  historicalProvider: 'EXTERNAL_YAHOO when FOREX_OHLC_PROVIDER=yahoo',
  liveProvider: 'ADB Exchange simulated quote aggregator (MOCK venues)',
  candlePriceBasis: 'Yahoo OHLC as published; forming-candle mid only when history and ticks share a source',
  mergePolicy: 'Do not apply simulated ticks onto Yahoo OHLC',
  quoteOverlayPolicy: 'Bid/Ask chart lines only when quote mid is within 0.25% of last historical close',
  aggregatedTimeframes: '30m from 15m · 4h from 1h · 1W from 1D (Monday UTC)',
} as const;
