import { getInternalFdmBrokerAdapter } from './internal-fdm.adapter.js';
import type { BrokerAdapter, ForexProviderCatalogEntry, ForexProviderType } from './types.js';

type CatalogSeed = Omit<ForexProviderCatalogEntry, 'status'> & { status?: ForexProviderCatalogEntry['status'] };

const PLANNED: CatalogSeed[] = [
  {
    providerId: 'internal-fdm',
    adapterId: 'internal-fdm',
    type: 'INTERNAL_FDM',
    displayName: 'Internal FDM (in-repo)',
    protocol: 'In-process',
    isDefault: true,
    enabled: true,
    priority: 0,
    capabilities: ['orders', 'positions', 'margin', 'ledger', 'protection', 'liquidation'],
    notes: 'Default execution path — MOCK/simulated venue until external adapters are certified.',
  },
  {
    providerId: 'mt5-bridge',
    adapterId: 'mt5',
    type: 'MT5',
    displayName: 'MetaTrader 5',
    protocol: 'Manager / Web API (planned)',
    isDefault: false,
    enabled: false,
    priority: null,
    capabilities: ['accounts', 'orders', 'positions', 'deals', 'history'],
    notes: 'Not connected — adapter stub only.',
  },
  {
    providerId: 'mt4-bridge',
    adapterId: 'mt4',
    type: 'MT4',
    displayName: 'MetaTrader 4',
    protocol: 'Manager API (planned)',
    isDefault: false,
    enabled: false,
    priority: null,
    capabilities: ['accounts', 'orders', 'positions'],
    notes: 'Not connected.',
  },
  {
    providerId: 'ctrader',
    adapterId: 'ctrader',
    type: 'CTRADER',
    displayName: 'cTrader',
    protocol: 'Open API (planned)',
    isDefault: false,
    enabled: false,
    priority: null,
    capabilities: ['accounts', 'orders', 'positions'],
    notes: 'Not connected.',
  },
  {
    providerId: 'fix-lp',
    adapterId: 'fix',
    type: 'FIX',
    displayName: 'FIX liquidity',
    protocol: 'FIX 4.4 (planned)',
    isDefault: false,
    enabled: false,
    priority: null,
    capabilities: ['quotes', 'orders', 'fills'],
    notes: 'Not connected.',
  },
  {
    providerId: 'direct-lp',
    adapterId: 'direct-lp',
    type: 'DIRECT_LP',
    displayName: 'Direct LP',
    protocol: 'Vendor-specific (planned)',
    isDefault: false,
    enabled: false,
    priority: null,
    capabilities: ['quotes', 'execution'],
    notes: 'Use forex_lp_providers table when wired.',
  },
];

const ADAPTERS: BrokerAdapter[] = [getInternalFdmBrokerAdapter()];

export function listRegisteredBrokerAdapters(): BrokerAdapter[] {
  return [...ADAPTERS];
}

export function getBrokerAdapterById(adapterId: string): BrokerAdapter | undefined {
  return ADAPTERS.find((a) => a.adapterId === adapterId);
}

export async function buildForexProviderCatalog(): Promise<ForexProviderCatalogEntry[]> {
  const internal = getInternalFdmBrokerAdapter();
  const internalHealth = await internal.healthCheck();

  return PLANNED.map((seed) => {
    if (seed.adapterId === 'internal-fdm') {
      return {
        ...seed,
        status: internalHealth.status,
      } as ForexProviderCatalogEntry;
    }
    return {
      ...seed,
      status: seed.status ?? 'not_configured',
    } as ForexProviderCatalogEntry;
  });
}

export function defaultBrokerAdapterId(): string {
  return 'internal-fdm';
}

export function providerTypeLabel(type: ForexProviderType): string {
  const labels: Record<ForexProviderType, string> = {
    INTERNAL_FDM: 'Internal FDM',
    MT5: 'MT5',
    MT4: 'MT4',
    CTRADER: 'cTrader',
    FIX: 'FIX',
    DIRECT_LP: 'Direct LP',
    PRIME_BROKER: 'Prime broker',
    BRIDGE: 'Bridge',
  };
  return labels[type] ?? type;
}
