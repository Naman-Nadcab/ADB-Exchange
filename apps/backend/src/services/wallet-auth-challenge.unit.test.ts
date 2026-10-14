/**
 * Wallet challenge unit tests. No database, no config, no Redis.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CaipParseError, parseCaip10 } from '../lib/caip10.js';
import {
  AUTH_ONLY_STATEMENT,
  CHALLENGE_TTL_MS,
  authOriginFromFrontendUrl,
  resolveWalletFrontendUrl,
  buildAuthMessage,
  createWalletAuthChallenge,
  generateWalletAuthNonce,
  type WalletAuthChallengeRow,
} from './wallet-auth-challenge.service.js';

const EVM = 'eip155:1:0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
const SOL = 'solana:mainnet:So11111111111111111111111111111111111111112';
const FRONTEND = 'http://wallet-auth.test:3000';

function rowFromParams(params: readonly unknown[]): WalletAuthChallengeRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nonce: String(params[0]),
    namespace: String(params[1]),
    chain_reference: String(params[2]),
    normalized_address: String(params[3]),
    domain: String(params[4]),
    message: String(params[5]),
    expires_at: params[6] as Date,
    consumed_at: null,
    user_id: null,
  };
}

async function run(): Promise<void> {
  const evm = parseCaip10(EVM);
  assert.equal(evm.namespace, 'eip155');
  assert.equal(evm.chainReference, '1');
  assert.equal(evm.address, '0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb');
  assert.equal(evm.normalizedAddress, '0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb');
  assert.notEqual(evm.address, evm.normalizedAddress);

  const sol = parseCaip10(SOL);
  assert.equal(sol.namespace, 'solana');
  assert.equal(sol.chainReference, 'mainnet');
  assert.equal(sol.address, 'So11111111111111111111111111111111111111112');
  assert.equal(sol.normalizedAddress, sol.address);

  const lowerSol = parseCaip10('solana:mainnet:so11111111111111111111111111111111111111112');
  assert.equal(lowerSol.address, 'so11111111111111111111111111111111111111112');
  assert.equal(lowerSol.normalizedAddress, lowerSol.address);
  assert.notEqual(lowerSol.address, sol.address);
  assert.throws(() => parseCaip10('solana:mainnet:So1111111111111111111111111111111111111111O'), CaipParseError);
  assert.throws(() => parseCaip10('bip122:000000000019d6689c085ae165831e93:addr'), (err: unknown) => {
    return err instanceof CaipParseError && err.code === 'UNSUPPORTED_NAMESPACE';
  });
  assert.throws(() => parseCaip10('EIP155:1:0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb'), (err: unknown) => {
    return err instanceof CaipParseError && err.code === 'UNSUPPORTED_NAMESPACE';
  });
  for (const bad of ['', 'eip155:1', 'not-a-caip', 'eip155::0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb', 'eip155:01:0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb', 'eip155:1:0xzz16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb', 'solana:mainnet:not-an-address']) {
    assert.throws(() => parseCaip10(bad), CaipParseError, bad);
  }

  const origin = authOriginFromFrontendUrl(FRONTEND);
  assert.equal(origin.domain, 'wallet-auth.test:3000');
  assert.equal(origin.uri, 'http://wallet-auth.test:3000');
  assert.throws(() => authOriginFromFrontendUrl('ftp://wallet-auth.test'));
  const alias = 'https://169.58.39.2.sslip.io';
  assert.equal(resolveWalletFrontendUrl(FRONTEND, alias, [alias]), alias);
  assert.equal(resolveWalletFrontendUrl(FRONTEND, 'https://evil.example', [alias]), FRONTEND);
  assert.equal(resolveWalletFrontendUrl(FRONTEND, undefined, [alias]), FRONTEND);

  const issuedAt = '2026-10-02T10:00:00Z';
  const expirationTime = '2026-10-02T10:10:00Z';
  const message = buildAuthMessage({
    namespace: 'eip155',
    domain: origin.domain,
    address: evm.address,
    uri: origin.uri,
    chainReference: '1',
    nonce: 'abc123def456abc123def456abc123de',
    issuedAt,
    expirationTime,
  });
  assert.ok(message.startsWith('wallet-auth.test:3000 wants you to sign in with your Ethereum account:\n'));
  assert.equal(message.split('\n')[1], evm.address);
  assert.ok(message.includes(AUTH_ONLY_STATEMENT));
  assert.ok(message.includes('URI: http://wallet-auth.test:3000\n'));
  assert.ok(message.includes('Version: 1\n'));
  assert.ok(message.includes('Chain ID: 1\n'));
  assert.ok(!message.includes('Chain ID: eip155:'));
  assert.ok(!message.includes('\r'));
  assert.equal(CHALLENGE_TTL_MS, 600_000);

  const solMessage = buildAuthMessage({
    namespace: 'solana',
    domain: origin.domain,
    address: sol.address,
    uri: origin.uri,
    chainReference: 'mainnet',
    nonce: 'abc123def456abc123def456abc123de',
    issuedAt,
    expirationTime,
  });
  assert.ok(solMessage.includes('Solana account:'));
  assert.equal(solMessage.split('\n')[1], sol.address);
  assert.ok(solMessage.includes('Chain ID: solana:mainnet\n'));
  assert.ok(!solMessage.includes(sol.address.toLowerCase()));

  const nonceA = generateWalletAuthNonce();
  const nonceB = generateWalletAuthNonce();
  assert.match(nonceA, /^[0-9a-f]{32}$/);
  assert.notEqual(nonceA, nonceB);

  let calls = 0;
  const inserted: unknown[][] = [];
  const colliding = 'a'.repeat(32);
  const fresh = 'b'.repeat(32);
  const nonces = [colliding, fresh];
  let nonceIndex = 0;
  const challenge = await createWalletAuthChallenge({
    caip10: EVM,
    frontendUrl: FRONTEND,
    now: new Date('2026-10-02T10:00:00.123Z'),
    generateNonce: () => nonces[nonceIndex++] ?? 'c'.repeat(32),
    query: async (_sql, params) => {
      calls += 1;
      if (params[0] === colliding) {
        const err = new Error('duplicate key') as Error & { code: string };
        err.code = '23505';
        throw err;
      }
      inserted.push([...params]);
      return { rows: [rowFromParams(params)] };
    },
  });
  assert.equal(calls, 2);
  assert.equal(inserted.length, 1);
  assert.equal(challenge.nonce, fresh);
  assert.equal(challenge.message, inserted[0]?.[5]);
  assert.ok(challenge.message.includes(`Nonce: ${fresh}`));
  assert.ok(!challenge.message.includes(colliding));
  assert.equal(challenge.expiresAt, '2026-10-02T10:10:00Z');
  assert.ok(challenge.message.includes('Issued At: 2026-10-02T10:00:00Z'));
  assert.ok(challenge.message.includes('Expiration Time: 2026-10-02T10:10:00Z'));
  assert.equal(challenge.address, evm.address);
  assert.equal(inserted[0]?.[3], evm.normalizedAddress);
  assert.equal(inserted[0]?.[4], 'wallet-auth.test:3000');
  assert.equal(inserted[0]?.[7], undefined);
  const hash = createHash('sha256').update(challenge.message).digest('hex');
  assert.equal(hash, createHash('sha256').update(String(inserted[0]?.[5])).digest('hex'));

  let queried = false;
  await assert.rejects(
    () => createWalletAuthChallenge({
      caip10: 'cosmos:cosmoshub-4:cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      frontendUrl: FRONTEND,
      query: async () => {
        queried = true;
        return { rows: [] };
      },
    }),
    (err: unknown) => err instanceof CaipParseError && err.code === 'UNSUPPORTED_NAMESPACE'
  );
  assert.equal(queried, false);

  const serviceSrc = readFileSync(new URL('./wallet-auth-challenge.service.ts', import.meta.url), 'utf8');
  const routeSrc = readFileSync(new URL('../routes/auth-wallet-challenge.fastify.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(serviceSrc, /createSession|user_wallets|user_sessions|forex_accounts|user_balances/);
  assert.match(serviceSrc, /consumed_at, user_id\s*\) VALUES \([\s\S]*NULL, NULL\)/);
  assert.doesNotMatch(routeSrc, /createSession|setCookie|user_wallets/i);
  assert.match(routeSrc, /preserveCase: true/);

  console.log('PASS: wallet challenge unit tests');
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
