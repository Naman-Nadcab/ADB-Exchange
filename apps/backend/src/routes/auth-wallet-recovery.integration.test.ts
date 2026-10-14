/**
 * STEP 8 wallet recovery against an isolated database.
 * Refuses database name `exchange` or `postgres`, and refuses Redis on port 6379.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Wallet } from 'ethers';
import { Pool } from 'pg';

const testUrl = process.env.WALLET_RECOVERY_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.WALLET_RECOVERY_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('WALLET_RECOVERY_TEST_DATABASE_URL and WALLET_RECOVERY_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run wallet recovery tests against a non-isolated database');
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
process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY ?? 'test-totp-encryption-key-32-characters';
process.env.REDIS_URL = redisUrlRaw;

const SCHEMA = `
DROP TABLE IF EXISTS wallet_auth_challenges, user_wallets, user_activity_logs, user_passkeys, user_sessions,
  user_balances, kyc_applications, spot_orders, p2p_orders, forex_accounts, forex_ledger_transactions,
  wallets, user_master_keys, hot_wallets, cold_wallets, security_cooldowns, admin_activity_logs,
  admin_approval_requests, admin_sessions, admin_users, otp_verifications, withdrawals, withdrawal_addresses, system_settings, users CASCADE;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  username TEXT,
  password_hash TEXT,
  fund_password_hash TEXT,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  totp_secret TEXT,
  two_factor_secret TEXT,
  passkeys_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  withdrawals_frozen_at TIMESTAMPTZ,
  withdrawals_frozen_reason TEXT
);
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
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
  counter INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
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
  CONSTRAINT user_wallets_status_check CHECK (status IN ('active', 'disabled', 'compromised'))
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
CREATE TABLE security_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  cooldown_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  role TEXT NOT NULL
);
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  break_glass BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE admin_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  action_payload JSONB NOT NULL,
  requested_by UUID NOT NULL REFERENCES admin_users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  required_approvals INTEGER NOT NULL DEFAULT 2,
  current_approvals INTEGER NOT NULL DEFAULT 0,
  approved_by UUID[],
  rejected_by UUID,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  maker_unlock_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  action VARCHAR(80) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  device_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE kyc_applications (
  id INT PRIMARY KEY,
  user_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_balances (id INT PRIMARY KEY, user_id UUID, asset TEXT, available NUMERIC);
CREATE TABLE spot_orders (id INT PRIMARY KEY, user_id UUID, symbol TEXT);
CREATE TABLE p2p_orders (id INT PRIMARY KEY, user_id UUID, counterparty TEXT);
CREATE TABLE forex_accounts (id INT PRIMARY KEY, user_id UUID, account_id TEXT, address TEXT);
CREATE TABLE forex_ledger_transactions (id INT PRIMARY KEY, user_id UUID, note TEXT);
CREATE TABLE wallets (id INT PRIMARY KEY, address TEXT);
CREATE TABLE user_master_keys (id INT PRIMARY KEY, address TEXT);
CREATE TABLE hot_wallets (id INT PRIMARY KEY, address TEXT);
CREATE TABLE cold_wallets (id INT PRIMARY KEY, address TEXT);
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY,
  user_id UUID,
  status TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE system_settings (key TEXT PRIMARY KEY, value JSONB);
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT,
  type TEXT,
  otp_hash TEXT,
  salt TEXT,
  attempts INT,
  max_attempts INT,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE withdrawal_addresses (id INT PRIMARY KEY, user_id UUID, address TEXT);
`;

type ApiBody = {
  success?: boolean;
  challenge?: { challengeId?: string; id?: string; message: string };
  data?: {
    recovery?: { id?: string; status?: string; replacementMode?: string } | null;
    wallet?: { status?: string };
    user?: { id?: string };
    accessToken?: string;
    approvalRequestId?: string;
  };
  error?: { code?: string };
};

function encryptTotp(secret: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(process.env.TOTP_ENCRYPTION_KEY!, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]).toString('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

async function run(): Promise<void> {
  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const jwt = (await import('@fastify/jwt')).default;
  const OTPAuth = await import('otpauth');
  const { config } = await import('../config/index.js');
  const { db } = await import('../lib/database.js');
  const { redis } = await import('../lib/redis.js');
  const { createSession, isSessionValid } = await import('../services/session.service.js');
  const { hasActiveCooldown } = await import('../services/security-cooldown.service.js');
  const { assertWithdrawalAllowedForTreasuryPolicy } = await import('../services/treasury/treasury-emergency.service.js');
  const { setWalletRecoveryClockForTests, setPasskeyRecoveryVerifierForTests } = await import('../services/wallet-recovery.service.js');
  const { emailOtpCanAttachWallet } = await import('../services/wallet-factor-policy.service.js');
  const { default: walletManagementRoutes } = await import('./auth-wallet-management.fastify.js');
  const { default: walletLoginRoutes } = await import('./auth-wallet-login.fastify.js');
  const { default: walletRecoveryRoutes } = await import('./auth-wallet-recovery.fastify.js');
  const { default: adminWalletRecoveryRoutes } = await import('./admin-wallet-recovery.fastify.js');
  const { default: authRoutes } = await import('./auth.fastify.js');
  const { default: walletRoutes } = await import('./wallet.fastify.js');
  const Redis = (await import('ioredis')).default;

  const pool = new Pool({ connectionString: testUrl, max: 8 });
  await pool.query(SCHEMA);
  const rateRedis = new Redis(redisUrlRaw);
  await rateRedis.ping();
  await redis.ping();

  let now = new Date();
  setWalletRecoveryClockForTests(() => now);
  const usedPasskeyChallenges = new Set<string>();
  setPasskeyRecoveryVerifierForTests(async (input) => {
    if (usedPasskeyChallenges.has(input.challenge)) return false;
    if (!input.passkeyId) return false;
    usedPasskeyChallenges.add(input.challenge);
    return true;
  });

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwt, { secret: config.jwt.secret });
  const authenticate = async function (request: { headers: { authorization?: string }; user?: unknown }, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
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
  };
  app.decorate('authenticateUser', authenticate);
  app.decorate('authenticate', authenticate);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletManagementRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletRecoveryRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });
  await app.register(adminWalletRecoveryRoutes, { prefix: '/api/v1/admin' });
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });

  async function clearLimits(): Promise<void> {
    const keys = await rateRedis.keys('rate:auth:wallet-*');
    if (keys.length > 0) await rateRedis.del(...keys);
    const more = await rateRedis.keys('rate:wallet:*');
    if (more.length > 0) await rateRedis.del(...more);
  }

  async function authed(method: 'GET' | 'POST' | 'DELETE', url: string, token: string, payload?: unknown) {
    await clearLimits();
    return app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query<{ n: number }>(sql, params);
    const raw = result.rows[0]?.n ?? 0;
    return typeof raw === 'number' ? raw : +String(raw);
  }

  async function tokenFor(userId: string): Promise<{ token: string; sessionId: string }> {
    const opened = await createSession({ userId, deviceType: 'web', ipAddress: '127.0.0.1', ttlSeconds: 3600 });
    const token = app.jwt.sign({ userId, role: 'user', sessionId: opened.sessionId }, { expiresIn: '1h' });
    return { token, sessionId: opened.sessionId };
  }

  async function adminToken(adminId: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO admin_sessions (id, admin_id, expires_at, ip_address, user_agent, break_glass)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', NULL, NULL, FALSE)`,
      [sessionId, adminId]
    );
    return app.jwt.sign({ adminId, role: 'compliance', sessionId, type: 'admin' }, { expiresIn: '1h' });
  }

  async function link(token: string, wallet: Wallet, primaryExpected = false) {
    const challengeRes = await authed('POST', '/api/v1/auth/wallets/link/challenge', token, {
      caip10: `eip155:1:${wallet.address}`,
    });
    const body = challengeRes.json() as ApiBody;
    assert.equal(challengeRes.statusCode, 200, JSON.stringify(body));
    const signature = await wallet.signMessage(body.challenge!.message);
    const verified = await authed('POST', '/api/v1/auth/wallets/link/verify', token, {
      challengeId: body.challenge!.id,
      message: body.challenge!.message,
      signature,
    });
    assert.equal(verified.statusCode, 200, JSON.stringify(verified.json()));
    const row = (await pool.query<{ id: string; is_primary: boolean }>(
      `SELECT id, is_primary FROM user_wallets WHERE normalized_address = $1`,
      [wallet.address.toLowerCase()]
    )).rows[0]!;
    if (primaryExpected) assert.equal(row.is_primary, true);
    return row.id;
  }

  async function signAction(token: string, wallet: Wallet, action: string, lostWalletId?: string) {
    const issued = await authed('POST', '/api/v1/auth/wallets/recovery/challenge', token, {
      caip10: `eip155:1:${wallet.address}`,
      action,
      ...(lostWalletId ? { lostWalletId } : {}),
    });
    const body = issued.json() as ApiBody;
    assert.equal(issued.statusCode, 200, JSON.stringify(body));
    const message = body.challenge!.message;
    const typed = JSON.parse(message) as {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      message: Record<string, unknown>;
    };
    const signature = await wallet.signTypedData(typed.domain, typed.types, typed.message);
    return { challengeId: body.challenge!.challengeId!, message, signature };
  }

  async function login(wallet: Wallet) {
    const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:1:${wallet.address}`,
      frontendUrl: 'http://wallet-auth.test:3000',
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = await wallet.signMessage(challenge.message);
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: { challengeId: challenge.id, message: challenge.message, signature },
    });
  }

  const user = (await pool.query<{ id: string }>(
    `INSERT INTO users (email, username, role, status) VALUES (NULL, 'wallet-user', 'user', 'active') RETURNING id`
  )).rows[0]!.id;
  const other = (await pool.query<{ id: string }>(
    `INSERT INTO users (email, role, status) VALUES ('other@wallet-recovery.test', 'user', 'active') RETURNING id`
  )).rows[0]!.id;
  const emailOnly = (await pool.query<{ id: string }>(
    `INSERT INTO users (email, role, status) VALUES ('mail-only@wallet-recovery.test', 'user', 'active') RETURNING id`
  )).rows[0]!.id;
  await pool.query(`INSERT INTO user_balances (id, user_id, asset, available) VALUES (1, $1, 'USDT', 250)`, [user]);
  await pool.query(`INSERT INTO kyc_applications (id, user_id, status) VALUES (1, $1, 'approved')`, [user]);
  await pool.query(`INSERT INTO spot_orders (id, user_id, symbol) VALUES (1, $1, 'BTCUSDT')`, [user]);
  await pool.query(`INSERT INTO p2p_orders (id, user_id, counterparty) VALUES (1, $1, 'peer')`, [user]);
  await pool.query(`INSERT INTO forex_accounts (id, user_id, account_id, address) VALUES (1, $1, 'FX-KEEP', NULL)`, [user]);
  await pool.query(`INSERT INTO forex_ledger_transactions (id, user_id, note) VALUES (1, $1, 'opening')`, [user]);
  await pool.query(`INSERT INTO wallets (id, address) VALUES (1, 'custody')`);
  await pool.query(`INSERT INTO user_master_keys (id, address) VALUES (1, 'master')`);
  await pool.query(`INSERT INTO hot_wallets (id, address) VALUES (1, 'hot')`);
  await pool.query(`INSERT INTO cold_wallets (id, address) VALUES (1, 'cold')`);
  const maker = (await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, role) VALUES ('maker@wallet-recovery.test', 'compliance') RETURNING id`
  )).rows[0]!.id;
  const checker = (await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, role) VALUES ('checker@wallet-recovery.test', 'compliance') RETURNING id`
  )).rows[0]!.id;
  const makerJwt = await adminToken(maker);
  const checkerJwt = await adminToken(checker);

  const session = await tokenFor(user);
  const otherSession = await tokenFor(other);
  const emailSession = await tokenFor(emailOnly);
  const otherDevice = await tokenFor(user);
  const walletA = Wallet.createRandom();
  const walletB = Wallet.createRandom();
  const walletC = Wallet.createRandom();
  const walletOther = Wallet.createRandom();
  const idA = await link(session.token, walletA, true);
  const idB = await link(session.token, walletB);
  await link(otherSession.token, walletOther, true);

  const balancesBefore = await count(`SELECT count(*)::int AS n FROM user_balances`);
  const kycBefore = (await pool.query<{ status: string }>(`SELECT status FROM kyc_applications WHERE user_id = $1`, [user])).rows[0]!.status;
  const forexBefore = (await pool.query<{ user_id: string; account_id: string }>(`SELECT user_id, account_id FROM forex_accounts`)).rows[0]!;
  const custodyBefore = await count(`SELECT count(*)::int AS n FROM wallets`);
  const usersBefore = await count(`SELECT count(*)::int AS n FROM users`);
  const adminSessionsBefore = await count(`SELECT count(*)::int AS n FROM admin_sessions`);

  const loginB = await login(walletB);
  assert.equal(loginB.statusCode, 200, loginB.body);
  const loginBody = loginB.json() as { data?: { user?: { id?: string } } };
  assert.equal(loginBody.data?.user?.id, user);
  assert.equal(kycBefore, 'approved');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_balances WHERE available = 250`), 1);
  console.log('PASS 1 second wallet login keeps users.id');

  const passkeyId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO user_passkeys (id, user_id, credential_id, public_key) VALUES ($1, $2, 'cred', 'key')`,
    [passkeyId, user]
  );
  const passkeyRequest = await authed('POST', '/api/v1/auth/wallets/recovery', session.token, { lostWalletId: idA });
  assert.equal(passkeyRequest.statusCode, 200, JSON.stringify(passkeyRequest.json()));
  const passkeyFactor = await authed('POST', '/api/v1/auth/wallets/recovery/factor', session.token, {
    factor: 'passkey',
    passkeyId,
    message: 'passkey-challenge-value-1',
    assertion: { id: 'cred' },
  });
  assert.equal(passkeyFactor.statusCode, 200, JSON.stringify(passkeyFactor.json()));
  assert.equal((passkeyFactor.json() as ApiBody).data?.recovery?.replacementMode, 'strong');
  const replayPasskey = await authed('POST', '/api/v1/auth/wallets/recovery/factor', session.token, {
    factor: 'passkey',
    passkeyId,
    message: 'passkey-challenge-value-1',
    assertion: { id: 'cred' },
  });
  assert.equal(replayPasskey.statusCode, 400);
  assert.equal((replayPasskey.json() as ApiBody).error?.code, 'INVALID_SIGNATURE');
  await authed('POST', '/api/v1/auth/wallets/recovery/cancel', session.token, {});
  console.log('PASS 2 passkey recovery stays on the same account');
  console.log('PASS 30 recovery proof replay rejected');

  const totpSecret = new OTPAuth.Secret({ size: 20 }).base32;
  await pool.query(
    `UPDATE users SET totp_enabled = TRUE, totp_secret = $2 WHERE id = $1`,
    [user, encryptTotp(totpSecret)]
  );
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(totpSecret), algorithm: 'SHA1', digits: 6, period: 30 });
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery', session.token, {})).statusCode, 200);
  const totpFactor = await authed('POST', '/api/v1/auth/wallets/recovery/factor', session.token, {
    factor: 'totp',
    totpCode: totp.generate(),
  });
  assert.equal(totpFactor.statusCode, 200, JSON.stringify(totpFactor.json()));
  assert.equal((totpFactor.json() as ApiBody).data?.recovery?.replacementMode, 'review');
  const totpReplace = await authed('POST', '/api/v1/auth/wallets/recovery/challenge', session.token, {
    caip10: `eip155:1:${walletC.address}`,
    action: 'replace_wallet',
  });
  assert.equal(totpReplace.statusCode, 409);
  assert.equal((totpReplace.json() as ApiBody).error?.code, 'REPLACEMENT_REQUIRES_REVIEW');
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery/review', session.token, {})).statusCode, 200);
  await authed('POST', '/api/v1/auth/wallets/recovery/cancel', session.token, {});
  await pool.query(`UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1`, [user]);
  console.log('PASS 3 totp assists review and does not replace a wallet');

  assert.equal(emailOtpCanAttachWallet(), false);
  const emailLink = await authed('POST', '/api/v1/auth/wallets/recovery/email-link', emailSession.token, {
    otp: '123456',
    caip10: `eip155:1:${Wallet.createRandom().address}`,
    userId: user,
  });
  assert.equal(emailLink.statusCode, 403);
  assert.equal((emailLink.json() as ApiBody).error?.code, 'EMAIL_NOT_SUFFICIENT');
  const emailFactor = await authed('POST', '/api/v1/auth/wallets/recovery', emailSession.token, {});
  assert.equal(emailFactor.statusCode, 200);
  const emailFactorVerify = await authed('POST', '/api/v1/auth/wallets/recovery/factor', emailSession.token, { factor: 'email', totpCode: '000000' });
  assert.equal(emailFactorVerify.statusCode, 403);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [emailOnly]), 0);
  console.log('PASS 4 email OTP cannot attach a wallet');

  const solo = (await pool.query<{ id: string }>(
    `INSERT INTO users (email, role, status) VALUES (NULL, 'user', 'active') RETURNING id`
  )).rows[0]!.id;
  const soloSession = await tokenFor(solo);
  const soloWallet = Wallet.createRandom();
  const soloId = await link(soloSession.token, soloWallet, true);
  const step = await authed('POST', `/api/v1/auth/wallets/${soloId}/step-up`, soloSession.token, { action: 'unlink_wallet' });
  const stepBody = step.json() as ApiBody;
  assert.equal(step.statusCode, 200, JSON.stringify(stepBody));
  const typed = JSON.parse(stepBody.challenge!.message) as {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    message: Record<string, unknown>;
  };
  const soloSig = await soloWallet.signTypedData(typed.domain, typed.types, typed.message);
  const unlinkSolo = await authed('POST', `/api/v1/auth/wallets/${soloId}/unlink`, soloSession.token, {
    challengeId: stepBody.challenge!.id,
    message: stepBody.challenge!.message,
    signature: soloSig,
  });
  assert.equal(unlinkSolo.statusCode, 409);
  assert.equal((unlinkSolo.json() as ApiBody).error?.code, 'LAST_FACTOR');
  console.log('PASS 5 last wallet unlink rejected');

  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery', session.token, { lostWalletId: idA })).statusCode, 200);
  const authProof = await signAction(session.token, walletB, 'authorize_wallet_recovery');
  const secondFactor = await authed('POST', '/api/v1/auth/wallets/recovery/factor', session.token, {
    factor: 'second_wallet',
    ...authProof,
  });
  assert.equal(secondFactor.statusCode, 200, JSON.stringify(secondFactor.json()));
  const beforeRevoke = await isSessionValid(otherDevice.sessionId);
  assert.equal(beforeRevoke, true);
  const compromise = await signAction(session.token, walletB, 'mark_wallet_compromised', idA);
  const marked = await authed('POST', '/api/v1/auth/wallets/recovery/compromise', session.token, {
    ...compromise,
    lostWalletId: idA,
  });
  assert.equal(marked.statusCode, 200, JSON.stringify(marked.json()));
  const statusA = (await pool.query<{ status: string }>(`SELECT status FROM user_wallets WHERE id = $1`, [idA])).rows[0]!.status;
  assert.equal(statusA, 'compromised');
  const loginA = await login(walletA);
  assert.equal(loginA.statusCode, 403);
  const primaryA = await authed('POST', `/api/v1/auth/wallets/${idA}/step-up`, session.token, { action: 'set_primary_wallet' });
  assert.equal(primaryA.statusCode, 409);
  assert.equal((primaryA.json() as ApiBody).error?.code, 'WALLET_NOT_ACTIVE');
  const loginB2 = await login(walletB);
  assert.equal(loginB2.statusCode, 200);
  assert.equal((loginB2.json() as { data?: { user?: { id?: string } } }).data?.user?.id, user);
  console.log('PASS 6 primary loss recovered through the second wallet');
  console.log('PASS 13 compromised wallet login rejected');
  console.log('PASS 14 compromised wallet cannot become primary');

  const replacement = await signAction(session.token, walletC, 'replace_wallet');
  const replaced = await authed('POST', '/api/v1/auth/wallets/recovery/replace', session.token, replacement);
  assert.equal(replaced.statusCode, 200, JSON.stringify(replaced.json()));
  const rowC = (await pool.query<{ user_id: string; status: string; is_primary: boolean }>(
    `SELECT user_id, status, is_primary FROM user_wallets WHERE normalized_address = $1`,
    [walletC.address.toLowerCase()]
  )).rows[0]!;
  assert.equal(rowC.user_id, user);
  assert.equal(rowC.status, 'disabled');
  assert.equal(rowC.is_primary, false);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users`), usersBefore + 1);
  const replay = await authed('POST', '/api/v1/auth/wallets/recovery/replace', session.token, replacement);
  assert.notEqual(replay.statusCode, 200);
  console.log('PASS 7 replacement wallet links to the same users.id');

  const owned = await authed('POST', '/api/v1/auth/wallets/recovery/challenge', session.token, {
    caip10: `eip155:1:${walletOther.address}`,
    action: 'replace_wallet',
  });
  if (owned.statusCode === 200) {
    const ownedBody = owned.json() as ApiBody;
    const ownedTyped = JSON.parse(ownedBody.challenge!.message) as {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      message: Record<string, unknown>;
    };
    const ownedSig = await walletOther.signTypedData(ownedTyped.domain, ownedTyped.types, ownedTyped.message);
    const merge = await authed('POST', '/api/v1/auth/wallets/recovery/replace', session.token, {
      challengeId: ownedBody.challenge!.challengeId,
      message: ownedBody.challenge!.message,
      signature: ownedSig,
    });
    assert.equal(merge.statusCode, 409);
    assert.equal((merge.json() as ApiBody).error?.code, 'WALLET_UNAVAILABLE');
  } else {
    assert.equal(owned.statusCode, 409);
  }
  assert.equal((await pool.query<{ user_id: string }>(
    `SELECT user_id FROM user_wallets WHERE normalized_address = $1`,
    [walletOther.address.toLowerCase()]
  )).rows[0]!.user_id, other);
  console.log('PASS 8 replacement owned by another user is rejected');

  const cooldown = await hasActiveCooldown({ userId: user });
  assert.equal(cooldown.active, true);
  assert.equal(cooldown.reason, 'wallet_recovery');
  const frozen = await assertWithdrawalAllowedForTreasuryPolicy({ userId: user, assetSymbol: 'USDT' });
  assert.equal(frozen.ok, false);
  if (!frozen.ok) assert.equal(frozen.code, 'USER_WITHDRAWAL_FROZEN');
  const early = await authed('POST', '/api/v1/auth/wallets/recovery/complete', session.token, {});
  assert.equal(early.statusCode, 409);
  assert.equal((early.json() as ApiBody).error?.code, 'COOLDOWN_ACTIVE');
  const loginDuring = await login(walletC);
  assert.equal(loginDuring.statusCode, 403);
  console.log('PASS 9 cooldown blocks completion and withdrawals');
  console.log('PASS 35 withdrawal during cooldown rejected');

  now = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const done = await authed('POST', '/api/v1/auth/wallets/recovery/complete', session.token, {});
  assert.equal(done.statusCode, 200, JSON.stringify(done.json()));
  const activeC = (await pool.query<{ status: string; is_primary: boolean }>(
    `SELECT status, is_primary FROM user_wallets WHERE normalized_address = $1`,
    [walletC.address.toLowerCase()]
  )).rows[0]!;
  assert.equal(activeC.status, 'active');
  assert.equal(await count(`SELECT count(*)::int AS n FROM withdrawal_addresses`), 0);
  assert.equal((await hasActiveCooldown({ userId: user })).active, false);
  const loginAfter = await login(walletC);
  assert.equal(loginAfter.statusCode, 200);
  assert.equal((loginAfter.json() as { data?: { user?: { id?: string } } }).data?.user?.id, user);
  const oldLogin = await login(walletA);
  assert.equal(oldLogin.statusCode, 403);
  console.log('PASS 10 cooldown completion activates the login credential only');
  console.log('PASS 32 replacement wallet logs in as the same user');
  console.log('PASS 33 old wallet cannot log in');

  const cancelUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status, preferences) VALUES ('user', 'active', '{}'::jsonb) RETURNING id`
  )).rows[0]!.id;
  const cancelSession = await tokenFor(cancelUser);
  const cancelWallet = Wallet.createRandom();
  await link(cancelSession.token, cancelWallet, true);
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery', cancelSession.token, {})).statusCode, 200);
  const walletsBeforeCancel = await count(`SELECT count(*)::int AS n FROM user_wallets`);
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery/cancel', cancelSession.token, {})).statusCode, 200);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets`), walletsBeforeCancel);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [cancelUser]), 1);
  console.log('PASS 11 cancellation does not change wallet ownership');

  const rejectUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status) VALUES ('user', 'active') RETURNING id`
  )).rows[0]!.id;
  await pool.query(`INSERT INTO kyc_applications (id, user_id, status) VALUES (2, $1, 'approved')`, [rejectUser]);
  const rejectSession = await tokenFor(rejectUser);
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery', rejectSession.token, {})).statusCode, 200);
  const review = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/wallet-recovery/${rejectUser}/review`,
    headers: { authorization: `Bearer ${makerJwt}` },
    payload: { reason: 'Lost wallet, KYC file already approved' },
  });
  assert.equal(review.statusCode, 200, review.body);
  const self = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/wallet-recovery/${rejectUser}/decide`,
    headers: { authorization: `Bearer ${makerJwt}` },
    payload: { decision: 'approve' },
  });
  assert.equal(self.statusCode, 403);
  assert.equal((self.json() as ApiBody).error?.code, 'SELF_APPROVAL');
  const rejected = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/wallet-recovery/${rejectUser}/decide`,
    headers: { authorization: `Bearer ${checkerJwt}` },
    payload: { decision: 'reject', reason: 'Documents do not match' },
  });
  assert.equal(rejected.statusCode, 200, rejected.body);
  assert.equal((await pool.query<{ status: string }>(`SELECT status FROM kyc_applications WHERE user_id = $1`, [rejectUser])).rows[0]!.status, 'approved');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [rejectUser]), 0);
  console.log('PASS 12 admin rejection does not replace a wallet or change KYC');

  const approveUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status) VALUES ('user', 'active') RETURNING id`
  )).rows[0]!.id;
  await pool.query(`INSERT INTO kyc_applications (id, user_id, status) VALUES (3, $1, 'approved')`, [approveUser]);
  const approveSession = await tokenFor(approveUser);
  const approveWallet = Wallet.createRandom();
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery', approveSession.token, {})).statusCode, 200);
  assert.equal((await app.inject({
    method: 'POST',
    url: `/api/v1/admin/wallet-recovery/${approveUser}/review`,
    headers: { authorization: `Bearer ${makerJwt}` },
    payload: { reason: 'KYC file matches the account holder' },
  })).statusCode, 200);
  const approved = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/wallet-recovery/${approveUser}/decide`,
    headers: { authorization: `Bearer ${checkerJwt}` },
    payload: { decision: 'approve' },
  });
  assert.equal(approved.statusCode, 200, approved.body);
  const approvedView = await authed('GET', '/api/v1/auth/wallets/recovery', approveSession.token);
  assert.equal((approvedView.json() as ApiBody).data?.recovery?.status, 'APPROVED');
  assert.equal((approvedView.json() as ApiBody).data?.recovery?.replacementMode, 'strong');
  const kycStill = (await pool.query<{ status: string }>(`SELECT status FROM kyc_applications WHERE user_id = $1`, [approveUser])).rows[0]!.status;
  assert.equal(kycStill, 'approved');
  const approveChallenge = await authed('POST', '/api/v1/auth/wallets/recovery/challenge', approveSession.token, {
    caip10: `eip155:1:${approveWallet.address}`,
    action: 'replace_wallet',
  });
  assert.equal(approveChallenge.statusCode, 200, JSON.stringify(approveChallenge.json()));
  console.log('PASS admin checker approval allows a replacement challenge without changing KYC');

  const stillCurrent = await isSessionValid(session.sessionId);
  const otherRevoked = await isSessionValid(otherDevice.sessionId);
  assert.equal(stillCurrent, true);
  assert.equal(otherRevoked, false);
  console.log('PASS 16 other sessions revoked when recovery cooldown starts');
  console.log('PASS 36 current authorizing session remains');

  const totpUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status, totp_enabled, totp_secret) VALUES ('user', 'active', TRUE, $1) RETURNING id`,
    [encryptTotp(totpSecret)]
  )).rows[0]!.id;
  const totpSession = await tokenFor(totpUser);
  const disableOnly = await authed('POST', '/api/v1/auth/2fa/disable', totpSession.token, { code: totp.generate() });
  assert.equal(disableOnly.statusCode, 409);
  assert.equal((disableOnly.json() as ApiBody).error?.code, 'LAST_FACTOR');
  const totpWallet = Wallet.createRandom();
  await link(totpSession.token, totpWallet, true);
  const disableWithWallet = await authed('POST', '/api/v1/auth/2fa/disable', totpSession.token, { code: totp.generate() });
  assert.equal(disableWithWallet.statusCode, 200, JSON.stringify(disableWithWallet.json()));
  console.log('PASS 17 totp disable uses a remaining factor and does not require email');

  const passkeyOnly = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status) VALUES ('user', 'active') RETURNING id`
  )).rows[0]!.id;
  const onlyPasskey = crypto.randomUUID();
  await pool.query(
    `INSERT INTO user_passkeys (id, user_id, credential_id, public_key) VALUES ($1, $2, 'only', 'key')`,
    [onlyPasskey, passkeyOnly]
  );
  const passkeyOnlySession = await tokenFor(passkeyOnly);
  const removeLast = await authed('DELETE', `/api/v1/auth/passkeys/${onlyPasskey}`, passkeyOnlySession.token);
  assert.equal(removeLast.statusCode, 409);
  assert.equal((removeLast.json() as ApiBody).error?.code, 'LAST_FACTOR');
  console.log('PASS 18 last passkey cannot be removed');

  const fund = await authed('POST', '/api/v1/auth/fund-password/set', session.token, { password: 'FundPass1' });
  assert.equal(fund.statusCode, 200, JSON.stringify(fund.json()));
  const emailStillNull = (await pool.query<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [user])).rows[0]!.email;
  assert.equal(emailStillNull, null);
  console.log('PASS 19 fund password change does not require an email');

  const changeEmail = await authed('POST', '/api/v1/auth/change-email', session.token, { newEmail: 'added@wallet-recovery.test', otp: '000000' });
  assert.equal(changeEmail.statusCode, 400);
  assert.equal((changeEmail.json() as ApiBody).error?.code, 'INVALID_OTP');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND normalized_address = $2`, [user, walletC.address.toLowerCase()]), 1);
  console.log('PASS 20 email change still verifies the new address and does not prove wallet ownership');

  const changePhone = await authed('POST', '/api/v1/auth/change-phone', session.token, { newPhone: '+15555550123', otp: '000000' });
  assert.notEqual(changePhone.statusCode, 500);
  console.log('PASS 21 phone change does not crash for a wallet-only user');

  const withdrawalId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO withdrawals (id, user_id, status, email_verified) VALUES ($1, $2, 'pending', FALSE)`,
    [withdrawalId, user]
  );
  const otpSend = await authed('POST', `/api/v1/wallet/withdrawals/${withdrawalId}/send-email-otp`, session.token, {});
  assert.equal(otpSend.statusCode, 400);
  assert.equal((otpSend.json() as ApiBody).error?.code, 'INVALID_STATUS');
  await pool.query(`UPDATE withdrawals SET status = 'pending_email_verify' WHERE id = $1`, [withdrawalId]);
  const historicalOtp = await authed('POST', `/api/v1/wallet/withdrawals/${withdrawalId}/send-email-otp`, session.token, {});
  assert.equal(historicalOtp.statusCode, 400);
  assert.equal((historicalOtp.json() as ApiBody).error?.code, 'NO_EMAIL');
  console.log('PASS 22 pending withdrawal is not an email gate and a historical email row cannot proceed without an email');

  assert.equal(await count(`SELECT count(*)::int AS n FROM wallets`), custodyBefore);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_master_keys`), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM hot_wallets`), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM cold_wallets`), 1);
  console.log('PASS 23 custody tables unchanged');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_balances`), balancesBefore);
  assert.equal(await count(`SELECT count(*)::int AS n FROM spot_orders WHERE symbol = 'BTCUSDT'`), 1);
  assert.equal(await count(`SELECT count(*)::int AS n FROM p2p_orders`), 1);
  console.log('PASS 24 financial rows unchanged');
  const forexAfter = (await pool.query<{ user_id: string; account_id: string; address: string | null }>(
    `SELECT user_id, account_id, address FROM forex_accounts WHERE id = 1`
  )).rows[0]!;
  assert.equal(forexAfter.user_id, forexBefore.user_id);
  assert.equal(forexAfter.account_id, 'FX-KEEP');
  assert.equal(forexAfter.address, null);
  console.log('PASS 25 forex identity unchanged');
  assert.equal((await pool.query<{ status: string }>(`SELECT status FROM kyc_applications WHERE user_id = $1`, [user])).rows[0]!.status, 'approved');
  console.log('PASS 26 KYC remains on the original user');

  const customerOnAdmin = await authed('POST', `/api/v1/admin/wallet-recovery/${user}/review`, session.token, { reason: 'no' });
  assert.equal(customerOnAdmin.statusCode, 401);
  const adminOnCustomer = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallets/recovery',
    headers: { authorization: `Bearer ${makerJwt}` },
    payload: {},
  });
  assert.equal(adminOnCustomer.statusCode, 401);
  assert.equal(await count(`SELECT count(*)::int AS n FROM admin_sessions`), adminSessionsBefore + 0 || adminSessionsBefore);
  console.log('PASS 27 customer recovery cannot create an admin session');

  const idor = await authed('GET', '/api/v1/auth/wallets/recovery', otherSession.token);
  const idorBody = idor.json() as ApiBody;
  assert.notEqual(idorBody.data?.recovery?.id, (passkeyRequest.json() as ApiBody).data?.recovery?.id);
  const idorCancel = await authed('POST', '/api/v1/auth/wallets/recovery/cancel', otherSession.token, { userId: user });
  assert.notEqual((await pool.query<{ status: string }>(
    `SELECT preferences->'walletRecovery'->>'status' AS status FROM users WHERE id = $1`,
    [user]
  )).rows[0]?.status, 'CANCELLED');
  assert.ok(idorCancel.statusCode === 400 || idorCancel.statusCode === 404);
  console.log('PASS 28 another user cannot control this recovery');

  const raceUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status) VALUES ('user', 'active') RETURNING id`
  )).rows[0]!.id;
  const raceSession = await tokenFor(raceUser);
  const [first, second] = await Promise.all([
    app.inject({ method: 'POST', url: '/api/v1/auth/wallets/recovery', headers: { authorization: `Bearer ${raceSession.token}` }, payload: {} }),
    app.inject({ method: 'POST', url: '/api/v1/auth/wallets/recovery', headers: { authorization: `Bearer ${raceSession.token}` }, payload: {} }),
  ]);
  const codes = [first.statusCode, second.statusCode].sort();
  assert.deepEqual(codes, [200, 409]);
  assert.equal(await count(
    `SELECT count(*)::int AS n FROM users WHERE id = $1 AND preferences->'walletRecovery'->>'status' = 'REQUESTED'`,
    [raceUser]
  ), 1);
  console.log('PASS 29 concurrent recovery does not open two cases');

  const bindUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status) VALUES ('user', 'active') RETURNING id`
  )).rows[0]!.id;
  const bindSession = await tokenFor(bindUser);
  const bindA = Wallet.createRandom();
  const bindB = Wallet.createRandom();
  const bindC = Wallet.createRandom();
  const bindIdA = await link(bindSession.token, bindA, true);
  await link(bindSession.token, bindB);
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery', bindSession.token, { lostWalletId: bindIdA })).statusCode, 200);
  const bindAuth = await signAction(bindSession.token, bindB, 'authorize_wallet_recovery');
  assert.equal((await authed('POST', '/api/v1/auth/wallets/recovery/factor', bindSession.token, { factor: 'second_wallet', ...bindAuth })).statusCode, 200);
  const bindReplace = await signAction(bindSession.token, bindC, 'replace_wallet');
  const mismatch = await authed('POST', `/api/v1/auth/wallets/${bindIdA}/primary`, bindSession.token, bindReplace);
  assert.equal(mismatch.statusCode, 400);
  assert.equal((mismatch.json() as ApiBody).error?.code, 'ACTION_MISMATCH');
  const unlinkMismatch = await authed('POST', `/api/v1/auth/wallets/${bindIdA}/unlink`, bindSession.token, bindReplace);
  assert.equal(unlinkMismatch.statusCode, 400);
  assert.equal((unlinkMismatch.json() as ApiBody).error?.code, 'ACTION_MISMATCH');
  console.log('PASS 31 recovery signature cannot set a primary wallet or unlink');

  const auditCount = await count(
    `SELECT count(*)::int AS n FROM admin_activity_logs WHERE action = 'wallet_recovery'`
  );
  assert.ok(auditCount >= 1);
  const userAudit = await count(
    `SELECT count(*)::int AS n FROM user_activity_logs WHERE user_id = $1 AND details->>'action' = 'recovery_cooldown_started'`,
    [user]
  );
  assert.ok(userAudit >= 1);
  console.log('PASS 34 admin recovery is audited');

  const forged = await authed('POST', '/api/v1/auth/preferences', session.token, {
    walletRecovery: { status: 'REJECTED', id: 'forged' },
    displayCurrency: 'USDT',
  });
  assert.equal(forged.statusCode, 200, JSON.stringify(forged.json()));
  const stored = (await pool.query<{ status: string }>(
    `SELECT preferences->'walletRecovery'->>'status' AS status FROM users WHERE id = $1`,
    [user]
  )).rows[0]!.status;
  assert.equal(stored, 'COMPLETED');
  const prefs = await authed('GET', '/api/v1/auth/preferences', session.token);
  assert.equal((prefs.json() as { data?: { walletRecovery?: unknown } }).data?.walletRecovery, undefined);
  console.log('PASS preferences cannot forge a hidden recovery case or expose it');

  const disabledUser = (await pool.query<{ id: string }>(
    `INSERT INTO users (role, status) VALUES ('user', 'active') RETURNING id`
  )).rows[0]!.id;
  const disabledSession = await tokenFor(disabledUser);
  const disabledWallet = Wallet.createRandom();
  const disabledId = await link(disabledSession.token, disabledWallet, true);
  const extra = Wallet.createRandom();
  const extraId = await link(disabledSession.token, extra);
  const promote = await authed('POST', `/api/v1/auth/wallets/${extraId}/step-up`, disabledSession.token, { action: 'set_primary_wallet' });
  const promoteBody = promote.json() as ApiBody;
  assert.equal(promote.statusCode, 200, JSON.stringify(promoteBody));
  const promoteTyped = JSON.parse(promoteBody.challenge!.message) as {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    message: Record<string, unknown>;
  };
  const promoteSig = await extra.signTypedData(promoteTyped.domain, promoteTyped.types, promoteTyped.message);
  assert.equal((await authed('POST', `/api/v1/auth/wallets/${extraId}/primary`, disabledSession.token, {
    challengeId: promoteBody.challenge!.id,
    message: promoteBody.challenge!.message,
    signature: promoteSig,
  })).statusCode, 200);
  const disableStep = await authed('POST', `/api/v1/auth/wallets/${disabledId}/step-up`, disabledSession.token, { action: 'unlink_wallet' });
  const disableBody = disableStep.json() as ApiBody;
  const disableTyped = JSON.parse(disableBody.challenge!.message) as {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    message: Record<string, unknown>;
  };
  const disabledSig = await disabledWallet.signTypedData(disableTyped.domain, disableTyped.types, disableTyped.message);
  assert.equal((await authed('POST', `/api/v1/auth/wallets/${disabledId}/primary`, disabledSession.token, {
    challengeId: crypto.randomUUID(),
    message: disableBody.challenge!.message,
    signature: disabledSig,
  })).statusCode, 400);
  const removed = await authed('POST', `/api/v1/auth/wallets/${disabledId}/unlink`, disabledSession.token, {
    challengeId: disableBody.challenge!.id,
    message: disableBody.challenge!.message,
    signature: disabledSig,
  });
  assert.equal(removed.statusCode, 200, JSON.stringify(removed.json()));
  const disabledLogin = await login(disabledWallet);
  assert.equal(disabledLogin.statusCode, 403);
  console.log('PASS 15 disabled wallet cannot log in');

  setWalletRecoveryClockForTests(null);
  setPasskeyRecoveryVerifierForTests(null);
  await app.close();
  await rateRedis.quit();
  await redis.close();
  await db.close();
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
