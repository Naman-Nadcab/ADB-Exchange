/**
 * Broker live-account provisioning contract — no mock "production" implementations.
 */
export type ForexLiveAccountApplicationInput = {
  userId: string;
  applicationId: string;
  currency: 'USD';
  accountKind: 'LIVE';
  leverage?: string | null;
  positionMode: 'NETTING' | 'HEDGING';
  groupCode?: string | null;
  idempotencyKey: string;
};

export type ForexLiveProvisionResult =
  | {
      ok: true;
      brokerTradingLogin: string;
      brokerServer: string;
      internalAccountId: string;
      providerReference: string;
    }
  | { ok: false; code: string; message: string };

export type ForexLiveAccountProviderHealth = {
  configured: boolean;
  provisioningAvailable: boolean;
  credentialsSupported: boolean;
  message: string;
};

export interface ForexLiveAccountProvider {
  readonly providerId: string;
  health(): Promise<ForexLiveAccountProviderHealth>;
  provisionLiveAccount(input: ForexLiveAccountApplicationInput): Promise<ForexLiveProvisionResult>;
}

export type ForexTradingCredentialOperation = 'CHANGE' | 'RESET';
export type ForexCredentialKind = 'TRADING' | 'INVESTOR';

export interface ForexBrokerCredentialsProvider {
  readonly providerId: string;
  supports(kind: ForexCredentialKind): boolean;
  changePassword(args: {
    userId: string;
    accountId: string;
    kind: ForexCredentialKind;
    idempotencyKey: string;
  }): Promise<{ ok: false; code: string; message: string } | { ok: true; status: 'REQUESTED' }>;
}
