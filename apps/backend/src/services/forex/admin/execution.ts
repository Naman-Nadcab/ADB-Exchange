/**
 * Admin Forex F5 — LP routing (MOCK), provider health, REAL_FOREX gate, fill recon summary.
 */
import { db } from '../../../lib/database.js';
import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import { forexMarketDataWorkerSnapshot } from '../market-data/worker.js';
import { getForexPricingService } from '../quotes.service.js';
import type { ForexRoutingRule } from '../types.js';
import { effectiveForexRuntimeFlags } from './runtime-controls.js';
import {
  assertCanSetRealForexArmRequested,
  buildForexRealForexGateState,
  isLiveForexReleaseOpen,
  setForexRealForexArmRequested,
  type ForexRealForexGateState,
} from './execution-gate.js';

const MOCK_PROVIDER_IDS = new Set<string>([
  FOREX_PROVIDER_IDS.MOCK_A,
  FOREX_PROVIDER_IDS.MOCK_B,
  FOREX_PROVIDER_IDS.MOCK_C,
]);

function isMockProviderCode(code: string): boolean {
  return code.startsWith('MOCK');
}

function assertMockRoutingTarget(rule: ForexRoutingRule | undefined, providerId: string): ForexRoutingRule {
  if (!rule) throw new Error('UNKNOWN_PROVIDER');
  if (!MOCK_PROVIDER_IDS.has(providerId) || !isMockProviderCode(rule.providerCode)) {
    throw new Error('LIVE_LP_FORBIDDEN');
  }
  return rule;
}

export type ForexAdminExecutionSnapshot = {
  posture: {
    source: string;
    executionMode: string;
    realForex: boolean;
    killSwitch: boolean;
  };
  routing: {
    rules: ForexRoutingRule[];
    mockProvidersOnly: boolean;
  };
  providers: Array<{
    providerId: string;
    providerCode: string;
    health: import('../types.js').ProviderHealthSnapshot | null;
    rule: ForexRoutingRule | null;
  }>;
  marketData: ReturnType<typeof forexMarketDataWorkerSnapshot>;
  realForexGate: ForexRealForexGateState;
  fillRecon: {
    windowHours: number;
    totals: { executions: number; filled: number; failed: number; partial: number };
    byProvider: Array<{ provider: string; count: number }>;
    note: string;
  };
};

async function loadFillReconSummary(): Promise<ForexAdminExecutionSnapshot['fillRecon']> {
  const windowHours = 24;
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const totalsRes = await db.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n
     FROM forex_executions
     WHERE created_at >= $1::timestamptz
     GROUP BY status`,
    [since],
  );

  let executions = 0;
  let filled = 0;
  let failed = 0;
  let partial = 0;
  for (const row of totalsRes.rows) {
    const n = Number.parseInt(row.n, 10) || 0;
    executions += n;
    const st = row.status.toUpperCase();
    if (st === 'FILLED' || st === 'COMPLETED') filled += n;
    else if (st === 'FAILED' || st === 'REJECTED') failed += n;
    else if (st === 'PARTIAL') partial += n;
  }

  const byProvRes = await db.query<{ provider: string; n: string }>(
    `SELECT COALESCE(selected_provider, 'unknown') AS provider, COUNT(*)::text AS n
     FROM forex_executions
     WHERE created_at >= $1::timestamptz
     GROUP BY COALESCE(selected_provider, 'unknown')
     ORDER BY COUNT(*) DESC
     LIMIT 20`,
    [since],
  );

  return {
    windowHours,
    totals: { executions, filled, failed, partial },
    byProvider: byProvRes.rows.map((r) => ({ provider: r.provider, count: Number.parseInt(r.n, 10) || 0 })),
    note: 'MOCK/simulated fills only — LP reconciliation against external statements is not applicable until REAL_FOREX.',
  };
}

export async function buildForexAdminExecutionSnapshot(): Promise<ForexAdminExecutionSnapshot> {
  const pricing = getForexPricingService();
  const rules = pricing.aggregator.rules.list();
  const mockProvidersOnly = rules.every((r) => MOCK_PROVIDER_IDS.has(r.providerId) && isMockProviderCode(r.providerCode));
  const marketData = forexMarketDataWorkerSnapshot();
  const now = new Date();

  const providers = pricing.providers.map((p) => {
    const rule = pricing.aggregator.rules.get(p.id, null) ?? null;
    return {
      providerId: p.id,
      providerCode: p.code,
      health: pricing.health.snapshot(p.id, now) ?? null,
      rule,
    };
  });

  const flags = effectiveForexRuntimeFlags();

  return {
    posture: {
      source: flags.source,
      executionMode: flags.executionMode,
      realForex: isLiveForexReleaseOpen(),
      killSwitch: flags.killSwitch,
    },
    routing: { rules, mockProvidersOnly },
    providers,
    marketData,
    realForexGate: buildForexRealForexGateState({
      mockProvidersOnly,
      marketDataRunning: marketData.running,
    }),
    fillRecon: await loadFillReconSummary(),
  };
}

export type ForexRoutingPatchResult = {
  providerId: string;
  previous: Pick<ForexRoutingRule, 'enabled' | 'priority' | 'failoverEnabled'>;
  next: Pick<ForexRoutingRule, 'enabled' | 'priority' | 'failoverEnabled'>;
};

export function applyForexAdminRoutingPatch(
  providerId: string,
  patch: { enabled?: boolean; priority?: number; failover_enabled?: boolean },
): ForexRoutingPatchResult {
  const registry = getForexPricingService().aggregator.rules;
  const current = assertMockRoutingTarget(registry.get(providerId, null), providerId);

  const previous = {
    enabled: current.enabled,
    priority: current.priority,
    failoverEnabled: current.failoverEnabled,
  };

  let priority = current.priority;
  if (typeof patch.priority === 'number') {
    if (!Number.isFinite(patch.priority) || patch.priority < 1 || patch.priority > 999) {
      throw new Error('INVALID_PRIORITY');
    }
    priority = Math.round(patch.priority);
  }

  const nextRule: ForexRoutingRule = {
    ...current,
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    priority,
    failoverEnabled:
      typeof patch.failover_enabled === 'boolean' ? patch.failover_enabled : current.failoverEnabled,
  };

  registry.upsert(nextRule);

  return {
    providerId,
    previous,
    next: {
      enabled: nextRule.enabled,
      priority: nextRule.priority,
      failoverEnabled: nextRule.failoverEnabled,
    },
  };
}

export function applyForexRealForexArmPatch(requested: boolean): {
  previous: boolean;
  next: boolean;
  previousEffective: boolean;
  gate: ForexRealForexGateState;
} {
  const pricing = getForexPricingService();
  const rules = pricing.aggregator.rules.list();
  const mockProvidersOnly = rules.every((r) => MOCK_PROVIDER_IDS.has(r.providerId) && isMockProviderCode(r.providerCode));
  const gate = buildForexRealForexGateState({
    mockProvidersOnly,
    marketDataRunning: forexMarketDataWorkerSnapshot().running,
  });

  assertCanSetRealForexArmRequested(requested, gate);
  const previousEffective = gate.effectiveRealForex;
  const { previous, next } = setForexRealForexArmRequested(requested);
  const gateAfter = buildForexRealForexGateState({
    mockProvidersOnly,
    marketDataRunning: forexMarketDataWorkerSnapshot().running,
  });
  return { previous, next, previousEffective, gate: gateAfter };
}
