/**
 * Admin Forex S3 — symbol routing desk (read-only) + feature flags.
 */
import { defaultBrokerAdapterId, getBrokerAdapterById } from '../adapters/registry.js';
import type { BrokerAdapterHealth } from '../adapters/types.js';
import { forexConfig } from '../config.js';
import { forexReadinessSnapshot } from '../durability/ready.js';
import { getForexPricingService } from '../quotes.service.js';
import { buildForexAdminExecutionSnapshot } from './execution.js';
import { effectiveForexRuntimeFlags } from './runtime-controls.js';

export type ForexAdminSymbolRouteRow = {
  symbol: string;
  status: string;
  selectedProvider: string | null;
  selectedReason: string;
  providerCount: number;
  healthyProviderCount: number;
  eligibleProviderCount: number;
  bestBidProvider: string | null;
  bestAskProvider: string | null;
};

export type ForexAdminRoutingDeskSnapshot = {
  featureFlags: {
    routingV2Enabled: boolean;
    adapterLayerHookEnabled: boolean;
  };
  defaultBrokerAdapterId: string;
  brokerAdapterHealth: BrokerAdapterHealth | null;
  mockLpRules: Awaited<ReturnType<typeof buildForexAdminExecutionSnapshot>>['routing']['rules'];
  symbolRoutes: ForexAdminSymbolRouteRow[];
  stagingChecklist: Array<{ id: string; label: string; pass: boolean; detail: string }>;
  notes: string[];
};

export async function buildForexAdminRoutingDeskSnapshot(): Promise<ForexAdminRoutingDeskSnapshot> {
  const [execution, adapterHealth] = await Promise.all([
    buildForexAdminExecutionSnapshot(),
    (async () => {
      const adapter = getBrokerAdapterById(defaultBrokerAdapterId());
      return adapter ? adapter.healthCheck() : null;
    })(),
  ]);

  const pricing = getForexPricingService();
  const now = new Date();
  const symbolRoutes: ForexAdminSymbolRouteRow[] = pricing.listRoutingSnapshots(now).map((snap) => ({
    symbol: snap.symbol,
    status: snap.status,
    selectedProvider: snap.selectedProvider,
    selectedReason: snap.selectedReason,
    providerCount: snap.providerCount,
    healthyProviderCount: snap.healthyProviderCount,
    eligibleProviderCount: snap.eligibleProviderCount,
    bestBidProvider: snap.bestBidProvider,
    bestAskProvider: snap.bestAskProvider,
  }));

  const notes = [
    'MOCK LP routing rules are editable from LP & Execution when you hold forex:control.',
    'FOREX_ROUTING_V2 enables this desk as the primary routing view; execution semantics stay MOCK until REAL_FOREX is certified.',
  ];
  if (forexConfig.adapterLayerHookEnabled) {
    notes.push('FOREX_ADAPTER_LAYER_HOOK=1 — orders reject when the default broker adapter is disabled or unavailable.');
  } else {
    notes.push('Staging S5: set FOREX_ADAPTER_LAYER_HOOK=1 on non-prod, place a test order, then toggle kill switch to confirm reject path.');
  }

  const readiness = forexReadinessSnapshot();
  const flags = effectiveForexRuntimeFlags();
  const adapterOk = adapterHealth?.status === 'connected' || adapterHealth?.status === 'degraded';

  const stagingChecklist = [
    {
      id: 'routing-v2',
      label: 'FOREX_ROUTING_V2',
      pass: forexConfig.routingV2Enabled,
      detail: forexConfig.routingV2Enabled ? 'Enabled in this worker.' : 'Off — enable on staging to validate desk-first ops.',
    },
    {
      id: 'adapter-hook',
      label: 'FOREX_ADAPTER_LAYER_HOOK',
      pass: forexConfig.adapterLayerHookEnabled,
      detail: forexConfig.adapterLayerHookEnabled
        ? 'Pre-routing adapter gate active.'
        : 'Off — enable on staging before certifying adapter rejects.',
    },
    {
      id: 'adapter-health',
      label: 'Default broker adapter',
      pass: adapterOk,
      detail: adapterHealth?.message ?? 'No adapter health',
    },
    {
      id: 'economic-ready',
      label: 'Forex economic ready',
      pass: readiness.economicReady,
      detail: readiness.reason ?? 'Ready',
    },
    {
      id: 'kill-switch',
      label: 'Kill switch clear',
      pass: !flags.killSwitch,
      detail: flags.killSwitch ? 'Kill switch ON — customer trading blocked.' : 'Kill switch off.',
    },
  ];

  return {
    featureFlags: {
      routingV2Enabled: forexConfig.routingV2Enabled,
      adapterLayerHookEnabled: forexConfig.adapterLayerHookEnabled,
    },
    defaultBrokerAdapterId: defaultBrokerAdapterId(),
    brokerAdapterHealth: adapterHealth,
    mockLpRules: execution.routing.rules,
    symbolRoutes,
    stagingChecklist,
    notes,
  };
}
