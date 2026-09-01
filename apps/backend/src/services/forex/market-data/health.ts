import { forexConfig } from '../config.js';
import type { ForexProviderHealthStatus, ProviderHealthSnapshot } from '../types.js';

export interface ProviderHealthCounters {
  quoteCount: number;
  staleCount: number;
  rejectedCount: number;
  errorCount: number;
  duplicateCount: number;
  outOfOrderCount: number;
  lastQuoteTime: Date | null;
  lastSequence: bigint | null;
  lastLatencyMs: number | null;
}

export function emptyHealthCounters(): ProviderHealthCounters {
  return {
    quoteCount: 0,
    staleCount: 0,
    rejectedCount: 0,
    errorCount: 0,
    duplicateCount: 0,
    outOfOrderCount: 0,
    lastQuoteTime: null,
    lastSequence: null,
    lastLatencyMs: null,
  };
}

export function deriveProviderHealthStatus(
  counters: ProviderHealthCounters,
  now: Date
): ForexProviderHealthStatus {
  if (!counters.lastQuoteTime) return 'OFFLINE';
  const age = now.getTime() - counters.lastQuoteTime.getTime();
  if (age > forexConfig.quoteOfflineMs) return 'OFFLINE';
  if (age > forexConfig.quoteStaleMs) return 'STALE';
  const denom = Math.max(1, counters.quoteCount + counters.rejectedCount);
  const errorRate = (counters.errorCount + counters.rejectedCount) / denom;
  if (errorRate >= forexConfig.degradedErrorRate) return 'DEGRADED';
  return 'HEALTHY';
}

export class ForexProviderHealthRegistry {
  private readonly byId = new Map<string, { code: string; counters: ProviderHealthCounters }>();

  register(providerId: string, providerCode: string): void {
    if (!this.byId.has(providerId)) {
      this.byId.set(providerId, { code: providerCode, counters: emptyHealthCounters() });
    }
  }

  recordAccepted(providerId: string, sequence: bigint, received: Date, providerTs: Date, stale: boolean): void {
    const row = this.byId.get(providerId);
    if (!row) return;
    row.counters.quoteCount += 1;
    row.counters.lastQuoteTime = received;
    row.counters.lastSequence = sequence;
    row.counters.lastLatencyMs = Math.max(0, received.getTime() - providerTs.getTime());
    if (stale) row.counters.staleCount += 1;
  }

  recordRejected(providerId: string): void {
    const row = this.byId.get(providerId);
    if (!row) return;
    row.counters.rejectedCount += 1;
    row.counters.errorCount += 1;
  }

  recordDuplicate(providerId: string): void {
    const row = this.byId.get(providerId);
    if (!row) return;
    row.counters.duplicateCount += 1;
  }

  recordOutOfOrder(providerId: string): void {
    const row = this.byId.get(providerId);
    if (!row) return;
    row.counters.outOfOrderCount += 1;
    row.counters.errorCount += 1;
  }

  snapshot(providerId: string, now = new Date()): ProviderHealthSnapshot | undefined {
    const row = this.byId.get(providerId);
    if (!row) return undefined;
    const c = row.counters;
    return {
      providerId,
      providerCode: row.code,
      status: deriveProviderHealthStatus(c, now),
      lastQuoteTime: c.lastQuoteTime?.toISOString() ?? null,
      lastSequence: c.lastSequence == null ? null : c.lastSequence.toString(),
      latencyMs: c.lastLatencyMs,
      quoteCount: c.quoteCount,
      staleCount: c.staleCount,
      rejectedCount: c.rejectedCount,
      errorCount: c.errorCount,
      duplicateCount: c.duplicateCount,
      outOfOrderCount: c.outOfOrderCount,
    };
  }

  list(now = new Date()): ProviderHealthSnapshot[] {
    return [...this.byId.keys()]
      .map((id) => this.snapshot(id, now))
      .filter((x): x is ProviderHealthSnapshot => Boolean(x));
  }
}
