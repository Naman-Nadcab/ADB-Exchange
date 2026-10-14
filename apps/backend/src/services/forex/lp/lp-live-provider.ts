import type {
  ForexBrokerCredentialsProvider,
  ForexCredentialKind,
  ForexLiveAccountApplicationInput,
  ForexLiveAccountProvider,
  ForexLiveAccountProviderHealth,
  ForexLiveProvisionResult,
} from '../customer/live-account-provider.types.js';
import { LpApiError, lpApiConfigured, lpChangePassword, lpHealth, lpPlugArmed, lpProvisionAccount } from './lp-api-client.js';

export class LpLiveAccountProvider implements ForexLiveAccountProvider {
  readonly providerId = 'direct-lp';

  async health(): Promise<ForexLiveAccountProviderHealth> {
    if (!lpPlugArmed()) {
      return {
        configured: lpApiConfigured(),
        provisioningAvailable: false,
        credentialsSupported: false,
        message: lpApiConfigured()
          ? 'LP URL is set. Arm with FOREX_LP_API_KEY, FOREX_LP_WEBHOOK_SECRET, and FOREX_REAL_FOREX_ALLOWED.'
          : 'No broker live-account provider is configured (MT5/LP bridge not connected).',
      };
    }
    const health = await lpHealth();
    return {
      configured: true,
      provisioningAvailable: health.connected && health.accounts,
      credentialsSupported: health.connected && health.accounts,
      message: health.message,
    };
  }

  async provisionLiveAccount(input: ForexLiveAccountApplicationInput): Promise<ForexLiveProvisionResult> {
    try {
      const created = await lpProvisionAccount({
        userId: input.userId,
        applicationId: input.applicationId,
        currency: 'USD',
        leverage: input.leverage ?? null,
        positionMode: input.positionMode,
        groupCode: input.groupCode ?? null,
        idempotencyKey: input.idempotencyKey,
      });
      return { ok: true, ...created };
    } catch (error) {
      const code = error instanceof LpApiError ? error.code : 'LIVE_PROVISIONING_FAILED';
      return { ok: false, code, message: error instanceof Error ? error.message : 'LP provisioning failed' };
    }
  }
}

export class LpCredentialsProvider implements ForexBrokerCredentialsProvider {
  readonly providerId = 'direct-lp';

  supports(kind: ForexCredentialKind): boolean {
    return lpPlugArmed() && (kind === 'TRADING' || kind === 'INVESTOR');
  }

  async changePassword(args: {
    userId: string;
    accountId: string;
    kind: ForexCredentialKind;
    idempotencyKey: string;
  }): Promise<{ ok: false; code: string; message: string } | { ok: true; status: 'REQUESTED' }> {
    if (!this.supports(args.kind)) {
      return { ok: false, code: 'BROKER_CREDENTIALS_UNAVAILABLE', message: 'Broker credential API is not connected.' };
    }
    try {
      await lpChangePassword({ accountId: args.accountId, kind: args.kind, idempotencyKey: args.idempotencyKey });
      return { ok: true, status: 'REQUESTED' };
    } catch (error) {
      const code = error instanceof LpApiError ? error.code : 'BROKER_CREDENTIALS_FAILED';
      return { ok: false, code, message: error instanceof Error ? error.message : 'LP credential request failed' };
    }
  }
}

let accounts: LpLiveAccountProvider | null = null;
let credentials: LpCredentialsProvider | null = null;

export function getLpLiveAccountProvider(): LpLiveAccountProvider {
  if (!accounts) accounts = new LpLiveAccountProvider();
  return accounts;
}

export function getLpCredentialsProvider(): LpCredentialsProvider {
  if (!credentials) credentials = new LpCredentialsProvider();
  return credentials;
}
