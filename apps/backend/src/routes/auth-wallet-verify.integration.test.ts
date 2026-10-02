/**
 * Wallet signature verification against an isolated database.
 * Refuses database name `exchange` or `postgres`, and refuses Redis on port 6379.
 */
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ed25519 } from '@noble/curves/ed25519';
import { Wallet } from 'ethers';
import { Pool, type PoolClient } from 'pg';

const testUrl = process.env.WALLET_VERIFY_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.WALLET_VERIFY_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('WALLET_VERIFY_TEST_DATABASE_URL and WALLET_VERIFY_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run wallet verify tests against a non-isolated database');
  process.exit(1);
}
const redisUrl = new URL(redisUrlRaw);
if (redisUrl.port === '6379' || (redisUrl.hostname !== '127.0.0.1' && redisUrl.hostname !== 'localhost')) {
  console.error('Refusing to use a non-local test Redis');
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.EXCHANGE_PRESERVE_SHELL_DATABASE_URL = '1';
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
process.env.RATE_LIMIT_FAIL_CLOSED = 'false';
process.env.FRONTEND_URL = 'http://wallet-auth.test:3000';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? 'test-csrf-secret-must-be-32-chars-min';
process.env.REDIS_URL = redisUrlRaw;

const FRONTEND = 'http://wallet-auth.test:3000';

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID
);
CREATE TABLE IF NOT EXISTS user_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID
);
CREATE TABLE IF NOT EXISTS forex_accounts (
  account_id VARCHAR PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL
);
CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nonce TEXT NOT NULL,
  namespace VARCHAR(16) NOT NULL,
  chain_reference TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  domain TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wallet_auth_challenges_namespace_check CHECK (namespace IN ('eip155', 'solana')),
  CONSTRAINT wallet_auth_challenges_nonce_nonempty CHECK (length(btrim(nonce)) > 0),
  CONSTRAINT wallet_auth_challenges_chain_reference_nonempty CHECK (length(btrim(chain_reference)) > 0),
  CONSTRAINT wallet_auth_challenges_address_nonempty CHECK (length(btrim(normalized_address)) > 0),
  CONSTRAINT wallet_auth_challenges_domain_nonempty CHECK (length(btrim(domain)) > 0),
  CONSTRAINT wallet_auth_challenges_message_nonempty CHECK (length(btrim(message)) > 0),
  CONSTRAINT wallet_auth_challenges_nonce_key UNIQUE (nonce)
);
`;

type SideCounts = {
  users: number;
  user_wallets: number;
  user_sessions: number;
  user_balances: number;
  forex_accounts: number;
  challenges: number;
};

function signSolana(message: string, secret: Uint8Array): string {
  return bs58.encode(ed25519.sign(new TextEncoder().encode(message), secret));
}

async function run(): Promise<void> {
  const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
  const { buildAuthMessage } = await import('../services/wallet-auth-challenge.service.js');
  const {
    verifyWalletAuthChallenge,
    WalletVerifyError,
    WALLET_AUTH_EIP1271_ENABLED,
  } = await import('../services/wallet-auth-verify.service.js');
  const { default: Fastify } = await import('fastify');
  const { default: walletVerifyRoutes } = await import('./auth-wallet-verify.fastify.js');
  const Redis = (await import('ioredis')).default;

  assert.equal(WALLET_AUTH_EIP1271_ENABLED, false);

  const pool = new Pool({ connectionString: testUrl, max: 4 });
  await pool.query(SCHEMA_SQL);
  await pool.query(`INSERT INTO users (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING`);
  await pool.query('DELETE FROM wallet_auth_challenges');

  async function transaction<T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: never[] }>) => Promise<T>): Promise<T> {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn((sql, params) => client.query(sql, params));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function counts(): Promise<SideCounts> {
    const result = await pool.query<SideCounts>(`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM user_wallets) AS user_wallets,
        (SELECT count(*)::int FROM user_sessions) AS user_sessions,
        (SELECT count(*)::int FROM user_balances) AS user_balances,
        (SELECT count(*)::int FROM forex_accounts) AS forex_accounts,
        (SELECT count(*)::int FROM wallet_auth_challenges) AS challenges
    `);
    return result.rows[0]!;
  }

  async function consumedAt(id: string): Promise<Date | null> {
    const result = await pool.query(`SELECT consumed_at FROM wallet_auth_challenges WHERE id = $1`, [id]);
    return result.rows[0]?.consumed_at ?? null;
  }

  async function issueEvm(wallet: Wallet, chain = '1') {
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:${chain}:${wallet.address}`,
      frontendUrl: FRONTEND,
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = await wallet.signMessage(challenge.message);
    return { challenge, signature, wallet };
  }

  async function issueSolana(chain = 'mainnet') {
    const key = Keypair.generate();
    const address = key.publicKey.toBase58();
    const challenge = await createWalletAuthChallenge({
      caip10: `solana:${chain}:${address}`,
      frontendUrl: FRONTEND,
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = signSolana(challenge.message, key.secretKey.slice(0, 32));
    return { challenge, signature, address, key };
  }

  async function verify(args: {
    challengeId: string;
    message: string;
    signature: string;
    frontendUrl?: string;
    now?: Date;
  }) {
    return verifyWalletAuthChallenge({
      challengeId: args.challengeId,
      message: args.message,
      signature: args.signature,
      frontendUrl: args.frontendUrl ?? FRONTEND,
      now: args.now,
      transaction,
    });
  }

  async function expectCode(args: Parameters<typeof verify>[0], code: string): Promise<void> {
    await assert.rejects(() => verify(args), (err: unknown) => err instanceof WalletVerifyError && err.code === code);
  }

  const before = await counts();
  const evmWallet = Wallet.createRandom();
  assert.notEqual(evmWallet.address, evmWallet.address.toLowerCase());
  const evm = await issueEvm(evmWallet);

  const ok = await verify({
    challengeId: evm.challenge.id,
    message: evm.challenge.message,
    signature: evm.signature,
  });
  assert.equal(ok.verified, true);
  assert.equal(ok.wallet.namespace, 'eip155');
  assert.equal(ok.wallet.address, evmWallet.address);
  assert.equal(ok.wallet.chainReference, '1');
  assert.equal(ok.wallet.caip10, `eip155:1:${evmWallet.address}`);
  assert.equal(ok.challengeId, evm.challenge.id);
  assert.ok(await consumedAt(evm.challenge.id));
  await expectCode({
    challengeId: evm.challenge.id,
    message: evm.challenge.message,
    signature: evm.signature,
  }, 'CHALLENGE_UNAVAILABLE');

  const whitespace = await issueEvm(evmWallet);
  await expectCode({
    challengeId: whitespace.challenge.id,
    message: `${whitespace.challenge.message} `,
    signature: whitespace.signature,
  }, 'INVALID_CHALLENGE');
  assert.equal(await consumedAt(whitespace.challenge.id), null);

  const domain = await issueEvm(evmWallet);
  await expectCode({
    challengeId: domain.challenge.id,
    message: domain.challenge.message.replace('wallet-auth.test:3000', 'attacker.example'),
    signature: domain.signature,
  }, 'INVALID_CHALLENGE');

  const uri = await issueEvm(evmWallet);
  await expectCode({
    challengeId: uri.challenge.id,
    message: uri.challenge.message.replace('URI: http://wallet-auth.test:3000', 'URI: http://attacker.example'),
    signature: uri.signature,
  }, 'INVALID_CHALLENGE');

  const nonce = await issueEvm(evmWallet);
  await expectCode({
    challengeId: nonce.challenge.id,
    message: nonce.challenge.message.replace(nonce.challenge.nonce, 'f'.repeat(32)),
    signature: nonce.signature,
  }, 'INVALID_CHALLENGE');

  const chain = await issueEvm(evmWallet);
  await expectCode({
    challengeId: chain.challenge.id,
    message: chain.challenge.message.replace('Chain ID: 1', 'Chain ID: 5'),
    signature: chain.signature,
  }, 'INVALID_CHALLENGE');

  const otherWallet = Wallet.createRandom();
  const wrongSigner = await issueEvm(evmWallet);
  const wrongSig = await otherWallet.signMessage(wrongSigner.challenge.message);
  await expectCode({
    challengeId: wrongSigner.challenge.id,
    message: wrongSigner.challenge.message,
    signature: wrongSig,
  }, 'INVALID_SIGNATURE');
  assert.equal(await consumedAt(wrongSigner.challenge.id), null);
  const recovered = await verify({
    challengeId: wrongSigner.challenge.id,
    message: wrongSigner.challenge.message,
    signature: wrongSigner.signature,
  });
  assert.equal(recovered.verified, true);

  const expired = await issueEvm(evmWallet);
  await pool.query(`UPDATE wallet_auth_challenges SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [expired.challenge.id]);
  await expectCode({
    challengeId: expired.challenge.id,
    message: expired.challenge.message,
    signature: expired.signature,
  }, 'CHALLENGE_EXPIRED');
  assert.equal(await consumedAt(expired.challenge.id), null);

  const future = await createWalletAuthChallenge({
    caip10: `eip155:1:${evmWallet.address}`,
    frontendUrl: FRONTEND,
    now: new Date(Date.now() + 5 * 60 * 1000),
    query: (sql, params) => pool.query(sql, params),
  });
  await expectCode({
    challengeId: future.id,
    message: future.message,
    signature: await evmWallet.signMessage(future.message),
  }, 'INVALID_CHALLENGE');
  assert.equal(await consumedAt(future.id), null);

  const issuedOld = new Date(Date.now() - 30 * 60 * 1000);
  const expiresSoon = new Date(Date.now() + 5 * 60 * 1000);
  const oldMessage = buildAuthMessage({
    namespace: 'eip155',
    domain: 'wallet-auth.test:3000',
    address: evmWallet.address,
    uri: 'http://wallet-auth.test:3000',
    chainReference: '1',
    nonce: '1'.repeat(32),
    issuedAt: issuedOld.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    expirationTime: expiresSoon.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  const oldRow = await pool.query(
    `INSERT INTO wallet_auth_challenges
      (nonce, namespace, chain_reference, normalized_address, domain, message, expires_at)
     VALUES ($1, 'eip155', '1', $2, 'wallet-auth.test:3000', $3, $4)
     RETURNING id`,
    ['1'.repeat(32), evmWallet.address.toLowerCase(), oldMessage, expiresSoon]
  );
  await expectCode({
    challengeId: oldRow.rows[0].id,
    message: oldMessage,
    signature: await evmWallet.signMessage(oldMessage),
  }, 'INVALID_CHALLENGE');

  const first = await issueEvm(evmWallet);
  const second = await issueEvm(evmWallet);
  await expectCode({
    challengeId: second.challenge.id,
    message: first.challenge.message,
    signature: first.signature,
  }, 'INVALID_CHALLENGE');
  assert.equal(await consumedAt(first.challenge.id), null);

  const chainOther = await issueEvm(evmWallet, '137');
  await expectCode({
    challengeId: chainOther.challenge.id,
    message: first.challenge.message,
    signature: first.signature,
  }, 'INVALID_CHALLENGE');

  const randomSig = `0x${'ab'.repeat(65)}`;
  const forged = await issueEvm(evmWallet);
  await expectCode({
    challengeId: forged.challenge.id,
    message: forged.challenge.message,
    signature: randomSig,
  }, 'INVALID_SIGNATURE');
  await expectCode({
    challengeId: forged.challenge.id,
    message: 'not a challenge',
    signature: forged.signature,
  }, 'INVALID_CHALLENGE');
  await expectCode({
    challengeId: '11111111-1111-4111-8111-111111111111',
    message: forged.challenge.message,
    signature: forged.signature,
  }, 'INVALID_CHALLENGE');

  const sol = await issueSolana();
  const solOk = await verify({
    challengeId: sol.challenge.id,
    message: sol.challenge.message,
    signature: sol.signature,
  });
  assert.equal(solOk.wallet.namespace, 'solana');
  assert.equal(solOk.wallet.address, sol.address);
  assert.equal(solOk.wallet.caip10, `solana:mainnet:${sol.address}`);
  assert.equal(await pool.query(`SELECT normalized_address FROM wallet_auth_challenges WHERE id = $1`, [sol.challenge.id]).then((r) => r.rows[0].normalized_address), sol.address);

  const solAddress = await issueSolana();
  const flipped = solAddress.address.slice(0, -1) + (solAddress.address.endsWith('A') ? 'B' : 'A');
  await expectCode({
    challengeId: solAddress.challenge.id,
    message: solAddress.challenge.message.replace(solAddress.address, flipped),
    signature: solAddress.signature,
  }, 'INVALID_CHALLENGE');

  const solNonce = await issueSolana();
  await expectCode({
    challengeId: solNonce.challenge.id,
    message: solNonce.challenge.message.replace(solNonce.challenge.nonce, '2'.repeat(32)),
    signature: solNonce.signature,
  }, 'INVALID_CHALLENGE');

  const solDomain = await issueSolana();
  await expectCode({
    challengeId: solDomain.challenge.id,
    message: solDomain.challenge.message.replace('wallet-auth.test:3000', 'attacker.example'),
    signature: solDomain.signature,
  }, 'INVALID_CHALLENGE');

  const solExpiry = await issueSolana();
  const solExpiryChanged = solExpiry.challenge.message.replace(
    /Expiration Time: .*/,
    'Expiration Time: 2099-01-01T00:00:00Z'
  );
  await expectCode({
    challengeId: solExpiry.challenge.id,
    message: solExpiryChanged,
    signature: solExpiry.signature,
  }, 'INVALID_CHALLENGE');

  const solSpace = await issueSolana();
  await expectCode({
    challengeId: solSpace.challenge.id,
    message: solSpace.challenge.message.replace('\n\n', '\n \n'),
    signature: solSpace.signature,
  }, 'INVALID_CHALLENGE');

  const solA = await issueSolana();
  const solB = await issueSolana();
  await expectCode({
    challengeId: solB.challenge.id,
    message: solA.challenge.message,
    signature: solA.signature,
  }, 'INVALID_CHALLENGE');

  const solUsed = await issueSolana();
  await verify({
    challengeId: solUsed.challenge.id,
    message: solUsed.challenge.message,
    signature: solUsed.signature,
  });
  await expectCode({
    challengeId: solUsed.challenge.id,
    message: solUsed.challenge.message,
    signature: solUsed.signature,
  }, 'CHALLENGE_UNAVAILABLE');

  const race = await issueEvm(evmWallet);
  const raced = await Promise.allSettled([
    verify({ challengeId: race.challenge.id, message: race.challenge.message, signature: race.signature }),
    verify({ challengeId: race.challenge.id, message: race.challenge.message, signature: race.signature }),
  ]);
  const wins = raced.filter((item) => item.status === 'fulfilled');
  const losses = raced.filter((item) => item.status === 'rejected');
  assert.equal(wins.length, 1);
  assert.equal(losses.length, 1);
  assert.ok(losses[0]?.status === 'rejected' && losses[0].reason instanceof WalletVerifyError);
  assert.equal(losses[0]?.status === 'rejected' && losses[0].reason.code, 'CHALLENGE_UNAVAILABLE');

  const attackerOrigin = await createWalletAuthChallenge({
    caip10: `eip155:1:${evmWallet.address}`,
    frontendUrl: 'http://attacker.example',
    query: (sql, params) => pool.query(sql, params),
  });
  await expectCode({
    challengeId: attackerOrigin.id,
    message: attackerOrigin.message,
    signature: await evmWallet.signMessage(attackerOrigin.message),
    frontendUrl: FRONTEND,
  }, 'INVALID_CHALLENGE');

  const after = await counts();
  assert.equal(after.users, before.users);
  assert.equal(after.user_wallets, 0);
  assert.equal(after.user_sessions, 0);
  assert.equal(after.user_balances, 0);
  assert.equal(after.forex_accounts, 0);
  assert.equal(before.users, 1);
  assert.ok(after.challenges > before.challenges);

  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    const err = error as { message?: string; statusCode?: number; code?: string; validation?: unknown };
    const statusCode = err.statusCode || 500;
    if (err.code === 'FST_ERR_VALIDATION' || (statusCode === 400 && err.validation)) {
      reply.status(400).send({
        success: false,
        error: { code: 'FST_ERR_VALIDATION', message: err.message || 'Validation failed' },
      });
      return;
    }
    reply.status(statusCode).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
  await app.register(walletVerifyRoutes, { prefix: '/api/v1/auth' });
  await app.ready();

  const redis = new Redis(redisUrlRaw, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
  await redis.ping();
  await redis.flushall();

  const httpWallet = Wallet.createRandom();
  const httpChallenge = await issueEvm(httpWallet);
  const httpRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/verify',
    payload: {
      challengeId: httpChallenge.challenge.id,
      message: httpChallenge.challenge.message,
      signature: httpChallenge.signature,
    },
  });
  assert.equal(httpRes.statusCode, 200, httpRes.body);
  const httpBody = httpRes.json() as {
    success: boolean;
    verified: boolean;
    wallet: { address: string; namespace: string };
    challengeId: string;
    role?: string;
    token?: string;
  };
  assert.equal(httpBody.success, true);
  assert.equal(httpBody.verified, true);
  assert.equal(httpBody.wallet.address, httpWallet.address);
  assert.equal(httpBody.role, undefined);
  assert.equal(httpBody.token, undefined);
  assert.equal(httpRes.headers['set-cookie'], undefined);
  assert.equal(httpBody.challengeId, httpChallenge.challenge.id);

  const replay = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/verify',
    payload: {
      challengeId: httpChallenge.challenge.id,
      message: httpChallenge.challenge.message,
      signature: httpChallenge.signature,
    },
  });
  assert.equal(replay.statusCode, 400);
  assert.equal(replay.json().error.code, 'CHALLENGE_UNAVAILABLE');

  const missing = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/verify',
    payload: { challengeId: httpChallenge.challenge.id, message: httpChallenge.challenge.message },
  });
  assert.equal(missing.statusCode, 400);

  const extra = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/verify',
    payload: {
      challengeId: httpChallenge.challenge.id,
      message: httpChallenge.challenge.message,
      signature: httpChallenge.signature,
      user_id: '00000000-0000-0000-0000-000000000099',
    },
  });
  assert.equal(extra.statusCode, 400);
  assert.equal(extra.json().error.code, 'INVALID_CHALLENGE');
  assert.ok(!extra.body.includes('00000000-0000-0000-0000-000000000099'));

  await redis.flushall();
  const burst = await issueEvm(httpWallet);
  let limitedStatus = 0;
  for (let i = 0; i < 11; i++) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/verify',
      payload: {
        challengeId: burst.challenge.id,
        message: burst.challenge.message,
        signature: `0x${'cd'.repeat(65)}`,
      },
    });
    limitedStatus = res.statusCode;
  }
  assert.equal(limitedStatus, 429);
  assert.equal(await consumedAt(burst.challenge.id), null);
  await redis.flushall();
  const afterBurst = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/verify',
    payload: {
      challengeId: burst.challenge.id,
      message: burst.challenge.message,
      signature: burst.signature,
    },
  });
  assert.equal(afterBurst.statusCode, 200, afterBurst.body);

  const finalCounts = await counts();
  assert.equal(finalCounts.users, 1);
  assert.equal(finalCounts.user_wallets, 0);
  assert.equal(finalCounts.user_sessions, 0);
  assert.equal(finalCounts.user_balances, 0);
  assert.equal(finalCounts.forex_accounts, 0);

  console.log(JSON.stringify({
    database: databaseName,
    users: finalCounts.users,
    user_wallets: finalCounts.user_wallets,
    user_sessions: finalCounts.user_sessions,
    challenges: finalCounts.challenges,
    evmAddress: evmWallet.address,
    solanaAddress: sol.address,
  }));
  console.log('PASS: wallet signature integration tests');

  await redis.quit();
  await app.close();
  await pool.end();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
