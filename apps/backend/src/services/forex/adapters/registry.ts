import { getBrokerGateway, isBrokerGatewayConfigured } from '../broker/gateway.js';
import { getInternalFdmBrokerAdapter } from './internal-fdm.adapter.js';
import type { BrokerAdapter, ForexProviderCatalogEntry, ForexProviderType } from './types.js';

type CatalogSeed = Omit<ForexProviderCatalogEntry, 'status'> & { status?: ForexProviderCatalogEntry['status'] };

const PLANNED: CatalogSeed[] = [
  {
    providerId: 'internal-fdm',
    adapterId: 'internal-fdm',
    type: 'INTERNAL_FDM',
    displayName: 'Internal Forex (in-repo)',
    protocol: 'In-process',
    isDefault: true,
    enabled: true,
    priority: 0,
    capabilities: ['orders', 'positions', 'margin', 'ledger', 'protection', 'liquidation'],
    notes: 'Default execution path — MOCK/simulated venue until a broker gateway is healthy.',
  },
];

/*
 * Hidden until a real adapter exists. Restore into PLANNED when implementing one.
 * These rows were disabled placeholders ("Not connected") and are not a product surface.
 *
 * {
 *   providerId: 'mt5-bridge', adapterId: 'mt5', type: 'MT5',
 *   displayName: 'MetaTrader 5', protocol: 'Manager / Web API (planned)',
 *   isDefault: false, enabled: false, priority: null,
 *   capabilities: ['accounts', 'orders', 'positions', 'deals', 'history'],
 *   notes: 'Not connected — adapter stub only.',
 * },
 * {
 *   providerId: 'mt4-bridge', adapterId: 'mt4', type: 'MT4',
 *   displayName: 'MetaTrader 4', protocol: 'Manager API (planned)',
 *   isDefault: false, enabled: false, priority: null,
 *   capabilities: ['accounts', 'orders', 'positions'],
 *   notes: 'Not connected.',
 * },
 * {
 *   providerId: 'ctrader', adapterId: 'ctrader', type: 'CTRADER',
 *   displayName: 'cTrader', protocol: 'Open API (planned)',
 *   isDefault: false, enabled: false, priority: null,
 *   capabilities: ['accounts', 'orders', 'positions'],
 *   notes: 'Not connected.',
 * },
 * {
 *   providerId: 'fix-lp', adapterId: 'fix', type: 'FIX',
 *   displayName: 'FIX liquidity', protocol: 'FIX 4.4 (planned)',
 *   isDefault: false, enabled: false, priority: null,
 *   capabilities: ['quotes', 'orders', 'fills'],
 *   notes: 'Not connected.',
 * },
 * {
 *   providerId: 'direct-lp', adapterId: 'direct-lp', type: 'DIRECT_LP',
 *   displayName: 'Direct LP', protocol: 'Vendor-specific (planned)',
 *   isDefault: false, enabled: false, priority: null,
 *   capabilities: ['quotes', 'execution'],
 *   notes: 'Use forex_lp_providers table when wired.',
 * },
 */

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

  const rows: ForexProviderCatalogEntry[] = PLANNED.map((seed) => {
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
  if (isBrokerGatewayConfigured()) {
    const health = await getBrokerGateway().health();
    rows.push({
      providerId: 'broker-gateway',
      adapterId: 'broker-gateway',
      type: 'BRIDGE',
      displayName: 'Broker HTTP gateway',
      protocol: 'HTTPS /v1',
      status: health.ok ? 'connected' : 'degraded',
      isDefault: false,
      enabled: true,
      priority: 10,
      capabilities: ['quotes', 'orders', 'accounts', 'cash'],
      notes: 'HTTP gateway. MT4, MT5, cTrader, and FIX stay disconnected.',
    });
  }
  return rows;
}

export function defaultBrokerAdapterId(): string {
  return 'internal-fdm';
}

export function providerTypeLabel(type: ForexProviderType): string {
  const labels: Record<ForexProviderType, string> = {
    INTERNAL_FDM: 'Internal Forex',
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
