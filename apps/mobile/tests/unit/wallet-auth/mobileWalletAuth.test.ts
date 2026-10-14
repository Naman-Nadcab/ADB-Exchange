import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from '@jest/globals';
import type { AuthSessionResponse } from '@exchange/mobile-types';
import { ApiError } from '@core/api/errors/ApiError';
import { unwrapApiData } from '@core/api/types/apiResponse';
import { AuthRepository } from '@core/repositories/AuthRepository';
import type { HttpClient } from '@core/api/httpClient';
import { SECURE_KEYS } from '@core/storage/secureStorage';
import { linking } from '@app/navigation/linking';
import { caip10ForAccount, sessionUserIsCanonical } from '@core/wallet-auth/caip';
import { PHASE_COPY, WALLET_SIGNATURE_NOTICE, WALLET_SIGN_IN_TITLE } from '@core/wallet-auth/copy';
import { DeeplinkWalletConnector, type WalletTransport } from '@core/wallet-auth/connector';
import { parseWalletReturn } from '@core/wallet-auth/deeplink';
import { mapWalletAuthError } from '@core/wallet-auth/errors';
import { authenticateMobileWallet, runMobileWalletLogin } from '@core/wallet-auth/flow';
import { WALLET_PROVIDERS } from '@core/wallet-auth/providers';
import {
  applicationSessionHasForbiddenFields,
  toApplicationSession,
  walletChallengeRequestBody,
  walletLoginRequestBody,
} from '@core/wallet-auth/sessionBoundary';
import type { WalletAccountSnapshot, WalletChangeKind } from '@core/wallet-auth/types';

const EVM_A = '0x1111111111111111111111111111111111111111';
const EVM_B = '0x2222222222222222222222222222222222222222';
const SOLANA = '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';
const USER_ID = 'a0000000-0000-4000-8000-00000000aa01';

function session(id = USER_ID, email: string | null = null): AuthSessionResponse {
  return {
    user: {
      id,
      email,
      phone: null,
      username: null,
      status: 'active',
      emailVerified: false,
      phoneVerified: false,
      tierLevel: 0,
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };
}

function scripted(options?: { installed?: boolean }) {
  const listeners = new Set<(url: string) => void>();
  const opened: string[] = [];
  let installed = options?.installed ?? true;
  let seq = 0;
  const transport: WalletTransport = {
    canOpen: async () => installed,
    open: async (url) => {
      opened.push(url);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createRequestId: () => {
      seq += 1;
      return `req-${seq}`;
    },
  };
  return {
    opened,
    transport,
    setInstalled(value: boolean) {
      installed = value;
    },
    emit(url: string) {
      listeners.forEach((listener) => listener(url));
    },
  };
}

function requestIdFrom(url: string): string {
  const redirect = new URL(url).searchParams.get('redirect') ?? '';
  return new URL(redirect).searchParams.get('requestId') ?? '';
}

function connectReturn(requestId: string, account: WalletAccountSnapshot): string {
  const params = new URLSearchParams({
    requestId,
    status: 'connected',
    namespace: account.namespace,
    chain: account.chainReference,
    address: account.address,
  });
  return `metheorium://wallet-auth?${params.toString()}`;
}

function signReturn(requestId: string, account: WalletAccountSnapshot, signature: string, message?: string): string {
  const params = new URLSearchParams({
    requestId,
    status: 'signed',
    namespace: account.namespace,
    chain: account.chainReference,
    address: account.address,
    signature,
  });
  if (message) params.set('message', message);
  return `metheorium://wallet-auth?${params.toString()}`;
}

describe('mock mobile wallet authentication', () => {
  it('keeps Solana address case in the CAIP-10 identity', () => {
    const caip10 = caip10ForAccount({
      namespace: 'solana',
      chainReference: 'mainnet',
      address: SOLANA,
    });
    expect(caip10).toBe(`solana:mainnet:${SOLANA}`);
    expect(caip10).not.toBe(caip10.toLowerCase());
  });

  it('builds a challenge body with only caip10', () => {
    expect(Object.keys(walletChallengeRequestBody('eip155:1:0xabc'))).toEqual(['caip10']);
    expect(Object.keys(walletLoginRequestBody({ challengeId: 'c', message: 'm', signature: 's' }))).toEqual([
      'challengeId',
      'message',
      'signature',
    ]);
  });

  it('does not treat the challenge envelope data field as the challenge', () => {
    const body = { success: true, challenge: { id: 'c1', message: 'server message' } };
    expect(unwrapApiData(body)).toEqual({});
  });

  it('reads the challenge field and posts the existing login contract', async () => {
    const calls: { path: string; body: unknown; retainEnvelope?: boolean }[] = [];
    const http = {
      request: async (path: string, config: { body?: unknown; retainEnvelope?: boolean }) => {
        calls.push({ path, body: config.body, retainEnvelope: config.retainEnvelope });
        if (path.endsWith('/wallet/challenge')) {
          return {
            success: true,
            challenge: {
              id: 'c1',
              namespace: 'eip155',
              chainReference: '1',
              address: EVM_A,
              message: 'server-issued message',
              nonce: 'nonce-1',
              expiresAt: '2099-01-01T00:00:00.000Z',
            },
          };
        }
        return session();
      },
    };
    const repo = new AuthRepository(http as HttpClient);
    const challenge = await repo.walletChallenge(`eip155:1:${EVM_A}`);
    expect(challenge.message).toBe('server-issued message');
    expect(calls[0]?.retainEnvelope).toBe(true);
    expect(calls[0]?.body).toEqual({ caip10: `eip155:1:${EVM_A}` });
    const loggedIn = await repo.walletLogin({
      challengeId: challenge.id,
      message: challenge.message,
      signature: '0xsig',
    });
    expect(loggedIn.user.id).toBe(USER_ID);
    expect(loggedIn.user.email).toBeNull();
    expect(calls[1]?.path).toBe('/auth/wallet/login');
    expect(calls.map((call) => call.path).some((path) => path.includes('/admin'))).toBe(false);
    expect(typeof repo.loginPassword).toBe('function');
    expect(typeof repo.loginOtp).toBe('function');
    expect(typeof repo.passkeyAuthenticateVerify).toBe('function');
    expect(typeof repo.googleOAuthCallback).toBe('function');
    expect(typeof repo.appleOAuthCallback).toBe('function');
    expect(typeof repo.logout).toBe('function');
  });

  it('uses the server message and stores only the application session', async () => {
    const account: WalletAccountSnapshot = { namespace: 'eip155', chainReference: '1', address: EVM_A };
    const logins: { challengeId: string; message: string; signature: string }[] = [];
    const result = await runMobileWalletLogin({
      connect: async () => account,
      getAccount: () => account,
      signMessage: async (message) => `signed:${message}`,
      watch: () => () => undefined,
      requestChallenge: async () => ({ id: 'c1', message: 'exact server message' }),
      login: async (body) => {
        logins.push(body);
        return session();
      },
    });
    expect(result.ok).toBe(true);
    expect(logins).toEqual([{ challengeId: 'c1', message: 'exact server message', signature: 'signed:exact server message' }]);
    if (!result.ok) return;
    const persisted = toApplicationSession(result.session);
    expect(persisted).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token', userId: USER_ID });
    expect(applicationSessionHasForbiddenFields(persisted)).toBe(false);
    expect(sessionUserIsCanonical(persisted.userId, EVM_A)).toBe(true);
    expect(Object.values(SECURE_KEYS)).toEqual(['access_token', 'refresh_token', 'user_id', 'pin_hash']);
  });

  it('does not authenticate when the wallet connects but does not sign', async () => {
    let logins = 0;
    const pending = runMobileWalletLogin({
      connect: async () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
      getAccount: () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
      signMessage: () => new Promise(() => undefined),
      watch: () => () => undefined,
      requestChallenge: async () => ({ id: 'c1', message: 'server message' }),
      login: async () => {
        logins += 1;
        return session();
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(logins).toBe(0);
    void pending;
  });

  it('does not open a session when the signature is rejected', async () => {
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, { timeoutMs: 1000 });
    connector.start();
    const connectPromise = connector.connect('metamask', () => undefined);
    const connectUrl = await waitFor(() => harness.opened[0]);
    harness.emit(connectReturn(requestIdFrom(connectUrl), { namespace: 'eip155', chainReference: '1', address: EVM_A }));
    await connectPromise;
    const signPromise = connector.signMessage('server message', () => undefined);
    const signUrl = await waitFor(() => harness.opened[1]);
    harness.emit(`metheorium://wallet-auth?requestId=${requestIdFrom(signUrl)}&status=rejected`);
    await expect(signPromise).rejects.toMatchObject({ code: 'USER_REJECTED' });
    expect(connector.getConnection()?.account.address).toBe(EVM_A);
    connector.stop();
  });

  it('starts an external handoff and completes only after server login', async () => {
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, { timeoutMs: 1000 });
    connector.start();
    const phases: string[] = [];
    const logins: string[] = [];
    const resultPromise = runMobileWalletLogin({
      connect: (report) => connector.connect('trust', report),
      getAccount: () => connector.getAccount(),
      signMessage: (message, report) => connector.signMessage(message, report),
      watch: (onChange) => connector.watch(onChange),
      requestChallenge: async (caip10) => {
        expect(caip10).toBe(`eip155:1:${EVM_A}`);
        return { id: 'c-trust', message: 'server-issued message' };
      },
      login: async (body) => {
        logins.push(body.signature);
        expect(body.message).toBe('server-issued message');
        return session();
      },
      onPhase: (phase) => phases.push(phase),
    });
    const connectUrl = await waitFor(() => harness.opened[0]);
    expect(connectUrl.startsWith('trust://')).toBe(true);
    harness.emit(connectReturn(requestIdFrom(connectUrl), { namespace: 'eip155', chainReference: '1', address: EVM_A }));
    const signUrl = await waitFor(() => harness.opened[1]);
    expect(new URL(signUrl).searchParams.get('message')).toBe('server-issued message');
    harness.emit(signReturn(requestIdFrom(signUrl), { namespace: 'eip155', chainReference: '1', address: EVM_A }, '0xsig'));
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    expect(logins).toEqual(['0xsig']);
    expect(phases).toContain('VERIFYING');
    expect(phases).toContain('SUCCESS');
    connector.disconnect();
    expect(connector.getConnection()).toBeNull();
    connector.stop();
  });

  it('discards the old challenge when the account changes', async () => {
    let account: WalletAccountSnapshot = { namespace: 'eip155', chainReference: '1', address: EVM_A };
    const challenges: string[] = [];
    let logins = 0;
    const first = await runMobileWalletLogin({
      connect: async () => account,
      getAccount: () => account,
      signMessage: async () => 'sig',
      watch: () => () => undefined,
      requestChallenge: async (caip10) => {
        challenges.push(caip10);
        account = { ...account, address: EVM_B };
        return { id: 'old', message: 'message-a' };
      },
      login: async () => {
        logins += 1;
        return session();
      },
    });
    expect(first).toEqual({ ok: false, restart: true, reason: 'account' });
    expect(logins).toBe(0);
    const second = await runMobileWalletLogin({
      connect: async () => account,
      getAccount: () => account,
      signMessage: async () => 'sig-b',
      watch: () => () => undefined,
      requestChallenge: async (caip10) => {
        challenges.push(caip10);
        return { id: 'fresh', message: 'message-b' };
      },
      login: async (body) => {
        logins += 1;
        expect(body.challengeId).toBe('fresh');
        return session();
      },
    });
    expect(second.ok).toBe(true);
    expect(challenges).toEqual([`eip155:1:${EVM_A}`, `eip155:1:${EVM_B}`]);
  });

  it('discards the old challenge when the chain changes', async () => {
    let account: WalletAccountSnapshot = { namespace: 'eip155', chainReference: '1', address: EVM_A };
    let logins = 0;
    const changed = await runMobileWalletLogin({
      connect: async () => account,
      getAccount: () => account,
      signMessage: async () => 'sig',
      watch: () => () => undefined,
      requestChallenge: async () => {
        account = { ...account, chainReference: '137' };
        return { id: 'chain-a', message: 'message-a' };
      },
      login: async () => {
        logins += 1;
        return session();
      },
    });
    expect(changed).toEqual({ ok: false, restart: true, reason: 'chain' });
    expect(logins).toBe(0);
  });

  it('requests a fresh challenge after an account switch', async () => {
    let account: WalletAccountSnapshot = { namespace: 'eip155', chainReference: '1', address: EVM_A };
    const ids: string[] = [];
    const result = await authenticateMobileWallet({
      connect: async () => account,
      getAccount: () => account,
      signMessage: async () => 'sig',
      watch: () => () => undefined,
      requestChallenge: async (caip10) => {
        const id = ids.length === 0 ? 'old' : 'fresh';
        ids.push(caip10);
        if (ids.length === 1) account = { ...account, address: EVM_B };
        return { id, message: `message-${id}` };
      },
      login: async (body) => {
        expect(body.challengeId).toBe('fresh');
        expect(body.message).toBe('message-fresh');
        return session();
      },
    });
    expect(result.ok).toBe(true);
    expect(ids[1]).toBe(`eip155:1:${EVM_B}`);
  });

  it('maps expired, replay, bad signature, disabled, rate limit, and network failures', async () => {
    const cases: { error: unknown; code: string }[] = [
      { error: new ApiError('Expired challenge', 400, 'CHALLENGE_EXPIRED'), code: 'CHALLENGE_EXPIRED' },
      { error: new ApiError('Challenge unavailable', 400, 'CHALLENGE_UNAVAILABLE'), code: 'VERIFY_FAILED' },
      { error: new ApiError('Invalid signature', 400, 'INVALID_SIGNATURE'), code: 'VERIFY_FAILED' },
      { error: new ApiError('Unavailable', 403, 'WALLET_UNAVAILABLE'), code: 'VERIFY_FAILED' },
      { error: new ApiError('Too many', 429, 'RATE_LIMIT_EXCEEDED'), code: 'RATE_LIMIT' },
      { error: new ApiError('offline', 0, 'NETWORK'), code: 'NETWORK_ERROR' },
    ];
    for (const item of cases) {
      const result = await runMobileWalletLogin({
        connect: async () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
        getAccount: () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
        signMessage: async () => 'sig',
        watch: () => () => undefined,
        requestChallenge: async () => ({ id: 'c', message: 'server message' }),
        login: async () => {
          throw item.error;
        },
      });
      expect(result).toEqual({ ok: false, restart: false, code: item.code });
      expect(mapWalletAuthError(item.error)).toBe(item.code);
    }
  });

  it('rejects a session whose user id is the wallet address', async () => {
    const result = await runMobileWalletLogin({
      connect: async () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
      getAccount: () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
      signMessage: async () => 'sig',
      watch: () => () => undefined,
      requestChallenge: async () => ({ id: 'c', message: 'server message' }),
      login: async () => session(EVM_A),
    });
    expect(result).toEqual({ ok: false, restart: false, code: 'VERIFY_FAILED' });
  });

  it('accepts a null email for a wallet-native user', async () => {
    const result = await runMobileWalletLogin({
      connect: async () => ({ namespace: 'solana', chainReference: 'mainnet', address: SOLANA }),
      getAccount: () => ({ namespace: 'solana', chainReference: 'mainnet', address: SOLANA }),
      signMessage: async () => 'sol-sig',
      watch: () => () => undefined,
      requestChallenge: async (caip10) => {
        expect(caip10).toBe(`solana:mainnet:${SOLANA}`);
        return { id: 'sol', message: 'server solana message' };
      },
      login: async () => session(USER_ID, null),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.user.email).toBeNull();
  });

  it('does not authenticate an invalid or unrelated return url', async () => {
    expect(parseWalletReturn('metheorium://oauth/callback?code=1').kind).toBe('unrelated');
    expect(parseWalletReturn('metheorium://wallet-auth?status=signed').kind).toBe('invalid');
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, { timeoutMs: 1000 });
    connector.start();
    const pending = connector.connect('coinbase', () => undefined);
    await waitFor(() => harness.opened[0]);
    harness.emit('metheorium://oauth/callback?code=1');
    harness.emit('metheorium://wallet-auth?status=connected');
    await expect(pending).rejects.toMatchObject({ code: 'DEEPLINK_CANCELLED' });
    expect(connector.getConnection()).toBeNull();
    connector.stop();
  });

  it('returns a retryable timeout and missing-wallet state', async () => {
    const missing = scripted({ installed: false });
    const connector = new DeeplinkWalletConnector(missing.transport, { timeoutMs: 30 });
    connector.start();
    await expect(connector.connect('phantom', () => undefined)).rejects.toMatchObject({ code: 'WALLET_NOT_INSTALLED' });
    connector.stop();

    const slow = scripted();
    const waiting = new DeeplinkWalletConnector(slow.transport, { timeoutMs: 20 });
    waiting.start();
    await expect(waiting.connect('metamask', () => undefined)).rejects.toMatchObject({ code: 'CONNECTION_TIMEOUT' });
    waiting.stop();
  });

  it('keeps the handoff alive across background and ignores a return after process death', async () => {
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, { timeoutMs: 1000 });
    connector.start();
    const pending = connector.connect('metamask', () => undefined);
    const opened = await waitFor(() => harness.opened[0]);
    connector.handleAppState('background');
    connector.handleAppState('active');
    const requestId = requestIdFrom(opened);
    harness.emit(connectReturn(requestId, { namespace: 'eip155', chainReference: '1', address: EVM_A }));
    await expect(pending).resolves.toMatchObject({ address: EVM_A });

    const sign = connector.signMessage('server message', () => undefined);
    await waitFor(() => harness.opened[1]);
    connector.abandonAfterProcessDeath();
    await expect(sign).rejects.toMatchObject({ code: 'DEEPLINK_CANCELLED' });
    harness.emit(signReturn('stale', { namespace: 'eip155', chainReference: '1', address: EVM_A }, 'late-sig'));
    expect(connector.getConnection()).toBeNull();
    connector.stop();
  });

  it('does not log the application out when the wallet disconnects', () => {
    const src = readFileSync(resolve(__dirname, '../../../core/wallet-auth/connector.ts'), 'utf8');
    const disconnectBlock = src.slice(src.indexOf('disconnect():'), src.indexOf('async connect'));
    expect(disconnectBlock.includes('/auth/logout')).toBe(false);
    expect(disconnectBlock.includes('logout(')).toBe(false);
    const flow = readFileSync(resolve(__dirname, '../../../core/wallet-auth/flow.ts'), 'utf8');
    expect(flow.includes('user_balances')).toBe(false);
    expect(flow.includes('forex')).toBe(false);
    expect(flow.includes('/wallet/deposit')).toBe(false);
    expect(flow.includes('privateKey')).toBe(false);
  });

  it('uses a WalletConnect pairing URI only when a relay client provides one', async () => {
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, {
      timeoutMs: 200,
      projectId: 'public-project-id',
      createPairingUri: async () => 'wc:pairing-example',
    });
    connector.start();
    const pending = connector.connect('metamask', () => undefined);
    const opened = await waitFor(() => harness.opened[0]);
    expect(opened).toContain('metamask://wc?uri=');
    expect(opened).toContain(encodeURIComponent('wc:pairing-example'));
    connector.cancelPending();
    await expect(pending).rejects.toMatchObject({ code: 'DEEPLINK_CANCELLED' });
    connector.stop();
  });

  it('preserves the Solana address returned by the wallet', async () => {
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, { timeoutMs: 500 });
    connector.start();
    const pending = connector.connect('phantom', () => undefined);
    const opened = await waitFor(() => harness.opened[0]);
    harness.emit(
      connectReturn(requestIdFrom(opened), {
        namespace: 'solana',
        chainReference: 'mainnet',
        address: SOLANA,
      }),
    );
    const account = await pending;
    expect(account.address).toBe(SOLANA);
    expect(caip10ForAccount(account)).toBe(`solana:mainnet:${SOLANA}`);
    connector.stop();
  });

  it('rejects a signed return for a different account before login', async () => {
    const harness = scripted();
    const connector = new DeeplinkWalletConnector(harness.transport, { timeoutMs: 500 });
    connector.start();
    const connectPromise = connector.connect('metamask', () => undefined);
    const connectUrl = await waitFor(() => harness.opened[0]);
    harness.emit(connectReturn(requestIdFrom(connectUrl), { namespace: 'eip155', chainReference: '1', address: EVM_A }));
    await connectPromise;
    const changes: WalletChangeKind[] = [];
    connector.watch((kind) => changes.push(kind));
    const signPromise = connector.signMessage('server message', () => undefined);
    const signUrl = await waitFor(() => harness.opened[1]);
    harness.emit(
      signReturn(requestIdFrom(signUrl), { namespace: 'eip155', chainReference: '137', address: EVM_B }, 'sig'),
    );
    await expect(signPromise).rejects.toMatchObject({ reason: 'chain' });
    expect(changes).toContain('chain');
    connector.stop();
  });

  it('shows the product sign-in copy and the existing return path', () => {
    expect(WALLET_SIGN_IN_TITLE).toBe('Sign in with your wallet');
    expect(WALLET_SIGNATURE_NOTICE).toBe(
      'This signature proves control of your wallet. It does not send funds or create a transaction.',
    );
    expect(PHASE_COPY.IDLE).toBe('Connect wallet');
    expect(PHASE_COPY.CONNECTING).toBe('Connecting…');
    expect(PHASE_COPY.WAITING_FOR_WALLET).toBe('Continue in your wallet app');
    expect(PHASE_COPY.SIGNING).toBe('Sign the login message');
    expect(PHASE_COPY.RETURNING).toBe('Verifying wallet signature…');
    expect(PHASE_COPY.VERIFYING).toBe('Signing you in…');
    expect(PHASE_COPY.USER_REJECTED).toBe('Wallet signature was rejected');
    expect(PHASE_COPY.WALLET_NOT_INSTALLED).toBe('Wallet app is unavailable');
    expect(PHASE_COPY.DEEPLINK_CANCELLED).toBe('Connection cancelled');
    expect(PHASE_COPY.CONNECTION_TIMEOUT).toBe('Wallet connection timed out');
    expect(PHASE_COPY.CHALLENGE_EXPIRED).toBe('Start again');
    expect(PHASE_COPY.VERIFY_FAILED).toBe('Authentication failed');
    expect(PHASE_COPY.RATE_LIMIT).toBe('Try again later');
    expect(PHASE_COPY.NETWORK_ERROR).toBe('Check connection and retry');
    expect(linking.config.screens.Auth.screens.LoginWallet).toBe('wallet-auth');
    expect(linking.prefixes).toEqual(['metheorium://', 'https://app.metheorium.com']);
    expect(WALLET_PROVIDERS.map((provider) => provider.id)).toEqual(['metamask', 'trust', 'coinbase', 'phantom']);
  });

  it('requests a new challenge after a rejected login', async () => {
    const ids: string[] = [];
    const once = async (id: string, fail: boolean) =>
      runMobileWalletLogin({
        connect: async () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
        getAccount: () => ({ namespace: 'eip155', chainReference: '1', address: EVM_A }),
        signMessage: async () => 'sig',
        watch: () => () => undefined,
        requestChallenge: async () => {
          ids.push(id);
          return { id, message: `message-${id}` };
        },
        login: async () => {
          if (fail) throw new ApiError('Invalid signature', 400, 'INVALID_SIGNATURE');
          return session();
        },
      });
    expect((await once('first', true)).ok).toBe(false);
    const second = await once('second', false);
    expect(second.ok).toBe(true);
    expect(ids).toEqual(['first', 'second']);
  });
});

async function waitFor(read: () => string | undefined): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < 500) {
    const value = read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('timed out waiting for wallet handoff');
}
