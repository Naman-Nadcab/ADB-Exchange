/**
 * Real admin HTTP certification for system_settings.forex_kyc_required.
 * Isolated database only. A child process is a backend restart: it imports the
 * policy service again and serves customer eligibility from the persisted row.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { Pool } from 'pg';

const testUrl = process.env.FOREX_KYC_CERT_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.FOREX_KYC_CERT_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('FOREX_KYC_CERT_DATABASE_URL and FOREX_KYC_CERT_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
const redisUrl = new URL(redisUrlRaw);
if (
  databaseName === 'exchange' ||
  databaseName === 'postgres' ||
  databaseName === '' ||
  testUrl.includes('169.58.39.2')
) {
  console.error('Refusing Forex KYC certification against a non-isolated database');
  process.exit(1);
}
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
process.env.LOG_LEVEL = 'error';

const PHASE = process.env.FOREX_KYC_CERT_PHASE ?? 'write';
const EXPECT = process.env.FOREX_KYC_CERT_EXPECT ?? '';
const CRYPTO_KEYS = ['compliance_policy_v1', 'kyc_required_for_withdrawal', 'kyc_required_for_trading'] as const;
const USERS = {
  none: { id: 'b1818000-0000-4000-8000-0000000000a1', code: 'kycA180001' },
  approved: { id: 'b1818000-0000-4000-8000-0000000000b2', code: 'kycB180001' },
  latestRejected: { id: 'b1818000-0000-4000-8000-0000000000c3', code: 'kycC180001' },
  latestApproved: { id: 'b1818000-0000-4000-8000-0000000000d4', code: 'kycD180001' },
  pending: { id: 'b1818000-0000-4000-8000-0000000000e5', code: 'kycE180001' },
} as const;

type Eligibility = {
  success: boolean;
  data?: {
    source?: string;
    kycRequired?: boolean;
    kycVerified?: boolean;
    kycStatus?: string;
    realForex?: boolean;
  };
};

function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-8, `expected ${expected} got ${actual}`);
}

async function boot() {
  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const jwtPlugin = (await import('@fastify/jwt')).default;
  const websocket = (await import('@fastify/websocket')).default;
  const { config } = await import('../config/index.js');
  const { redis } = await import('../lib/redis.js');
  const { isSessionValid } = await import('../services/session.service.js');
  const { createSession } = await import('../services/session.service.js');
  const { default: forexRoutes } = await import('./forex.fastify.js');
  const { default: adminForexRoutes } = await import('./admin-forex.fastify.js');
  const { default: walletRoutes } = await import('./wallet.fastify.js');
  const Redis = (await import('ioredis')).default;

  const pool = new Pool({ connectionString: testUrl, max: 4 });
  const rateRedis = new Redis(redisUrlRaw);
  await rateRedis.ping();
  await redis.ping();

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwtPlugin, { secret: config.jwt.secret });
  await app.register(websocket);
  const authenticate = async function (
    request: { headers: { authorization?: string }; user?: unknown },
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
  ) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    try {
      const decoded = app.jwt.verify<{ userId: string; role?: string; sessionId: string; type?: string }>(token);
      if (decoded.type === 'admin' || decoded.type === 'refresh') {
        return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Use user token for this route' } });
      }
      const valid = await isSessionValid(decoded.sessionId);
      if (!valid) {
        return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session expired' } });
      }
      request.user = { id: decoded.userId, role: decoded.role ?? 'user', sessionId: decoded.sessionId };
    } catch {
      return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }
  };
  app.decorate('authenticate', authenticate);
  app.decorate('authenticateUser', authenticate);
  await app.register(forexRoutes, { prefix: '/api/v1/forex' });
  await app.register(adminForexRoutes, { prefix: '/api/v1/admin' });
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  await app.ready();

  async function clearLimits(): Promise<void> {
    const keys = await rateRedis.keys('rate:*');
    if (keys.length > 0) await rateRedis.del(...keys);
  }

  async function authed(method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: unknown, headers?: Record<string, string>) {
    await clearLimits();
    return app.inject({ method, url, headers: { authorization: `Bearer ${token}`, ...headers }, payload });
  }

  async function userToken(userId: string): Promise<string> {
    const session = await createSession({ userId, authMethod: 'wallet', ttlSeconds: 3600 });
    return app.jwt.sign({ userId, role: 'user', sessionId: session.sessionId }, { expiresIn: '1h' });
  }

  async function adminToken(adminId: string, role: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO admin_sessions (id, admin_id, session_token, expires_at)
       VALUES ($1, $2, $3, NOW() + interval '2 hours')`,
      [sessionId, adminId, crypto.randomUUID()]
    );
    await redis.setJson(`admin:session:${sessionId}`, { adminId, role, isActive: true }, 7200);
    return app.jwt.sign({ adminId, role, sessionId, type: 'admin' }, { expiresIn: '1h' });
  }

  return { app, pool, redis, rateRedis, authed, userToken, adminToken, clearLimits };
}

async function cryptoSnapshot(pool: Pool): Promise<string> {
  const rows = await pool.query<{ key: string; value: unknown }>(
    `SELECT key, value FROM system_settings WHERE key = ANY($1::text[]) ORDER BY key`,
    [CRYPTO_KEYS]
  );
  return JSON.stringify(rows.rows);
}

async function settingValue(pool: Pool): Promise<unknown> {
  const row = await pool.query<{ value: unknown }>(
    `SELECT value FROM system_settings WHERE key = 'forex_kyc_required'`
  );
  return row.rows[0]?.value ?? null;
}

async function runChild(expect: 'missing' | 'off' | 'on'): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('/workspace/node_modules/.bin/tsx', [new URL(import.meta.url).pathname], {
      env: { ...process.env, FOREX_KYC_CERT_PHASE: 'read', FOREX_KYC_CERT_EXPECT: expect },
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`restarted backend phase ${expect} exited ${code}`));
    });
  });
}

async function runRead(): Promise<void> {
  const ctx = await boot();
  const { pool, authed, userToken, adminToken } = ctx;
  assert.equal(await pool.query(`SELECT current_database()`).then((r) => r.rows[0].current_database), databaseName);

  const publicPaths = ['/api/v1/forex/instruments', '/api/v1/forex/quotes', '/api/v1/forex/sessions', '/api/v1/forex/trading-config', '/api/v1/forex/providers/health'];
  for (const path of publicPaths) {
    const res = await ctx.app.inject({ method: 'GET', url: path });
    assert.equal(res.statusCode, 200, `${path} ${res.body.slice(0, 240)}`);
    assert.equal(res.body.includes('"executionMode":"LIVE"'), false, path);
  }
  console.log(`PASS restarted process public Forex hydrate endpoints (${EXPECT})`);

  const tokenNone = await userToken(USERS.none.id);
  const eligibility = await authed('GET', '/api/v1/forex/live/eligibility', tokenNone);
  assert.equal(eligibility.statusCode, 200, eligibility.body.slice(0, 400));
  const body = eligibility.json() as Eligibility;
  assert.equal(body.data?.source, 'SIMULATED');
  assert.notEqual(body.data?.realForex, true);

  const apply = await authed('POST', '/api/v1/forex/live/applications', tokenNone, {
    idempotencyKey: `cert-${EXPECT}-none`,
  });

  if (EXPECT === 'missing') {
    assert.equal(await settingValue(pool), null);
    assert.equal(body.data?.kycRequired, true);
    assert.equal(body.data?.kycVerified, false);
    assert.equal(apply.statusCode, 403, apply.body.slice(0, 400));
    assert.equal(apply.json().error.code, 'KYC_REQUIRED');
    console.log('PASS missing forex_kyc_required stays required after a new process');
  } else if (EXPECT === 'off') {
    assert.equal(await settingValue(pool), false);
    assert.equal(body.data?.kycRequired, false);
    assert.equal(apply.statusCode, 201, apply.body.slice(0, 400));
    assert.notEqual(apply.json().error?.code, 'KYC_REQUIRED');
    console.log('PASS Forex KYC OFF persisted across process restart and does not block the application');
  } else if (EXPECT === 'on') {
    assert.equal(await settingValue(pool), true);
    assert.equal(body.data?.kycRequired, true);
    assert.equal(body.data?.kycVerified, false);
    assert.equal(apply.statusCode, 403, apply.body.slice(0, 300));
    assert.equal(apply.json().error.code, 'KYC_REQUIRED');

    const tokenApproved = await userToken(USERS.approved.id);
    const approvedEligibility = await authed('GET', '/api/v1/forex/live/eligibility', tokenApproved);
    const approvedBody = approvedEligibility.json() as Eligibility;
    assert.equal(approvedBody.data?.kycRequired, true);
    assert.equal(approvedBody.data?.kycVerified, true);
    assert.equal(approvedBody.data?.kycStatus, 'approved');
    const approvedApply = await authed('POST', '/api/v1/forex/live/applications', tokenApproved, {
      idempotencyKey: 'cert-on-approved',
    });
    assert.equal(approvedApply.statusCode, 201, approvedApply.body.slice(0, 400));

    const stillNone = await authed('POST', '/api/v1/forex/live/applications', tokenNone, {
      idempotencyKey: 'cert-on-none-again',
    });
    assert.equal(stillNone.statusCode, 403);
    assert.equal(stillNone.json().error.code, 'KYC_REQUIRED');

    const tokenRejected = await userToken(USERS.latestRejected.id);
    const rejected = (await authed('GET', '/api/v1/forex/live/eligibility', tokenRejected)).json() as Eligibility;
    assert.equal(rejected.data?.kycStatus, 'rejected');
    assert.equal(rejected.data?.kycVerified, false);
    const rejectedApply = await authed('POST', '/api/v1/forex/live/applications', tokenRejected, {
      idempotencyKey: 'cert-on-latest-rejected',
    });
    assert.equal(rejectedApply.statusCode, 403);
    assert.equal(rejectedApply.json().error.code, 'KYC_REQUIRED');

    const tokenPending = await userToken(USERS.pending.id);
    const pending = (await authed('GET', '/api/v1/forex/live/eligibility', tokenPending)).json() as Eligibility;
    assert.equal(pending.data?.kycStatus, 'pending');
    assert.equal(pending.data?.kycVerified, false);
    const pendingApply = await authed('POST', '/api/v1/forex/live/applications', tokenPending, {
      idempotencyKey: 'cert-on-pending',
    });
    assert.equal(pendingApply.statusCode, 403);
    assert.equal(pendingApply.json().error.code, 'KYC_REQUIRED');

    const tokenLatest = await userToken(USERS.latestApproved.id);
    const latest = (await authed('GET', '/api/v1/forex/live/eligibility', tokenLatest)).json() as Eligibility;
    assert.equal(latest.data?.kycStatus, 'approved');
    assert.equal(latest.data?.kycVerified, true);

    const admin = await pool.query<{ id: string }>(
      `SELECT id::text FROM admin_users WHERE email = 'forex-kyc-cert-admin@step18.test'`
    );
    const controls = await authed('GET', '/api/v1/admin/forex/controls', await adminToken(admin.rows[0]!.id, 'super_admin'));
    assert.equal(controls.statusCode, 200, controls.body.slice(0, 300));
    const controlsBody = controls.json() as { data?: { kycPolicy?: { required?: boolean; source?: string } } };
    assert.equal(controlsBody.data?.kycPolicy?.required, true);
    assert.equal(controlsBody.data?.kycPolicy?.source, 'system_settings');
    console.log('PASS Forex KYC ON persisted; latest same-user KYC decides; another user cannot satisfy it');
  } else {
    throw new Error(`unknown expect ${EXPECT}`);
  }

  await ctx.app.close();
  await ctx.rateRedis.quit();
  await pool.end();
}

async function runWrite(): Promise<void> {
  const ctx = await boot();
  const { pool, authed, userToken, adminToken } = ctx;
  assert.equal((await pool.query(`SELECT current_database()`)).rows[0].current_database, databaseName);
  const cryptoBefore = await cryptoSnapshot(pool);
  const cutoverBefore = await pool.query<{ value: unknown }>(
    `SELECT value FROM system_settings WHERE key = 'wallet_auth_cutover_mode'`
  );
  await pool.query(`DELETE FROM system_settings WHERE key = 'forex_kyc_required'`);
  assert.equal(await settingValue(pool), null);

  for (const user of Object.values(USERS)) {
    await pool.query(
      `INSERT INTO users (id, referral_code, status) VALUES ($1, $2, 'active') ON CONFLICT (id) DO NOTHING`,
      [user.id, user.code]
    );
  }

  const usdt = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'USDT' LIMIT 1`);
  const btc = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'BTC' LIMIT 1`);
  assert.equal(usdt.rows.length, 1);
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'funding', 25, 0, 0, 0), ($1, $2, '', 'trading', 10, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = EXCLUDED.available_balance, locked_balance = 0`,
    [USERS.none.id, usdt.rows[0]!.id]
  );
  if (btc.rows[0]) {
    await pool.query(
      `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
       VALUES ($1, $2, '', 'funding', 0, 0, 0, 0)
       ON CONFLICT (user_id, currency_id, chain_id, account_type) DO UPDATE SET available_balance = 0, locked_balance = 0`,
      [USERS.none.id, btc.rows[0].id]
    );
  }
  await pool.query(
    `INSERT INTO fiat_balances (user_id, currency, available_balance, locked_balance)
     VALUES ($1, 'INR', 999.00, 0)
     ON CONFLICT (user_id, currency) DO UPDATE SET available_balance = 999.00`,
    [USERS.none.id]
  );
  await pool.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $1, 'USD', 'ACTIVE', 'NETTING', 'DEMO')
     ON CONFLICT (account_id) DO NOTHING`,
    [USERS.none.id]
  );
  await pool.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $2, 'USD', 'ACTIVE', 'NETTING', 'DEMO')
     ON CONFLICT (account_id) DO NOTHING`,
    [`FX${USERS.approved.id.slice(0, 8)}`, USERS.approved.id]
  );

  const tokenNone = await userToken(USERS.none.id);
  const summary = await authed('GET', '/api/v1/wallet/balances/summary', tokenNone);
  assert.equal(summary.statusCode, 200, summary.body.slice(0, 500));
  const summaryBody = summary.json() as {
    data?: { funding?: { totalUsd?: string }; trading?: { totalUsd?: string }; forex?: unknown };
  };
  near(Number(summaryBody.data?.funding?.totalUsd), 25);
  near(Number(summaryBody.data?.trading?.totalUsd), 10);
  assert.equal(summaryBody.data?.forex, undefined);
  assert.equal(summary.body.includes('999'), false);
  const tokenApprovedEmpty = await userToken(USERS.approved.id);
  const zero = await authed('GET', '/api/v1/wallet/balances/summary', tokenApprovedEmpty);
  const zeroBody = zero.json() as { data?: { funding?: { totalUsd?: string }; trading?: { totalUsd?: string } } };
  near(Number(zeroBody.data?.funding?.totalUsd), 0);
  near(Number(zeroBody.data?.trading?.totalUsd), 0);
  const ownFx = await authed('GET', '/api/v1/forex/accounts', tokenNone);
  assert.equal(ownFx.statusCode, 200, ownFx.body.slice(0, 400));
  assert.equal(ownFx.body.includes(USERS.none.id), true);
  const walletAsAccount = await authed('GET', '/api/v1/forex/balance', tokenNone, undefined, {
    'x-forex-account-id': '0x1111111111111111111111111111111111111111',
  });
  assert.equal(walletAsAccount.statusCode, 403, walletAsAccount.body.slice(0, 300));
  assert.equal(walletAsAccount.json().error.code, 'FOREX_ACCOUNT_FORBIDDEN');
  const otherFx = await authed('GET', '/api/v1/forex/balance', tokenNone, undefined, {
    'x-forex-account-id': `FX${USERS.approved.id.slice(0, 8)}`,
  });
  assert.equal(otherFx.statusCode, 403, otherFx.body.slice(0, 300));
  console.log('PASS crypto summary ignores fiat INR and Forex; wallet address is not a Forex account id');

  const superId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash, name, role)
     VALUES ($1, 'forex-kyc-cert-admin@step18.test', 'not-a-customer-login', 'Forex KYC Cert', 'super_admin')
     ON CONFLICT (email) DO NOTHING`,
    [superId]
  );
  const complianceId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash, name, role)
     VALUES ($1, 'forex-kyc-cert-compliance@step18.test', 'not-a-customer-login', 'Compliance', 'compliance')
     ON CONFLICT (email) DO NOTHING`,
    [complianceId]
  );
  const superRow = await pool.query<{ id: string }>(
    `SELECT id::text FROM admin_users WHERE email = 'forex-kyc-cert-admin@step18.test'`
  );
  const complianceRow = await pool.query<{ id: string }>(
    `SELECT id::text FROM admin_users WHERE email = 'forex-kyc-cert-compliance@step18.test'`
  );
  const superToken = await adminToken(superRow.rows[0]!.id, 'super_admin');
  const complianceToken = await adminToken(complianceRow.rows[0]!.id, 'compliance');

  const customerDenied = await authed('PATCH', '/api/v1/admin/forex/controls', tokenNone, {
    kyc_required: false,
    reason: 'customer must not write this policy',
  });
  assert.equal(customerDenied.statusCode, 401, customerDenied.body.slice(0, 240));
  const complianceDenied = await authed('PATCH', '/api/v1/admin/forex/controls', complianceToken, {
    kyc_required: false,
    reason: 'compliance role lacks forex controls',
  });
  assert.equal(complianceDenied.statusCode, 403, complianceDenied.body.slice(0, 240));
  const shortReason = await authed('PATCH', '/api/v1/admin/forex/controls', superToken, {
    kyc_required: false,
    reason: 'short',
  });
  assert.equal(shortReason.statusCode, 400, shortReason.body.slice(0, 240));
  console.log('PASS customer and compliance cannot change Forex KYC; short reason is rejected');

  await runChild('missing');

  const off = await authed('PATCH', '/api/v1/admin/forex/controls', superToken, {
    kyc_required: false,
    reason: 'certification turn Forex KYC off',
  });
  assert.equal(off.statusCode, 200, off.body.slice(0, 500));
  const offBody = off.json() as { data?: { kycPolicy?: { previous?: boolean; next?: boolean } } };
  assert.equal(offBody.data?.kycPolicy?.previous, true);
  assert.equal(offBody.data?.kycPolicy?.next, false);
  assert.equal(await settingValue(pool), false);
  const offAudit = await pool.query<{ resource_id: string; new_value: string }>(
    `SELECT resource_id, new_value FROM audit_logs_immutable
     WHERE action = 'forex_admin_control_update' AND resource_type = 'forex_kyc_policy'
     ORDER BY created_at DESC LIMIT 1`
  );
  assert.equal(offAudit.rows.length, 1);
  assert.equal(offAudit.rows[0]?.resource_id, 'forex_kyc_required');
  assert.equal(offAudit.rows[0]?.new_value.includes('false'), true);
  console.log('PASS admin HTTP wrote Forex KYC OFF and an audit row');
  await runChild('off');

  const on = await authed('PATCH', '/api/v1/admin/forex/controls', superToken, {
    kyc_required: true,
    reason: 'certification turn Forex KYC on',
  });
  assert.equal(on.statusCode, 200, on.body.slice(0, 500));
  assert.equal(await settingValue(pool), true);
  const onAudit = await pool.query(
    `SELECT count(*)::int AS n FROM audit_logs_immutable
     WHERE action = 'forex_admin_control_update' AND resource_type = 'forex_kyc_policy' AND resource_id = 'forex_kyc_required'`
  );
  assert.equal(onAudit.rows[0].n >= 2, true);

  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at)
     VALUES ($1, 1, 'approved', NOW() - interval '2 minutes')`,
    [USERS.approved.id]
  );
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at)
     VALUES
       ($1, 1, 'approved', NOW() - interval '5 minutes'),
       ($1, 1, 'rejected', NOW() - interval '1 minute')`,
    [USERS.latestRejected.id]
  );
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at)
     VALUES
       ($1, 1, 'rejected', NOW() - interval '5 minutes'),
       ($1, 1, 'approved', NOW() - interval '1 minute')`,
    [USERS.latestApproved.id]
  );
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at)
     VALUES ($1, 1, 'pending', NOW())`,
    [USERS.pending.id]
  );
  await runChild('on');

  assert.equal(await cryptoSnapshot(pool), cryptoBefore);
  const cutoverAfter = await pool.query<{ value: unknown }>(
    `SELECT value FROM system_settings WHERE key = 'wallet_auth_cutover_mode'`
  );
  assert.deepEqual(cutoverAfter.rows, cutoverBefore.rows);
  console.log('PASS crypto KYC settings and wallet cutover mode were not changed');
  console.log(`PASS forex-kyc-admin-http database=${databaseName}`);

  await ctx.app.close();
  await ctx.rateRedis.quit();
  await pool.end();
}

const run = PHASE === 'read' ? runRead : runWrite;
run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
