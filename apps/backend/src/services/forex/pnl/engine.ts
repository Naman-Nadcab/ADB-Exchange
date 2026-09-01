/**
 * P&L engine. Position owns volume/side/entry. This module owns P&L math.
 *
 * Realized (fill price authoritative, never requested/frontend price):
 *   LONG  (close - entry) × closedVolume × contractSize
 *   SHORT (entry - close) × closedVolume × contractSize
 * Result is quote-currency, then converted to USD.
 *
 * Unrealized executable-side policy (documented):
 *   LONG  valued at BID  (close = sell at bid)
 *   SHORT valued at ASK  (close = buy at ask)
 * Mid is never used for unrealized valuation.
 * Missing or stale quote → fail closed (do not fabricate, do not label LIVE).
 */
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import type { ForexPositionRecord, ForexPositionSide } from '../positions/models.js';
import type { ForexQuoteDto } from '../types.js';
import {
  convertQuoteToAccount,
  ForexConversionError,
  type ConversionRateSource,
  type ConversionResult,
} from './conversion.js';

export class ForexPnlError extends Error {
  constructor(
    readonly reason: string,
    message: string
  ) {
    super(message);
    this.name = 'ForexPnlError';
  }
}

export type PnlCalculationStatus =
  | 'CALCULATED'
  | 'PRICE_UNAVAILABLE'
  | 'STALE_PRICE'
  | 'CONVERSION_RATE_UNAVAILABLE'
  | 'STALE_CONVERSION_RATE';

export interface RealizedPnlResult {
  kind: 'REALIZED';
  quotePnl: string;
  accountPnl: string;
  currency: string;
  closedVolume: string;
  entryPrice: string;
  closePrice: string;
  contractSize: string;
  side: ForexPositionSide;
  symbol: string;
  conversion: ConversionResult;
  calculationStatus: 'CALCULATED';
  valuationTimestamp: string;
  priceSource: 'FILL';
  conversionSource: ConversionResult['conversionSource'];
  source: 'SIMULATED';
}

export interface UnrealizedPnlResult {
  kind: 'UNREALIZED';
  quotePnl: string;
  accountPnl: string;
  currency: string;
  volume: string;
  entryPrice: string;
  valuationPrice: string;
  contractSize: string;
  side: ForexPositionSide;
  symbol: string;
  conversion?: ConversionResult;
  calculationStatus: PnlCalculationStatus;
  valuationTimestamp: string;
  priceSource: 'BID' | 'ASK' | 'UNAVAILABLE';
  conversionSource: ConversionResult['conversionSource'] | 'UNAVAILABLE';
  source: 'SIMULATED';
  reason?: string;
}

export function quoteRealizedPnl(args: {
  side: ForexPositionSide;
  entryPrice: string;
  closePrice: string;
  closedVolume: string;
  contractSize: string;
}): string {
  const entry = fxDecimal(args.entryPrice);
  const close = fxDecimal(args.closePrice);
  const vol = fxDecimal(args.closedVolume);
  const cs = fxDecimal(args.contractSize);
  if (!vol.gt(0) || !cs.gt(0) || !entry.gt(0) || !close.gt(0)) {
    throw new ForexPnlError('INVALID_PNL_INPUT', 'realized P&L inputs must be positive decimals');
  }
  const diff = args.side === 'long' ? close.minus(entry) : entry.minus(close);
  return diff.times(vol).times(cs).toFixed();
}

export function calculateRealizedPnl(args: {
  symbol: string;
  side: ForexPositionSide;
  entryPrice: string;
  closePrice: string;
  closedVolume: string;
  rates: ConversionRateSource;
}): RealizedPnlResult {
  const instrument = getForexInstrumentBySymbol(args.symbol);
  if (!instrument) throw new ForexPnlError('UNKNOWN_INSTRUMENT', args.symbol);
  const quotePnl = quoteRealizedPnl({
    side: args.side,
    entryPrice: args.entryPrice,
    closePrice: args.closePrice,
    closedVolume: args.closedVolume,
    contractSize: instrument.contractSize,
  });
  const conversion = convertQuoteToAccount({
    quoteAmount: quotePnl,
    instrumentSymbol: args.symbol,
    rates: args.rates,
    ownRate: args.closePrice,
    ownPriceSource: 'OWN_FILL',
  });
  return {
    kind: 'REALIZED',
    quotePnl,
    accountPnl: conversion.amountAccount,
    currency: conversion.accountCurrency,
    closedVolume: args.closedVolume,
    entryPrice: args.entryPrice,
    closePrice: args.closePrice,
    contractSize: instrument.contractSize,
    side: args.side,
    symbol: args.symbol,
    conversion,
    calculationStatus: 'CALCULATED',
    valuationTimestamp: conversion.valuationTimestamp,
    priceSource: 'FILL',
    conversionSource: conversion.conversionSource,
    source: 'SIMULATED',
  };
}

export function executableClosePrice(side: ForexPositionSide, quote: ForexQuoteDto): { price: string; priceSource: 'BID' | 'ASK' } {
  return side === 'long' ? { price: quote.bid, priceSource: 'BID' } : { price: quote.ask, priceSource: 'ASK' };
}

export function calculateUnrealizedPnl(args: {
  position: Pick<ForexPositionRecord, 'symbol' | 'side' | 'volume' | 'entryPrice' | 'status'>;
  quote: ForexQuoteDto | undefined;
  rates: ConversionRateSource;
}): UnrealizedPnlResult {
  const now = new Date().toISOString();
  const base = {
    kind: 'UNREALIZED' as const,
    currency: 'USD',
    volume: args.position.volume,
    entryPrice: args.position.entryPrice,
    contractSize: getForexInstrumentBySymbol(args.position.symbol)?.contractSize ?? '0',
    side: args.position.side,
    symbol: args.position.symbol,
    source: 'SIMULATED' as const,
  };
  if (args.position.status !== 'OPEN' || !fxDecimal(args.position.volume).gt(0)) {
    return {
      ...base,
      quotePnl: '0',
      accountPnl: '0',
      valuationPrice: args.position.entryPrice,
      calculationStatus: 'CALCULATED',
      valuationTimestamp: now,
      priceSource: 'BID',
      conversionSource: 'IDENTITY',
    };
  }
  if (!args.quote) {
    return {
      ...base,
      quotePnl: '0',
      accountPnl: '0',
      valuationPrice: '0',
      calculationStatus: 'PRICE_UNAVAILABLE',
      valuationTimestamp: now,
      priceSource: 'UNAVAILABLE',
      conversionSource: 'UNAVAILABLE',
      reason: 'PRICE_UNAVAILABLE',
    };
  }
  if (args.quote.freshness === 'STALE' || args.quote.quality === 'STALE' || args.quote.status !== 'TRADEABLE') {
    return {
      ...base,
      quotePnl: '0',
      accountPnl: '0',
      valuationPrice: args.quote.mid,
      calculationStatus: 'STALE_PRICE',
      valuationTimestamp: args.quote.receivedTimestamp,
      priceSource: 'UNAVAILABLE',
      conversionSource: 'UNAVAILABLE',
      reason: 'STALE_PRICE',
    };
  }
  const exec = executableClosePrice(args.position.side, args.quote);
  try {
    const quotePnl = quoteRealizedPnl({
      side: args.position.side,
      entryPrice: args.position.entryPrice,
      closePrice: exec.price,
      closedVolume: args.position.volume,
      contractSize: base.contractSize,
    });
    const conversion = convertQuoteToAccount({
      quoteAmount: quotePnl,
      instrumentSymbol: args.position.symbol,
      rates: args.rates,
      ownRate: exec.price,
      ownPriceSource: exec.priceSource === 'BID' ? 'OWN_BID' : 'OWN_ASK',
    });
    return {
      ...base,
      quotePnl,
      accountPnl: conversion.amountAccount,
      valuationPrice: exec.price,
      conversion,
      calculationStatus: 'CALCULATED',
      valuationTimestamp: conversion.valuationTimestamp,
      priceSource: exec.priceSource,
      conversionSource: conversion.conversionSource,
    };
  } catch (e) {
    const reason =
      e instanceof ForexConversionError && e.reason !== 'CURRENCY_MISMATCH'
        ? e.reason
        : 'CONVERSION_RATE_UNAVAILABLE';
    return {
      ...base,
      quotePnl: '0',
      accountPnl: '0',
      valuationPrice: exec.price,
      calculationStatus: reason,
      valuationTimestamp: args.quote.receivedTimestamp,
      priceSource: exec.priceSource,
      conversionSource: 'UNAVAILABLE',
      reason,
    };
  }
}

export function sumUnrealized(items: UnrealizedPnlResult[]): {
  accountPnl: string;
  calculationStatus: PnlCalculationStatus;
  reason?: string;
} {
  for (const i of items) {
    if (i.calculationStatus !== 'CALCULATED') {
      return { accountPnl: '0', calculationStatus: i.calculationStatus, reason: i.reason };
    }
  }
  let sum = fxDecimal(0);
  for (const i of items) sum = sum.plus(i.accountPnl);
  return { accountPnl: sum.toFixed(), calculationStatus: 'CALCULATED' };
}
