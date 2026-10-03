/**
 * STEP 12 cutover gates on an isolated database.
 * Refuses database name `exchange` or `postgres`, and refuses Redis on port 6379.
 * The runner must point at a restored STEP 0 dump plus the wallet identity migration.
 */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { Wallet } from 'ethers';

const testUrl = process.env.CUTOVER_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.CUTOVER_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('CUTOVER_TEST_DATABASE_URL and CUTOVER_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run cutover tests against a non-isolated database');
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
process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = 'test-csrf-secret-must-be-32-chars-min';
process.env.REDIS_URL = redisUrlRaw;
process.env.LOG_LEVEL = 'error';

const PASSWORD = 'Password1a';
const RESET_PASSWORD = 'Password2b';
const FRONTEND = 'http://wallet-auth.test:3000';

const IDS = {
  legacy: 'a1000000-0000-4000-8000-000000000001',
  linked: 'a1000000-0000-4000-8000-000000000002',
  otp: 'a1000000-0000-4000-8000-000000000003',
  disabled: 'a1000000-0000-4000-8000-000000000004',
  multi: 'a1000000-0000-4000-8000-000000000005',
  oauth: 'a1000000-0000-4000-8000-000000000006',
  sms: 'a1000000-0000-4000-8000-000000000007',
} as const;

const EMAIL = {
  legacy: 'legacy@step12.test',
  linked: 'linked@step12.test',
  otp: 'otp@step12.test',
  disabled: 'disabled@step12.test',
  multi: 'multi@step12.test',
  oauth: 'oauth@step12.test',
  sms: 'sms@step12.test',
  fresh: 'fresh-signup@step12.test',
  unknown: 'missing@step12.test',
  oauthNew: 'oauth-new@step12.test',
} as const;

type ErrorBody = { success: boolean; error?: { code?: string; message?: string }; data?: Record<string, unknown> };

function codeOf(body: string): string {
  const parsed = JSON.parse(body) as ErrorBody;
  return parsed.error?.code ?? '';
}

function messageOf(body: string): string {
  const parsed = JSON.parse(body) as ErrorBody;
  return parsed.error?.message ?? '';
}

async function run(): Promise<void> {
  const { Pool } = await import('pg');
  const Redis = (await import('ioredis')).default;
  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const jwt = (await import('@fastify/jwt')).default;
  const { config } = await import('../config/index.js');
  const { db } = await import('../lib/database.js');
  const { redis } = await import('../lib/redis.js');
  const { isSessionValid, createSession } = await import('../services/session.service.js');
  const { ACCESS_COOKIE } = await import('../lib/auth-cookies.js');
  const { default: authRoutes } = await import('./auth.fastify.js');
  const { default: walletLoginRoutes } = await import('./auth-wallet-login.fastify.js');
  const { default: cutoverRoutes } = await import('./auth-legacy-cutover.fastify.js');
  const { default: adminMigrationRoutes } = await import('./admin-wallet-migration.fastify.js');
  const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
  const { otpService } = await import('../services/otp.service.js');
  const { findOrCreateOAuthUser } = await import('./auth.oauth.js');
  const { assertEmailCannotLinkWallet } = await import('../services/wallet-recovery.service.js');
  const {
    setCutoverMode,
    CutoverRefused,
    buildMigrationReadiness,
    LegacySignupClosed,
    LegacyCustomerLoginClosed,
    LEGACY_DISABLED_MESSAGE,
  } = await import('../services/legacy-auth-policy.service.js');

  const pool = new Pool({ connectionString: testUrl, max: 4 });
  const rateRedis = new Redis(redisUrlRaw);
  const passwordHash = await bcrypt.hash(PASSWORD, 4);

  async function clearRates(): Promise<void> {
    const keys = await rateRedis.keys('rate:*');
    if (keys.length > 0) await rateRedis.del(...keys);
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query<{ n: number }>(sql, params);
    const value = result.rows[0]?.n;
    return typeof value === 'number' ? value : 0;
  }

  async function tableCount(table: string): Promise<number | null> {
    const exists = await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    if (!exists.rows[0]?.t) return null;
    return count(`SELECT count(*)::int AS n FROM ${table}`);
  }

  const watched = [
    'user_balances', 'balance_ledger', 'spot_orders', 'trades', 'p2p_orders', 'p2p_escrow',
    'forex_accounts', 'forex_ledger_transactions', 'forex_ledger_entries',
    'wallets', 'user_master_keys', 'hot_wallets', 'cold_wallets', 'kyc_applications', 'password_history',
  ] as const;
  const before: Record<string, number | null> = {};
  for (const table of watched) before[table] = await tableCount(table);

  await pool.query(`DELETE FROM system_settings WHERE key = 'wallet_auth_cutover_mode'`);
  await pool.query(
    `DELETE FROM wallet_auth_challenges WHERE user_id = ANY($1::uuid[])`,
    [Object.values(IDS)]
  );
  await pool.query(
    `DELETE FROM user_wallets WHERE user_id = ANY($1::uuid[])`,
    [Object.values(IDS)]
  );
  await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[]) OR email = ANY($2::text[])`, [
    Object.values(IDS),
    Object.values(EMAIL),
  ]);

  async function insertUser(id: string, email: string, code: string, phone: string | null = null): Promise<void> {
    await pool.query(
      `INSERT INTO users (id, email, phone, password_hash, referral_code, status, role, email_verified, phone_verified)
       VALUES ($1, $2, $3, $4, $5, 'active', 'user', TRUE, $6)`,
      [id, email, phone, passwordHash, code, phone != null]
    );
  }

  await insertUser(IDS.legacy, EMAIL.legacy, 'S12LEGACY1');
  await insertUser(IDS.linked, EMAIL.linked, 'S12LINKED1');
  await insertUser(IDS.otp, EMAIL.otp, 'S12OTP0001');
  await insertUser(IDS.disabled, EMAIL.disabled, 'S12DISABL1');
  await insertUser(IDS.multi, EMAIL.multi, 'S12MULTI01');
  await insertUser(IDS.oauth, EMAIL.oauth, 'S12OAUTH01');
  await insertUser(IDS.sms, EMAIL.sms, 'S12SMS0001', '+15550001111');
  await pool.query(`UPDATE users SET sms_auth_enabled = TRUE WHERE id = $1`, [IDS.sms]);
  await pool.query(`UPDATE users SET totp_enabled = TRUE, totp_secret = 'kept-secret' WHERE id = $1`, [IDS.linked]);

  async function insertWallet(userId: string, wallet: Wallet, status: 'active' | 'disabled' | 'compromised', primary: boolean): Promise<void> {
    const address = wallet.address;
    const normalized = address.toLowerCase();
    await pool.query(
      `INSERT INTO user_wallets (
         user_id, namespace, chain_reference, address, normalized_address, caip10,
         wallet_type, is_primary, is_verified, verified_at, linked_at, status
       ) VALUES ($1, 'eip155', '1', $2, $3, $4, 'eoa', $5, TRUE, NOW(), NOW(), $6)`,
      [userId, address, normalized, `eip155:1:${address}`, primary, status]
    );
  }

  const linkedWallet = Wallet.createRandom();
  await insertWallet(IDS.linked, linkedWallet, 'active', true);
  const disabledWallet = Wallet.createRandom();
  await insertWallet(IDS.disabled, disabledWallet, 'disabled', true);
  const multiA = Wallet.createRandom();
  const multiB = Wallet.createRandom();
  await insertWallet(IDS.multi, multiA, 'active', true);
  await insertWallet(IDS.multi, multiB, 'active', false);

  const sameLinked = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [EMAIL.linked]);
  assert.equal(sameLinked.rows[0]?.id, IDS.linked);

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwt, { secret: config.jwt.secret });
  app.decorate('authenticate', async function (request, reply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
      }
      const decoded = app.jwt.verify<{ userId: string; email?: string; role: string; sessionId: string; type?: string }>(token);
      if (decoded.type === 'admin' || decoded.type === 'refresh') {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Use user token for this route' } });
      }
      const valid = await isSessionValid(decoded.sessionId);
      if (!valid) {
        return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
      }
      request.user = { id: decoded.userId, email: decoded.email, role: decoded.role, sessionId: decoded.sessionId };
    } catch {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }
  });
  app.addHook('onRequest', async (request) => {
    if (!request.headers.authorization?.startsWith('Bearer ')) {
      const cookieToken = request.cookies?.[ACCESS_COOKIE];
      if (typeof cookieToken === 'string' && cookieToken.length > 0) {
        request.headers.authorization = `Bearer ${cookieToken}`;
      }
    }
  });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });
  await app.register(cutoverRoutes, { prefix: '/api/v1/auth' });
  await app.register(adminMigrationRoutes, { prefix: '/api/v1/admin' });
  await app.ready();

  async function postPassword(email: string, password = PASSWORD, extra: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/login/password',
      payload: { email, password, ...extra },
    });
  }

  async function issueLogin(wallet: Wallet) {
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:1:${wallet.address}`,
      frontendUrl: FRONTEND,
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = await wallet.signMessage(challenge.message);
    await clearRates();
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: { challengeId: challenge.id, message: challenge.message, signature },
    });
  }

  function sessionOf(body: string): { userId: string; accessToken: string; refreshToken: string; email: string | null } {
    const parsed = JSON.parse(body) as {
      data: { user: { id: string; email: string | null }; accessToken: string; refreshToken: string };
    };
    return {
      userId: parsed.data.user.id,
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      email: parsed.data.user.email,
    };
  }

  async function hashSame(userId: string): Promise<boolean> {
    const row = await pool.query<{ same: boolean }>(
      `SELECT (password_hash = $2) AS same FROM users WHERE id = $1`,
      [userId, passwordHash]
    );
    return row.rows[0]?.same === true;
  }

  const usersBeforeNative = await count(`SELECT count(*)::int AS n FROM users`);

  await clearRates();
  const legacyLogin = await postPassword(EMAIL.legacy);
  assert.equal(legacyLogin.statusCode, 200, legacyLogin.body);
  const legacySession = sessionOf(legacyLogin.body);
  assert.equal(legacySession.userId, IDS.legacy);

  await clearRates();
  const [racePassword, raceLink] = await Promise.all([
    postPassword(EMAIL.legacy),
    pool.query(`SELECT id FROM users WHERE id = $1`, [IDS.legacy]),
  ]);
  assert.equal(racePassword.statusCode, 200, racePassword.body);
  assert.equal(raceLink.rows[0]?.id, IDS.legacy);

  await clearRates();
  const linkedDuringWindow = await postPassword(EMAIL.linked);
  assert.equal(linkedDuringWindow.statusCode, 200, linkedDuringWindow.body);
  assert.equal(sessionOf(linkedDuringWindow.body).userId, IDS.linked);

  await clearRates();
  const wrong = await postPassword(EMAIL.linked, 'WrongPass1');
  assert.equal(wrong.statusCode, 401);
  assert.equal(codeOf(wrong.body), 'INVALID_CREDENTIALS');
  assert.equal(messageOf(wrong.body).includes('wallet'), false);

  await clearRates();
  const missing = await postPassword(EMAIL.unknown);
  assert.equal(missing.statusCode, 401);
  assert.equal(messageOf(missing.body).includes('wallet'), false);

  const linkedWalletLogin = await issueLogin(linkedWallet);
  assert.equal(linkedWalletLogin.statusCode, 200, linkedWalletLogin.body);
  const linkedWalletSession = sessionOf(linkedWalletLogin.body);
  assert.equal(linkedWalletSession.userId, IDS.linked);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [IDS.linked]), 1);

  const viewBefore = await app.inject({ method: 'GET', url: '/api/v1/auth/wallet-cutover' });
  assert.equal(viewBefore.statusCode, 200);
  const viewBody = JSON.parse(viewBefore.body) as { data: { mode: string; walletPrimary: boolean; legacyEntryAvailable: boolean } };
  assert.equal(viewBody.data.mode, 'LEGACY_AND_WALLET');
  assert.equal(viewBody.data.legacyEntryAvailable, true);

  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(() => setCutoverMode('WALLET_FIRST', 'step12-test'), CutoverRefused);
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
  const modeAfterRefuse = await pool.query(`SELECT value FROM system_settings WHERE key = 'wallet_auth_cutover_mode'`);
  assert.equal(modeAfterRefuse.rows.length, 0);

  await setCutoverMode('WALLET_PREFERRED', 'step12-test');
  await clearRates();
  const preferred = await postPassword(EMAIL.linked);
  assert.equal(preferred.statusCode, 200, preferred.body);
  const preferredView = JSON.parse((await app.inject({ method: 'GET', url: '/api/v1/auth/wallet-cutover' })).body) as {
    data: { walletPrimary: boolean };
  };
  assert.equal(preferredView.data.walletPrimary, true);

  await setCutoverMode('WALLET_FIRST', 'step12-test');
  const readiness = await buildMigrationReadiness();
  assert.equal(readiness.productionCutoverExecuted, false);
  assert.equal(readiness.checks.filter((check) => check.required && !check.ok).length, 0);

  await clearRates();
  const blockedPassword = await postPassword(EMAIL.linked);
  assert.equal(blockedPassword.statusCode, 403, blockedPassword.body);
  assert.equal(codeOf(blockedPassword.body), 'LEGACY_AUTH_DISABLED');
  assert.equal(messageOf(blockedPassword.body), LEGACY_DISABLED_MESSAGE);
  assert.equal(await hashSame(IDS.linked), true);

  await clearRates();
  const forged = await postPassword(EMAIL.linked, PASSWORD, {
    userId: IDS.legacy,
    role: 'admin',
    migrationState: 'UNMIGRATED',
    walletStatus: 'disabled',
  });
  assert.equal(forged.statusCode, 403, forged.body);
  const roleRow = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [IDS.linked]);
  assert.equal(roleRow.rows[0]?.role, 'user');

  const [cutA, cutB] = await Promise.all([postPassword(EMAIL.linked), postPassword(EMAIL.linked)]);
  assert.equal(cutA.statusCode, 403);
  assert.equal(cutB.statusCode, 403);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.linked]), 1);

  const walletsBeforeOtp = await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.linked]);
  const linkedOtp = await otpService.createOTP(EMAIL.linked, 'email', IDS.linked);
  await clearRates();
  const blockedOtp = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: EMAIL.linked, otp: linkedOtp.otp },
  });
  assert.equal(blockedOtp.statusCode, 403, blockedOtp.body);
  assert.equal(messageOf(blockedOtp.body), LEGACY_DISABLED_MESSAGE);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.linked]), walletsBeforeOtp);

  await clearRates();
  const badOtp = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: EMAIL.linked, otp: '000000' },
  });
  assert.notEqual(badOtp.statusCode, 200);
  assert.equal(messageOf(badOtp.body).includes('wallet'), false);

  await clearRates();
  const unmigratedPassword = await postPassword(EMAIL.legacy);
  assert.equal(unmigratedPassword.statusCode, 200, unmigratedPassword.body);
  const unmigratedSession = sessionOf(unmigratedPassword.body);

  const otpCode = await otpService.createOTP(EMAIL.otp, 'email', IDS.otp);
  await clearRates();
  const otpLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: EMAIL.otp, otp: otpCode.otp },
  });
  assert.equal(otpLogin.statusCode, 200, otpLogin.body);
  assert.equal(sessionOf(otpLogin.body).userId, IDS.otp);

  const [otpCutA, otpCutB] = await Promise.all([
    app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: EMAIL.linked, otp: '111111' } }),
    app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: EMAIL.linked, otp: '222222' } }),
  ]);
  assert.notEqual(otpCutA.statusCode, 200);
  assert.notEqual(otpCutB.statusCode, 200);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [IDS.linked]), 1);

  const nativeLogin = await issueLogin(Wallet.createRandom());
  assert.equal(nativeLogin.statusCode, 200, nativeLogin.body);
  const nativeSession = sessionOf(nativeLogin.body);
  assert.equal(nativeSession.email, null);
  const nativeRow = await pool.query<{ email: string | null; password_hash: string | null }>(
    `SELECT email, (password_hash IS NULL) AS password_hash FROM users WHERE id = $1`,
    [nativeSession.userId]
  );
  assert.equal(nativeRow.rows[0]?.email, null);
  assert.equal(nativeRow.rows[0]?.password_hash, true);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users`), usersBeforeNative + 1);

  const resetOtpBlocked = await otpService.createOTP(EMAIL.linked, 'password_reset', IDS.linked);
  const resetBlocked = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/password/reset',
    payload: { identifier: EMAIL.linked, otp: resetOtpBlocked.otp, newPassword: RESET_PASSWORD },
  });
  assert.equal(resetBlocked.statusCode, 403, resetBlocked.body);
  assert.equal(await hashSame(IDS.linked), true);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.linked]), walletsBeforeOtp);

  const resetRequestBefore = await count(
    `SELECT count(*)::int AS n FROM otp_verifications WHERE identifier = $1 AND type = 'password_reset'`,
    [EMAIL.linked]
  );
  await clearRates();
  const resetRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/password/reset/request',
    payload: { identifier: EMAIL.linked },
  });
  assert.equal(resetRequest.statusCode, 200, resetRequest.body);
  const resetRequestBody = JSON.parse(resetRequest.body) as { data?: { message?: string } };
  assert.match(resetRequestBody.data?.message ?? '', /If an account exists/);
  assert.equal(
    await count(
      `SELECT count(*)::int AS n FROM otp_verifications WHERE identifier = $1 AND type = 'password_reset'`,
      [EMAIL.linked]
    ),
    resetRequestBefore
  );

  const resetOtpOpen = await otpService.createOTP(EMAIL.legacy, 'password_reset', IDS.legacy);
  const resetOpen = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/password/reset',
    payload: { identifier: EMAIL.legacy, otp: resetOtpOpen.otp, newPassword: RESET_PASSWORD },
  });
  assert.equal(resetOpen.statusCode, 200, resetOpen.body);
  assert.equal(await hashSame(IDS.legacy), false);
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [IDS.legacy, passwordHash]);

  const passkeySession = await createSession({ userId: IDS.linked, authMethod: 'passkey', ipAddress: '127.0.0.1' });
  const passkeyRefresh = app.jwt.sign(
    { userId: IDS.linked, sessionId: passkeySession.sessionId, type: 'refresh' },
    { expiresIn: '7d' }
  );
  const passkeyRefreshRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: passkeyRefresh },
  });
  assert.equal(passkeyRefreshRes.statusCode, 200, passkeyRefreshRes.body);
  const totpRow = await pool.query<{ totp_enabled: boolean; kept: boolean }>(
    `SELECT totp_enabled, (totp_secret = 'kept-secret') AS kept FROM users WHERE id = $1`,
    [IDS.linked]
  );
  assert.equal(totpRow.rows[0]?.totp_enabled, true);
  assert.equal(totpRow.rows[0]?.kept, true);

  const walletAfter = await issueLogin(linkedWallet);
  assert.equal(walletAfter.statusCode, 200, walletAfter.body);
  const walletAfterSession = sessionOf(walletAfter.body);
  const walletRefresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: walletAfterSession.refreshToken },
  });
  assert.equal(walletRefresh.statusCode, 200, walletRefresh.body);

  const legacyIssued = await createSession({ userId: IDS.linked, authMethod: 'password', ipAddress: '127.0.0.1' });
  const legacyRefreshToken = app.jwt.sign(
    { userId: IDS.linked, sessionId: legacyIssued.sessionId, type: 'refresh' },
    { expiresIn: '7d' }
  );
  const legacyRefresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: legacyRefreshToken },
  });
  assert.equal(legacyRefresh.statusCode, 403, legacyRefresh.body);
  const stillThere = await redis.getJson<{ isActive: boolean; authMethod?: string }>(`session:${legacyIssued.sessionId}`);
  assert.equal(stillThere?.isActive, true);
  assert.equal(stillThere?.authMethod, 'password');

  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${unmigratedSession.accessToken}` },
  });
  assert.equal(me.statusCode, 200, me.body);

  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { authorization: `Bearer ${unmigratedSession.accessToken}` },
  });
  assert.equal(logout.statusCode, 200, logout.body);

  await clearRates();
  const current = await postPassword(EMAIL.otp);
  assert.equal(current.statusCode, 200, current.body);
  const currentSession = sessionOf(current.body);
  const other = await createSession({ userId: IDS.otp, authMethod: 'password', ipAddress: '127.0.0.1' });
  const logoutOthers = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout-all-other',
    headers: { authorization: `Bearer ${currentSession.accessToken}` },
  });
  assert.equal(logoutOthers.statusCode, 200, logoutOthers.body);
  const otherRow = await pool.query<{ is_active: boolean }>(`SELECT is_active FROM user_sessions WHERE id = $1`, [other.sessionId]);
  assert.equal(otherRow.rows[0]?.is_active, false);

  const multiLoginB = await issueLogin(multiB);
  assert.equal(multiLoginB.statusCode, 200, multiLoginB.body);
  assert.equal(sessionOf(multiLoginB.body).userId, IDS.multi);
  await pool.query(`UPDATE user_wallets SET status = 'disabled' WHERE user_id = $1 AND normalized_address = $2`, [
    IDS.multi,
    multiB.address.toLowerCase(),
  ]);
  const disabledB = await issueLogin(multiB);
  assert.equal(disabledB.statusCode, 403, disabledB.body);
  assert.equal(codeOf(disabledB.body), 'WALLET_UNAVAILABLE');
  await pool.query(`UPDATE user_wallets SET status = 'compromised' WHERE user_id = $1 AND normalized_address = $2`, [
    IDS.multi,
    multiA.address.toLowerCase(),
  ]);
  await pool.query(`UPDATE user_wallets SET status = 'active', is_primary = TRUE WHERE user_id = $1 AND normalized_address = $2`, [
    IDS.multi,
    multiB.address.toLowerCase(),
  ]);
  const activeB = await issueLogin(multiB);
  assert.equal(activeB.statusCode, 200, activeB.body);
  assert.equal(sessionOf(activeB.body).userId, IDS.multi);
  const compromisedA = await issueLogin(multiA);
  assert.equal(compromisedA.statusCode, 403);
  await pool.query(`UPDATE user_wallets SET status = 'disabled' WHERE user_id = $1`, [IDS.multi]);
  await clearRates();
  const noDowngrade = await postPassword(EMAIL.multi);
  assert.equal(noDowngrade.statusCode, 403, noDowngrade.body);
  const allDisabledLogin = await issueLogin(multiB);
  assert.notEqual(allDisabledLogin.statusCode, 200);

  const disabledOnly = await issueLogin(disabledWallet);
  assert.equal(disabledOnly.statusCode, 403);

  assert.throws(() => assertEmailCannotLinkWallet());

  await redis.set(`otp:verified:${EMAIL.linked}`, 'true', 600);
  await setCutoverMode('LEGACY_AND_WALLET', 'step12-test');
  const usersBeforeSignup = await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.linked]);
  const duplicateSignup = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email: EMAIL.linked, password: PASSWORD },
  });
  assert.equal(duplicateSignup.statusCode, 400, duplicateSignup.body);
  assert.equal(codeOf(duplicateSignup.body), 'USER_EXISTS');
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.linked]), usersBeforeSignup);

  await setCutoverMode('WALLET_FIRST', 'step12-test');
  const closedSignup = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email: EMAIL.fresh, password: PASSWORD },
  });
  assert.equal(closedSignup.statusCode, 403, closedSignup.body);
  assert.equal(codeOf(closedSignup.body), 'LEGACY_SIGNUP_CLOSED');
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.fresh]), 0);

  const fakeRequest = {
    headers: { 'user-agent': 'step12-test' },
    socket: { remoteAddress: '127.0.0.1' },
    ip: '127.0.0.1',
  } as import('fastify').FastifyRequest;
  const linkedOauth = await findOrCreateOAuthUser(app, 'google', 'step12-google-subject', EMAIL.oauth, 'O', 'Auth', null, fakeRequest);
  assert.equal(linkedOauth.isNewUser, false);
  assert.equal(linkedOauth.user.id, IDS.oauth);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.oauth]), 1);
  await assert.rejects(
    () => findOrCreateOAuthUser(app, 'google', 'step12-google-new', EMAIL.oauthNew, 'N', 'Ew', null, fakeRequest),
    LegacySignupClosed
  );
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.oauthNew]), 0);

  await insertWallet(IDS.sms, Wallet.createRandom(), 'active', true);
  const smsOtp = await otpService.createOTP(EMAIL.sms, 'email', IDS.sms);
  await clearRates();
  const smsBlocked = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: EMAIL.sms, otp: smsOtp.otp },
  });
  assert.equal(smsBlocked.statusCode, 403);
  assert.equal(codeOf(smsBlocked.body), 'LEGACY_AUTH_DISABLED');

  const customerToken = unmigratedSession.accessToken;
  const adminPost = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/wallet-migration/mode',
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { mode: 'LEGACY_AND_WALLET' },
  });
  assert.equal(adminPost.statusCode, 401, adminPost.body);
  const stillFirst = await pool.query<{ value: { mode?: string } }>(
    `SELECT value FROM system_settings WHERE key = 'wallet_auth_cutover_mode'`
  );
  assert.equal(stillFirst.rows[0]?.value.mode, 'WALLET_FIRST');

  await setCutoverMode('LEGACY_AND_WALLET', 'step12-test');
  await clearRates();
  const restored = await postPassword(EMAIL.linked);
  assert.equal(restored.statusCode, 200, restored.body);
  const rolled = JSON.parse((await app.inject({ method: 'GET', url: '/api/v1/auth/wallet-cutover' })).body) as {
    data: { mode: string; walletPrimary: boolean };
  };
  assert.equal(rolled.data.mode, 'LEGACY_AND_WALLET');
  assert.equal(rolled.data.walletPrimary, false);
  const walletStill = await issueLogin(linkedWallet);
  assert.equal(walletStill.statusCode, 200, walletStill.body);

  const previousOnlyEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(() => setCutoverMode('WALLET_ONLY', 'step13-test'), CutoverRefused);
  } finally {
    process.env.NODE_ENV = previousOnlyEnv;
  }
  const modeBeforeOnly = await pool.query<{ value: { mode?: string } }>(
    `SELECT value FROM system_settings WHERE key = 'wallet_auth_cutover_mode'`
  );
  assert.equal(modeBeforeOnly.rows[0]?.value.mode, 'LEGACY_AND_WALLET');

  await setCutoverMode('WALLET_ONLY', 'step13-test');
  const onlyView = JSON.parse((await app.inject({ method: 'GET', url: '/api/v1/auth/wallet-cutover' })).body) as {
    data: { mode: string; walletPrimary: boolean; legacyEntryAvailable: boolean };
  };
  assert.equal(onlyView.data.mode, 'WALLET_ONLY');
  assert.equal(onlyView.data.walletPrimary, true);
  assert.equal(onlyView.data.legacyEntryAvailable, false);

  await clearRates();
  const zeroPassword = await postPassword(EMAIL.legacy);
  assert.equal(zeroPassword.statusCode, 403, zeroPassword.body);
  assert.equal(codeOf(zeroPassword.body), 'LEGACY_AUTH_DISABLED');
  assert.equal(await hashSame(IDS.legacy), true);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.legacy]), 0);

  await clearRates();
  const wrongOnly = await postPassword(EMAIL.legacy, 'WrongPass1');
  assert.equal(wrongOnly.statusCode, 401, wrongOnly.body);
  assert.equal(messageOf(wrongOnly.body).includes('wallet'), false);

  const zeroOtp = await otpService.createOTP(EMAIL.legacy, 'email', IDS.legacy);
  await clearRates();
  const zeroOtpLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: EMAIL.legacy, otp: zeroOtp.otp },
  });
  assert.equal(zeroOtpLogin.statusCode, 403, zeroOtpLogin.body);
  assert.equal(codeOf(zeroOtpLogin.body), 'LEGACY_AUTH_DISABLED');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.legacy]), 0);

  const phoneOtp = await otpService.createOTP('+15550001111', 'phone', IDS.sms);
  await clearRates();
  const phoneOtpLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { phone: '+15550001111', otp: phoneOtp.otp },
  });
  assert.equal(phoneOtpLogin.statusCode, 403, phoneOtpLogin.body);
  assert.equal(codeOf(phoneOtpLogin.body), 'LEGACY_AUTH_DISABLED');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.sms]), 1);

  const { authService } = await import('../services/auth.service.js');
  await assert.rejects(
    () => authService.login({ email: EMAIL.legacy, password: PASSWORD, ip: '127.0.0.1' }),
    (error: unknown) => error instanceof Error && error.message === LEGACY_DISABLED_MESSAGE
  );
  await assert.rejects(
    () => authService.oauthLogin({
      provider: 'google',
      providerUserId: 'step13-express-oauth',
      email: EMAIL.oauth,
      ip: '127.0.0.1',
    }),
    (error: unknown) => error instanceof Error && error.message === LEGACY_DISABLED_MESSAGE
  );
  await assert.rejects(
    () => authService.signup({ email: EMAIL.fresh, password: PASSWORD, provider: 'email', ip: '127.0.0.1' }),
    (error: unknown) => error instanceof Error && error.message === 'Connect your wallet to continue.'
  );

  const passwordIssued = await createSession({ userId: IDS.legacy, authMethod: 'password', ipAddress: '127.0.0.1' });
  const passwordRefresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: {
      refreshToken: app.jwt.sign(
        { userId: IDS.legacy, sessionId: passwordIssued.sessionId, type: 'refresh' },
        { expiresIn: '7d' }
      ),
    },
  });
  assert.equal(passwordRefresh.statusCode, 403, passwordRefresh.body);
  const passwordKept = await redis.getJson<{ isActive: boolean; authMethod?: string }>(`session:${passwordIssued.sessionId}`);
  assert.equal(passwordKept?.isActive, true);
  assert.equal(passwordKept?.authMethod, 'password');
  const { generateTokens: expressTokens } = await import('../middleware/auth.js');
  const expressRefresh = expressTokens(IDS.legacy, EMAIL.legacy, 'user' as import('../types/index.js').UserRole, passwordIssued.sessionId).refreshToken;
  await assert.rejects(
    () => authService.refreshToken(expressRefresh, '127.0.0.1'),
    (error: unknown) => error instanceof Error && error.message === LEGACY_DISABLED_MESSAGE
  );
  const expressKept = await redis.getJson<{ isActive: boolean }>(`session:${passwordIssued.sessionId}`);
  assert.equal(expressKept?.isActive, true);

  for (const method of ['passkey', 'oauth'] as const) {
    const issued = await createSession({ userId: IDS.linked, authMethod: method, ipAddress: '127.0.0.1' });
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken: app.jwt.sign(
          { userId: IDS.linked, sessionId: issued.sessionId, type: 'refresh' },
          { expiresIn: '7d' }
        ),
      },
    });
    assert.equal(refreshed.statusCode, 403, `${method} ${refreshed.body}`);
  }

  const freshOnly = await issueLogin(Wallet.createRandom());
  assert.equal(freshOnly.statusCode, 200, freshOnly.body);
  const freshOnlySession = sessionOf(freshOnly.body);
  assert.equal(freshOnlySession.email, null);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND status = 'active' AND is_primary IS TRUE`, [freshOnlySession.userId]), 1);

  const onlyWallet = await issueLogin(linkedWallet);
  assert.equal(onlyWallet.statusCode, 200, onlyWallet.body);
  const onlyWalletSession = sessionOf(onlyWallet.body);
  assert.equal(onlyWalletSession.userId, IDS.linked);
  const onlyWalletRefresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: onlyWalletSession.refreshToken },
  });
  assert.equal(onlyWalletRefresh.statusCode, 200, onlyWalletRefresh.body);
  const refreshedAccess = (JSON.parse(onlyWalletRefresh.body) as { data?: { accessToken?: string } }).data?.accessToken;
  assert.equal(typeof refreshedAccess, 'string');
  const refreshedIdentity = app.jwt.verify<{ userId: string; type?: string }>(refreshedAccess!);
  assert.equal(refreshedIdentity.userId, IDS.linked);
  assert.notEqual(refreshedIdentity.type, 'admin');

  await clearRates();
  const passkeyClosed = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/passkey/authenticate/verify',
    payload: {},
  });
  assert.equal(passkeyClosed.statusCode, 403, passkeyClosed.body);
  assert.equal(codeOf(passkeyClosed.body), 'LEGACY_AUTH_DISABLED');

  const oauthUsers = await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.oauth]);
  await assert.rejects(
    () => findOrCreateOAuthUser(app, 'google', 'step12-google-subject', EMAIL.oauth, 'O', 'Auth', null, fakeRequest),
    LegacyCustomerLoginClosed
  );
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.oauth]), oauthUsers);

  const resetBefore = await hashSame(IDS.legacy);
  await clearRates();
  const resetOnly = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/password/reset/request',
    payload: { identifier: EMAIL.legacy },
  });
  assert.equal(resetOnly.statusCode, 200, resetOnly.body);
  assert.match(JSON.parse(resetOnly.body).data?.message ?? '', /If an account exists/);
  assert.equal(await hashSame(IDS.legacy), resetBefore);

  const closedOnly = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email: EMAIL.fresh, password: PASSWORD },
  });
  assert.equal(closedOnly.statusCode, 403, closedOnly.body);
  assert.equal(await count(`SELECT count(*)::int AS n FROM users WHERE email = $1`, [EMAIL.fresh]), 0);

  const customerOnly = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/wallet-migration/mode',
    headers: { authorization: `Bearer ${onlyWalletSession.accessToken}` },
    payload: { mode: 'LEGACY_AND_WALLET' },
  });
  assert.equal(customerOnly.statusCode, 401, customerOnly.body);

  await setCutoverMode('LEGACY_AND_WALLET', 'step13-test');
  await clearRates();
  const restoredAfterOnly = await postPassword(EMAIL.legacy);
  assert.equal(restoredAfterOnly.statusCode, 200, restoredAfterOnly.body);
  assert.equal(sessionOf(restoredAfterOnly.body).userId, IDS.legacy);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [IDS.legacy]), 0);

  await clearRates();
  let limited = 0;
  for (let i = 0; i < 6; i += 1) {
    const attempt = await postPassword(EMAIL.unknown, 'WrongPass1');
    limited = attempt.statusCode;
  }
  assert.equal(limited, 429);

  for (const table of watched) {
    assert.equal(await tableCount(table), before[table], table);
  }

  const legacyHashKept = await pool.query<{ present: boolean }>(
    `SELECT (password_hash IS NOT NULL) AS present FROM users WHERE id = $1`,
    [IDS.legacy]
  );
  assert.equal(legacyHashKept.rows[0]?.present, true);

  await app.close();
  await rateRedis.quit();
  await pool.end();
  await db.close();
  await redis.close();
  console.log('legacy-auth-cutover integration: PASS');
}

run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'cutover test failed');
    process.exit(1);
  });
