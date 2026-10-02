import assert from 'node:assert/strict';
import { maskAccountEmail } from '../account-email';
import { WalletApiError, walletChallenge, walletVerify } from './api';
import {
  caip10ForAccount,
  encodeBase58,
  evmCaip10,
  hexChainToReference,
  solanaCaip10,
  utf8MessageToHex,
} from './encoding';
import {
  isUserRejected,
  mapWalletApiError,
  runWalletAuthentication,
  type WalletAccountSnapshot,
  type WalletAuthPhase,
  type WalletChangeKind,
} from './flow';

function test(name: string, fn: () => void | Promise<void>) {
  const run = fn();
  if (run && typeof (run as Promise<void>).then === 'function') {
    pending.push(run.then(
      () => console.log(`ok ${name}`),
      (error) => {
        console.error(`fail ${name}`, error);
        process.exitCode = 1;
      },
    ));
    return;
  }
  console.log(`ok ${name}`);
}

const pending: Promise<void>[] = [];

const evm: WalletAccountSnapshot = {
  namespace: 'eip155',
  chainReference: '1',
  address: '0x1111111111111111111111111111111111111111',
};

test('base58 keeps leading zero bytes and does not emit hex', () => {
  assert.equal(encodeBase58(new Uint8Array()), '');
  assert.equal(encodeBase58(Uint8Array.of(0, 0)), '11');
  const encoded = encodeBase58(Uint8Array.of(1, 2, 3));
  assert.match(encoded, /^[1-9A-HJ-NP-Za-km-z]+$/);
  assert.equal(encoded.startsWith('0x'), false);
});

test('personal_sign hex is the exact UTF-8 message', () => {
  assert.equal(utf8MessageToHex('Hi'), '0x4869');
  assert.equal(utf8MessageToHex('签名'), '0xe7adbee5908d');
});

test('chain reference is decimal and Solana addresses are not lowercased', () => {
  assert.equal(hexChainToReference('0x1'), '1');
  assert.equal(hexChainToReference('0x89'), '137');
  const solanaAddress = 'SoLAddrCaseSensitive1111111111111111111';
  assert.equal(solanaCaip10('mainnet', solanaAddress), `solana:mainnet:${solanaAddress}`);
  assert.equal(
    caip10ForAccount({ namespace: 'solana', chainReference: 'mainnet', address: solanaAddress }),
    `solana:mainnet:${solanaAddress}`,
  );
  assert.equal(evmCaip10('1', evm.address), `eip155:1:${evm.address}`);
});

test('missing email renders the neutral label', () => {
  for (const value of [null, undefined, '', 'null', 'undefined', '  ']) {
    assert.equal(maskAccountEmail(value, 'Not added'), 'Not added');
  }
  assert.equal(maskAccountEmail('alice@example.com', 'Not added').includes('null'), false);
  assert.match(maskAccountEmail('alice@example.com', 'Not added'), /@/);
});

test('rejection and API errors map to safe codes', () => {
  assert.equal(isUserRejected({ code: 4001, message: 'x' }), true);
  assert.equal(isUserRejected(new Error('User rejected the request')), true);
  assert.equal(isUserRejected(new Error('wallet locked')), false);
  assert.equal(mapWalletApiError(new WalletApiError(0, 'NETWORK')), 'NETWORK');
  assert.equal(mapWalletApiError(new WalletApiError(429, 'RATE_LIMIT_EXCEEDED')), 'RATE_LIMITED');
  assert.equal(mapWalletApiError(new WalletApiError(400, 'CHALLENGE_EXPIRED')), 'CHALLENGE_EXPIRED');
  assert.equal(mapWalletApiError(new WalletApiError(400, 'CHALLENGE_UNAVAILABLE')), 'CHALLENGE_USED');
  assert.equal(mapWalletApiError(new WalletApiError(400, 'INVALID_SIGNATURE')), 'VERIFY_FAILED');
  assert.equal(mapWalletApiError(new Error('stack')), 'PROVIDER');
});

function harness(options: {
  account?: WalletAccountSnapshot;
  nextAccount?: WalletAccountSnapshot;
  sign?: () => Promise<string>;
  challenge?: () => Promise<{ id: string; message: string }>;
  verify?: () => Promise<{ user: Record<string, unknown>; accessToken: string; refreshToken: string }>;
  emit?: (notify: (kind: WalletChangeKind) => void) => void;
}) {
  const phases: WalletAuthPhase[] = [];
  let verifyCalls = 0;
  let challengeCalls = 0;
  let signCalls = 0;
  const account = options.account ?? evm;
  const result = runWalletAuthentication({
    connect: async () => account,
    getAccount: async () => options.nextAccount ?? account,
    signMessage: async () => {
      signCalls += 1;
      if (options.sign) return options.sign();
      return '0xsig';
    },
    watch: (onChange) => {
      options.emit?.(onChange);
      return () => {};
    },
    requestChallenge: async (caip10) => {
      challengeCalls += 1;
      assert.equal(caip10, caip10ForAccount(account));
      if (options.challenge) return options.challenge();
      return { id: 'challenge-1', message: 'server-issued-message' };
    },
    verify: async (body) => {
      verifyCalls += 1;
      assert.equal(body.message, 'server-issued-message');
      assert.equal(body.challengeId, 'challenge-1');
      if (options.verify) return options.verify();
      return {
        user: { id: '6f1c0c2e-1111-4111-8111-111111111111', email: null },
        accessToken: 'access',
        refreshToken: 'refresh',
      };
    },
    onPhase: (phase) => phases.push(phase),
  });
  return { result, phases, counts: () => ({ verifyCalls, challengeCalls, signCalls }) };
}

test('connection alone is not authentication', async () => {
  const { result, phases, counts } = harness({
    sign: async () => {
      throw Object.assign(new Error('User rejected the request'), { code: 4001 });
    },
  });
  const outcome = await result;
  assert.equal(outcome.ok, false);
  if (!outcome.ok && !outcome.restart) assert.equal(outcome.code, 'USER_REJECTED');
  assert.equal(counts().verifyCalls, 0);
  assert.deepEqual(phases.includes('connected'), true);
  assert.equal(phases.includes('authenticated'), false);
});

test('a valid server message verifies and keeps the server user id', async () => {
  const { result, phases, counts } = harness({});
  const outcome = await result;
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.user.id, '6f1c0c2e-1111-4111-8111-111111111111');
    assert.equal(outcome.user.email, null);
    assert.notEqual(outcome.user.id, evm.address);
  }
  assert.equal(counts().verifyCalls, 1);
  assert.equal(phases.at(-1), 'authenticated');
});

test('wallet address is rejected as the application user id', async () => {
  const { result, counts } = harness({
    verify: async () => ({
      user: { id: evm.address, email: null },
      accessToken: 'access',
      refreshToken: 'refresh',
    }),
  });
  const outcome = await result;
  assert.equal(outcome.ok, false);
  assert.equal(counts().verifyCalls, 1);
});

test('account change does not submit the old challenge', async () => {
  const { result, counts } = harness({
    nextAccount: { ...evm, address: '0x2222222222222222222222222222222222222222' },
  });
  const outcome = await result;
  assert.deepEqual(outcome, { ok: false, restart: true, reason: 'account' });
  assert.equal(counts().signCalls, 0);
  assert.equal(counts().verifyCalls, 0);
});

test('chain change does not reuse the previous challenge', async () => {
  const { result, counts } = harness({
    nextAccount: { ...evm, chainReference: '137' },
  });
  const outcome = await result;
  assert.deepEqual(outcome, { ok: false, restart: true, reason: 'chain' });
  assert.equal(counts().verifyCalls, 0);
});

test('disconnect, expiry, bad signature, and replay stay unauthenticated', async () => {
  const disconnected = await harness({ emit: (notify) => notify('disconnect') }).result;
  assert.deepEqual(disconnected, { ok: false, restart: false, code: 'WALLET_DISCONNECTED' });

  const expired = await harness({
    challenge: async () => {
      throw new WalletApiError(400, 'CHALLENGE_EXPIRED');
    },
  }).result;
  assert.deepEqual(expired, { ok: false, restart: false, code: 'CHALLENGE_EXPIRED' });

  const bad = await harness({
    verify: async () => {
      throw new WalletApiError(400, 'INVALID_SIGNATURE');
    },
  }).result;
  assert.deepEqual(bad, { ok: false, restart: false, code: 'VERIFY_FAILED' });

  const replay = await harness({
    verify: async () => {
      throw new WalletApiError(400, 'CHALLENGE_UNAVAILABLE');
    },
  }).result;
  assert.deepEqual(replay, { ok: false, restart: false, code: 'CHALLENGE_USED' });
});

test('each attempt requests a fresh challenge', async () => {
  const ids: string[] = [];
  const run = () => runWalletAuthentication({
    connect: async () => evm,
    getAccount: async () => evm,
    signMessage: async () => '0xsig',
    watch: () => () => {},
    requestChallenge: async () => {
      const id = `c-${ids.length + 1}`;
      ids.push(id);
      return { id, message: `message-${id}` };
    },
    verify: async (body) => {
      assert.equal(body.challengeId, ids.at(-1));
      assert.equal(body.message, `message-${body.challengeId}`);
      if (ids.length === 1) throw new WalletApiError(400, 'CHALLENGE_EXPIRED');
      return {
        user: { id: '6f1c0c2e-1111-4111-8111-111111111111', email: null },
        accessToken: 'access',
        refreshToken: 'refresh',
      };
    },
  });
  const first = await run();
  assert.equal(first.ok, false);
  const second = await run();
  assert.equal(second.ok, true);
  assert.deepEqual(ids, ['c-1', 'c-2']);
});

test('challenge and login clients send only the accepted fields', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    const url = String(input);
    if (url.endsWith('/api/v1/auth/wallet/challenge')) {
      return new Response(JSON.stringify({
        success: true,
        challenge: {
          id: 'c-1',
          message: 'exact-message',
          namespace: 'eip155',
          chainReference: '1',
          address: evm.address,
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: { id: '6f1c0c2e-1111-4111-8111-111111111111', email: null },
        accessToken: 'access',
        refreshToken: 'refresh',
      },
    }), { status: 200 });
  }) as typeof fetch;
  try {
    const challenge = await walletChallenge(`eip155:1:${evm.address}`);
    assert.equal(challenge.message, 'exact-message');
    assert.deepEqual(Object.keys(calls[0]?.body ?? {}).sort(), ['caip10']);
    const session = await walletVerify({ challengeId: 'c-1', message: 'exact-message', signature: '0xsig' });
    assert.equal(session.user.id, '6f1c0c2e-1111-4111-8111-111111111111');
    assert.equal(calls[1]?.url.endsWith('/api/v1/auth/wallet/login'), true);
    assert.equal(calls.some((call) => call.url.includes('/wallet/verify')), false);
    assert.deepEqual(Object.keys(calls[1]?.body ?? {}).sort(), ['challengeId', 'message', 'signature']);
  } finally {
    globalThis.fetch = original;
  }
});

void Promise.all(pending).then(() => {
  if (process.exitCode) process.exit(process.exitCode);
});
