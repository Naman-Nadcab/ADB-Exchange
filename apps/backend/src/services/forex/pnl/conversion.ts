/**
 * Quote-currency → account-currency conversion.
 *
 * Phase 6 accounting currency is USD only. Never mix currencies.
 * Never fabricate a rate. Never assume 1:1 unless the quote currency IS USD
 * (documented IDENTITY — not a silent conversion of a foreign currency).
 *
 * Rules:
 * 1. quoteCurrency === USD → IDENTITY (rate 1, no market lookup)
 * 2. USD{quote} catalog pair (USDJPY, USDCHF, USDCAD) → usd = quoteAmount / rate
 * 3. {quote}USD catalog pair (GBPUSD, AUDUSD) → usd = quoteAmount * rate
 * 4. otherwise CONVERSION_RATE_UNAVAILABLE
 *
 * EURJPY / GBPJPY P&L is in JPY and MUST use USDJPY, not the instrument mid.
 * When the instrument itself is a USD pair, ownRate (fill or executable side) is used.
 */
import { forexCurrencyConversionErrorTotal } from '../../../lib/forex-prometheus-metrics.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import type { ForexPricingService } from '../quotes.service.js';

export class ForexConversionError extends Error {
  constructor(
    readonly reason: 'CONVERSION_RATE_UNAVAILABLE' | 'CURRENCY_MISMATCH' | 'STALE_CONVERSION_RATE',
    message: string
  ) {
    super(message);
    this.name = 'ForexConversionError';
  }
}

export interface ConversionQuote {
  pair: string;
  bid: string;
  ask: string;
  mid: string;
  source: 'SIMULATED';
  timestamp: string;
  freshness: 'FRESH' | 'STALE';
}

export interface ConversionRateSource {
  getRate(pair: string): ConversionQuote | null;
}

export interface ConversionResult {
  amountAccount: string;
  accountCurrency: string;
  quoteCurrency: string;
  rate: string;
  pair: string | null;
  conversionSource: 'IDENTITY' | 'USDXXX' | 'XXXUSD';
  priceSource: 'IDENTITY' | 'MID' | 'OWN_FILL' | 'OWN_BID' | 'OWN_ASK';
  valuationTimestamp: string;
}

export const FOREX_ACCOUNTING_CURRENCY = forexConfig.accountingCurrency;

export class MapConversionSource implements ConversionRateSource {
  constructor(private readonly rates = new Map<string, ConversionQuote>()) {}

  set(quote: ConversionQuote): void {
    this.rates.set(quote.pair, quote);
  }

  getRate(pair: string): ConversionQuote | null {
    return this.rates.get(pair) ?? null;
  }
}

export class ForexQuoteConversionSource implements ConversionRateSource {
  constructor(private readonly pricing?: ForexPricingService) {}

  getRate(pair: string): ConversionQuote | null {
    const q = this.pricing?.getQuote(pair);
    if (!q) return null;
    return {
      pair,
      bid: q.bid,
      ask: q.ask,
      mid: q.mid,
      source: 'SIMULATED',
      timestamp: q.receivedTimestamp,
      freshness: q.freshness === 'STALE' ? 'STALE' : 'FRESH',
    };
  }
}

export function convertQuoteToAccount(args: {
  quoteAmount: string;
  instrumentSymbol: string;
  rates: ConversionRateSource;
  ownRate?: string;
  ownPriceSource?: ConversionResult['priceSource'];
  now?: string;
}): ConversionResult {
  const instrument = getForexInstrumentBySymbol(args.instrumentSymbol);
  if (!instrument) {
    fail('CONVERSION_RATE_UNAVAILABLE');
    throw new ForexConversionError('CONVERSION_RATE_UNAVAILABLE', `unknown instrument ${args.instrumentSymbol}`);
  }
  const quoteCcy = instrument.quoteCurrency;
  const account = FOREX_ACCOUNTING_CURRENCY;
  const now = args.now ?? new Date().toISOString();
  const amount = fxDecimal(args.quoteAmount);

  if (quoteCcy === account) {
    return {
      amountAccount: amount.toFixed(),
      accountCurrency: account,
      quoteCurrency: quoteCcy,
      rate: '1',
      pair: null,
      conversionSource: 'IDENTITY',
      priceSource: 'IDENTITY',
      valuationTimestamp: now,
    };
  }

  const usdxxx = `${account}${quoteCcy}`;
  const xxxusd = `${quoteCcy}${account}`;
  const ownIsUsdPair = instrument.baseCurrency === account || instrument.quoteCurrency === account;

  if (getForexInstrumentBySymbol(usdxxx)) {
    return applyRate({
      amount,
      account,
      quoteCcy,
      pair: usdxxx,
      mode: 'div',
      conversionSource: 'USDXXX',
      rates: args.rates,
      ownRate: ownIsUsdPair ? args.ownRate : undefined,
      ownPriceSource: args.ownPriceSource,
      now,
    });
  }

  if (getForexInstrumentBySymbol(xxxusd)) {
    return applyRate({
      amount,
      account,
      quoteCcy,
      pair: xxxusd,
      mode: 'mul',
      conversionSource: 'XXXUSD',
      rates: args.rates,
      ownRate: ownIsUsdPair ? args.ownRate : undefined,
      ownPriceSource: args.ownPriceSource,
      now,
    });
  }

  fail('CONVERSION_RATE_UNAVAILABLE');
  throw new ForexConversionError(
    'CONVERSION_RATE_UNAVAILABLE',
    `no USD conversion path for quote ${quoteCcy} on ${args.instrumentSymbol}`
  );
}

function applyRate(args: {
  amount: ReturnType<typeof fxDecimal>;
  account: string;
  quoteCcy: string;
  pair: string;
  mode: 'div' | 'mul';
  conversionSource: ConversionResult['conversionSource'];
  rates: ConversionRateSource;
  ownRate?: string;
  ownPriceSource?: ConversionResult['priceSource'];
  now: string;
}): ConversionResult {
  let rateStr: string;
  let priceSource: ConversionResult['priceSource'];
  let timestamp = args.now;

  if (args.ownRate != null) {
    rateStr = args.ownRate;
    priceSource = args.ownPriceSource ?? 'OWN_FILL';
  } else {
    const q = args.rates.getRate(args.pair);
    if (!q) {
      fail('CONVERSION_RATE_UNAVAILABLE');
      throw new ForexConversionError('CONVERSION_RATE_UNAVAILABLE', `no conversion rate for ${args.pair}`);
    }
    if (q.freshness === 'STALE') {
      fail('STALE_CONVERSION_RATE');
      throw new ForexConversionError('STALE_CONVERSION_RATE', `${args.pair} conversion rate is stale`);
    }
    rateStr = q.mid;
    priceSource = 'MID';
    timestamp = q.timestamp;
  }

  const r = fxDecimal(rateStr);
  if (!r.gt(0)) {
    fail('CONVERSION_RATE_UNAVAILABLE');
    throw new ForexConversionError('CONVERSION_RATE_UNAVAILABLE', `${args.pair} rate is not positive`);
  }
  const usd = args.mode === 'div' ? args.amount.div(r) : args.amount.times(r);
  return {
    amountAccount: usd.toFixed(),
    accountCurrency: args.account,
    quoteCurrency: args.quoteCcy,
    rate: r.toFixed(),
    pair: args.pair,
    conversionSource: args.conversionSource,
    priceSource,
    valuationTimestamp: timestamp,
  };
}

function fail(reason: 'CONVERSION_RATE_UNAVAILABLE' | 'STALE_CONVERSION_RATE'): void {
  forexCurrencyConversionErrorTotal.inc({ reason });
}
