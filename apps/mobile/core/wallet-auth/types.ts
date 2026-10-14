export type WalletNamespace = 'eip155' | 'solana';

export type WalletAccountSnapshot = {
  namespace: WalletNamespace;
  chainReference: string;
  address: string;
};

export type WalletProviderId = 'metamask' | 'trust' | 'coinbase' | 'phantom';

/** Wallet connection state. This is not the exchange application session. */
export type WalletConnectionState = {
  providerId: WalletProviderId;
  account: WalletAccountSnapshot;
};

export type MobileWalletPhase =
  | 'IDLE'
  | 'CONNECTING'
  | 'WAITING_FOR_WALLET'
  | 'SIGNING'
  | 'RETURNING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'USER_REJECTED'
  | 'WALLET_NOT_INSTALLED'
  | 'DEEPLINK_CANCELLED'
  | 'CONNECTION_TIMEOUT'
  | 'CHALLENGE_EXPIRED'
  | 'VERIFY_FAILED'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR';

export type MobileWalletFailureCode = Exclude<
  MobileWalletPhase,
  'IDLE' | 'CONNECTING' | 'WAITING_FOR_WALLET' | 'SIGNING' | 'RETURNING' | 'VERIFYING' | 'SUCCESS'
>;

export type WalletChangeKind = 'account' | 'chain' | 'disconnect';
