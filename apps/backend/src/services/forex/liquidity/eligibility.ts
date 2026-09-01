import { fxDecimal } from '../decimal-fx.js';
import type {
  ForexEligibilityReason,
  ForexEligibilityResult,
  ForexRoutingRule,
  NormalizedQuote,
  ProviderHealthSnapshot,
} from '../types.js';

export interface EligibilityInput {
  quote: NormalizedQuote | undefined;
  health: ProviderHealthSnapshot | undefined;
  rule: ForexRoutingRule;
  instrumentSupported: boolean;
  now: Date;
}

export function evaluateProviderEligibility(input: EligibilityInput): ForexEligibilityResult {
  const { quote, health, rule, instrumentSupported } = input;
  const rejectRate = health?.rejectRate ?? 0;
  const base = {
    providerId: rule.providerId,
    providerCode: rule.providerCode,
    rejectRate,
  };

  const fail = (reason: ForexEligibilityReason, detail: string, extra?: Partial<ForexEligibilityResult>): ForexEligibilityResult => ({
    ...base,
    eligible: false,
    reason,
    detail,
    latencyMs: extra?.latencyMs ?? health?.latencyMs ?? null,
    spread: extra?.spread ?? null,
  });

  if (!rule.enabled) {
    return fail('PROVIDER_DISABLED', `${rule.providerCode} is disabled`);
  }
  if (!instrumentSupported) {
    return fail('INSTRUMENT_UNSUPPORTED', `${rule.providerCode} does not support this instrument`);
  }
  if (!quote) {
    return fail('NO_QUOTE', `No quote from ${rule.providerCode}`);
  }

  const latencyMs = Math.max(0, quote.receivedTimestamp.getTime() - quote.providerTimestamp.getTime());
  const spread = quote.spread.toFixed();

  if (quote.ask.lt(quote.bid) || quote.quality === 'CROSSED') {
    return fail('QUOTE_CROSSED', `Crossed market ${quote.bid.toFixed()}/${quote.ask.toFixed()}`, { latencyMs, spread });
  }
  if (quote.freshness === 'STALE' || quote.quality === 'STALE') {
    return fail('QUOTE_STALE', `Quote older than freshness policy`, { latencyMs, spread });
  }
  if (quote.status === 'REJECTED') {
    return fail('QUOTE_INVALID', `Quote status ${quote.status} quality ${quote.quality}`, { latencyMs, spread });
  }
  if (!quote.bid.gt(0) || !quote.ask.gt(0)) {
    return fail('QUOTE_INVALID', 'Non-positive bid/ask', { latencyMs, spread });
  }

  const healthStatus = health?.status ?? 'OFFLINE';
  if (healthStatus === 'OFFLINE' || healthStatus === 'STALE') {
    return fail('PROVIDER_UNHEALTHY', `Provider health ${healthStatus}`, { latencyMs, spread });
  }

  if (quote.spread.gt(fxDecimal(rule.maxSpread))) {
    return fail('SPREAD_LIMIT', `spread ${spread} exceeds max ${rule.maxSpread}`, { latencyMs, spread });
  }
  if (latencyMs > rule.maxLatencyMs) {
    return fail('LATENCY_LIMIT', `latency ${latencyMs}ms exceeds max ${rule.maxLatencyMs}ms`, { latencyMs, spread });
  }
  if (rejectRate > rule.maxRejectRate) {
    return fail('REJECT_RATE_LIMIT', `reject rate ${rejectRate} exceeds max ${rule.maxRejectRate}`, { latencyMs, spread });
  }

  return {
    ...base,
    eligible: true,
    reason: 'ELIGIBLE',
    detail: 'Eligible for routing',
    latencyMs,
    spread,
  };
}
