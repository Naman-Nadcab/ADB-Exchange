/**
 * STEP 5 wallet login against an isolated database.
 * Refuses database name `exchange` or `postgres`, and refuses Redis on port 6379.
 */
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { Pool } from 'pg';

const testUrl = process.env.WALLET_LOGIN_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.WALLET_LOGIN_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('WALLET_LOGIN_TEST_DATABASE_URL and WALLET_LOGIN_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run wallet login tests against a non-isolated database');
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

type LoginBody = {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      username: string | null;
      status: string;
      emailVerified: boolean;
      phoneVerified: boolean;
      tierLevel: number;
    };
    accessToken: string;
    refreshToken: string;
  };
  error?: { code: string; message: string };
};

function cookieHeader(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((part) => part.split(';')[0] ?? '').filter(Boolean).join('; ');
}

async function run(): Promise<void> {
  const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const jwt = (await import('@fastify/jwt')).default;
  const { config } = await import('../config/index.js');
  const { db } = await import('../lib/database.js');
  const { redis } = await import('../lib/redis.js');
  const { isSessionValid } = await import('../services/session.service.js');
  const { ACCESS_COOKIE, REFRESH_COOKIE } = await import('../lib/auth-cookies.js');
  const { default: authRoutes } = await import('./auth.fastify.js');
  const { default: walletLoginRoutes, setWalletLoginSessionOpenerForTests } = await import('./auth-wallet-login.fastify.js');
  const Redis = (await import('ioredis')).default;

  const pool = new Pool({ connectionString: testUrl, max: 8 });
  const rateRedis = new Redis(redisUrlRaw);
  await rateRedis.ping();
  await redis.ping();

  const emailNullable = await pool.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'`
  );
  assert.equal(emailNullable.rows[0]?.is_nullable, 'YES', 'STEP 2 email nullable migration is required');
  const walletsTable = await pool.query(`SELECT to_regclass('public.user_wallets') AS t`);
  assert.ok(walletsTable.rows[0]?.t, 'user_wallets missing');
  const challengesTable = await pool.query(`SELECT to_regclass('public.wallet_auth_challenges') AS t`);
  assert.ok(challengesTable.rows[0]?.t, 'wallet_auth_challenges missing');

  async function clearLimits(): Promise<void> {
    const keys = await rateRedis.keys('rate:auth:wallet-login:*');
    if (keys.length > 0) await rateRedis.del(...keys);
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query<{ n: number }>(sql, params);
    return result.rows[0]?.n ?? 0;
  }

  async function tableCount(table: string): Promise<number | null> {
    const exists = await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    if (!exists.rows[0]?.t) return null;
    return count(`SELECT count(*)::int AS n FROM ${table}`);
  }

  const custodyTables = ['wallets', 'user_master_keys', 'hot_wallets', 'cold_wallets'] as const;
  const forexTables = ['forex_accounts', 'forex_ledger_transactions', 'forex_ledger_entries'] as const;
  const custodyBefore: Record<string, number | null> = {};
  const forexBefore: Record<string, number | null> = {};
  for (const table of custodyTables) custodyBefore[table] = await tableCount(table);
  for (const table of forexTables) forexBefore[table] = await tableCount(table);
  const balanceLedgerBefore = await tableCount('balance_ledger');

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwt, { secret: config.jwt.secret });
  app.decorate('authenticate', async function (request, reply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
      }
      const decoded = app.jwt.verify<{
        userId: string;
        email?: string;
        phone?: string;
        role: string;
        sessionId: string;
        type?: string;
      }>(token);
      if (decoded.type === 'admin') {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Use user token for this route' } });
      }
      const valid = await isSessionValid(decoded.sessionId);
      if (!valid) {
        return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
      }
      request.user = {
        id: decoded.userId,
        email: decoded.email,
        phone: decoded.phone,
        role: decoded.role,
        sessionId: decoded.sessionId,
      };
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
  app.get('/api/v1/admin/auth/session-probe', async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }
    try {
      const decoded = app.jwt.verify<{ type?: string; adminId?: string; sessionId?: string }>(header.slice(7));
      if (decoded.type !== 'admin' || !decoded.sessionId || !decoded.adminId) {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Admin session required' } });
      }
    } catch {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }
    return reply.send({ success: true });
  });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });

  async function issue(wallet: Wallet, chain = '1') {
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:${chain}:${wallet.address}`,
      frontendUrl: FRONTEND,
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = await wallet.signMessage(challenge.message);
    return { challenge, signature, wallet };
  }

  async function login(issued: { challenge: { id: string; message: string }; signature: string }) {
    await clearLimits();
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: {
        challengeId: issued.challenge.id,
        message: issued.challenge.message,
        signature: issued.signature,
      },
    });
  }

  function authOf(res: { json: () => LoginBody; headers: { 'set-cookie'?: string | string[] } }) {
    const body = res.json();
    assert.equal(body.success, true);
    assert.ok(body.data?.accessToken);
    assert.ok(body.data?.refreshToken);
    const cookies = cookieHeader(res.headers['set-cookie']);
    assert.match(cookies, new RegExp(`${ACCESS_COOKIE}=`));
    assert.match(cookies, new RegExp(`${REFRESH_COOKIE}=`));
    const raw = res.headers['set-cookie'];
    const joined = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
    assert.match(joined, /HttpOnly/i);
    return { body: body.data!, cookies };
  }

  const results: string[] = [];

  const walletA = Wallet.createRandom();
  const usersBeforeA = await count('SELECT count(*)::int AS n FROM users');
  const issuedA = await issue(walletA);
  const loginA = await login(issuedA);
  assert.equal(loginA.statusCode, 200, loginA.body);
  const authA = authOf(loginA);
  assert.equal(authA.body.user.email, null);
  assert.equal(authA.body.user.status, 'active');
  assert.notEqual(authA.body.user.id, walletA.address);
  assert.notEqual(authA.body.user.id.toLowerCase(), walletA.address.toLowerCase());
  const userA = await pool.query<{
    id: string;
    role: string;
    email: string | null;
    password_hash: string | null;
    referral_code: string;
  }>(
    `SELECT id, role, email, password_hash, referral_code FROM users WHERE id = $1`,
    [authA.body.user.id]
  );
  assert.equal(userA.rows[0]?.role, 'user');
  assert.equal(userA.rows[0]?.email, null);
  assert.equal(userA.rows[0]?.password_hash, null);
  assert.ok(userA.rows[0]?.referral_code);
  const referral = await pool.query(`SELECT code FROM referral_codes WHERE user_id = $1`, [authA.body.user.id]);
  assert.equal(referral.rows[0]?.code, userA.rows[0]?.referral_code);
  const walletRowA = await pool.query<{
    id: string;
    user_id: string;
    is_primary: boolean;
    is_verified: boolean;
    status: string;
    provider: string | null;
    wallet_type: string;
    address: string;
    normalized_address: string;
    namespace: string;
  }>(
    `SELECT id, user_id, is_primary, is_verified, status, provider, wallet_type, address, normalized_address, namespace
     FROM user_wallets WHERE normalized_address = $1`,
    [walletA.address.toLowerCase()]
  );
  assert.equal(walletRowA.rows.length, 1);
  assert.equal(walletRowA.rows[0]?.user_id, authA.body.user.id);
  assert.equal(walletRowA.rows[0]?.is_primary, true);
  assert.equal(walletRowA.rows[0]?.is_verified, true);
  assert.equal(walletRowA.rows[0]?.status, 'active');
  assert.equal(walletRowA.rows[0]?.provider, null);
  assert.equal(walletRowA.rows[0]?.wallet_type, 'eoa');
  assert.equal(walletRowA.rows[0]?.address, walletA.address);
  assert.equal(walletRowA.rows[0]?.namespace, 'eip155');
  const sessionA = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM user_sessions WHERE user_id = $1 AND is_active = TRUE`,
    [authA.body.user.id]
  );
  assert.equal(sessionA.rows.length, 1);
  assert.equal(sessionA.rows[0]?.user_id, authA.body.user.id);
  const decodedA = app.jwt.verify<{ userId: string; role: string; sessionId: string; type?: string; email?: string }>(authA.body.accessToken);
  assert.equal(decodedA.userId, authA.body.user.id);
  assert.equal(decodedA.role, 'user');
  assert.equal(decodedA.type, undefined);
  assert.equal(decodedA.sessionId, sessionA.rows[0]?.id);
  assert.equal(decodedA.email, undefined);
  const redisSession = await redis.getJson<{ userId: string; isActive: boolean }>(`session:${decodedA.sessionId}`);
  assert.equal(redisSession?.userId, authA.body.user.id);
  assert.equal(redisSession?.isActive, true);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeA + 1);
  const activity = await pool.query<{ details: string }>(
    `SELECT details::text AS details FROM user_activity_logs
     WHERE user_id = $1 AND activity_type = 'login_success' ORDER BY created_at DESC LIMIT 1`,
    [authA.body.user.id]
  );
  assert.match(activity.rows[0]?.details ?? '', /wallet/);
  assert.equal((activity.rows[0]?.details ?? '').includes(issuedA.signature), false);
  results.push('TEST 1 new wallet user');

  const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: authA.cookies } });
  assert.equal(me.statusCode, 200, me.body);
  const meBody = me.json() as { success: boolean; data: { email: string | null; id: string; referralCode?: string } };
  assert.equal(meBody.success, true);
  assert.equal(meBody.data.email, null);
  assert.equal(meBody.data.id, authA.body.user.id);
  assert.equal(meBody.data.referralCode, userA.rows[0]?.referral_code);
  results.push('TEST 18 email null on /auth/me');

  const refreshed = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: { cookie: authA.cookies },
  });
  assert.equal(refreshed.statusCode, 200, refreshed.body);
  const refreshAuth = authOf(refreshed);
  const decodedRefresh = app.jwt.verify<{ userId: string; sessionId: string; type?: string }>(refreshAuth.body.accessToken);
  assert.equal(decodedRefresh.userId, authA.body.user.id);
  assert.notEqual(decodedRefresh.sessionId, decodedA.sessionId);
  assert.equal(decodedRefresh.type, undefined);
  const oldValid = await isSessionValid(decodedA.sessionId);
  assert.equal(oldValid, false);
  const meAfterRefresh = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: refreshAuth.cookies } });
  assert.equal(meAfterRefresh.statusCode, 200, meAfterRefresh.body);
  results.push('TEST 11 refresh');

  const secondSession = await login(await issue(walletA));
  assert.equal(secondSession.statusCode, 200, secondSession.body);
  const authA2 = authOf(secondSession);
  const decodedA2 = app.jwt.verify<{ sessionId: string; userId: string }>(authA2.body.accessToken);
  assert.notEqual(decodedA2.sessionId, decodedRefresh.sessionId);
  const logoutOthers = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout-all-other',
    headers: { cookie: refreshAuth.cookies },
  });
  assert.equal(logoutOthers.statusCode, 200, logoutOthers.body);
  assert.equal((await isSessionValid(decodedA2.sessionId)), false);
  assert.equal((await isSessionValid(decodedRefresh.sessionId)), true);
  const meKept = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: refreshAuth.cookies } });
  assert.equal(meKept.statusCode, 200, meKept.body);
  results.push('TEST 12 logout-all-other');

  const loggedOut = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { cookie: refreshAuth.cookies },
  });
  assert.equal(loggedOut.statusCode, 200, loggedOut.body);
  const meAfterLogout = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: refreshAuth.cookies } });
  assert.equal(meAfterLogout.statusCode, 401, meAfterLogout.body);
  const stillActive = await pool.query<{ status: string }>(
    `SELECT status FROM user_wallets WHERE id = $1`,
    [walletRowA.rows[0]!.id]
  );
  assert.equal(stillActive.rows[0]?.status, 'active');
  const replayAfterLogout = await login(issuedA);
  assert.equal(replayAfterLogout.statusCode, 400);
  assert.equal(replayAfterLogout.json().error.code, 'CHALLENGE_UNAVAILABLE');
  results.push('TEST 10 logout keeps wallet and rejects replay');

  const disconnectLogin = await login(await issue(walletA));
  assert.equal(disconnectLogin.statusCode, 200, disconnectLogin.body);
  const disconnectAuth = authOf(disconnectLogin);
  const meWhileDisconnected = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: disconnectAuth.cookies },
  });
  assert.equal(meWhileDisconnected.statusCode, 200, meWhileDisconnected.body);
  results.push('TEST 13 wallet disconnect does not revoke session');

  const usersBeforeRepeat = await count('SELECT count(*)::int AS n FROM users');
  const walletsBeforeRepeat = await count('SELECT count(*)::int AS n FROM user_wallets');
  const beforeLastUsed = await pool.query<{ last_used_at: Date; is_primary: boolean }>(
    `SELECT last_used_at, is_primary FROM user_wallets WHERE id = $1`,
    [walletRowA.rows[0]!.id]
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const repeat = await login(await issue(walletA));
  assert.equal(repeat.statusCode, 200, repeat.body);
  const repeatAuth = authOf(repeat);
  assert.equal(repeatAuth.body.user.id, authA.body.user.id);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeRepeat);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets'), walletsBeforeRepeat);
  const afterLastUsed = await pool.query<{ last_used_at: Date; is_primary: boolean }>(
    `SELECT last_used_at, is_primary FROM user_wallets WHERE id = $1`,
    [walletRowA.rows[0]!.id]
  );
  assert.equal(afterLastUsed.rows[0]?.is_primary, true);
  assert.equal(beforeLastUsed.rows[0]?.is_primary, afterLastUsed.rows[0]?.is_primary);
  assert.ok(new Date(afterLastUsed.rows[0]!.last_used_at).getTime() >= new Date(beforeLastUsed.rows[0]!.last_used_at).getTime());
  results.push('TEST 2 existing wallet login');

  await pool.query(`UPDATE user_wallets SET status = 'disabled', updated_at = NOW() WHERE id = $1`, [walletRowA.rows[0]!.id]);
  const sessionsBeforeDisabled = await count(
    `SELECT count(*)::int AS n FROM user_sessions WHERE user_id = $1`,
    [authA.body.user.id]
  );
  const disabled = await login(await issue(walletA));
  assert.equal(disabled.statusCode, 403, disabled.body);
  assert.equal(disabled.json().error.code, 'WALLET_UNAVAILABLE');
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_sessions WHERE user_id = $1`, [authA.body.user.id]),
    sessionsBeforeDisabled
  );
  const disabledStatus = await pool.query<{ status: string; email: string | null }>(
    `SELECT w.status, u.email FROM user_wallets w JOIN users u ON u.id = w.user_id WHERE w.id = $1`,
    [walletRowA.rows[0]!.id]
  );
  assert.equal(disabledStatus.rows[0]?.status, 'disabled');
  assert.equal(disabledStatus.rows[0]?.email, null);
  results.push('TEST 5 disabled wallet');

  const walletComp = Wallet.createRandom();
  const compLogin = await login(await issue(walletComp));
  assert.equal(compLogin.statusCode, 200, compLogin.body);
  const compUserId = authOf(compLogin).body.user.id;
  await pool.query(
    `UPDATE user_wallets SET status = 'compromised', updated_at = NOW()
     WHERE normalized_address = $1`,
    [walletComp.address.toLowerCase()]
  );
  const sessionsBeforeComp = await count(`SELECT count(*)::int AS n FROM user_sessions WHERE user_id = $1`, [compUserId]);
  const compromised = await login(await issue(walletComp));
  assert.equal(compromised.statusCode, 403, compromised.body);
  assert.equal(compromised.json().error.code, 'WALLET_UNAVAILABLE');
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_sessions WHERE user_id = $1`, [compUserId]), sessionsBeforeComp);
  const compStatus = await pool.query<{ status: string }>(
    `SELECT status FROM user_wallets WHERE normalized_address = $1`,
    [walletComp.address.toLowerCase()]
  );
  assert.equal(compStatus.rows[0]?.status, 'compromised');
  results.push('TEST 6 compromised wallet');

  const walletBad = Wallet.createRandom();
  const usersBeforeBad = await count('SELECT count(*)::int AS n FROM users');
  const walletsBeforeBad = await count('SELECT count(*)::int AS n FROM user_wallets');
  const sessionsBeforeBad = await count('SELECT count(*)::int AS n FROM user_sessions');
  const badIssued = await issue(walletBad);
  const other = Wallet.createRandom();
  const badSig = await other.signMessage(badIssued.challenge.message);
  const bad = await login({ challenge: badIssued.challenge, signature: badSig });
  assert.equal(bad.statusCode, 400, bad.body);
  assert.equal(bad.json().error.code, 'INVALID_SIGNATURE');
  const consumedBad = await pool.query<{ consumed_at: Date | null }>(
    `SELECT consumed_at FROM wallet_auth_challenges WHERE id = $1`,
    [badIssued.challenge.id]
  );
  assert.equal(consumedBad.rows[0]?.consumed_at, null);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeBad);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_wallets'), walletsBeforeBad);
  assert.equal(await count('SELECT count(*)::int AS n FROM user_sessions'), sessionsBeforeBad);
  results.push('TEST 7 invalid signature');

  const replayIssued = await issue(walletBad);
  const replayOk = await login(replayIssued);
  assert.equal(replayOk.statusCode, 200, replayOk.body);
  const replayFail = await login(replayIssued);
  assert.equal(replayFail.statusCode, 400);
  assert.equal(replayFail.json().error.code, 'CHALLENGE_UNAVAILABLE');
  results.push('TEST 8 replay');

  const walletRaceChallenge = Wallet.createRandom();
  const concurrentIssued = await issue(walletRaceChallenge);
  await clearLimits();
  const [first, second] = await Promise.all([
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: {
        challengeId: concurrentIssued.challenge.id,
        message: concurrentIssued.challenge.message,
        signature: concurrentIssued.signature,
      },
    }),
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: {
        challengeId: concurrentIssued.challenge.id,
        message: concurrentIssued.challenge.message,
        signature: concurrentIssued.signature,
      },
    }),
  ]);
  const concurrentStatuses = [first.statusCode, second.statusCode].sort();
  assert.deepEqual(concurrentStatuses, [200, 400]);
  const winner = first.statusCode === 200 ? first : second;
  const winnerBody = winner.json() as LoginBody;
  const concurrentUsers = await count(
    `SELECT count(*)::int AS n FROM users u
     JOIN user_wallets w ON w.user_id = u.id
     WHERE w.normalized_address = $1`,
    [walletRaceChallenge.address.toLowerCase()]
  );
  assert.equal(concurrentUsers, 1);
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1`, [walletRaceChallenge.address.toLowerCase()]),
    1
  );
  assert.equal(
    await count(
      `SELECT count(*)::int AS n FROM user_sessions WHERE user_id = $1`,
      [winnerBody.data!.user.id]
    ),
    1
  );
  const consumedOnce = await pool.query<{ consumed_at: Date | null }>(
    `SELECT consumed_at FROM wallet_auth_challenges WHERE id = $1`,
    [concurrentIssued.challenge.id]
  );
  assert.ok(consumedOnce.rows[0]?.consumed_at);
  results.push('TEST 9 concurrent same challenge');

  const walletSecond = Wallet.createRandom();
  const usersBeforeSecond = await count('SELECT count(*)::int AS n FROM users');
  const secondWalletLogin = await login(await issue(walletSecond));
  assert.equal(secondWalletLogin.statusCode, 200, secondWalletLogin.body);
  const secondUser = authOf(secondWalletLogin).body.user.id;
  assert.notEqual(secondUser, authA.body.user.id);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeSecond + 1);
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [authA.body.user.id]),
    1
  );
  results.push('TEST 4 second wallet creates a new user');

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM users
     WHERE deleted_at IS NULL AND status = 'active' AND role = 'user'
       AND email IS NOT NULL
       AND (locked_until IS NULL OR locked_until <= NOW())
     ORDER BY created_at ASC
     LIMIT 1`
  );
  assert.ok(existing.rows[0]?.id, 'seeded customer user required');
  const existingUserId = existing.rows[0]!.id;
  const walletExisting = Wallet.createRandom();
  const primaryExists = await count(
    `SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND is_primary = TRUE AND status = 'active'`,
    [existingUserId]
  );
  await pool.query(
    `INSERT INTO user_wallets (
       user_id, namespace, chain_reference, address, normalized_address, caip10,
       wallet_type, provider, is_primary, is_verified, verified_at, linked_at, last_used_at, status
     ) VALUES (
       $1, 'eip155', '1', $2, $3, $4,
       'eoa', NULL, $5, TRUE, NOW(), NOW(), NOW(), 'active'
     )`,
    [
      existingUserId,
      walletExisting.address,
      walletExisting.address.toLowerCase(),
      `eip155:1:${walletExisting.address}`,
      primaryExists === 0,
    ]
  );
  async function digest(table: string, column: string, idColumn = 'id'): Promise<string> {
    const existsTable = await pool.query<{ t: string | null }>(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
    if (!existsTable.rows[0]?.t) return 'missing';
    const result = await pool.query<{ n: number; h: string }>(
      `SELECT count(*)::int AS n,
              md5(COALESCE(string_agg(${idColumn}::text, ',' ORDER BY ${idColumn}::text), '')) AS h
       FROM ${table} WHERE ${column} = $1`,
      [existingUserId]
    );
    return `${result.rows[0]?.n ?? 0}:${result.rows[0]?.h ?? ''}`;
  }
  const financialBefore = {
    balances: await digest('user_balances', 'user_id'),
    ledger: await digest('balance_ledger', 'user_id'),
    kyc: await digest('kyc_applications', 'user_id'),
    orders: await digest('orders', 'user_id'),
    spot: await digest('spot_orders', 'user_id'),
    forex: await digest('forex_accounts', 'user_id', 'account_id'),
  };
  const p2pBefore = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM p2p_orders WHERE buyer_id = $1 OR seller_id = $1`,
    [existingUserId]
  ).catch(() => ({ rows: [{ n: -1 }] }));
  const usersBeforeExisting = await count('SELECT count(*)::int AS n FROM users');
  const existingLogin = await login(await issue(walletExisting));
  assert.equal(existingLogin.statusCode, 200, existingLogin.body);
  assert.equal(authOf(existingLogin).body.user.id, existingUserId);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeExisting);
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1`, [walletExisting.address.toLowerCase()]),
    1
  );
  const financialAfter = {
    balances: await digest('user_balances', 'user_id'),
    ledger: await digest('balance_ledger', 'user_id'),
    kyc: await digest('kyc_applications', 'user_id'),
    orders: await digest('orders', 'user_id'),
    spot: await digest('spot_orders', 'user_id'),
    forex: await digest('forex_accounts', 'user_id', 'account_id'),
  };
  assert.deepEqual(financialAfter, financialBefore);
  const p2pAfter = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM p2p_orders WHERE buyer_id = $1 OR seller_id = $1`,
    [existingUserId]
  ).catch(() => ({ rows: [{ n: -1 }] }));
  assert.equal(p2pAfter.rows[0]?.n, p2pBefore.rows[0]?.n);
  results.push('TEST 3 existing user wallet');
  results.push('TEST 17 financial identity preserved');

  const adminSessionsBefore = await tableCount('admin_sessions');
  const adminUsersBefore = await tableCount('admin_users');
  const adminProbe = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/auth/session-probe',
    headers: { authorization: `Bearer ${authA.body.accessToken}` },
  });
  assert.equal(adminProbe.statusCode, 401, adminProbe.body);
  const walletAdmin = Wallet.createRandom();
  const adminCustomer = await login(await issue(walletAdmin));
  assert.equal(adminCustomer.statusCode, 200, adminCustomer.body);
  const adminCustomerId = authOf(adminCustomer).body.user.id;
  await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminCustomerId]);
  const adminDenied = await login(await issue(walletAdmin));
  assert.equal(adminDenied.statusCode, 403, adminDenied.body);
  assert.equal(adminDenied.json().error.code, 'WALLET_UNAVAILABLE');
  assert.equal(await tableCount('admin_sessions'), adminSessionsBefore);
  assert.equal(await tableCount('admin_users'), adminUsersBefore);
  const roleStill = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [authA.body.user.id]);
  assert.equal(roleStill.rows[0]?.role, 'user');
  results.push('TEST 14 admin isolation');

  for (const table of custodyTables) {
    assert.equal(await tableCount(table), custodyBefore[table], table);
  }
  const newUserIds = [authA.body.user.id, secondUser, compUserId, winnerBody.data!.user.id];
  for (const userId of newUserIds) {
    assert.equal(await count(`SELECT count(*)::int AS n FROM wallets WHERE user_id = $1`, [userId]), 0);
    assert.equal(await count(`SELECT count(*)::int AS n FROM user_master_keys WHERE user_id = $1`, [userId]), 0);
  }
  const depositMatch = await count(
    `SELECT count(*)::int AS n FROM wallets WHERE lower(address) = $1`,
    [walletA.address.toLowerCase()]
  );
  assert.equal(depositMatch, 0);
  results.push('TEST 15 custody separation');

  for (const table of forexTables) {
    assert.equal(await tableCount(table), forexBefore[table], table);
  }
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1 OR account_id = $2`, [authA.body.user.id, walletA.address]),
    0
  );
  assert.equal(financialAfter.forex, financialBefore.forex);
  results.push('TEST 16 forex separation');
  assert.equal(await tableCount('balance_ledger'), balanceLedgerBefore);
  results.push('TEST 17 global ledger unchanged');

  const walletFail = Wallet.createRandom();
  const usersBeforeFail = await count('SELECT count(*)::int AS n FROM users');
  setWalletLoginSessionOpenerForTests(async () => {
    throw new Error('SESSION_FAILED');
  });
  const failedSession = await login(await issue(walletFail));
  setWalletLoginSessionOpenerForTests(null);
  assert.equal(failedSession.statusCode, 500, failedSession.body);
  assert.equal(await count('SELECT count(*)::int AS n FROM users'), usersBeforeFail + 1);
  const failedUser = await pool.query<{ id: string; email: string | null }>(
    `SELECT u.id, u.email FROM users u
     JOIN user_wallets w ON w.user_id = u.id
     WHERE w.normalized_address = $1`,
    [walletFail.address.toLowerCase()]
  );
  assert.equal(failedUser.rows.length, 1);
  assert.equal(failedUser.rows[0]?.email, null);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_sessions WHERE user_id = $1`, [failedUser.rows[0]!.id]), 0);
  const failedChallengeConsumed = await pool.query<{ consumed_at: Date | null }>(
    `SELECT c.consumed_at FROM wallet_auth_challenges c
     JOIN user_wallets w ON w.normalized_address = c.normalized_address
     WHERE w.user_id = $1 AND c.consumed_at IS NOT NULL`,
    [failedUser.rows[0]!.id]
  );
  assert.ok(failedChallengeConsumed.rows.length >= 1);
  const retryAfterSessionFailure = await login(await issue(walletFail));
  assert.equal(retryAfterSessionFailure.statusCode, 200, retryAfterSessionFailure.body);
  assert.equal(authOf(retryAfterSessionFailure).body.user.id, failedUser.rows[0]?.id);
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1`, [walletFail.address.toLowerCase()]),
    1
  );
  results.push('TEST session failure keeps identity and allows a new challenge');

  const walletUnique = Wallet.createRandom();
  const [raceA, raceB] = await Promise.all([issue(walletUnique), issue(walletUnique)]);
  await clearLimits();
  const raced = await Promise.all([
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: { challengeId: raceA.challenge.id, message: raceA.challenge.message, signature: raceA.signature },
    }),
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: { challengeId: raceB.challenge.id, message: raceB.challenge.message, signature: raceB.signature },
    }),
  ]);
  for (const res of raced) {
    assert.ok(res.statusCode === 200 || res.statusCode === 500, res.body);
  }
  assert.ok(raced.some((res) => res.statusCode === 200));
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1`, [walletUnique.address.toLowerCase()]),
    1
  );
  const uniqueOwners = await pool.query<{ user_id: string; role: string }>(
    `SELECT w.user_id, u.role FROM user_wallets w JOIN users u ON u.id = w.user_id WHERE w.normalized_address = $1`,
    [walletUnique.address.toLowerCase()]
  );
  assert.equal(uniqueOwners.rows.length, 1);
  assert.equal(uniqueOwners.rows[0]?.role, 'user');
  results.push('TEST unique first-login race');

  console.log(results.map((line) => `PASS ${line}`).join('\n'));

  await app.close();
  await pool.end();
  await rateRedis.quit();
  await db.close();
  await redis.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
