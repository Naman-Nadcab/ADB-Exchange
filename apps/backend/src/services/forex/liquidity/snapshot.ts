import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { quoteToDto } from '../market-data/normalize.js';
import type { ForexBookStatus, ForexEligibilityResult, ForexQuoteDto, NormalizedQuote } from '../types.js';

export interface LiquidityProviderRow {
  providerId: string;
  providerCode: string;
  eligible: boolean;
  reason: string;
  detail: string;
  quote: ForexQuoteDto | null;
  health: string | null;
  latencyMs: number | null;
  rejectRate: number;
  priority: number;
  enabled: boolean;
}

export interface ForexRoutingSnapshot {
  symbol: string;
  displaySymbol: string;
  source: 'SIMULATED' | 'LIVE';
  bestBid: string | null;
  bestBidProvider: string | null;
  bestAsk: string | null;
  bestAskProvider: string | null;
  spread: string | null;
  providerCount: number;
  healthyProviderCount: number;
  eligibleProviderCount: number;
  selectedProvider: string | null;
  selectedReason: string;
  providers: LiquidityProviderRow[];
  generatedAt: string;
  status: ForexBookStatus;
}

export function deriveBookStatus(args: {
  halted: boolean;
  providerCount: number;
  eligibleCount: number;
  allStale: boolean;
  someIneligible: boolean;
}): ForexBookStatus {
  if (args.halted) return 'HALTED';
  if (args.providerCount === 0 || args.eligibleCount === 0) {
    return args.allStale && args.providerCount > 0 ? 'STALE' : 'NO_LIQUIDITY';
  }
  if (args.someIneligible || args.eligibleCount < args.providerCount) return 'DEGRADED';
  return 'READY';
}

export function selectFailoverProvider(rows: LiquidityProviderRow[]): { code: string | null; reason: string } {
  const enabled = rows.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  const primary = enabled[0];
  const eligible = enabled.filter((r) => r.eligible);
  if (eligible.length === 0) return { code: null, reason: 'NO_LIQUIDITY' };
  const first = eligible[0]!;
  if (primary && primary.eligible && first.providerCode === primary.providerCode) {
    return { code: first.providerCode, reason: 'PRIMARY' };
  }
  return { code: first.providerCode, reason: 'FAILOVER' };
}

export function buildRoutingSnapshot(args: {
  symbol: string;
  now: Date;
  bestBid: string | null;
  bestBidProviderCode: string | null;
  bestAsk: string | null;
  bestAskProviderCode: string | null;
  spread: string | null;
  providerCount: number;
  healthyProviderCount: number;
  eligibleProviderCount: number;
  status: ForexBookStatus;
  providers: LiquidityProviderRow[];
  source?: 'SIMULATED' | 'LIVE';
}): ForexRoutingSnapshot {
  const instrument = getForexInstrumentBySymbol(args.symbol);
  const failover = selectFailoverProvider(args.providers);
  return {
    symbol: args.symbol,
    displaySymbol: instrument?.displaySymbol ?? args.symbol,
    source: args.source ?? 'SIMULATED',
    bestBid: args.bestBid,
    bestBidProvider: args.bestBidProviderCode,
    bestAsk: args.bestAsk,
    bestAskProvider: args.bestAskProviderCode,
    spread: args.spread,
    providerCount: args.providerCount,
    healthyProviderCount: args.healthyProviderCount,
    eligibleProviderCount: args.eligibleProviderCount,
    selectedProvider: failover.code,
    selectedReason: failover.reason,
    providers: args.providers,
    generatedAt: args.now.toISOString(),
    status: args.status,
  };
}

export function eligibilityToRow(
  el: ForexEligibilityResult,
  quote: ForexQuoteDto | null,
  health: string | null,
  priority: number,
  enabled: boolean
): LiquidityProviderRow {
  return {
    providerId: el.providerId,
    providerCode: el.providerCode,
    eligible: el.eligible,
    reason: el.reason,
    detail: el.detail,
    quote,
    health,
    latencyMs: el.latencyMs,
    rejectRate: el.rejectRate,
    priority,
    enabled,
  };
}

export function quoteDtoOrNull(
  quote: NormalizedQuote | undefined,
  displaySymbol: string,
  digits: number
): ForexQuoteDto | null {
  if (!quote) return null;
  return quoteToDto(quote, displaySymbol, digits);
}

export function bookSpread(bestBid: string | null, bestAsk: string | null, digits: number): string | null {
  if (bestBid == null || bestAsk == null) return null;
  return fxDecimal(bestAsk).minus(bestBid).toFixed(digits);
}
