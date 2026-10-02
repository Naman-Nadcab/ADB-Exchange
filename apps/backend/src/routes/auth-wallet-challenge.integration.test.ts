/**
 * Wallet challenge HTTP and database tests.
 * Refuses to run unless WALLET_CHALLENGE_TEST_DATABASE_URL names an isolated
 * database (not `exchange`). Does not migrate or write the production database.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Client } from 'pg';

const testUrl = process.env.WALLET_CHALLENGE_TEST_DATABASE_URL?.trim() ?? '';
if (!testUrl) {
  console.error('WALLET_CHALLENGE_TEST_DATABASE_URL is required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run wallet challenge tests against a non-isolated database');
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
process.env.REDIS_URL = process.env.WALLET_CHALLENGE_TEST_REDIS_URL ?? 'redis://127.0.0.1:1';

const EVM = 'eip155:1:0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
const EVM_NORMALIZED = '0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb';
const SOL = 'solana:mainnet:So11111111111111111111111111111111111111112';
const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';

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

async function counts(client: Client): Promise<SideCounts> {
  const result = await client.query<SideCounts>(`
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

type ChallengeBody = {
  success: boolean;
  challenge: {
    id: string;
    namespace: string;
    chainReference: string;
    address: string;
    message: string;
    nonce: string;
    expiresAt: string;
  };
};

async function run(): Promise<void> {
  const { default: Fastify } = await import('fastify');
  const { default: walletChallengeRoutes } = await import('./auth-wallet-challenge.fastify.js');
  const { normalizeRateLimitIdentifier } = await import('../lib/rate-limit-fastify.js');
  const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');

  assert.equal(normalizeRateLimitIdentifier('So11111111111111111111111111111111111111112', true), SOL_ADDRESS);
  assert.equal(normalizeRateLimitIdentifier('  User@Example.com  ', false), 'user@example.com');

  const client = new Client({ connectionString: testUrl });
  await client.connect();
  await client.query(SCHEMA_SQL);
  await client.query(`INSERT INTO users (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING`);
  await client.query('DELETE FROM wallet_auth_challenges');

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
      error: { code: 'INTERNAL_ERROR', message: statusCode === 500 ? 'Internal server error' : (err.message || 'Error') },
    });
  });
  await app.register(walletChallengeRoutes, { prefix: '/api/v1/auth' });
  await app.ready();

  const before = await counts(client);

  const firstRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: EVM },
  });
  assert.equal(firstRes.statusCode, 200, firstRes.body);
  const first = firstRes.json() as ChallengeBody;
  assert.equal(first.success, true);
  assert.equal(first.challenge.namespace, 'eip155');
  assert.equal(first.challenge.chainReference, '1');
  assert.equal(first.challenge.address, '0xAb16A96D359eC26a11e2C2b3d8f8B8942d5Bfcdb');
  assert.equal(Object.hasOwn(first.challenge, 'user_id'), false);
  assert.equal(firstRes.headers['set-cookie'], undefined);

  const firstRow = await client.query(
    `SELECT id, nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id
     FROM wallet_auth_challenges WHERE id = $1`,
    [first.challenge.id]
  );
  assert.equal(firstRow.rowCount, 1);
  const stored = firstRow.rows[0];
  assert.equal(stored.message, first.challenge.message);
  assert.equal(stored.nonce, first.challenge.nonce);
  assert.equal(stored.user_id, null);
  assert.equal(stored.consumed_at, null);
  assert.equal(stored.normalized_address, EVM_NORMALIZED);
  assert.equal(stored.domain, 'wallet-auth.test:3000');
  assert.equal(stored.namespace, 'eip155');
  assert.equal(stored.chain_reference, '1');
  assert.ok(stored.message.includes('THIS SIGNATURE IS FOR AUTHENTICATION ONLY'));
  assert.ok(stored.message.includes('does not authorize a transaction, payment, token transfer, withdrawal, approval, or spending.'));
  assert.equal(stored.message.split('\n')[1], first.challenge.address);
  assert.ok(stored.message.includes('Chain ID: 1\n'));
  assert.ok(stored.message.includes(`Nonce: ${first.challenge.nonce}\n`));
  assert.ok(stored.message.includes(`Expiration Time: ${first.challenge.expiresAt}`));
  assert.ok(!stored.message.includes('\r'));
  const expiresAt = new Date(stored.expires_at as Date);
  const issuedMatch = String(stored.message).match(/Issued At: ([^\n]+)/);
  assert.ok(issuedMatch);
  const issued = new Date(issuedMatch[1]!);
  assert.equal(expiresAt.getTime() - issued.getTime(), 10 * 60 * 1000);
  assert.ok(Math.abs(issued.getTime() - Date.now()) < 15_000);
  const messageHash = createHash('sha256').update(stored.message).digest('hex');
  assert.equal(messageHash, createHash('sha256').update(first.challenge.message).digest('hex'));

  const secondRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: EVM },
  });
  assert.equal(secondRes.statusCode, 200, secondRes.body);
  const second = secondRes.json() as ChallengeBody;
  assert.notEqual(second.challenge.id, first.challenge.id);
  assert.notEqual(second.challenge.nonce, first.challenge.nonce);
  assert.notEqual(second.challenge.message, first.challenge.message);
  const both = await client.query(
    `SELECT id, nonce, message, user_id, consumed_at FROM wallet_auth_challenges WHERE id = ANY($1::uuid[])`,
    [[first.challenge.id, second.challenge.id]]
  );
  assert.equal(both.rowCount, 2);
  const old = both.rows.find((row) => row.id === first.challenge.id);
  assert.equal(old.nonce, first.challenge.nonce);
  assert.equal(old.message, first.challenge.message);
  assert.equal(old.user_id, null);
  assert.equal(old.consumed_at, null);

  const solRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: SOL },
  });
  assert.equal(solRes.statusCode, 200, solRes.body);
  const solBody = solRes.json() as ChallengeBody;
  assert.equal(solBody.challenge.namespace, 'solana');
  assert.equal(solBody.challenge.address, SOL_ADDRESS);
  assert.equal(solBody.challenge.chainReference, 'mainnet');
  const solRow = await client.query(
    `SELECT normalized_address, message, user_id, consumed_at, domain FROM wallet_auth_challenges WHERE id = $1`,
    [solBody.challenge.id]
  );
  assert.equal(solRow.rows[0].normalized_address, SOL_ADDRESS);
  assert.equal(solRow.rows[0].message, solBody.challenge.message);
  assert.equal(solRow.rows[0].message.split('\n')[1], SOL_ADDRESS);
  assert.ok(solRow.rows[0].message.includes('Chain ID: solana:mainnet\n'));
  assert.equal(solRow.rows[0].user_id, null);
  assert.equal(solRow.rows[0].consumed_at, null);
  assert.equal(solRow.rows[0].domain, 'wallet-auth.test:3000');

  async function expectNoWrite(payload: unknown, status: number): Promise<{ statusCode: number; body: string; json: () => { error: { code: string } } }> {
    const beforeWrite = await counts(client);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/challenge',
      payload: payload as Record<string, unknown>,
    });
    assert.equal(res.statusCode, status, res.body);
    const afterWrite = await counts(client);
    assert.equal(afterWrite.challenges, beforeWrite.challenges);
    assert.equal(afterWrite.users, beforeWrite.users);
    return res;
  }

  const unsupported = await expectNoWrite({ caip10: 'bip122:000000000019d6689c085ae165831e93:addr' }, 400);
  assert.equal(unsupported.json().error.code, 'UNSUPPORTED_WALLET');

  await expectNoWrite({ caip10: 'not-a-caip' }, 400);
  const malformed = await expectNoWrite({ caip10: 'eip155:1' }, 400);
  assert.equal(malformed.json().error.code, 'INVALID_ACCOUNT');

  const beforeDomain = (await counts(client)).challenges;
  const domainRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: EVM, domain: 'attacker-site.com' },
  });
  assert.equal(domainRes.statusCode, 400, domainRes.body);
  assert.equal(domainRes.json().error.code, 'INVALID_ACCOUNT');
  assert.ok(!domainRes.body.includes('attacker-site.com'));
  assert.equal((await counts(client)).challenges, beforeDomain);

  const nonceRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: EVM, nonce: 'clientnonce12' },
  });
  assert.equal(nonceRes.statusCode, 400);
  assert.equal(nonceRes.json().error.code, 'INVALID_ACCOUNT');
  assert.ok(!nonceRes.body.includes('clientnonce12'));

  const expRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: EVM, expiration: '2099-01-01T00:00:00Z' },
  });
  assert.equal(expRes.statusCode, 400);
  assert.equal(expRes.json().error.code, 'INVALID_ACCOUNT');
  assert.ok(!expRes.body.includes('2099-01-01'));
  assert.equal((await counts(client)).challenges, beforeDomain);

  await expectNoWrite({}, 400);
  const missing = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: {},
  });
  assert.equal(missing.json().error.code, 'FST_ERR_VALIDATION');

  const colliding = 'c'.repeat(32);
  const fresh = 'd'.repeat(32);
  await client.query(
    `INSERT INTO wallet_auth_challenges
      (nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id)
     VALUES ($1, 'eip155', '1', $2, 'old.example', 'OLD MESSAGE', NOW() + INTERVAL '10 minutes', NULL, NULL)`,
    [colliding, EVM_NORMALIZED]
  );
  let issuedNonce = 0;
  const collided = await createWalletAuthChallenge({
    caip10: EVM,
    frontendUrl: 'http://wallet-auth.test:3000',
    generateNonce: () => (issuedNonce++ === 0 ? colliding : fresh),
    query: (sql, params) => client.query(sql, params as unknown[]),
  });
  assert.equal(collided.nonce, fresh);
  assert.ok(!collided.message.includes(colliding));
  const oldCollision = await client.query(
    `SELECT message, domain FROM wallet_auth_challenges WHERE nonce = $1`,
    [colliding]
  );
  assert.equal(oldCollision.rows[0].message, 'OLD MESSAGE');
  assert.equal(oldCollision.rows[0].domain, 'old.example');
  const freshRow = await client.query(
    `SELECT message, user_id, consumed_at FROM wallet_auth_challenges WHERE nonce = $1`,
    [fresh]
  );
  assert.equal(freshRow.rows[0].message, collided.message);
  assert.equal(freshRow.rows[0].user_id, null);
  assert.equal(freshRow.rows[0].consumed_at, null);

  const beforeLimit = await counts(client);
  for (let i = 0; i < 3; i++) {
    const allowed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/challenge',
      payload: { caip10: EVM },
    });
    assert.equal(allowed.statusCode, 200, allowed.body);
  }
  const limited = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/challenge',
    payload: { caip10: EVM },
  });
  assert.equal(limited.statusCode, 429, limited.body);
  assert.equal(limited.json().error.code, 'RATE_LIMIT_EXCEEDED');
  const afterLimit = await counts(client);
  assert.equal(afterLimit.challenges, beforeLimit.challenges + 3);

  const after = await counts(client);
  assert.equal(after.users, before.users);
  assert.equal(after.user_wallets, before.user_wallets);
  assert.equal(after.user_sessions, before.user_sessions);
  assert.equal(after.user_balances, before.user_balances);
  assert.equal(after.forex_accounts, before.forex_accounts);
  assert.equal(before.users, 1);
  assert.equal(before.user_wallets, 0);
  assert.ok(after.challenges > before.challenges);

  console.log(JSON.stringify({
    database: databaseName,
    messageHash,
    domain: stored.domain,
    evmNonce: first.challenge.nonce,
    solanaAddress: solBody.challenge.address,
    challenges: after.challenges,
    users: after.users,
    user_wallets: after.user_wallets,
    user_sessions: after.user_sessions,
    user_balances: after.user_balances,
    forex_accounts: after.forex_accounts,
  }));
  console.log('PASS: wallet challenge integration tests');

  await app.close();
  await client.end();
}

run()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
