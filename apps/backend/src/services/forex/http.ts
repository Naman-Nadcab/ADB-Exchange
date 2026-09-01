import { forexConfig } from './config.js';
import { getForexInstrumentBySymbol, normalizeForexSymbol } from './instruments.catalog.js';
import { instrumentToApi, listForexInstruments } from './instruments.service.js';
import type { ForexPricingService } from './quotes.service.js';

export function forexInstrumentsPayload() {
  const instruments = listForexInstruments().map(instrumentToApi);
  return {
    success: true as const,
    data: { count: instruments.length, instruments },
  };
}

export function forexQuotesPayload(svc: ForexPricingService) {
  const quotes = svc.listQuotes();
  const simulated = quotes.every((q) => q.source === 'SIMULATED') || quotes.length === 0;
  return {
    success: true as const,
    data: {
      source: simulated ? ('SIMULATED' as const) : ('LIVE' as const),
      count: quotes.length,
      quotes,
      providers: svc.listHealth(),
    },
  };
}

export function forexProvidersPayload(svc: ForexPricingService) {
  const providers = svc.listProviders();
  return {
    success: true as const,
    data: { source: 'SIMULATED' as const, count: providers.length, providers },
  };
}

export function forexLiquidityPayload(svc: ForexPricingService) {
  const books = svc.listRoutingSnapshots();
  return {
    success: true as const,
    data: { source: 'SIMULATED' as const, count: books.length, books },
  };
}

export function forexLiquidityBySymbolPayload(svc: ForexPricingService, rawSymbol: string) {
  const symbol = normalizeForexSymbol(rawSymbol);
  const instrument = getForexInstrumentBySymbol(symbol);
  if (!instrument) {
    return {
      status: 404 as const,
      body: {
        success: false as const,
        error: { code: 'FOREX_INSTRUMENT_NOT_FOUND', message: `Unknown Forex symbol ${symbol}` },
      },
    };
  }
  return {
    status: 200 as const,
    body: {
      success: true as const,
      data: svc.getRoutingSnapshot(symbol),
    },
  };
}

export function forexQuoteBySymbolPayload(svc: ForexPricingService, rawSymbol: string) {
  const symbol = normalizeForexSymbol(rawSymbol);
  const instrument = getForexInstrumentBySymbol(symbol);
  if (!instrument) {
    return {
      status: 404 as const,
      body: {
        success: false as const,
        error: { code: 'FOREX_INSTRUMENT_NOT_FOUND', message: `Unknown Forex symbol ${symbol}` },
      },
    };
  }
  const quote = svc.getQuote(symbol);
  if (!quote) {
    return {
      status: 404 as const,
      body: {
        success: false as const,
        error: { code: 'FOREX_QUOTE_UNAVAILABLE', message: `No Forex quote for ${symbol}` },
      },
    };
  }
  return {
    status: 200 as const,
    body: {
      success: true as const,
      data: {
        source: quote.source,
        quality: quote.quality,
        freshness: quote.freshness,
        quote,
      },
    },
  };
}

export function isForexExecutionTestAuthorized(header: string | string[] | undefined): boolean {
  if (!forexConfig.executionTestApiEnabled) return false;
  const v = Array.isArray(header) ? header[0] : header;
  return v === 'SIMULATED';
}
