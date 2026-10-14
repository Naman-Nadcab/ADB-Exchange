/**
 * Live-account provider backed by the broker gateway.
 * Installed only when FOREX_BROKER_BASE_URL is set.
 */
import type {
  ForexBrokerCredentialsProvider,
  ForexCredentialKind,
  ForexLiveAccountApplicationInput,
  ForexLiveAccountProvider,
  ForexLiveAccountProviderHealth,
  ForexLiveProvisionResult,
} from '../customer/live-account-provider.types.js';
import { ensureLiveForexAccountRow } from '../customer/accounts-service.js';
import { rememberForexAccountKind } from './account-kind.js';
import { getBrokerGateway } from './gateway.js';

export class BrokerGatewayAccountProvider implements ForexLiveAccountProvider {
  readonly providerId = 'broker-gateway';

  async health(): Promise<ForexLiveAccountProviderHealth> {
    const health = await getBrokerGateway().health();
    const accounts = health.configured && health.ok && health.accounts;
    return {
      configured: health.configured,
      provisioningAvailable: accounts,
      credentialsSupported: health.configured && health.ok && health.accounts,
      message: accounts
        ? 'Broker account API is reachable.'
        : 'Broker account API is not ready.',
    };
  }

  async provisionLiveAccount(input: ForexLiveAccountApplicationInput): Promise<ForexLiveProvisionResult> {
    const created = await getBrokerGateway().provisionAccount({
      applicationId: input.applicationId,
      userId: input.userId,
      currency: 'USD',
      positionMode: input.positionMode,
      leverage: input.leverage ?? null,
      idempotencyKey: input.idempotencyKey,
    });
    if (!created.ok) return created;
    try {
      await ensureLiveForexAccountRow({
        accountId: created.internalAccountId,
        userId: input.userId,
        positionMode: input.positionMode,
        leverage: input.leverage ?? null,
      });
    } catch {
      return {
        ok: false,
        code: 'LIVE_PROVISIONING_UNAVAILABLE',
        message: 'Broker account was created but the local Forex row could not be stored.',
      };
    }
    rememberForexAccountKind(created.internalAccountId, 'LIVE');
    return {
      ok: true,
      brokerTradingLogin: created.tradingLogin,
      brokerServer: created.server,
      internalAccountId: created.internalAccountId,
      providerReference: created.providerReference,
    };
  }
}

/** Installed only when FOREX_BROKER_BASE_URL is set. Unset URL keeps the unconfigured provider. */
export class BrokerGatewayCredentialsProvider implements ForexBrokerCredentialsProvider {
  readonly providerId = 'broker-gateway';

  supports(_kind: ForexCredentialKind): boolean {
    return true;
  }

  async changePassword(args: {
    userId: string;
    accountId: string;
    kind: ForexCredentialKind;
    idempotencyKey: string;
  }): Promise<{ ok: false; code: string; message: string } | { ok: true; status: 'REQUESTED' }> {
    const changed = await getBrokerGateway().changeCredentials({
      accountId: args.accountId,
      kind: args.kind,
      idempotencyKey: args.idempotencyKey,
    });
    if (!changed.ok) {
      return { ok: false, code: 'BROKER_CREDENTIALS_UNAVAILABLE', message: changed.message };
    }
    return { ok: true, status: 'REQUESTED' };
  }
}
