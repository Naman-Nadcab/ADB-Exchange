/**
 * Multi-broker / multi-LP adapter contracts (provider-agnostic Forex core).
 * Implementations live in this folder. Execution stays on the internal Forex adapter until another adapter is armed.
 */

export type ForexProviderType =
  | 'INTERNAL_FDM'
  | 'MT5'
  | 'MT4'
  | 'CTRADER'
  | 'FIX'
  | 'DIRECT_LP'
  | 'PRIME_BROKER'
  | 'BRIDGE';

export type ForexProviderConnectionStatus =
  | 'connected'
  | 'degraded'
  | 'disconnected'
  | 'disabled'
  | 'not_configured';

export type BrokerAdapterHealth = {
  status: ForexProviderConnectionStatus;
  message: string;
  checkedAt: string;
  latencyMs?: number;
};

/** Operator-facing provider row (no secrets). */
export type ForexProviderCatalogEntry = {
  providerId: string;
  adapterId: string;
  type: ForexProviderType;
  displayName: string;
  protocol: string;
  status: ForexProviderConnectionStatus;
  isDefault: boolean;
  enabled: boolean;
  priority: number | null;
  capabilities: string[];
  notes: string;
};

/**
 * Provider adapter surface — full trading ops for future MT5/FIX/LP plugins.
 * The internal Forex adapter implements a subset today. Other adapters stay catalog-only until wired.
 */
export interface BrokerAdapter {
  readonly adapterId: string;
  readonly providerType: ForexProviderType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<BrokerAdapterHealth>;
}
