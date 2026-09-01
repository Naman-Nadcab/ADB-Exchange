import type { DecimalInstance } from '../../lib/decimal.js';

export const FOREX_QUOTE_QUALITIES = ['OK', 'STALE', 'CROSSED', 'HALTED', 'SIMULATED'] as const;
export type ForexQuoteQuality = (typeof FOREX_QUOTE_QUALITIES)[number];

export const FOREX_QUOTE_SOURCES = ['LIVE', 'SIMULATED'] as const;
export type ForexQuoteSource = (typeof FOREX_QUOTE_SOURCES)[number];

export const FOREX_FRESHNESS = ['FRESH', 'STALE'] as const;
export type ForexFreshness = (typeof FOREX_FRESHNESS)[number];

export const FOREX_QUOTE_STATUSES = ['TRADEABLE', 'HALTED', 'REJECTED', 'UNAVAILABLE'] as const;
export type ForexQuoteStatus = (typeof FOREX_QUOTE_STATUSES)[number];

export const FOREX_ASSET_CLASSES = ['fx_major', 'fx_cross', 'metal'] as const;
export type ForexAssetClass = (typeof FOREX_ASSET_CLASSES)[number];

export const FOREX_TRADING_STATUSES = ['active', 'halted', 'closed'] as const;
export type ForexTradingStatus = (typeof FOREX_TRADING_STATUSES)[number];

export const FOREX_COMMISSION_TYPES = ['per_lot', 'percentage', 'none'] as const;
export type ForexCommissionType = (typeof FOREX_COMMISSION_TYPES)[number];

export const FOREX_PROVIDER_KINDS = ['market_data', 'execution', 'both'] as const;
export type ForexProviderKind = (typeof FOREX_PROVIDER_KINDS)[number];

export const FOREX_PROVIDER_HEALTH = ['HEALTHY', 'DEGRADED', 'STALE', 'OFFLINE'] as const;
export type ForexProviderHealthStatus = (typeof FOREX_PROVIDER_HEALTH)[number];

export const FOREX_SESSION_NAMES = ['Sydney', 'Tokyo', 'London', 'New York'] as const;
export type ForexSessionName = (typeof FOREX_SESSION_NAMES)[number];

export const FOREX_REJECT_REASONS = [
  'ZERO_BID',
  'ZERO_ASK',
  'NEGATIVE_BID',
  'NEGATIVE_ASK',
  'CROSSED_MARKET',
  'INVALID_PROVIDER_TIMESTAMP',
  'INVALID_RECEIVED_TIMESTAMP',
  'FUTURE_PROVIDER_TIMESTAMP',
  'MALFORMED_SEQUENCE',
  'IMPOSSIBLE_PRECISION',
  'UNKNOWN_INSTRUMENT',
  'HALTED_INSTRUMENT',
  'DUPLICATE_SEQUENCE',
  'OUT_OF_ORDER_SEQUENCE',
] as const;
export type ForexRejectReason = (typeof FOREX_REJECT_REASONS)[number];

export interface ForexInstrument {
  id: string;
  symbol: string;
  displaySymbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  assetClass: ForexAssetClass;
  digits: number;
  pricePrecision: number;
  pipSize: string;
  tickSize: string;
  contractSize: string;
  minVolume: string;
  maxVolume: string;
  volumeStep: string;
  tradingStatus: ForexTradingStatus;
  sessionCalendarId: string;
  maxLeverage: string;
  marginPercent: string;
  commission: string;
  commissionType: ForexCommissionType;
  swapLong: string;
  swapShort: string;
  swap3day: string;
}

export interface ForexSessionWindow {
  sessionName: ForexSessionName;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  timezone: string;
  wrapsMidnight: boolean;
}

export interface ForexSessionCalendar {
  id: string;
  code: string;
  name: string;
  timezone: string;
  windows: ForexSessionWindow[];
}

export interface ForexLpProvider {
  id: string;
  code: string;
  name: string;
  kind: ForexProviderKind;
  status: 'active' | 'disabled';
  priority: number;
}

/**
 * Provider-specific payload. Must not leak past the adapter.
 */
export interface ProviderRawQuote {
  providerId: string;
  providerCode: string;
  symbol: string;
  bid: string;
  ask: string;
  providerTimestamp: Date;
  providerSequence: bigint;
  source: ForexQuoteSource;
  raw?: Record<string, unknown>;
}

export interface NormalizedQuote {
  symbol: string;
  instrumentId: string;
  bid: DecimalInstance;
  ask: DecimalInstance;
  mid: DecimalInstance;
  spread: DecimalInstance;
  spreadPips: DecimalInstance;
  spreadTicks: DecimalInstance;
  providerId: string;
  providerCode: string;
  providerTimestamp: Date;
  receivedTimestamp: Date;
  providerSequence: bigint;
  edaReceiveSequence: bigint;
  quality: ForexQuoteQuality;
  status: ForexQuoteStatus;
  source: ForexQuoteSource;
  freshness: ForexFreshness;
}

export interface ForexQuoteDto {
  symbol: string;
  displaySymbol: string;
  instrumentId: string;
  bid: string;
  ask: string;
  mid: string;
  spread: string;
  spreadPips: string;
  spreadTicks: string;
  providerId: string;
  providerCode: string;
  providerTimestamp: string;
  receivedTimestamp: string;
  sequence: string;
  edaReceiveSequence: string;
  quality: ForexQuoteQuality;
  status: ForexQuoteStatus;
  source: ForexQuoteSource;
  freshness: ForexFreshness;
}

export interface QuoteValidationFailure {
  ok: false;
  reason: ForexRejectReason;
  detail: string;
}

export interface QuoteValidationSuccess {
  ok: true;
}

export type QuoteValidationResult = QuoteValidationSuccess | QuoteValidationFailure;

export interface SequenceDecision {
  action: 'accept' | 'duplicate' | 'out_of_order';
  reason?: ForexRejectReason;
  lastSequence?: bigint;
}

export interface ProviderHealthSnapshot {
  providerId: string;
  providerCode: string;
  status: ForexProviderHealthStatus;
  lastQuoteTime: string | null;
  lastSequence: string | null;
  latencyMs: number | null;
  quoteCount: number;
  staleCount: number;
  rejectedCount: number;
  errorCount: number;
  duplicateCount: number;
  outOfOrderCount: number;
}

/**
 * Future multi-LP book top. Phase 1 fills this from registered providers
 * so Phase 2 routing does not need a new quote contract.
 */
export interface AggregatedBookTop {
  symbol: string;
  bestBid: string | null;
  bestAsk: string | null;
  bestBidProviderId: string | null;
  bestAskProviderId: string | null;
  spread: string | null;
  eligibleProviderIds: string[];
  quotes: ForexQuoteDto[];
}

export interface ForexMarketDataProvider {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: ForexProviderKind;
  readonly source: ForexQuoteSource;
  start(symbols: string[]): void;
  stop(): void;
  nextQuotes(now: Date): ProviderRawQuote[];
  health(): ProviderHealthSnapshot;
}
