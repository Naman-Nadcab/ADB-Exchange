import type { AuthSessionResponse } from '@exchange/mobile-types';
import { caip10ForAccount, sameWalletAccount, sessionUserIsCanonical } from './caip';
import { WalletAccountChangedError, WalletConnectorError, mapWalletAuthError } from './errors';
import type { MobileWalletFailureCode, MobileWalletPhase, WalletAccountSnapshot, WalletChangeKind } from './types';

export type WalletChallengeRef = { id: string; message: string };

export type MobileWalletLoginResult =
  | { ok: true; session: AuthSessionResponse; account: WalletAccountSnapshot }
  | { ok: false; restart: true; reason: 'account' | 'chain' }
  | { ok: false; restart: false; code: MobileWalletFailureCode };

type LoginDeps = {
  connect: (report: (phase: 'CONNECTING' | 'WAITING_FOR_WALLET') => void) => Promise<WalletAccountSnapshot>;
  getAccount: () => WalletAccountSnapshot | null;
  signMessage: (
    message: string,
    report: (phase: 'SIGNING' | 'WAITING_FOR_WALLET' | 'RETURNING') => void,
  ) => Promise<string>;
  watch: (onChange: (kind: WalletChangeKind) => void) => () => void;
  requestChallenge: (caip10: string) => Promise<WalletChallengeRef>;
  login: (body: { challengeId: string; message: string; signature: string }) => Promise<AuthSessionResponse>;
  onPhase?: (phase: MobileWalletPhase) => void;
};

/**
 * Connection is not authentication.
 * The server-issued message is signed, then posted to the existing wallet login API.
 * An account or chain change discards the current challenge and does not submit it.
 */
export async function runMobileWalletLogin(input: LoginDeps): Promise<MobileWalletLoginResult> {
  const phase = (value: MobileWalletPhase) => input.onPhase?.(value);
  let changed: WalletChangeKind | null = null;
  let account: WalletAccountSnapshot;
  try {
    account = await input.connect((next) => phase(next));
  } catch (error) {
    if (error instanceof WalletAccountChangedError) {
      return { ok: false, restart: true, reason: error.reason };
    }
    return { ok: false, restart: false, code: failureCode(error) };
  }
  if (!account.address || !account.chainReference) {
    return { ok: false, restart: false, code: 'VERIFY_FAILED' };
  }
  const stop = input.watch((kind) => {
    changed = kind;
  });
  try {
    const challenge = await input.requestChallenge(caip10ForAccount(account));
    if (!challenge.id || !challenge.message) {
      return { ok: false, restart: false, code: 'VERIFY_FAILED' };
    }
    const switched = switchedAccount(changed, account, input.getAccount());
    if (switched === 'disconnect') return { ok: false, restart: false, code: 'DEEPLINK_CANCELLED' };
    if (switched === 'account' || switched === 'chain') return { ok: false, restart: true, reason: switched };

    let signature: string;
    try {
      signature = await input.signMessage(challenge.message, (next) => phase(next));
    } catch (error) {
      if (error instanceof WalletAccountChangedError) {
        return { ok: false, restart: true, reason: error.reason };
      }
      if (changed === 'disconnect') return { ok: false, restart: false, code: 'DEEPLINK_CANCELLED' };
      return { ok: false, restart: false, code: failureCode(error) };
    }
    const signedAccount = switchedAccount(changed, account, input.getAccount());
    if (signedAccount === 'disconnect') return { ok: false, restart: false, code: 'DEEPLINK_CANCELLED' };
    if (signedAccount === 'account' || signedAccount === 'chain') {
      return { ok: false, restart: true, reason: signedAccount };
    }
    phase('VERIFYING');
    try {
      const session = await input.login({
        challengeId: challenge.id,
        message: challenge.message,
        signature,
      });
      if (!sessionUserIsCanonical(session.user?.id ?? '', account.address)) {
        return { ok: false, restart: false, code: 'VERIFY_FAILED' };
      }
      phase('SUCCESS');
      return { ok: true, session, account };
    } catch (error) {
      return { ok: false, restart: false, code: failureCode(error) };
    }
  } catch (error) {
    if (error instanceof WalletAccountChangedError) {
      return { ok: false, restart: true, reason: error.reason };
    }
    return { ok: false, restart: false, code: failureCode(error) };
  } finally {
    stop();
  }
}

export async function authenticateMobileWallet(
  input: LoginDeps,
  options?: { maxAttempts?: number },
): Promise<MobileWalletLoginResult> {
  const maxAttempts = options?.maxAttempts ?? 2;
  let last: MobileWalletLoginResult = { ok: false, restart: false, code: 'VERIFY_FAILED' };
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await runMobileWalletLogin(input);
    if (last.ok || !last.restart) return last;
  }
  return last.ok ? last : { ok: false, restart: false, code: 'CHALLENGE_EXPIRED' };
}

function failureCode(error: unknown): MobileWalletFailureCode {
  if (error instanceof WalletConnectorError) return error.code;
  return mapWalletAuthError(error);
}

function switchedAccount(
  changed: WalletChangeKind | null,
  original: WalletAccountSnapshot,
  current: WalletAccountSnapshot | null,
): 'account' | 'chain' | 'disconnect' | null {
  if (changed === 'disconnect' || !current) return changed === 'disconnect' ? 'disconnect' : null;
  if (sameWalletAccount(original, current) && changed == null) return null;
  if (!sameWalletAccount(original, current)) {
    return current.chainReference !== original.chainReference || current.namespace !== original.namespace
      ? 'chain'
      : 'account';
  }
  if (changed === 'account' || changed === 'chain') return changed;
  return null;
}
