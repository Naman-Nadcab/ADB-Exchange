import { caip10ForAccount } from './encoding';
import { WalletApiError, type WalletLoginSuccess } from './api';

export type WalletAccountSnapshot = {
  namespace: 'eip155' | 'solana';
  chainReference: string;
  address: string;
};

export type WalletAuthPhase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'challenging'
  | 'signing'
  | 'verifying'
  | 'authenticated';

export type WalletAuthFailureCode =
  | 'USER_REJECTED'
  | 'WALLET_DISCONNECTED'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_USED'
  | 'VERIFY_FAILED'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'PROVIDER';

export type WalletChangeKind = 'account' | 'chain' | 'disconnect';

export type WalletAuthResult =
  | ({ ok: true } & WalletLoginSuccess)
  | { ok: false; restart: true; reason: 'account' | 'chain' }
  | { ok: false; restart: false; code: WalletAuthFailureCode };

function sameAccount(left: WalletAccountSnapshot, right: WalletAccountSnapshot): boolean {
  return left.namespace === right.namespace
    && left.chainReference === right.chainReference
    && left.address === right.address;
}

export function isUserRejected(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === 4001 || code === 'ACTION_REJECTED' || code === 'USER_REJECTED') return true;
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return message.includes('user rejected')
    || message.includes('user denied')
    || message.includes('rejected the request');
}

export function mapWalletApiError(error: unknown): WalletAuthFailureCode {
  if (!(error instanceof WalletApiError)) return 'PROVIDER';
  if (error.status === 0 || error.code === 'NETWORK') return 'NETWORK';
  if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') return 'RATE_LIMITED';
  if (error.code === 'CHALLENGE_EXPIRED') return 'CHALLENGE_EXPIRED';
  if (error.code === 'CHALLENGE_UNAVAILABLE') return 'CHALLENGE_USED';
  return 'VERIFY_FAILED';
}

/**
 * Connect, challenge, sign, then verify.
 * A connected wallet is not authenticated until verify returns success.
 * An account or chain change discards the current challenge and does not submit it.
 */
export async function runWalletAuthentication(input: {
  connect: () => Promise<WalletAccountSnapshot>;
  getAccount: () => Promise<WalletAccountSnapshot>;
  signMessage: (message: string) => Promise<string>;
  watch: (onChange: (kind: WalletChangeKind) => void) => () => void;
  requestChallenge: (caip10: string) => Promise<{ id: string; message: string }>;
  verify: (body: { challengeId: string; message: string; signature: string }) => Promise<WalletLoginSuccess>;
  onPhase?: (phase: WalletAuthPhase) => void;
}): Promise<WalletAuthResult> {
  const phase = (value: WalletAuthPhase) => input.onPhase?.(value);
  let changed: WalletChangeKind | null = null;
  phase('connecting');
  let account: WalletAccountSnapshot;
  try {
    account = await input.connect();
  } catch (error) {
    if (isUserRejected(error)) return { ok: false, restart: false, code: 'USER_REJECTED' };
    return { ok: false, restart: false, code: 'PROVIDER' };
  }
  if (!account.address || !account.chainReference) {
    return { ok: false, restart: false, code: 'PROVIDER' };
  }
  phase('connected');
  const stop = input.watch((kind) => {
    changed = kind;
  });
  try {
    phase('challenging');
    const challenge = await input.requestChallenge(caip10ForAccount(account));
    if (changed === 'disconnect') return { ok: false, restart: false, code: 'WALLET_DISCONNECTED' };
    if (changed === 'account' || changed === 'chain') return { ok: false, restart: true, reason: changed };
    const afterChallenge = await input.getAccount();
    if (!sameAccount(account, afterChallenge)) {
      return {
        ok: false,
        restart: true,
        reason: afterChallenge.chainReference !== account.chainReference ? 'chain' : 'account',
      };
    }
    phase('signing');
    let signature: string;
    try {
      signature = await input.signMessage(challenge.message);
    } catch (error) {
      if (isUserRejected(error)) return { ok: false, restart: false, code: 'USER_REJECTED' };
      if (changed === 'disconnect') return { ok: false, restart: false, code: 'WALLET_DISCONNECTED' };
      return { ok: false, restart: false, code: 'PROVIDER' };
    }
    if (changed === 'disconnect') return { ok: false, restart: false, code: 'WALLET_DISCONNECTED' };
    if (changed === 'account' || changed === 'chain') return { ok: false, restart: true, reason: changed };
    const afterSign = await input.getAccount();
    if (!sameAccount(account, afterSign)) {
      return {
        ok: false,
        restart: true,
        reason: afterSign.chainReference !== account.chainReference ? 'chain' : 'account',
      };
    }
    phase('verifying');
    try {
      const session = await input.verify({
        challengeId: challenge.id,
        message: challenge.message,
        signature,
      });
      const userId = typeof session.user.id === 'string' ? session.user.id : '';
      if (userId && userId !== account.address && userId.toLowerCase() !== account.address.toLowerCase()) {
        phase('authenticated');
        return { ok: true, ...session };
      }
      return { ok: false, restart: false, code: 'VERIFY_FAILED' };
    } catch (error) {
      return { ok: false, restart: false, code: mapWalletApiError(error) };
    }
  } catch (error) {
    return { ok: false, restart: false, code: mapWalletApiError(error) };
  } finally {
    stop();
  }
}
