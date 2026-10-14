import { effectiveForexRuntimeFlags } from '../admin/runtime-controls.js';
import { buildForexProviderCatalog } from '../adapters/registry.js';
import { getForexLiveAccountProvider } from './live-account-provider.registry.js';
import { lpApiSettings, lpPlugArmed } from '../lp/lp-api-client.js';

export type LiveForexReadiness = {
  liveForexReady: boolean;
  realForexEffective: boolean;
  executionMode: string;
  source: 'SIMULATED' | 'LP';
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
  const runtimeRealForex = flags.realForex;
  const realForexEffective = runtimeRealForex;
  const blockers: string[] = [];
  const armed = lpPlugArmed();

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
  const externalBroker = catalog.some((p) => p.enabled && p.adapterId !== 'internal-fdm' && p.status === 'connected');
  if (!externalBroker) {
    blockers.push('No external broker/LP adapter enabled');
  }

  const settings = lpApiSettings();
  if (!armed || !providerHealth.provisioningAvailable) {
    blockers.push('Payment provider for Forex deposits not configured');
    blockers.push('Withdrawal payout rail not configured');
  }
  if (!settings.webhookSecret) {
    blockers.push('Funding webhook reconciliation not configured');
  }

  if (runtimeRealForex && blockers.length > 0) {
    blockers.push('REAL_FOREX runtime flag must remain off until readiness passes');
  }

  const liveForexReady = armed && blockers.length === 0;

  const internalTransfer =
    flags.executionMode === 'MOCK' && !realForexEffective && !flags.killSwitch;

  return {
    liveForexReady,
    realForexEffective,
    executionMode: flags.executionMode,
    source: flags.source,
    blockers,
    capabilities: {
      liveAccountApplication: !realForexEffective || liveForexReady,
      liveAccountProvisioning: providerHealth.provisioningAvailable && liveForexReady,
      brokerCredentials: providerHealth.credentialsSupported && liveForexReady,
      deposit: liveForexReady,
      withdrawal: liveForexReady,
      internalTransfer,
      paymentMethods: liveForexReady,
      fundingReconciliation: liveForexReady,
    },
    identity: {
      platformCustomerIdField: 'user_id',
      tradingLoginField: 'forex_accounts.account_id',
      note: 'Platform user ID and Forex trading login are separate identifiers; broker login appears after provisioning.',
    },
  };
}
