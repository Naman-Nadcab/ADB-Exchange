import { getForexAdminBackendConfig } from '../admin/config.js';
import { buildForexProviderCatalog } from '../adapters/registry.js';
import { effectiveForexRuntimeFlags } from '../admin/runtime-controls.js';
import { getForexLiveAccountProvider } from './live-account-provider.registry.js';

export type LiveForexReadiness = {
  liveForexReady: false;
  realForexEffective: boolean;
  executionMode: string;
  source: 'SIMULATED';
  blockers: string[];
  capabilities: {
    liveAccountApplication: boolean;
    liveAccountProvisioning: boolean;
    brokerCredentials: boolean;
    deposit: boolean;
    withdrawal: boolean;
    internalTransfer: boolean;
    paymentMethods: boolean;
    fundingReconciliation: boolean;
  };
  identity: {
    platformCustomerIdField: 'user_id';
    tradingLoginField: 'forex_accounts.account_id';
    note: string;
  };
};

export async function buildLiveForexReadiness(): Promise<LiveForexReadiness> {
  const flags = effectiveForexRuntimeFlags();
  const adminCfg = getForexAdminBackendConfig();
  const runtimeRealForex = flags.realForex as boolean;
  const realForexEffective = adminCfg.realForex === true && runtimeRealForex === true;
  const blockers: string[] = [];

  const providerHealth = await getForexLiveAccountProvider().health();
  if (!providerHealth.configured) {
    blockers.push('Broker provisioning not configured');
  }
  if (!providerHealth.provisioningAvailable) {
    blockers.push('Live account provisioning unavailable');
  }
  if (!providerHealth.credentialsSupported) {
    blockers.push('Broker trading/investor credential API unavailable');
  }

  const catalog = await buildForexProviderCatalog();
  const externalBroker = catalog.some((p) => p.enabled && p.adapterId !== 'internal-fdm');
  if (!externalBroker) {
    blockers.push('No external broker/LP adapter enabled');
  }

  blockers.push('Payment provider for Forex deposits not configured');
  blockers.push('Withdrawal payout rail not configured');
  blockers.push('Funding webhook reconciliation not configured');

  if (runtimeRealForex) {
    blockers.push('REAL_FOREX runtime flag must remain off until readiness passes');
  }

  const liveForexReady = false as const;

  const internalTransfer =
    flags.executionMode === 'MOCK' && !realForexEffective && !flags.killSwitch;

  return {
    liveForexReady,
    realForexEffective,
    executionMode: flags.executionMode,
    source: 'SIMULATED',
    blockers,
    capabilities: {
      liveAccountApplication: !realForexEffective,
      liveAccountProvisioning: providerHealth.provisioningAvailable && realForexEffective,
      brokerCredentials: providerHealth.credentialsSupported && realForexEffective,
      deposit: false,
      withdrawal: false,
      internalTransfer,
      paymentMethods: false,
      fundingReconciliation: false,
    },
    identity: {
      platformCustomerIdField: 'user_id',
      tradingLoginField: 'forex_accounts.account_id',
      note: 'Platform user ID and Forex trading login are separate identifiers; broker login appears after provisioning.',
    },
  };
}
