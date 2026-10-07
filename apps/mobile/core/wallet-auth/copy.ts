import type { MobileWalletPhase } from './types';

export const WALLET_SIGN_IN_TITLE = 'Sign in with your wallet';
export const WALLET_SIGNUP_TITLE = 'Sign up with your wallet';

/** Shown before the wallet is asked to sign. Not a payment or transfer. */
export const WALLET_SIGNATURE_NOTICE =
  'This signature proves control of your wallet. It does not send funds or create a transaction.';

export const PHASE_COPY: Record<MobileWalletPhase, string> = {
  IDLE: 'Connect wallet',
  CONNECTING: 'Connecting…',
  WAITING_FOR_WALLET: 'Continue in your wallet app',
  SIGNING: 'Sign the login message',
  RETURNING: 'Verifying wallet signature…',
  VERIFYING: 'Signing you in…',
  SUCCESS: 'Connect wallet',
  USER_REJECTED: 'Wallet signature was rejected',
  WALLET_NOT_INSTALLED: 'Wallet app is unavailable',
  DEEPLINK_CANCELLED: 'Connection cancelled',
  CONNECTION_TIMEOUT: 'Wallet connection timed out',
  CHALLENGE_EXPIRED: 'Start again',
  VERIFY_FAILED: 'Authentication failed',
  RATE_LIMIT: 'Try again later',
  NETWORK_ERROR: 'Check connection and retry',
};

const RETRYABLE: ReadonlySet<MobileWalletPhase> = new Set([
  'USER_REJECTED',
  'WALLET_NOT_INSTALLED',
  'DEEPLINK_CANCELLED',
  'CONNECTION_TIMEOUT',
  'CHALLENGE_EXPIRED',
  'VERIFY_FAILED',
  'RATE_LIMIT',
  'NETWORK_ERROR',
]);

export function isRetryableWalletPhase(phase: MobileWalletPhase): boolean {
  return RETRYABLE.has(phase);
}
