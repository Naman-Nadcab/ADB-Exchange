import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import type { ForexRoutingRule } from '../types.js';

const DEFAULT_MAX_SPREAD = '0.05000';
const DEFAULT_MAX_LATENCY_MS = 500;
const DEFAULT_MAX_REJECT_RATE = 0.05;

function rule(
  providerId: string,
  providerCode: string,
  priority: number
): ForexRoutingRule {
  return {
    providerId,
    providerCode,
    instrumentSymbol: null,
    enabled: true,
    priority,
    maxSpread: DEFAULT_MAX_SPREAD,
    maxLatencyMs: DEFAULT_MAX_LATENCY_MS,
    maxRejectRate: DEFAULT_MAX_REJECT_RATE,
    failoverEnabled: true,
  };
}

export function defaultForexRoutingRules(): ForexRoutingRule[] {
  return [
    rule(FOREX_PROVIDER_IDS.MOCK_A, 'MOCK-A', 10),
    rule(FOREX_PROVIDER_IDS.MOCK_B, 'MOCK-B', 20),
    rule(FOREX_PROVIDER_IDS.MOCK_C, 'MOCK-C', 30),
  ];
}

/**
 * In-memory routing config. Future Admin writes go here first, then forex_routing_rules.
 * No credentials. No live LP.
 */
export class ForexRoutingRuleRegistry {
  private readonly rules = new Map<string, ForexRoutingRule>();

  constructor(seed: ForexRoutingRule[] = defaultForexRoutingRules()) {
    for (const r of seed) this.upsert(r);
  }

  upsert(next: ForexRoutingRule): void {
    this.rules.set(this.key(next.providerId, next.instrumentSymbol), { ...next });
  }

  disable(providerId: string): void {
    const current = this.get(providerId, null);
    if (current) this.upsert({ ...current, enabled: false });
  }

  enable(providerId: string): void {
    const current = this.get(providerId, null);
    if (current) this.upsert({ ...current, enabled: true });
  }

  key(providerId: string, instrumentSymbol: string | null): string {
    return `${providerId}:${instrumentSymbol ?? '*'}`;
  }

  get(providerId: string, instrumentSymbol: string | null): ForexRoutingRule | undefined {
    if (instrumentSymbol) {
      const specific = this.rules.get(this.key(providerId, instrumentSymbol));
      if (specific) return specific;
    }
    return this.rules.get(this.key(providerId, null));
  }

  list(): ForexRoutingRule[] {
    return [...this.rules.values()].sort((a, b) => a.priority - b.priority || a.providerCode.localeCompare(b.providerCode));
  }

  listForSymbol(symbol: string): ForexRoutingRule[] {
    const seen = new Set<string>();
    const out: ForexRoutingRule[] = [];
    for (const r of this.list()) {
      if (r.instrumentSymbol != null && r.instrumentSymbol !== symbol) continue;
      if (seen.has(r.providerId)) continue;
      const resolved = this.get(r.providerId, symbol);
      if (!resolved) continue;
      seen.add(r.providerId);
      out.push(resolved);
    }
    return out;
  }
}
