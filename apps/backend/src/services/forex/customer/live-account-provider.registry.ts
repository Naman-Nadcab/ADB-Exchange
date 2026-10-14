import type {
  ForexBrokerCredentialsProvider,
  ForexLiveAccountProvider,
  ForexLiveAccountProviderHealth,
  ForexLiveProvisionResult,
  ForexLiveAccountApplicationInput,
} from './live-account-provider.types.js';
import { lpPlugArmed } from '../lp/lp-api-client.js';
import { getLpCredentialsProvider, getLpLiveAccountProvider } from '../lp/lp-live-provider.js';

class UnconfiguredLiveAccountProvider implements ForexLiveAccountProvider {
  readonly providerId = 'unconfigured';

  async health(): Promise<ForexLiveAccountProviderHealth> {
    return {
      configured: false,
      provisioningAvailable: false,
      credentialsSupported: false,
      message: 'No broker live-account provider is configured (MT5/LP bridge not connected).',
    };
  }

  async provisionLiveAccount(_input: ForexLiveAccountApplicationInput): Promise<ForexLiveProvisionResult> {
    return {
      ok: false,
      code: 'LIVE_PROVISIONING_UNAVAILABLE',
      message: 'Broker provisioning is not configured on this environment.',
    };
  }
}

class UnconfiguredCredentialsProvider implements ForexBrokerCredentialsProvider {
  readonly providerId = 'unconfigured';

  supports(): boolean {
    return false;
  }

  async changePassword(): Promise<{ ok: false; code: string; message: string }> {
    return {
      ok: false,
      code: 'BROKER_CREDENTIALS_UNAVAILABLE',
      message: 'Broker credential API is not connected.',
    };
  }
}

let liveProvider: ForexLiveAccountProvider = new UnconfiguredLiveAccountProvider();
let credentialsProvider: ForexBrokerCredentialsProvider = new UnconfiguredCredentialsProvider();

export function getForexLiveAccountProvider(): ForexLiveAccountProvider {
  if (liveProvider.providerId === 'unconfigured' && lpPlugArmed()) return getLpLiveAccountProvider();
  return liveProvider;
}

export function getForexBrokerCredentialsProvider(): ForexBrokerCredentialsProvider {
  if (credentialsProvider.providerId === 'unconfigured' && lpPlugArmed()) return getLpCredentialsProvider();
  return credentialsProvider;
}

/** Test / future wiring hook — production registers real adapter here. */
export function setForexLiveAccountProviderForTests(p: ForexLiveAccountProvider): void {
  liveProvider = p;
}

export function resetForexLiveAccountProviderForTests(): void {
  liveProvider = new UnconfiguredLiveAccountProvider();
  credentialsProvider = new UnconfiguredCredentialsProvider();
}
