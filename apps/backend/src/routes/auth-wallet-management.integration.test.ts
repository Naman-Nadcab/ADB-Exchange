/**
 * STEP 7 wallet management against an isolated database.
 * Refuses database name `exchange` or `postgres`, and refuses Redis on port 6379.
 */
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import bs58 from 'bs58';
import { Wallet } from 'ethers';
import { Pool } from 'pg';

const testUrl = process.env.WALLET_MGMT_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.WALLET_MGMT_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('WALLET_MGMT_TEST_DATABASE_URL and WALLET_MGMT_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run wallet management tests against a non-isolated database');
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

const SCHEMA = `
DROP TABLE IF EXISTS wallet_auth_challenges, user_wallets, user_activity_logs, user_passkeys, user_sessions, user_balances, kyc_applications, spot_orders, p2p_orders, forex_accounts, forex_ledger_transactions, wallets, user_master_keys, hot_wallets, cold_wallets, admin_sessions, admin_users, users CASCADE;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  username TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  tier_level INT NOT NULL DEFAULT 0,
  referral_code TEXT,
  deleted_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  device_type VARCHAR(50) NOT NULL DEFAULT 'web',
  device_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE TABLE user_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  session_id UUID,
  activity_type VARCHAR(80) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  deleted_at TIMESTAMPTZ
);
CREATE TABLE user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  namespace VARCHAR(16) NOT NULL,
  chain_reference TEXT NOT NULL,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  caip10 TEXT NOT NULL,
  wallet_type VARCHAR(16) NOT NULL,
  provider TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_wallets_namespace_check CHECK (namespace IN ('eip155', 'solana')),
  CONSTRAINT user_wallets_status_check CHECK (status IN ('active', 'disabled', 'compromised')),
  CONSTRAINT user_wallets_evm_normalized_lowercase CHECK (
    namespace <> 'eip155' OR normalized_address = lower(normalized_address)
  )
);
CREATE UNIQUE INDEX idx_user_wallets_namespace_normalized_address ON user_wallets (namespace, normalized_address);
CREATE UNIQUE INDEX idx_user_wallets_caip10 ON user_wallets (caip10);
CREATE UNIQUE INDEX idx_user_wallets_one_active_primary ON user_wallets (user_id) WHERE is_primary IS TRUE AND status = 'active';
CREATE TABLE wallet_auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  namespace VARCHAR(16) NOT NULL,
  chain_reference TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  domain TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE wallets (id INT PRIMARY KEY, address TEXT);
CREATE TABLE user_master_keys (id INT PRIMARY KEY, address TEXT);
CREATE TABLE hot_wallets (id INT PRIMARY KEY, address TEXT);
CREATE TABLE cold_wallets (id INT PRIMARY KEY, address TEXT);
CREATE TABLE forex_accounts (id INT PRIMARY KEY, user_id UUID, account_id TEXT, address TEXT);
CREATE TABLE forex_ledger_transactions (id INT PRIMARY KEY, user_id UUID, note TEXT);
CREATE TABLE user_balances (id INT PRIMARY KEY, user_id UUID, asset TEXT, available NUMERIC);
CREATE TABLE kyc_applications (id INT PRIMARY KEY, user_id UUID, status TEXT);
CREATE TABLE spot_orders (id INT PRIMARY KEY, user_id UUID, symbol TEXT);
CREATE TABLE p2p_orders (id INT PRIMARY KEY, user_id UUID, counterparty TEXT);
CREATE TABLE admin_users (id INT PRIMARY KEY, email TEXT);
CREATE TABLE admin_sessions (id INT PRIMARY KEY, admin_id INT);
`;

type WalletView = {
  id: string;
  namespace: string;
  chainReference: string;
  address: string;
  provider: string | null;
  isPrimary: boolean;
  status: string;
  linkedAt: string | null;
};

type ApiBody = {
  success?: boolean;
  challenge?: { id: string; message: string; signing?: string; address?: string };
  data?: { wallets?: WalletView[]; wallet?: WalletView; user?: { id: string }; accessToken?: string };
  error?: { code: string; message: string };
};

function signSolana(message: string, secret: Uint8Array): string {
  return bs58.encode(ed25519.sign(new TextEncoder().encode(message), secret));
}

async function run(): Promise<void> {
  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const jwt = (await import('@fastify/jwt')).default;
  const { config } = await import('../config/index.js');
  const { db } = await import('../lib/database.js');
  const { redis } = await import('../lib/redis.js');
  const { createSession, isSessionValid } = await import('../services/session.service.js');
  const { default: walletManagementRoutes } = await import('./auth-wallet-management.fastify.js');
  const { default: walletLoginRoutes } = await import('./auth-wallet-login.fastify.js');
  const Redis = (await import('ioredis')).default;

  const pool = new Pool({ connectionString: testUrl, max: 8 });
  await pool.query(SCHEMA);
  const rateRedis = new Redis(redisUrlRaw);
  await rateRedis.ping();
  await redis.ping();

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwt, { secret: config.jwt.secret });
  app.decorate('authenticateUser', async function (request, reply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }
      const decoded = app.jwt.verify<{ userId: string; role: string; sessionId: string; type?: string }>(token);
      if (decoded.type === 'admin') {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Use user token for this route' } });
      }
      const valid = await isSessionValid(decoded.sessionId);
      if (!valid) {
        return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
      }
      request.user = { id: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };
    } catch {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }
  });
  await app.register(walletManagementRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });

  async function clearLimits(): Promise<void> {
    const keys = await rateRedis.keys('rate:auth:wallet-*');
    if (keys.length > 0) await rateRedis.del(...keys);
    const loginKeys = await rateRedis.keys('rate:auth:wallet-login:*');
    if (loginKeys.length > 0) await rateRedis.del(...loginKeys);
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query<{ n: number }>(sql, params);
    const raw = result.rows[0]?.n ?? 0;
    return typeof raw === 'number' ? raw : +String(raw);
  }

  const userA = (await pool.query<{ id: string }>(
    `INSERT INTO users (email, role, status) VALUES ('a@wallet-mgmt.test', 'user', 'active') RETURNING id`
  )).rows[0]!.id;
  const userB = (await pool.query<{ id: string }>(
    `INSERT INTO users (email, role, status) VALUES ('b@wallet-mgmt.test', 'user', 'active') RETURNING id`
  )).rows[0]!.id;
  await pool.query(`INSERT INTO user_balances (id, user_id, asset, available) VALUES (1, $1, 'USDT', 100)`, [userA]);
  await pool.query(`INSERT INTO kyc_applications (id, user_id, status) VALUES (1, $1, 'approved')`, [userA]);
  await pool.query(`INSERT INTO spot_orders (id, user_id, symbol) VALUES (1, $1, 'BTCUSDT')`, [userA]);
  await pool.query(`INSERT INTO p2p_orders (id, user_id, counterparty) VALUES (1, $1, 'member-a')`, [userA]);
  await pool.query(`INSERT INTO forex_accounts (id, user_id, account_id, address) VALUES (1, $1, 'FX-1', NULL)`, [userA]);
  await pool.query(`INSERT INTO forex_ledger_transactions (id, user_id, note) VALUES (1, $1, 'opening')`, [userA]);
  await pool.query(`INSERT INTO wallets (id, address) VALUES (1, 'custody-hot')`);
  await pool.query(`INSERT INTO user_master_keys (id, address) VALUES (1, 'master')`);
  await pool.query(`INSERT INTO hot_wallets (id, address) VALUES (1, 'hot')`);
  await pool.query(`INSERT INTO cold_wallets (id, address) VALUES (1, 'cold')`);
  await pool.query(`INSERT INTO admin_users (id, email) VALUES (1, 'admin@wallet-mgmt.test')`);
  await pool.query(`INSERT INTO admin_sessions (id, admin_id) VALUES (1, 1)`);

  async function tokenFor(userId: string): Promise<{ token: string; sessionId: string }> {
    const opened = await createSession({
      userId,
      deviceType: 'web',
      ipAddress: '127.0.0.1',
      ttlSeconds: 3600,
    });
    const token = app.jwt.sign(
      { userId, role: 'user', sessionId: opened.sessionId },
      { expiresIn: '1h' }
    );
    return { token, sessionId: opened.sessionId };
  }

  const sessionA = await tokenFor(userA);
  const sessionB = await tokenFor(userB);
  const usersAtStart = await count('SELECT count(*)::int AS n FROM users');

  async function authed(method: 'GET' | 'POST', url: string, token: string, payload?: unknown) {
    await clearLimits();
    return app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
  }

  async function linkEvm(token: string, wallet: Wallet, chain = '1', provider?: string) {
    const challengeRes = await authed('POST', '/api/v1/auth/wallets/link/challenge', token, {
      caip10: `eip155:${chain}:${wallet.address}`,
      ...(provider ? { provider } : {}),
    });
    const challengeBody = challengeRes.json() as ApiBody;
    assert.equal(challengeRes.statusCode, 200, JSON.stringify(challengeBody));
    const message = challengeBody.challenge!.message;
    const signature = await wallet.signMessage(message);
    const verifyRes = await authed('POST', '/api/v1/auth/wallets/link/verify', token, {
      challengeId: challengeBody.challenge!.id,
      message,
      signature,
    });
    return { challengeBody, verifyRes, body: verifyRes.json() as ApiBody };
  }

  async function stepUp(token: string, walletId: string, action: 'set_primary_wallet' | 'unlink_wallet', wallet: Wallet) {
    const issued = await authed('POST', `/api/v1/auth/wallets/${walletId}/step-up`, token, { action });
    const body = issued.json() as ApiBody;
    assert.equal(issued.statusCode, 200, JSON.stringify(body));
    const message = body.challenge!.message;
    const typed = JSON.parse(message) as {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      message: Record<string, unknown>;
    };
    const signature = await wallet.signTypedData(typed.domain, typed.types, typed.message);
    return { message, signature, challengeId: body.challenge!.id };
  }

  const walletA = Wallet.createRandom();
  const walletB = Wallet.createRandom();
  const walletC = Wallet.createRandom();
  const walletD = Wallet.createRandom();
  const walletE = Wallet.createRandom();
  const walletF = Wallet.createRandom();
  const walletG = Wallet.createRandom();
  const walletH = Wallet.createRandom();
  const sol = Keypair.generate();

  const linkedA = await linkEvm(sessionA.token, walletA, '1', 'MetaMask');
  assert.equal(linkedA.verifyRes.statusCode, 200);
  assert.equal(linkedA.body.data?.wallet?.isPrimary, true);
  assert.equal(linkedA.body.data?.wallet?.provider, 'MetaMask');
  const idA = linkedA.body.data!.wallet!.id;
  console.log('PASS 3a first wallet is primary for the same user');

  const listA = await authed('GET', '/api/v1/auth/wallets', sessionA.token);
  const listABody = listA.json() as ApiBody;
  assert.equal(listA.statusCode, 200);
  assert.equal(listABody.data?.wallets?.length, 1);
  assert.equal(listABody.data?.wallets?.[0]?.address, walletA.address);
  assert.equal((listABody.data?.wallets?.[0] as { userId?: string } | undefined)?.userId, undefined);
  assert.equal(JSON.stringify(listABody).includes('signature'), false);
  console.log('PASS 1 list own wallets');

  const listB = await authed('GET', `/api/v1/auth/wallets?userId=${userA}`, sessionB.token);
  const listBBody = listB.json() as ApiBody;
  assert.equal(listB.statusCode, 200);
  assert.equal(listBBody.data?.wallets?.length, 0);
  console.log('PASS 2 IDOR list returns only the authenticated user');

  const linkedB = await linkEvm(sessionA.token, walletB, '137', 'Trust Wallet');
  assert.equal(linkedB.verifyRes.statusCode, 200);
  assert.equal(linkedB.body.data?.wallet?.isPrimary, false);
  const idB = linkedB.body.data!.wallet!.id;
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersAtStart);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1', [userA]), 2);
  console.log('PASS 3 second wallet linked, same user, not primary');

  const linkedC = await linkEvm(sessionA.token, walletC);
  assert.equal(linkedC.body.data?.wallet?.isPrimary, false);
  const idC = linkedC.body.data!.wallet!.id;
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND is_primary AND status = 'active'`, [userA]), 1);
  console.log('PASS 4 third wallet linked, only the first remains primary');

  const duplicate = await linkEvm(sessionA.token, walletB, '10');
  assert.equal(duplicate.verifyRes.statusCode, 409);
  assert.equal(duplicate.body.error?.code, 'ALREADY_LINKED');
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1', [walletB.address.toLowerCase()]), 1);
  console.log('PASS 5 duplicate link does not create a second credential');

  const cross = await linkEvm(sessionB.token, walletB);
  assert.equal(cross.verifyRes.statusCode, 409);
  assert.equal(cross.body.error?.code, 'WALLET_UNAVAILABLE');
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1', [userB]), 0);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersAtStart);
  console.log('PASS 6 cross-user link rejected without merge');

  const foreignChallenge = await authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, {
    caip10: `eip155:1:${walletE.address}`,
  });
  const foreignBody = foreignChallenge.json() as ApiBody;
  const foreignSig = await walletE.signMessage(foreignBody.challenge!.message);
  const foreignVerify = await authed('POST', '/api/v1/auth/wallets/link/verify', sessionB.token, {
    challengeId: foreignBody.challenge!.id,
    message: foreignBody.challenge!.message,
    signature: foreignSig,
  });
  assert.equal(foreignVerify.statusCode, 400);
  assert.equal((foreignVerify.json() as ApiBody).error?.code, 'CHALLENGE_UNAVAILABLE');
  assert.equal(await count('SELECT count(*)::int AS n FROM wallet_auth_challenges WHERE id = $1 AND consumed_at IS NULL', [foreignBody.challenge!.id]), 1);
  console.log('PASS 7 challenge bound to user A cannot be verified by user B');

  const badChallenge = await authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, {
    caip10: `eip155:1:${walletF.address}`,
  });
  const badBody = badChallenge.json() as ApiBody;
  const badSig = await Wallet.createRandom().signMessage(badBody.challenge!.message);
  const badVerify = await authed('POST', '/api/v1/auth/wallets/link/verify', sessionA.token, {
    challengeId: badBody.challenge!.id,
    message: badBody.challenge!.message,
    signature: badSig,
  });
  assert.equal(badVerify.statusCode, 400);
  assert.equal((badVerify.json() as ApiBody).error?.code, 'INVALID_SIGNATURE');
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1', [walletF.address.toLowerCase()]), 0);
  console.log('PASS 8 invalid signature creates no credential');

  const expiredIssue = await authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, {
    caip10: `eip155:1:${walletF.address}`,
  });
  const expiredBody = expiredIssue.json() as ApiBody;
  await pool.query(`UPDATE wallet_auth_challenges SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [expiredBody.challenge!.id]);
  const expiredSig = await walletF.signMessage(expiredBody.challenge!.message);
  const expiredVerify = await authed('POST', '/api/v1/auth/wallets/link/verify', sessionA.token, {
    challengeId: expiredBody.challenge!.id,
    message: expiredBody.challenge!.message,
    signature: expiredSig,
  });
  assert.equal(expiredVerify.statusCode, 400);
  assert.equal((expiredVerify.json() as ApiBody).error?.code, 'CHALLENGE_EXPIRED');
  console.log('PASS 9 expired link challenge rejected');

  const replay = await linkEvm(sessionA.token, walletF);
  assert.equal(replay.verifyRes.statusCode, 200);
  const replayAgain = await authed('POST', '/api/v1/auth/wallets/link/verify', sessionA.token, {
    challengeId: replay.challengeBody.challenge!.id,
    message: replay.challengeBody.challenge!.message,
    signature: await walletF.signMessage(replay.challengeBody.challenge!.message),
  });
  assert.equal(replayAgain.statusCode, 400);
  assert.equal((replayAgain.json() as ApiBody).error?.code, 'CHALLENGE_UNAVAILABLE');
  console.log('PASS 10 replay of a consumed link challenge rejected');

  const solAddress = sol.publicKey.toBase58();
  const solChallenge = await authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, {
    caip10: `solana:mainnet:${solAddress}`,
    provider: 'Phantom',
  });
  const solBody = solChallenge.json() as ApiBody;
  assert.equal(solChallenge.statusCode, 200);
  assert.equal(solBody.challenge!.address, solAddress);
  const solVerify = await authed('POST', '/api/v1/auth/wallets/link/verify', sessionA.token, {
    challengeId: solBody.challenge!.id,
    message: solBody.challenge!.message,
    signature: signSolana(solBody.challenge!.message, sol.secretKey.slice(0, 32)),
  });
  const solResult = solVerify.json() as ApiBody;
  assert.equal(solVerify.statusCode, 200, JSON.stringify(solResult));
  assert.equal(solResult.data?.wallet?.address, solAddress);
  assert.equal(solResult.data?.wallet?.isPrimary, false);
  const storedSol = await pool.query<{ normalized_address: string }>(
    `SELECT normalized_address FROM user_wallets WHERE id = $1`,
    [solResult.data!.wallet!.id]
  );
  assert.equal(storedSol.rows[0]?.normalized_address, solAddress);
  console.log('PASS solana address preserved and not primary');

  const extraFields = await authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, {
    caip10: `eip155:1:${walletG.address}`,
    userId: userB,
    isPrimary: true,
  });
  assert.equal(extraFields.statusCode, 400);
  console.log('PASS client cannot send user id or primary flag');

  const idorStep = await authed('POST', `/api/v1/auth/wallets/${idA}/step-up`, sessionB.token, {
    action: 'set_primary_wallet',
  });
  assert.equal(idorStep.statusCode, 404);
  const idorPrimary = await authed('POST', `/api/v1/auth/wallets/${idA}/unlink`, sessionB.token, {
    challengeId: '11111111-1111-4111-8111-111111111111',
    message: 'nope',
    signature: '0x' + '11'.repeat(65),
  });
  assert.notEqual(idorPrimary.statusCode, 200);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND user_id = $2 AND status = \'active\'', [idA, userA]), 1);
  console.log('PASS IDOR wallet id is not found for another user');

  const proofB = await stepUp(sessionA.token, idB, 'set_primary_wallet', walletB);
  const unset = await authed('POST', `/api/v1/auth/wallets/${idB}/primary`, sessionA.token, {
    challengeId: '11111111-1111-4111-8111-111111111111',
    message: proofB.message,
    signature: proofB.signature,
  });
  assert.notEqual(unset.statusCode, 200);
  const primaryStillA = await count(`SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND is_primary AND status = 'active'`, [idA]);
  assert.equal(primaryStillA, 1);
  console.log('PASS 13 primary change without the matching fresh challenge rejected');

  const unlinkProof = await stepUp(sessionA.token, idC, 'unlink_wallet', walletC);
  const wrongAction = await authed('POST', `/api/v1/auth/wallets/${idC}/primary`, sessionA.token, unlinkProof);
  assert.equal(wrongAction.statusCode, 400);
  assert.equal((wrongAction.json() as ApiBody).error?.code, 'ACTION_MISMATCH');
  console.log('PASS 14 unlink authorization does not set primary');

  const proofForB = await stepUp(sessionA.token, idB, 'set_primary_wallet', walletB);
  const wrongTarget = await authed('POST', `/api/v1/auth/wallets/${idC}/primary`, sessionA.token, proofForB);
  assert.equal(wrongTarget.statusCode, 400);
  assert.equal((wrongTarget.json() as ApiBody).error?.code, 'ACTION_MISMATCH');
  console.log('PASS 15 authorization for wallet B rejected for wallet C');

  const setB = await authed('POST', `/api/v1/auth/wallets/${idB}/primary`, sessionA.token, proofB);
  assert.equal(setB.statusCode, 200, JSON.stringify(setB.json()));
  assert.equal((setB.json() as ApiBody).data?.wallet?.isPrimary, true);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND is_primary AND status = 'active'`, [userA]), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND is_primary`, [idA]), 0);
  console.log('PASS 12 wallet B is the only active primary');

  const removePrimary = await stepUp(sessionA.token, idB, 'unlink_wallet', walletB);
  const blockedPrimary = await authed('POST', `/api/v1/auth/wallets/${idB}/unlink`, sessionA.token, removePrimary);
  assert.equal(blockedPrimary.statusCode, 409);
  assert.equal((blockedPrimary.json() as ApiBody).error?.code, 'PRIMARY_REPLACEMENT_REQUIRED');
  console.log('PASS 17 unlink primary without a replacement primary rejected');

  const backToA = await stepUp(sessionA.token, idA, 'set_primary_wallet', walletA);
  const restored = await authed('POST', `/api/v1/auth/wallets/${idA}/primary`, sessionA.token, backToA);
  assert.equal(restored.statusCode, 200);

  const linkedAtC = (await pool.query<{ linked_at: Date }>(`SELECT linked_at FROM user_wallets WHERE id = $1`, [idC])).rows[0]!.linked_at;
  const unlinkC = await stepUp(sessionA.token, idC, 'unlink_wallet', walletC);
  const removedC = await authed('POST', `/api/v1/auth/wallets/${idC}/unlink`, sessionA.token, unlinkC);
  assert.equal(removedC.statusCode, 200, JSON.stringify(removedC.json()));
  assert.equal((removedC.json() as ApiBody).data?.wallet?.status, 'disabled');
  const rowC = (await pool.query<{ status: string; linked_at: Date; user_id: string }>(
    `SELECT status, linked_at, user_id FROM user_wallets WHERE id = $1`,
    [idC]
  )).rows[0]!;
  assert.equal(rowC.status, 'disabled');
  assert.equal(rowC.user_id, userA);
  assert.equal(new Date(rowC.linked_at).toISOString(), new Date(linkedAtC).toISOString());
  console.log('PASS 16 secondary unlink is a soft disable');

  const loginC = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: await (async () => {
      const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
      const challenge = await createWalletAuthChallenge({
        caip10: `eip155:1:${walletC.address}`,
        frontendUrl: 'http://wallet-auth.test:3000',
        query: (sql, params) => pool.query(sql, params),
      });
      return {
        challengeId: challenge.id,
        message: challenge.message,
        signature: await walletC.signMessage(challenge.message),
      };
    })(),
  });
  assert.equal(loginC.statusCode, 403);
  assert.equal((loginC.json() as ApiBody).error?.code, 'WALLET_UNAVAILABLE');
  assert.equal((loginC.json() as ApiBody).data?.accessToken, undefined);
  console.log('PASS 11 disabled wallet cannot log in');

  const setB2 = await stepUp(sessionA.token, idB, 'set_primary_wallet', walletB);
  assert.equal((await authed('POST', `/api/v1/auth/wallets/${idB}/primary`, sessionA.token, setB2)).statusCode, 200);
  const unlinkA = await stepUp(sessionA.token, idA, 'unlink_wallet', walletA);
  const removedA = await authed('POST', `/api/v1/auth/wallets/${idA}/unlink`, sessionA.token, unlinkA);
  assert.equal(removedA.statusCode, 200, JSON.stringify(removedA.json()));
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND status = 'disabled'`, [idA]), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND is_primary AND status = 'active'`, [idB]), 1);
  console.log('PASS 18 new primary then unlink of the old primary');

  const linkedD = await linkEvm(sessionB.token, walletD);
  assert.equal(linkedD.body.data?.wallet?.isPrimary, true);
  const idD = linkedD.body.data!.wallet!.id;
  const lastFactor = await stepUp(sessionB.token, idD, 'unlink_wallet', walletD);
  const blockedLast = await authed('POST', `/api/v1/auth/wallets/${idD}/unlink`, sessionB.token, lastFactor);
  assert.equal(blockedLast.statusCode, 409);
  assert.equal((blockedLast.json() as ApiBody).error?.code, 'LAST_FACTOR');
  console.log('PASS 19 last sign-in wallet cannot be removed without a recovery factor');

  const history = await authed('GET', '/api/v1/auth/wallets', sessionA.token);
  const historyBody = history.json() as ApiBody;
  assert.ok(historyBody.data?.wallets?.some((item) => item.id === idC && item.status === 'disabled'));
  assert.ok(historyBody.data?.wallets?.some((item) => item.id === idA && item.status === 'disabled'));
  console.log('PASS 20 disabled rows remain in the wallet list');

  const idG = (await linkEvm(sessionA.token, walletG)).body.data!.wallet!.id;
  await pool.query(`UPDATE user_wallets SET status = 'compromised', is_primary = FALSE WHERE id = $1`, [idG]);
  const compromisedStep = await authed('POST', `/api/v1/auth/wallets/${idG}/step-up`, sessionA.token, { action: 'set_primary_wallet' });
  assert.equal(compromisedStep.statusCode, 409);
  assert.equal((compromisedStep.json() as ApiBody).error?.code, 'WALLET_NOT_ACTIVE');
  console.log('PASS 21 compromised wallet cannot become primary');

  await clearLimits();
  const loginG = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: await (async () => {
      const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
      const challenge = await createWalletAuthChallenge({
        caip10: `eip155:1:${walletG.address}`,
        frontendUrl: 'http://wallet-auth.test:3000',
        query: (sql, params) => pool.query(sql, params),
      });
      return {
        challengeId: challenge.id,
        message: challenge.message,
        signature: await walletG.signMessage(challenge.message),
      };
    })(),
  });
  assert.equal(loginG.statusCode, 403);
  assert.equal((loginG.json() as ApiBody).error?.code, 'WALLET_UNAVAILABLE');
  console.log('PASS 22 compromised wallet cannot log in');

  const raceChallenges = await Promise.all([
    authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, { caip10: `eip155:1:${walletH.address}` }),
    authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, { caip10: `eip155:1:${walletH.address}` }),
  ]);
  const raceProofs = await Promise.all(raceChallenges.map(async (res) => {
    const body = res.json() as ApiBody;
    return {
      challengeId: body.challenge!.id,
      message: body.challenge!.message,
      signature: await walletH.signMessage(body.challenge!.message),
    };
  }));
  const raceResults = await Promise.all(raceProofs.map((payload) => app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallets/link/verify',
    headers: { authorization: `Bearer ${sessionA.token}` },
    payload,
  })));
  const raceCodes = raceResults.map((res) => res.statusCode).sort();
  assert.deepEqual(raceCodes, [200, 409]);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1', [walletH.address.toLowerCase()]), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersAtStart);
  console.log('PASS 23 concurrent links create one credential and one owner');

  const idH = (raceResults.find((res) => res.statusCode === 200)!.json() as ApiBody).data!.wallet!.id;
  const [primaryH, primaryB] = await Promise.all([
    stepUp(sessionA.token, idH, 'set_primary_wallet', walletH),
    stepUp(sessionA.token, idB, 'set_primary_wallet', walletB),
  ]);
  const primaryRace = await Promise.all([
    app.inject({ method: 'POST', url: `/api/v1/auth/wallets/${idH}/primary`, headers: { authorization: `Bearer ${sessionA.token}` }, payload: primaryH }),
    app.inject({ method: 'POST', url: `/api/v1/auth/wallets/${idB}/primary`, headers: { authorization: `Bearer ${sessionA.token}` }, payload: primaryB }),
  ]);
  assert.ok(primaryRace.every((res) => res.statusCode === 200));
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND is_primary AND status = 'active'`, [userA]), 1);
  console.log('PASS 24 concurrent primary changes leave one active primary');

  const [unlink1, unlink2] = await Promise.all([
    stepUp(sessionA.token, idH, 'unlink_wallet', walletH),
    stepUp(sessionA.token, idH, 'unlink_wallet', walletH),
  ]);
  const currentPrimary = await count(`SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND is_primary AND status = 'active'`, [idH]);
  if (currentPrimary === 1) {
    const other = idB;
    const swap = await stepUp(sessionA.token, other, 'set_primary_wallet', walletB);
    assert.equal((await authed('POST', `/api/v1/auth/wallets/${other}/primary`, sessionA.token, swap)).statusCode, 200);
  }
  const unlinkRace = await Promise.all([
    app.inject({ method: 'POST', url: `/api/v1/auth/wallets/${idH}/unlink`, headers: { authorization: `Bearer ${sessionA.token}` }, payload: unlink1 }),
    app.inject({ method: 'POST', url: `/api/v1/auth/wallets/${idH}/unlink`, headers: { authorization: `Bearer ${sessionA.token}` }, payload: unlink2 }),
  ]);
  const unlinkCodes = unlinkRace.map((res) => res.statusCode).sort();
  assert.deepEqual(unlinkCodes, [200, 409]);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE id = $1 AND status = 'disabled'`, [idH]), 1);
  console.log('PASS 25 concurrent unlinks leave one disabled row');

  assert.equal(userA, (await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', ['a@wallet-mgmt.test'])).rows[0]!.id);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_balances WHERE available = 100'), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM kyc_applications WHERE status = 'approved'`), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM spot_orders`), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM p2p_orders WHERE counterparty = 'member-a'`), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM forex_accounts'), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE address IS NOT NULL`), 0);
  assert.equal(await count('SELECT count(*)::int AS n FROM wallets'), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_master_keys'), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM hot_wallets'), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM cold_wallets'), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM admin_users'), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM admin_sessions'), 1);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersAtStart);
  console.log('PASS 26-30 identity, balances, KYC, spot, P2P, forex, custody, and admin rows unchanged');

  assert.equal(await isSessionValid(sessionA.sessionId), true);
  assert.equal(await isSessionValid(sessionB.sessionId), true);
  console.log('PASS 31 existing sessions remain valid');

  await clearLimits();
  const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
  async function walletLogin(wallet: Wallet) {
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:1:${wallet.address}`,
      frontendUrl: 'http://wallet-auth.test:3000',
      query: (sql, params) => pool.query(sql, params),
    });
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: {
        challengeId: challenge.id,
        message: challenge.message,
        signature: await wallet.signMessage(challenge.message),
      },
    });
  }
  const loginF = await walletLogin(walletF);
  assert.equal(loginF.statusCode, 200, JSON.stringify(loginF.json()));
  assert.equal((loginF.json() as ApiBody).data?.user?.id, userA);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersAtStart);
  console.log('PASS 32 newly linked wallet logs into the same user');

  const loginDisabledA = await walletLogin(walletA);
  assert.equal(loginDisabledA.statusCode, 403);
  console.log('PASS 33 unlinked wallet cannot log in');

  const primaryRow = (await pool.query<{ address: string }>(
    `SELECT address FROM user_wallets WHERE user_id = $1 AND is_primary AND status = 'active'`,
    [userA]
  )).rows[0]!;
  const primaryWallet = primaryRow.address.toLowerCase() === walletB.address.toLowerCase() ? walletB : walletF;
  const secondaryWallet = primaryWallet === walletB ? walletF : walletB;
  await clearLimits();
  const loginPrimary = await walletLogin(primaryWallet);
  assert.equal(loginPrimary.statusCode, 200);
  assert.equal((loginPrimary.json() as ApiBody).data?.user?.id, userA);
  console.log('PASS 34 primary wallet logs in');
  await clearLimits();
  const loginSecondary = await walletLogin(secondaryWallet);
  assert.equal(loginSecondary.statusCode, 200);
  assert.equal((loginSecondary.json() as ApiBody).data?.user?.id, userA);
  console.log('PASS 35 secondary wallet logs in without being primary');

  const managed = await authed('POST', '/api/v1/auth/wallets/link/challenge', sessionA.token, {
    caip10: `eip155:1:${Wallet.createRandom().address}`,
  });
  const managedBody = managed.json() as ApiBody;
  const usersBeforeSteal = await count('SELECT count(*)::int AS n FROM users');
  await clearLimits();
  const steal = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: {
      challengeId: managedBody.challenge!.id,
      message: managedBody.challenge!.message,
      signature: '0x' + 'ab'.repeat(65),
    },
  });
  assert.equal(steal.statusCode, 400);
  assert.equal((steal.json() as ApiBody).error?.code, 'CHALLENGE_UNAVAILABLE');
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeSteal);
  assert.equal(await count('SELECT count(*)::int AS n FROM wallet_auth_challenges WHERE id = $1 AND consumed_at IS NULL', [managedBody.challenge!.id]), 1);
  console.log('PASS management challenge cannot be consumed as a login');

  await clearLimits();
  let limited = 0;
  for (let i = 0; i < 12; i += 1) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallets/link/challenge',
      headers: { authorization: `Bearer ${sessionA.token}` },
      payload: { caip10: `eip155:1:${Wallet.createRandom().address}` },
    });
    if (res.statusCode === 429) limited += 1;
  }
  assert.ok(limited >= 1);
  console.log('PASS rate limit rejects excess link challenges');

  const logs = await pool.query<{ details: { action?: string; messageSha256?: string; signature?: string } }>(
    `SELECT details FROM user_activity_logs WHERE user_id = $1 AND activity_type = 'settings_change'`,
    [userA]
  );
  const actions = new Set(logs.rows.map((row) => row.details?.action));
  assert.ok(actions.has('wallet_link'));
  assert.ok(actions.has('wallet_set_primary'));
  assert.ok(actions.has('wallet_unlink'));
  assert.ok(actions.has('wallet_step_up_success'));
  assert.ok(logs.rows.some((row) => typeof row.details?.messageSha256 === 'string' && row.details.messageSha256.length === 64));
  assert.ok(logs.rows.every((row) => row.details?.signature == null));
  console.log('PASS audit log records wallet actions without signatures');

  await app.close();
  await rateRedis.quit();
  await pool.end();
  await db.close();
  await redis.close();
  console.log('PASS wallet management integration');
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
