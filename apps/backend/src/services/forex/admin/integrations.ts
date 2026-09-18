/**
 * Admin — multi-broker integration catalog (read-only S2).
 */
import { buildForexProviderCatalog, defaultBrokerAdapterId, providerTypeLabel } from '../adapters/registry.js';
import type { ForexProviderCatalogEntry } from '../adapters/types.js';
import { buildForexAdminExecutionSnapshot, type ForexAdminExecutionSnapshot } from './execution.js';

export type ForexAdminIntegrationsSnapshot = {
  defaultAdapterId: string;
  adapterLayerVersion: 'S2-catalog';
  posture: ForexAdminExecutionSnapshot['posture'];
  providers: ForexProviderCatalogEntry[];
  mockLpRouting: ForexAdminExecutionSnapshot['routing'];
  executionProviders: ForexAdminExecutionSnapshot['providers'];
  realForexGate: ForexAdminExecutionSnapshot['realForexGate'];
  notes: string[];
};

export async function buildForexAdminIntegrationsSnapshot(): Promise<ForexAdminIntegrationsSnapshot> {
  const [catalog, execution] = await Promise.all([buildForexProviderCatalog(), buildForexAdminExecutionSnapshot()]);

  return {
    defaultAdapterId: defaultBrokerAdapterId(),
    adapterLayerVersion: 'S2-catalog',
    posture: execution.posture,
    providers: catalog.map((p) => ({
      ...p,
      displayName: p.displayName || providerTypeLabel(p.type),
    })),
    mockLpRouting: execution.routing,
    executionProviders: execution.providers,
    realForexGate: execution.realForexGate,
    notes: [
      'Credentials for external brokers are never stored in admin responses — use encrypted integration vault when wired.',
      'Only Internal FDM is connected today; MT5/MT4/cTrader/FIX rows are integration placeholders.',
      'MOCK LP rows in execution refer to simulated quote/ fill providers, not live brokerage.',
    ],
  };
}
