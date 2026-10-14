/**
 * STEP 10 — Forex identity regression after wallet login.
 * Isolated database only. Refuses database name exchange or postgres, and Redis port 6379.
 * Wallet address is an authentication credential. Forex ownership stays users.id / forex account id.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Wallet } from 'ethers';
import { Pool } from 'pg';
import WebSocket from 'ws';

const testUrl = process.env.FOREX_WALLET_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.FOREX_WALLET_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('FOREX_WALLET_TEST_DATABASE_URL and FOREX_WALLET_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run Forex wallet identity tests against a non-isolated database');
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
process.env.REDIS_WS_PUBSUB_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';
process.env.FOREX_FUNDING_TEST_API = 'false';
process.env.FOREX_DEMO_FUNDING = 'false';
process.env.FOREX_HOLIDAY_REQUIRED = 'false';

const EXISTING_USER = 'a0000000-0000-4000-8000-00000000aa01';
const LEGACY_PASSWORD = 'Step10Legacy!1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN_SESSION = new Date('2026-09-30T15:00:00.000Z');
const ROLLOVER_AT = new Date('2026-09-30T21:05:00.000Z');

function brief(res: { statusCode: number; body: string }): string {
  return `${res.statusCode} ${res.body.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').slice(0, 700)}`;
}

function assertUuidOwner(id: string, label: string): void {
  assert.match(id, UUID_RE, `${label} must be users.id`);
  assert.equal(id.startsWith('0x') || id.startsWith('0X'), false, `${label} must not be a wallet address`);
}

async function waitQuery<T extends Record<string, unknown>>(
  pool: Pool,
  sql: string,
  params: unknown[]
): Promise<{ rows: T[] }> {
  const started = Date.now();
  let last: { rows: T[] } = { rows: [] };
  while (Date.now() - started < 2000) {
    last = await pool.query<T>(sql, params);
    if (last.rows.length > 0) return last;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return last;
}

function bodyHasAddress(body: string, address: string): boolean {
  return body.toLowerCase().includes(address.toLowerCase());
}

function scanForexSources(): void {
  const roots = [
    path.resolve('src/services/forex'),
    path.resolve('src/routes'),
  ];
  const danger = /caip10|normalized_address|user_wallets|walletAddress|wallet_address|userWalletId/;
  const identity = /\b(account_id|user_id|owner_id|trader_id)\b/;
  const hits: string[] = [];
  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.includes('.test.') || entry.name.includes('.cert.')) continue;
      if (dir.endsWith(`${path.sep}routes`) && !entry.name.includes('forex')) continue;
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (danger.test(line) || (/\bwallet\b/i.test(line) && identity.test(line))) {
          hits.push(`${path.relative(process.cwd(), full)}:${index + 1}: ${trimmed}`);
        }
      });
    }
  }
  for (const root of roots) walk(root);
  assert.equal(hits.length, 0, `Forex identity coupling:\n${hits.join('\n')}`);
  console.log('PASS wallet to Forex scan has no financial identity coupling');
}

async function run(): Promise<void> {
  scanForexSources();
  const bcrypt = (await import('bcryptjs')).default;
  const { default: Fastify } = await import('fastify');
  const cookie = (await import('@fastify/cookie')).default;
  const jwtPlugin = (await import('@fastify/jwt')).default;
  const websocket = (await import('@fastify/websocket')).default;
  const { config } = await import('../config/index.js');
  const { db } = await import('../lib/database.js');
  const { redis } = await import('../lib/redis.js');
  const { isSessionValid } = await import('../services/session.service.js');
  const { createWalletAuthChallenge } = await import('../services/wallet-auth-challenge.service.js');
  const { otpService } = await import('../services/otp.service.js');
  const { default: authRoutes } = await import('./auth.fastify.js');
  const { default: walletLoginRoutes } = await import('./auth-wallet-login.fastify.js');
  const { default: walletManagementRoutes } = await import('./auth-wallet-management.fastify.js');
  const { default: walletRecoveryRoutes } = await import('./auth-wallet-recovery.fastify.js');
  const { default: forexRoutes } = await import('./forex.fastify.js');
  const { default: adminForexRoutes } = await import('./admin-forex.fastify.js');
  const { assertNotCryptoLedger } = await import('../services/forex/accounting/boundary.js');
  const { forexEnvBaselineFlags, effectiveForexRuntimeFlags, setForexRuntimeBool } = await import('../services/forex/admin/runtime-controls.js');
  const { setForexSessionNowForTests } = await import('../services/forex/sessions/eligibility.js');
  const { FOREX_VALUATION_POLICY } = await import('../services/forex/accounting/valuation.js');
  const { getForexPricingService } = await import('../services/forex/quotes.service.js');
  const { getForexProtectionService } = await import('../services/forex/protection/service.js');
  const { getForexPositionService } = await import('../services/forex/positions/service.js');
  const { getForexOrderService } = await import('../services/forex/orders/service.js');
  const { getForexLiquidationService } = await import('../services/forex/liquidation/service.js');
  const { getForexAccountingService } = await import('../services/forex/accounting/service.js');
  const { getForexSwapService } = await import('../services/forex/swap/service.js');
  const { forexWsHub } = await import('../services/forex/ws/hub.js');
  const Redis = (await import('ioredis')).default;

  assert.throws(() => assertNotCryptoLedger('user_balances'), /FOREX_CRYPTO_BOUNDARY/);
  assert.throws(() => assertNotCryptoLedger('balance_ledger'), /FOREX_CRYPTO_BOUNDARY/);
  const baseline = forexEnvBaselineFlags();
  assert.equal(baseline.demoFundingEnabled, false);
  assert.equal(baseline.fundingTestApiEnabled, false);
  assert.equal(effectiveForexRuntimeFlags().executionMode, 'MOCK');
  assert.equal(effectiveForexRuntimeFlags().realForex, false);
  assert.equal(FOREX_VALUATION_POLICY.longExecutableClose, 'BID');
  assert.equal(FOREX_VALUATION_POLICY.shortExecutableClose, 'ASK');
  setForexRuntimeBool('fundingTestApiEnabled', true);
  setForexSessionNowForTests(OPEN_SESSION);
  console.log('PASS execution mode remains MOCK and real Forex is off');

  const pool = new Pool({ connectionString: testUrl, max: 8 });
  const migration = fs.readFileSync(
    new URL('../database/migrations/wallet-identity-foundation.sql', import.meta.url),
    'utf8'
  );
  await pool.query(migration);
  const rateRedis = new Redis(redisUrlRaw);
  await rateRedis.flushall();
  await rateRedis.ping();
  await redis.ping();

  const emailNullable = await pool.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'`
  );
  assert.equal(emailNullable.rows[0]?.is_nullable, 'YES');

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query<{ n: number }>(sql, params);
    return result.rows[0]?.n ?? 0;
  }

  async function tableCount(table: string): Promise<number> {
    const exists = await pool.query<{ name: string | null }>(`SELECT to_regclass($1) AS name`, [`public.${table}`]);
    if (!exists.rows[0]?.name) return -1;
    return count(`SELECT count(*)::int AS n FROM ${table}`);
  }

  const ledgerTable = await pool.query<{ name: string | null }>(`SELECT to_regclass('public.forex_ledger') AS name`);
  console.log(`INFO forex_ledger relation ${ledgerTable.rows[0]?.name ?? 'absent; authority is forex_ledger_transactions'}`);

  const existing = await pool.query<{ email: string; totp_enabled: boolean | null }>(
    `SELECT email, totp_enabled FROM users WHERE id = $1`,
    [EXISTING_USER]
  );
  assert.equal(existing.rows.length, 1, 'STEP 0 seed user missing');
  const existingEmail = existing.rows[0]!.email;
  const totpBefore = existing.rows[0]!.totp_enabled === true;
  const passwordHash = await bcrypt.hash(LEGACY_PASSWORD, 6);
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [EXISTING_USER, passwordHash]);
  await pool.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $1, 'USD', 'ACTIVE', 'NETTING', 'DEMO')`,
    [EXISTING_USER]
  );
  const historyOrderId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO forex_orders (
       order_id, client_order_id, client_exec_id, account_id, fingerprint, symbol, side, order_type,
       requested_volume, filled_volume, remaining_volume, status, request_json, fill_ids, source, execution_mode, time_in_force
     ) VALUES (
       $1, $2, $3, $4, 'step10-history', 'EURUSD', 'buy', 'market',
       0.01, 0.01, 0, 'FILLED', '{}'::jsonb, '{}', 'SIMULATED', 'MOCK', 'GTC'
     )`,
    [historyOrderId, `step10-history-${historyOrderId}`, `exec-${historyOrderId}`, EXISTING_USER]
  );
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, country, document_type, third_party_provider, submitted_at, reviewed_at, created_at, updated_at)
     VALUES ($1, 1, 'approved', 'US', 'passport', 'manual', NOW(), NOW(), NOW(), NOW())`,
    [EXISTING_USER]
  );
  const usdt = await pool.query<{ id: string }>(`SELECT id FROM currencies WHERE symbol = 'USDT' LIMIT 1`);
  const usdtId = usdt.rows[0]!.id;
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'trading', 100000, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 100000, locked_balance = 0, escrow_balance = 0`,
    [EXISTING_USER, usdtId]
  );

  const watched = [
    'forex_accounts',
    'forex_orders',
    'forex_positions',
    'forex_pending_orders',
    'forex_order_modifications',
    'forex_fee_events',
    'forex_swap_events',
    'forex_reconciliation_events',
    'forex_ledger_transactions',
    'forex_ledger_entries',
    'kyc_applications',
    'user_balances',
    'balance_ledger',
    'wallets',
    'user_master_keys',
    'hot_wallets',
    'cold_wallets',
  ] as const;
  const beforeLogin: Record<string, number> = {};
  for (const table of watched) beforeLogin[table] = await tableCount(table);
  assert.equal(beforeLogin.forex_accounts, 1);
  assert.equal(beforeLogin.forex_orders, 1);

  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: config.security.sessionSecret });
  await app.register(jwtPlugin, { secret: config.jwt.secret });
  await app.register(websocket);
  const authenticate = async function (
    request: { headers: { authorization?: string }; user?: unknown },
    /* eslint-disable no-unused-vars */
    reply: { status: (statusCode: number) => { send: (payload: unknown) => unknown } }
    /* eslint-enable no-unused-vars */
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
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletManagementRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletRecoveryRoutes, { prefix: '/api/v1/auth' });
  await app.register(forexRoutes, { prefix: '/api/v1/forex' });
  await app.register(adminForexRoutes, { prefix: '/api/v1/admin' });
  await app.ready();

  async function clearLimits(): Promise<void> {
    const keys = await rateRedis.keys('rate:*');
    if (keys.length > 0) await rateRedis.del(...keys);
  }

  async function authed(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    token: string,
    payload?: unknown,
    headers?: Record<string, string>
  ) {
    await clearLimits();
    return app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, ...headers },
      payload,
    });
  }

  async function issue(wallet: Wallet, chain = '1') {
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:${chain}:${wallet.address}`,
      frontendUrl: 'http://wallet-auth.test:3000',
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = await wallet.signMessage(challenge.message);
    return { challenge, signature };
  }

  async function walletLogin(wallet: Wallet, chain = '1'): Promise<{ token: string; refresh: string; userId: string; status: number; body: string }> {
    const issued = await issue(wallet, chain);
    await clearLimits();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: {
        challengeId: issued.challenge.id,
        message: issued.challenge.message,
        signature: issued.signature,
      },
    });
    if (res.statusCode !== 200) {
      return { token: '', refresh: '', userId: '', status: res.statusCode, body: res.body };
    }
    const body = res.json() as { data: { user: { id: string }; accessToken: string; refreshToken: string } };
    assertUuidOwner(body.data.user.id, 'wallet login user');
    assert.equal(body.data.user.id === wallet.address, false);
    return { token: body.data.accessToken, refresh: body.data.refreshToken, userId: body.data.user.id, status: 200, body: res.body };
  }

  async function linkEvm(token: string, wallet: Wallet) {
    const challengeRes = await authed('POST', '/api/v1/auth/wallets/link/challenge', token, {
      caip10: `eip155:1:${wallet.address}`,
    });
    assert.equal(challengeRes.statusCode, 200, brief(challengeRes));
    const challengeBody = challengeRes.json() as { challenge: { id: string; message: string } };
    const signature = await wallet.signMessage(challengeBody.challenge.message);
    return authed('POST', '/api/v1/auth/wallets/link/verify', token, {
      challengeId: challengeBody.challenge.id,
      message: challengeBody.challenge.message,
      signature,
    });
  }

  async function stepUp(token: string, walletId: string, action: 'set_primary_wallet' | 'unlink_wallet', wallet: Wallet) {
    const issued = await authed('POST', `/api/v1/auth/wallets/${walletId}/step-up`, token, { action });
    assert.equal(issued.statusCode, 200, brief(issued));
    const body = issued.json() as { challenge: { id: string; message: string } };
    const typed = JSON.parse(body.challenge.message) as {
      domain: Record<string, unknown>;
      types: Record<string, Array<{ name: string; type: string }>>;
      message: Record<string, unknown>;
    };
    const signature = await wallet.signTypedData(typed.domain, typed.types, typed.message);
    return { message: body.challenge.message, signature, challengeId: body.challenge.id };
  }

  getForexPricingService().tick(OPEN_SESSION);
  const instruments = await app.inject({ method: 'GET', url: '/api/v1/forex/instruments' });
  assert.equal(instruments.statusCode, 200, brief(instruments));
  assert.equal(instruments.body.includes('EURUSD'), true);
  const quotes = await app.inject({ method: 'GET', url: '/api/v1/forex/quotes' });
  assert.equal(quotes.statusCode, 200, brief(quotes));
  const quote = await app.inject({ method: 'GET', url: '/api/v1/forex/quotes/EURUSD' });
  assert.equal(quote.statusCode, 200, brief(quote));
  const candles = await app.inject({ method: 'GET', url: '/api/v1/forex/candles?symbol=EURUSD&timeframe=M1&limit=2' });
  assert.ok(candles.statusCode === 200 || candles.statusCode === 400, brief(candles));
  const sessions = await app.inject({ method: 'GET', url: '/api/v1/forex/sessions' });
  assert.equal(sessions.statusCode, 200, brief(sessions));
  const sessionBody = sessions.json() as {
    data?: { holidayCoverage?: string; sessions?: string[]; eligibility?: { open?: boolean }; valuationPolicy?: { longExecutableClose?: string; shortExecutableClose?: string } };
  };
  assert.equal(sessionBody.data?.holidayCoverage, 'UNCONFIGURED');
  assert.deepEqual(sessionBody.data?.sessions, ['Sydney', 'Tokyo', 'London', 'New York']);
  assert.equal(sessionBody.data?.eligibility?.open, true);
  assert.equal(sessionBody.data?.valuationPolicy?.longExecutableClose, 'BID');
  assert.equal(sessionBody.data?.valuationPolicy?.shortExecutableClose, 'ASK');
  const calendar = await app.inject({ method: 'GET', url: '/api/v1/forex/calendar' });
  assert.equal(calendar.statusCode, 200, brief(calendar));
  const readiness = await app.inject({ method: 'GET', url: '/api/v1/forex/readiness' });
  assert.equal(readiness.statusCode, 200, brief(readiness));
  const readyBody = readiness.json() as { data?: { economicReady?: boolean; holiday?: { coverage?: string } } };
  assert.equal(readyBody.data?.economicReady, true);
  assert.equal(readyBody.data?.holiday?.coverage, 'UNCONFIGURED');
  console.log('PASS public Forex market data does not require a wallet address');
  console.log('PASS holiday coverage remains UNCONFIGURED');

  const walletNative = Wallet.createRandom();
  const usersBeforeNative = await tableCount('users');
  const forexBeforeNative = await tableCount('forex_accounts');
  const native = await walletLogin(walletNative);
  assert.equal(native.status, 200, native.body);
  assert.equal(await tableCount('forex_accounts'), forexBeforeNative);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`, [native.userId]), 0);
  assert.equal(await tableCount('user_balances'), beforeLogin.user_balances);
  assert.equal(await tableCount('balance_ledger'), beforeLogin.balance_ledger);
  console.log('PASS 1 wallet login reaches the existing session without creating a Forex account');
  console.log('PASS 2 wallet login user id is users.id');
  console.log('PASS wallet login does not write Forex, user_balances, or balance_ledger');

  const nativeAccounts = await authed('GET', '/api/v1/forex/accounts', native.token);
  assert.equal(nativeAccounts.statusCode, 200, brief(nativeAccounts));
  const nativeAccountBody = nativeAccounts.json() as {
    data?: { activeAccountId?: string; executionMode?: string; accounts?: Array<{ accountId: string }> };
  };
  assert.equal(nativeAccountBody.data?.executionMode, 'MOCK');
  assert.equal(nativeAccountBody.data?.activeAccountId, native.userId);
  assert.equal(nativeAccountBody.data?.accounts?.length, 1);
  assert.equal(nativeAccountBody.data?.accounts?.[0]?.accountId, native.userId);
  assert.equal(bodyHasAddress(nativeAccounts.body, walletNative.address), false);
  const nativeRow = await pool.query<{ account_id: string; user_id: string; account_kind: string }>(
    `SELECT account_id, user_id::text, account_kind FROM forex_accounts WHERE user_id = $1`,
    [native.userId]
  );
  assert.equal(nativeRow.rows.length, 1);
  assert.equal(nativeRow.rows[0]?.account_id, native.userId);
  assert.equal(nativeRow.rows[0]?.user_id, native.userId);
  assert.equal(nativeRow.rows[0]?.account_kind, 'DEMO');
  assert.notEqual(nativeRow.rows[0]?.account_id, walletNative.address);
  assert.equal(await tableCount('users'), usersBeforeNative + 1);
  console.log('PASS 41 new wallet user receives the existing legacy demo account where account_id = users.id');

  const replay = await walletLogin(walletNative);
  assert.equal(replay.status, 200, replay.body);
  assert.equal(replay.userId, native.userId);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`, [native.userId]), 1);
  console.log('PASS 28 fresh wallet challenge keeps the same users.id and Forex account');

  const passwordLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login/password',
    payload: { email: existingEmail, password: LEGACY_PASSWORD },
  });
  assert.equal(passwordLogin.statusCode, 200, brief(passwordLogin));
  const passwordBody = passwordLogin.json() as { data?: { user?: { id?: string }; accessToken?: string } };
  assert.equal(passwordBody.data?.user?.id, EXISTING_USER);
  const passwordToken = passwordBody.data?.accessToken ?? '';
  assert.ok(passwordToken);
  const existingAccounts = await authed('GET', '/api/v1/forex/accounts', passwordToken);
  assert.equal(existingAccounts.statusCode, 200, brief(existingAccounts));
  const existingAccountBody = existingAccounts.json() as { data?: { activeAccountId?: string; count?: number; accounts?: Array<{ accountId: string }> } };
  assert.equal(existingAccountBody.data?.activeAccountId, EXISTING_USER);
  assert.equal(existingAccountBody.data?.count, 1);
  assert.equal(existingAccountBody.data?.accounts?.[0]?.accountId, EXISTING_USER);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`, [EXISTING_USER]), 1);
  const historyStill = await pool.query<{ account_id: string; status: string }>(
    `SELECT account_id, status FROM forex_orders WHERE order_id = $1`,
    [historyOrderId]
  );
  assert.equal(historyStill.rows[0]?.account_id, EXISTING_USER);
  assert.equal(historyStill.rows[0]?.status, 'FILLED');
  console.log('PASS 5 legacy password login keeps the seeded Forex account and history');

  const otpPlain = '591746';
  const otpSalt = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO otp_verifications (identifier, type, otp_hash, salt, attempts, max_attempts, expires_at)
     VALUES ($1, 'email', $2, $3, 0, 3, NOW() + INTERVAL '10 minutes')`,
    [existingEmail.toLowerCase(), otpService.hashOTP(otpPlain, otpSalt), otpSalt]
  );
  await clearLimits();
  const otpLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: existingEmail, otp: otpPlain },
  });
  assert.equal(otpLogin.statusCode, 200, brief(otpLogin));
  const otpBody = otpLogin.json() as { data?: { user?: { id?: string }; accessToken?: string; verificationToken?: string } };
  if (otpBody.data?.user?.id) assert.equal(otpBody.data.user.id, EXISTING_USER);
  else if (otpBody.data?.verificationToken) {
    const tokenRow = await pool.query<{ user_id: string }>(
      `SELECT user_id::text FROM login_verification_tokens WHERE token = $1`,
      [otpBody.data.verificationToken]
    );
    assert.equal(tokenRow.rows[0]?.user_id, EXISTING_USER);
  } else {
    assert.fail(brief(otpLogin));
  }
  console.log('PASS legacy OTP login stays on the seeded users.id');

  const credit = await authed(
    'POST',
    '/api/v1/forex/funding/test',
    passwordToken,
    { amount: '10000', idempotencyKey: `step10-credit-${crypto.randomUUID()}`, type: 'INITIAL_FUNDING' },
    { 'x-eda-forex-test': 'SIMULATED' }
  );
  assert.equal(credit.statusCode, 200, brief(credit));
  assert.equal(bodyHasAddress(credit.body, '0x'), false);
  const ledgerOwner = await pool.query<{ account_id: string }>(
    `SELECT account_id FROM forex_ledger_transactions WHERE account_id = $1`,
    [EXISTING_USER]
  );
  assert.ok((ledgerOwner.rowCount ?? 0) >= 1);
  assert.equal(ledgerOwner.rows.every((row) => row.account_id === EXISTING_USER), true);
  const cryptoAfterCredit = await count(
    `SELECT count(*)::int AS n FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND chain_id = '' AND account_type = 'trading' AND available_balance = 100000`,
    [EXISTING_USER, usdtId]
  );
  assert.equal(cryptoAfterCredit, 1);
  assert.equal(await tableCount('balance_ledger'), beforeLogin.balance_ledger);
  console.log('PASS Forex credit stays on the Forex ledger and does not touch crypto balances');

  const market = await authed('POST', '/api/v1/forex/orders', passwordToken, {
    clientOrderId: `step10-mkt-${crypto.randomUUID()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'market',
    volume: '0.01',
  });
  assert.equal(market.statusCode, 200, brief(market));
  const marketBody = market.json() as { data?: { executionMode?: string; order?: { orderId?: string; status?: string } } };
  assert.equal(marketBody.data?.executionMode, 'MOCK');
  const marketOrderId = marketBody.data?.order?.orderId ?? '';
  assert.match(marketOrderId, UUID_RE);
  const marketRow = await pool.query<{ account_id: string; status: string }>(
    `SELECT account_id, status FROM forex_orders WHERE order_id = $1`,
    [marketOrderId]
  );
  assert.equal(marketRow.rows[0]?.account_id, EXISTING_USER);
  assert.equal(marketRow.rows[0]?.status, 'FILLED');
  assert.equal(bodyHasAddress(market.body, walletNative.address), false);
  console.log('PASS 6 Forex market order owner is the existing Forex account id');

  const limit = await authed('POST', '/api/v1/forex/orders', passwordToken, {
    clientOrderId: `step10-lmt-${crypto.randomUUID()}`,
    symbol: 'EURUSD',
    side: 'buy',
    orderType: 'limit',
    volume: '0.01',
    requestedPrice: '0.50000',
    timeInForce: 'GTC',
  });
  assert.equal(limit.statusCode, 200, brief(limit));
  const limitBody = limit.json() as { data?: { order?: { orderId?: string; status?: string; version?: number } } };
  const limitOrderId = limitBody.data?.order?.orderId ?? '';
  assert.match(limitOrderId, UUID_RE);
  assert.equal(limitBody.data?.order?.status, 'PENDING');
  const modified = await authed('PATCH', `/api/v1/forex/orders/${limitOrderId}`, passwordToken, {
    requestedPrice: '0.49000',
    expectedVersion: limitBody.data?.order?.version ?? 1,
  });
  assert.equal(modified.statusCode, 200, brief(modified));
  const limitRow = await pool.query<{ account_id: string }>(`SELECT account_id FROM forex_orders WHERE order_id = $1`, [limitOrderId]);
  assert.equal(limitRow.rows[0]?.account_id, EXISTING_USER);
  console.log('PASS Forex limit modify keeps the existing account owner');

  const positions = await authed('GET', '/api/v1/forex/positions', passwordToken);
  assert.equal(positions.statusCode, 200, brief(positions));
  const positionBody = positions.json() as { data?: { positions?: Array<{ positionId: string; side: string; status: string }> } };
  const positionId = positionBody.data?.positions?.[0]?.positionId ?? '';
  assert.ok(positionId);
  assert.equal(positionBody.data?.positions?.[0]?.side, 'long');
  const positionRow = await pool.query<{ account_id: string; side: string }>(
    `SELECT account_id, side FROM forex_positions WHERE position_id = $1`,
    [positionId]
  );
  assert.equal(positionRow.rows[0]?.account_id, EXISTING_USER);
  assert.equal(positionRow.rows[0]?.side, 'long');
  console.log('PASS 8 Forex position owner is the existing Forex account');

  const equity = await authed('GET', '/api/v1/forex/equity', passwordToken);
  assert.equal(equity.statusCode, 200, brief(equity));
  const accountView = await authed('GET', '/api/v1/forex/account', passwordToken);
  assert.equal(accountView.statusCode, 200, brief(accountView));
  const accountViewBody = accountView.json() as { data?: { account?: { accountId?: string; equity?: string; usedMargin?: string; freeMargin?: string; marginLevel?: string | null } } };
  assert.equal(accountViewBody.data?.account?.accountId, EXISTING_USER);
  assert.equal(bodyHasAddress(accountView.body, '0x'), false);
  const margin = await authed('GET', '/api/v1/forex/margin', passwordToken);
  assert.equal(margin.statusCode, 200, brief(margin));
  const risk = await authed('GET', '/api/v1/forex/risk/status', passwordToken);
  assert.equal(risk.statusCode, 200, brief(risk));
  assert.equal(bodyHasAddress(risk.body, '0x'), false);
  console.log('PASS 32 margin and risk identity stay on the Forex account');

  const feeCount = await count(`SELECT count(*)::int AS n FROM forex_fee_events WHERE account_id = $1`, [EXISTING_USER]);
  const foreignFees = await count(
    `SELECT count(*)::int AS n FROM forex_fee_events WHERE account_id <> $1`,
    [EXISTING_USER]
  );
  const feeLedger = await count(
    `SELECT count(*)::int AS n FROM forex_ledger_transactions WHERE account_id = $1 AND type = 'FEE'`,
    [EXISTING_USER]
  );
  assert.equal(foreignFees, 0);
  assert.equal(feeCount, feeLedger);
  console.log('PASS 35 fee ownership stays on the Forex account; catalog commission is zero so no fee row is required');

  const pricing = getForexPricingService();
  const positionsSvc = getForexPositionService(pricing);
  const ordersSvc = getForexOrderService();
  const swaps = getForexSwapService(positionsSvc, getForexAccountingService(positionsSvc, pricing));
  const swapEvents = await swaps.applyRollover(ROLLOVER_AT);
  assert.ok(swapEvents.length >= 1, 'expected a rollover swap on the open position');
  assert.equal(swapEvents.every((event) => event.accountId === EXISTING_USER), true);
  const swapRows = await count(`SELECT count(*)::int AS n FROM forex_swap_events WHERE account_id = $1`, [EXISTING_USER]);
  assert.ok(swapRows >= 1);
  console.log('PASS 36 swap ownership stays on the Forex account');

  const protection = await authed('POST', '/api/v1/forex/protections', passwordToken, {
    clientProtectionId: `step10-sl-${crypto.randomUUID()}`,
    positionId,
    type: 'STOP_LOSS',
    triggerPrice: '0.90000',
  });
  assert.equal(protection.statusCode, 200, brief(protection));
  const protectionBody = protection.json() as { data?: { protection?: { protectionId?: string; version?: number } } };
  const protectionId = protectionBody.data?.protection?.protectionId ?? '';
  assert.ok(protectionId);
  const protectionRow = await waitQuery<{ account_id: string }>(
    pool,
    `SELECT account_id FROM forex_protections WHERE protection_id = $1`,
    [protectionId]
  );
  assert.equal(protectionRow.rows[0]?.account_id, EXISTING_USER);
  const takeProfit = await authed('POST', '/api/v1/forex/protections', passwordToken, {
    clientProtectionId: `step10-tp-${crypto.randomUUID()}`,
    positionId,
    type: 'TAKE_PROFIT',
    triggerPrice: '1.80000',
  });
  assert.equal(takeProfit.statusCode, 200, brief(takeProfit));
  const patched = await authed('PATCH', `/api/v1/forex/protections/${protectionId}`, passwordToken, {
    triggerPrice: '0.85000',
    expectedVersion: protectionBody.data?.protection?.version ?? 1,
  });
  assert.equal(patched.statusCode, 200, brief(patched));
  console.log('PASS 33 stop loss and take profit stay on the Forex account');

  const ledgerBeforeSecondLogin = await tableCount('forex_ledger_transactions');
  const reconBefore = await tableCount('forex_reconciliation_events');
  const existingWalletA = Wallet.createRandom();
  const existingWalletB = Wallet.createRandom();
  const linkedA = await linkEvm(passwordToken, existingWalletA);
  assert.equal(linkedA.statusCode, 200, brief(linkedA));
  const walletAId = (linkedA.json() as { data?: { wallet?: { id?: string } } }).data?.wallet?.id ?? '';
  assert.match(walletAId, UUID_RE);
  const linkedB = await linkEvm(passwordToken, existingWalletB);
  assert.equal(linkedB.statusCode, 200, brief(linkedB));
  const walletBId = (linkedB.json() as { data?: { wallet?: { id?: string; isPrimary?: boolean } } }).data?.wallet?.id ?? '';
  assert.equal((linkedB.json() as { data?: { wallet?: { isPrimary?: boolean } } }).data?.wallet?.isPrimary, false);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`, [EXISTING_USER]), 1);
  console.log('PASS 17 linking a wallet does not change the Forex account');

  const loginA = await walletLogin(existingWalletA);
  assert.equal(loginA.status, 200, loginA.body);
  assert.equal(loginA.userId, EXISTING_USER);
  const loginB = await walletLogin(existingWalletB);
  assert.equal(loginB.status, 200, loginB.body);
  assert.equal(loginB.userId, EXISTING_USER);
  const seenOrders = await authed('GET', '/api/v1/forex/orders', loginB.token);
  assert.equal(seenOrders.statusCode, 200, brief(seenOrders));
  assert.equal(seenOrders.body.includes(limitOrderId), true);
  const seenPositions = await authed('GET', '/api/v1/forex/positions', loginB.token);
  assert.equal(seenPositions.statusCode, 200, brief(seenPositions));
  assert.equal(seenPositions.body.includes(positionId), true);
  const seenLedger = await authed('GET', '/api/v1/forex/ledger', loginB.token);
  assert.equal(seenLedger.statusCode, 200, brief(seenLedger));
  assert.equal(bodyHasAddress(seenLedger.body, existingWalletB.address), false);
  assert.equal(await tableCount('forex_ledger_transactions'), ledgerBeforeSecondLogin);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`, [EXISTING_USER]), 1);
  const historyAfterWallet = await pool.query<{ account_id: string }>(
    `SELECT account_id FROM forex_orders WHERE order_id = $1`,
    [historyOrderId]
  );
  assert.equal(historyAfterWallet.rows[0]?.account_id, EXISTING_USER);
  console.log('PASS 3 secondary wallet login keeps the same Forex account, orders, and positions');
  console.log('PASS 4 primary status is not required for Forex access');
  console.log('PASS 42 seeded Forex history stays on users.id after wallet login');

  const kycAfter = await pool.query<{ status: string; kyc_level: number }>(
    `SELECT status, kyc_level FROM kyc_applications WHERE user_id = $1`,
    [EXISTING_USER]
  );
  assert.equal(kycAfter.rows[0]?.status, 'approved');
  assert.equal(kycAfter.rows[0]?.kyc_level, 1);
  const totpAfter = await pool.query<{ totp_enabled: boolean | null }>(`SELECT totp_enabled FROM users WHERE id = $1`, [EXISTING_USER]);
  assert.equal(totpAfter.rows[0]?.totp_enabled === true, totpBefore);
  console.log('PASS 29 KYC stays approved on users.id');
  console.log('PASS 30 2FA flag is unchanged');

  const strangerOrders = await authed('GET', `/api/v1/forex/orders/${limitOrderId}`, native.token);
  assert.equal(strangerOrders.statusCode, 404, brief(strangerOrders));
  const strangerCancel = await authed('POST', `/api/v1/forex/orders/${limitOrderId}/cancel`, native.token, {});
  assert.equal(strangerCancel.statusCode, 404, brief(strangerCancel));
  const strangerPatch = await authed('PATCH', `/api/v1/forex/orders/${limitOrderId}`, native.token, { requestedPrice: '0.40000' });
  assert.equal(strangerPatch.statusCode, 404, brief(strangerPatch));
  const strangerPosition = await authed('GET', `/api/v1/forex/positions/${positionId}`, native.token);
  assert.equal(strangerPosition.statusCode, 404, brief(strangerPosition));
  const strangerClose = await authed('POST', `/api/v1/forex/positions/${positionId}/close`, native.token, {
    clientOrderId: `step10-stranger-close-${crypto.randomUUID()}`,
  });
  assert.ok(strangerClose.statusCode === 404 || strangerClose.statusCode === 403, brief(strangerClose));
  const strangerLedger = await authed('GET', '/api/v1/forex/ledger', native.token, undefined, {
    'x-forex-account-id': EXISTING_USER,
  });
  assert.equal(strangerLedger.statusCode, 403, brief(strangerLedger));
  const strangerAccount = await authed('GET', `/api/v1/forex/accounts/${EXISTING_USER}`, native.token);
  assert.equal(strangerAccount.statusCode, 404, brief(strangerAccount));
  const stillPending = await pool.query<{ account_id: string; status: string }>(
    `SELECT account_id, status FROM forex_orders WHERE order_id = $1`,
    [limitOrderId]
  );
  assert.equal(stillPending.rows[0]?.account_id, EXISTING_USER);
  assert.notEqual(stillPending.rows[0]?.status, 'CANCELLED');
  console.log('PASS 7 stranger cannot cancel a Forex order');
  console.log('PASS 10 Forex order IDOR is rejected');
  console.log('PASS 11 Forex position IDOR is rejected');
  console.log('PASS 12 Forex ledger access is own-account only');

  const walletAsAccount = await authed('GET', '/api/v1/forex/balance', loginB.token, undefined, {
    'x-forex-account-id': existingWalletB.address,
  });
  assert.equal(walletAsAccount.statusCode, 403, brief(walletAsAccount));
  console.log('PASS 13 wallet address is rejected as a Forex account id');

  const ownerCancel = await authed('POST', `/api/v1/forex/orders/${limitOrderId}/cancel`, loginA.token, {});
  assert.equal(ownerCancel.statusCode, 200, brief(ownerCancel));
  const cancelled = await pool.query<{ account_id: string; status: string }>(
    `SELECT account_id, status FROM forex_orders WHERE order_id = $1`,
    [limitOrderId]
  );
  assert.equal(cancelled.rows[0]?.account_id, EXISTING_USER);
  assert.equal(cancelled.rows[0]?.status, 'CANCELLED');
  console.log('PASS 7 owner can cancel the Forex order');

  const select = await authed('POST', `/api/v1/forex/accounts/${EXISTING_USER}/select`, loginB.token, {});
  assert.equal(select.statusCode, 200, brief(select));
  const setCookie = select.headers['set-cookie'];
  const cookieText = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie ?? '');
  assert.equal(cookieText.includes('mlive_fx_ac='), true);
  assert.equal(cookieText.toLowerCase().includes(existingWalletB.address.toLowerCase()), false);
  assert.equal(cookieText.includes(EXISTING_USER), true);
  const cookieOnly = await app.inject({
    method: 'GET',
    url: '/api/v1/forex/account',
    headers: {
      authorization: `Bearer ${loginB.token}`,
      cookie: `mlive_fx_ac=${EXISTING_USER}`,
    },
  });
  assert.equal(cookieOnly.statusCode, 200, brief(cookieOnly));
  const cookieBody = cookieOnly.json() as { data?: { account?: { accountId?: string } } };
  assert.equal(cookieBody.data?.account?.accountId, EXISTING_USER);
  console.log('PASS active Forex account cookie stays on users.id');

  const adminGet = await authed('GET', '/api/v1/admin/forex/config', loginB.token);
  assert.equal(adminGet.statusCode, 401, brief(adminGet));
  const killBefore = effectiveForexRuntimeFlags().killSwitch;
  const adminPatch = await authed('PATCH', '/api/v1/admin/forex/controls', loginB.token, {
    reason: 'customer wallet must not change dealing controls',
    kill_switch: !killBefore,
  });
  assert.equal(adminPatch.statusCode, 401, brief(adminPatch));
  assert.equal(effectiveForexRuntimeFlags().killSwitch, killBefore);
  const adminLedger = await authed('GET', '/api/v1/admin/forex/ledger', loginB.token);
  assert.equal(adminLedger.statusCode, 401, brief(adminLedger));
  console.log('PASS 39 customer wallet auth cannot open Forex admin');
  console.log('PASS 40 customer wallet auth cannot modify Forex admin controls');

  const recovery = await authed('POST', '/api/v1/auth/wallets/recovery', loginA.token, { lostWalletId: walletBId });
  assert.equal(recovery.statusCode, 200, brief(recovery));
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1 AND account_id = $1`, [EXISTING_USER]), 1);
  const kycDuringRecovery = await pool.query<{ status: string }>(
    `SELECT status FROM kyc_applications WHERE user_id = $1`,
    [EXISTING_USER]
  );
  assert.equal(kycDuringRecovery.rows[0]?.status, 'approved');
  const cancelRecovery = await authed('POST', '/api/v1/auth/wallets/recovery/cancel', loginA.token, {});
  assert.equal(cancelRecovery.statusCode, 200, brief(cancelRecovery));
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1`, [EXISTING_USER]), 1);
  console.log('PASS 19 wallet recovery does not change the Forex account or KYC');

  const unlinkProof = await stepUp(loginA.token, walletBId, 'unlink_wallet', existingWalletB);
  const unlinked = await authed('POST', `/api/v1/auth/wallets/${walletBId}/unlink`, loginA.token, unlinkProof);
  assert.equal(unlinked.statusCode, 200, brief(unlinked));
  const disabledLogin = await walletLogin(existingWalletB);
  assert.equal(disabledLogin.status, 403, disabledLogin.body);
  assert.equal(disabledLogin.body.includes('WALLET_UNAVAILABLE'), true);
  const afterUnlink = await authed('GET', '/api/v1/forex/accounts', loginA.token);
  assert.equal(afterUnlink.statusCode, 200, brief(afterUnlink));
  assert.equal((afterUnlink.json() as { data?: { activeAccountId?: string } }).data?.activeAccountId, EXISTING_USER);
  console.log('PASS 18 unlink does not change the Forex account');
  console.log('PASS 24 disabled wallet login is rejected');

  const walletC = Wallet.createRandom();
  const linkedC = await linkEvm(loginA.token, walletC);
  assert.equal(linkedC.statusCode, 200, brief(linkedC));
  const walletCId = (linkedC.json() as { data?: { wallet?: { id?: string } } }).data?.wallet?.id ?? '';
  await pool.query(`UPDATE user_wallets SET status = 'compromised', is_primary = FALSE WHERE id = $1`, [walletCId]);
  const compromised = await walletLogin(walletC);
  assert.equal(compromised.status, 403, compromised.body);
  const primaryStill = await walletLogin(existingWalletA);
  assert.equal(primaryStill.status, 200, primaryStill.body);
  assert.equal(primaryStill.userId, EXISTING_USER);
  const accountsAfterCompromise = await authed('GET', '/api/v1/forex/accounts', primaryStill.token);
  assert.equal((accountsAfterCompromise.json() as { data?: { activeAccountId?: string } }).data?.activeAccountId, EXISTING_USER);
  console.log('PASS 25 compromised wallet login is rejected and the Forex account remains');

  const refresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: primaryStill.refresh },
  });
  assert.equal(refresh.statusCode, 200, brief(refresh));
  const refreshedToken = (refresh.json() as { data?: { accessToken?: string } }).data?.accessToken ?? '';
  const refreshedUser = app.jwt.verify<{ userId: string; type?: string }>(refreshedToken);
  assert.equal(refreshedUser.userId, EXISTING_USER);
  assert.notEqual(refreshedUser.type, 'admin');
  const afterRefresh = await authed('GET', '/api/v1/forex/accounts', refreshedToken);
  assert.equal(afterRefresh.statusCode, 200, brief(afterRefresh));
  assert.equal((afterRefresh.json() as { data?: { activeAccountId?: string } }).data?.activeAccountId, EXISTING_USER);
  console.log('PASS 26 refresh keeps the same Forex identity');

  const logout = await authed('POST', '/api/v1/auth/logout', refreshedToken, {});
  assert.equal(logout.statusCode, 200, brief(logout));
  const afterLogout = await authed('GET', '/api/v1/forex/accounts', refreshedToken);
  assert.equal(afterLogout.statusCode, 401, brief(afterLogout));
  const relogin = await walletLogin(existingWalletA);
  assert.equal(relogin.status, 200, relogin.body);
  assert.equal(relogin.userId, EXISTING_USER);
  console.log('PASS 27 logout revokes the session and a fresh login returns the same users.id');

  const abandoned = await issue(existingWalletA);
  const otherWallet = Wallet.createRandom();
  const wrongSignature = await otherWallet.signMessage(abandoned.challenge.message);
  await clearLimits();
  const switched = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: {
      challengeId: abandoned.challenge.id,
      message: abandoned.challenge.message,
      signature: wrongSignature,
    },
  });
  assert.notEqual(switched.statusCode, 200, brief(switched));
  const usersAfterSwitch = await tableCount('users');
  const chainIssued = await issue(existingWalletA, '137');
  await clearLimits();
  const chainLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: {
      challengeId: chainIssued.challenge.id,
      message: chainIssued.challenge.message,
      signature: chainIssued.signature,
    },
  });
  if (chainLogin.statusCode === 200) {
    const chainUser = (chainLogin.json() as { data?: { user?: { id?: string } } }).data?.user?.id ?? '';
    assert.equal(chainUser, EXISTING_USER);
  } else {
    assert.ok(chainLogin.statusCode >= 400, brief(chainLogin));
  }
  assert.equal(await tableCount('users'), usersAfterSwitch);
  assert.equal(await count(`SELECT count(*)::int AS n FROM forex_accounts WHERE user_id = $1 AND account_id = $1`, [EXISTING_USER]), 1);
  console.log('PASS 44 account switch during login does not attach another Forex account');
  console.log('PASS 45 chain switch does not create a different Forex account');

  const challengeOne = await issue(existingWalletA);
  const challengeTwo = await issue(existingWalletA);
  await clearLimits();
  const [first, second] = await Promise.all([
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: { challengeId: challengeOne.challenge.id, message: challengeOne.challenge.message, signature: challengeOne.signature },
    }),
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/wallet/login',
      payload: { challengeId: challengeTwo.challenge.id, message: challengeTwo.challenge.message, signature: challengeTwo.signature },
    }),
  ]);
  assert.equal(first.statusCode, 200, brief(first));
  assert.equal(second.statusCode, 200, brief(second));
  const firstId = (first.json() as { data: { user: { id: string } } }).data.user.id;
  const secondId = (second.json() as { data: { user: { id: string } } }).data.user.id;
  assert.equal(firstId, EXISTING_USER);
  assert.equal(secondId, EXISTING_USER);
  console.log('PASS 43 concurrent wallet logins resolve to the same users.id');

  const quoted = getForexPricingService().applyDemoPrice('EURUSD', '0.40000');
  assert.ok(quoted);
  await getForexProtectionService(positionsSvc, ordersSvc, pricing).evaluateQuote(quoted!);
  const slRow = await pool.query<{ account_id: string }>(
    `SELECT account_id FROM forex_protections WHERE protection_id = $1`,
    [protectionId]
  );
  assert.equal(slRow.rows[0]?.account_id, EXISTING_USER);
  console.log('PASS stop-loss evaluation keeps the Forex account owner');

  const liq = getForexLiquidationService(positionsSvc, ordersSvc, getForexAccountingService(positionsSvc, pricing));
  const balancesBeforeLiq = await tableCount('user_balances');
  const ledgerCryptoBeforeLiq = await tableCount('balance_ledger');
  const liquidation = await liq.evaluateAccount(EXISTING_USER);
  if (liquidation) {
    assert.equal(liquidation.accountId, EXISTING_USER);
    assert.equal(liquidation.accountId.startsWith('0x'), false);
  }
  assert.equal(await tableCount('user_balances'), balancesBeforeLiq);
  assert.equal(await tableCount('balance_ledger'), ledgerCryptoBeforeLiq);
  const liqStatus = await authed('GET', '/api/v1/forex/liquidation', relogin.token);
  assert.equal(liqStatus.statusCode, 200, brief(liqStatus));
  assert.equal(bodyHasAddress(liqStatus.body, existingWalletA.address), false);
  console.log('PASS 34 liquidation evaluation targets the Forex account and does not touch crypto balances');

  const closed = await authed('POST', `/api/v1/forex/positions/${positionId}/close`, relogin.token, {
    clientOrderId: `step10-close-${crypto.randomUUID()}`,
  });
  const closedRow = await pool.query<{ account_id: string; status: string }>(
    `SELECT account_id, status FROM forex_positions WHERE position_id = $1`,
    [positionId]
  );
  assert.equal(closedRow.rows[0]?.account_id, EXISTING_USER);
  if (closed.statusCode === 200) {
    console.log('PASS 9 position close stays on the Forex account');
  } else {
    assert.equal(closed.statusCode, 409, brief(closed));
    assert.equal(closed.body.includes('POSITION_CLOSED'), true);
    console.log('PASS 9 position was already closed by account-scoped protection or liquidation');
  }

  const cryptoFinal = await count(
    `SELECT count(*)::int AS n FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND chain_id = '' AND account_type = 'trading' AND available_balance = 100000`,
    [EXISTING_USER, usdtId]
  );
  assert.equal(cryptoFinal, 1);
  assert.equal(await tableCount('balance_ledger'), beforeLogin.balance_ledger);
  assert.equal(await tableCount('wallets'), beforeLogin.wallets);
  assert.equal(await tableCount('hot_wallets'), beforeLogin.hot_wallets);
  assert.equal(await tableCount('cold_wallets'), beforeLogin.cold_wallets);
  assert.ok((await tableCount('forex_ledger_transactions')) > beforeLogin.forex_ledger_transactions);
  const reconAfter = await tableCount('forex_reconciliation_events');
  assert.ok(reconAfter >= reconBefore);
  const reconOwners = await pool.query<{ account_id: string }>(
    `SELECT DISTINCT account_id FROM forex_reconciliation_events`
  );
  assert.equal(reconOwners.rows.every((row) => row.account_id === EXISTING_USER || row.account_id === native.userId), true);
  console.log('PASS 20 wallet login does not change the crypto balance');
  console.log('PASS 21 Forex activity does not change the crypto balance');
  console.log('PASS 22 Forex ledger does not write the crypto ledger');
  console.log('PASS 37 reconciliation rows stay on Forex account ids');

  const addrSql = `
    WITH addrs AS (
      SELECT lower(address) AS a FROM user_wallets
      UNION SELECT lower(normalized_address) FROM user_wallets
      UNION SELECT lower(caip10) FROM user_wallets
    )
    SELECT
      (SELECT count(*)::int FROM forex_accounts WHERE lower(account_id) IN (SELECT a FROM addrs) OR lower(user_id::text) IN (SELECT a FROM addrs)) AS accounts,
      (SELECT count(*)::int FROM forex_orders WHERE lower(account_id) IN (SELECT a FROM addrs)) AS orders,
      (SELECT count(*)::int FROM forex_positions WHERE lower(account_id) IN (SELECT a FROM addrs)) AS positions,
      (SELECT count(*)::int FROM forex_ledger_transactions WHERE lower(account_id) IN (SELECT a FROM addrs)) AS ledger,
      (SELECT count(*)::int FROM forex_ledger_entries WHERE lower(account_id) IN (SELECT a FROM addrs)) AS entries,
      (SELECT count(*)::int FROM forex_fee_events WHERE lower(account_id) IN (SELECT a FROM addrs)) AS fees,
      (SELECT count(*)::int FROM forex_swap_events WHERE lower(account_id) IN (SELECT a FROM addrs)) AS swaps,
      (SELECT count(*)::int FROM user_balances WHERE lower(user_id::text) IN (SELECT a FROM addrs)) AS crypto
  `;
  const crossed = await pool.query<{
    accounts: number; orders: number; positions: number; ledger: number; entries: number; fees: number; swaps: number; crypto: number;
  }>(addrSql);
  for (const value of Object.values(crossed.rows[0] ?? {})) assert.equal(value, 0);
  console.log('PASS 14 15 23 wallet address is not a Forex owner, account id, or ledger owner');

  const sessionFile = fs.readFileSync(path.resolve('../frontend/src/lib/forex/runtime/useForexSession.ts'), 'utf8');
  assert.equal(sessionFile.includes('s.user?.id'), true);
  assert.equal(sessionFile.includes('caip10'), false);
  assert.equal(sessionFile.includes('normalized_address'), false);
  const kycHook = fs.readFileSync(path.resolve('../frontend/src/lib/forex/hooks/useForexWalletKyc.ts'), 'utf8');
  assert.equal(kycHook.includes('/api/v1/wallet/kyc-status'), true);
  assert.equal(kycHook.includes('caip10'), false);
  assert.equal(kycHook.includes('accountId'), false);
  console.log('PASS Forex UI session account id is users.id and does not render a CAIP-10 account number');

  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address === 'object');
  const wsPort = address.port;

  async function connectForex(token?: string): Promise<{ ws: WebSocket; frames: string[] }> {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}/api/v1/forex/ws`, { headers });
    const frames: string[] = [];
    ws.on('message', (data) => frames.push(data.toString()));
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    await waitFor(frames, (frame) => frame.includes('welcome'));
    return { ws, frames };
  }

  const ownerWs = await connectForex(relogin.token);
  ownerWs.ws.send(JSON.stringify({ type: 'refresh_account' }));
  const context = await waitFor(ownerWs.frames, (frame) => frame.includes('account_context'));
  assert.equal(context.includes(EXISTING_USER), true);
  assert.equal(context.toLowerCase().includes(existingWalletA.address.toLowerCase()), false);
  ownerWs.ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.order' }));
  await waitFor(ownerWs.frames, (frame) => frame.includes('subscribed') && frame.includes('fx.order'));
  const strangerWs = await connectForex(native.token);
  strangerWs.ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.order' }));
  await waitFor(strangerWs.frames, (frame) => frame.includes('subscribed') && frame.includes('fx.order'));
  const anon = await connectForex();
  anon.ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.order' }));
  const denied = await waitFor(anon.frames, (frame) => frame.includes('AUTH_REQUIRED'));
  assert.equal(denied.includes('AUTH_REQUIRED'), true);
  anon.ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.quote.EURUSD' }));
  const publicSub = await waitFor(anon.frames, (frame) => frame.includes('fx.quote'));
  assert.equal(publicSub.includes('fx.quote'), true);
  const marker = `fx-identity-${EXISTING_USER}`;
  forexWsHub.publishPrivate(EXISTING_USER, 'fx.order', { marker, accountId: EXISTING_USER });
  const got = await waitFor(ownerWs.frames, (frame) => frame.includes(marker));
  assert.equal(got.includes(EXISTING_USER), true);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(strangerWs.frames.some((frame) => frame.includes(marker)), false);
  ownerWs.ws.close();
  strangerWs.ws.close();
  anon.ws.close();
  console.log('PASS 38 Forex websocket identity is the Forex account and private events stay there');

  const { setCutoverMode } = await import('../services/legacy-auth-policy.service.js');
  await setCutoverMode('WALLET_ONLY', 'step14-forex');
  const onlyLogin = await walletLogin(existingWalletA);
  assert.equal(onlyLogin.status, 200, onlyLogin.body);
  assert.equal(onlyLogin.userId, EXISTING_USER);
  const onlyAccounts = await authed('GET', '/api/v1/forex/accounts', onlyLogin.token);
  assert.equal(onlyAccounts.statusCode, 200, brief(onlyAccounts));
  assert.equal(onlyAccounts.body.includes(EXISTING_USER), true);
  assert.equal(onlyAccounts.body.toLowerCase().includes(existingWalletA.address.toLowerCase()), false);
  const onlyPassword = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login/password',
    payload: { email: existingEmail, password: LEGACY_PASSWORD },
  });
  assert.equal(onlyPassword.statusCode, 403, brief(onlyPassword));
  await setCutoverMode('LEGACY_AND_WALLET', 'step14-forex');
  console.log('PASS wallet-only policy keeps Forex on users.id and denies password login');

  await app.close();
  await pool.end();
  await rateRedis.quit();
  await db.close();
  await redis.close();
}

/* eslint-disable no-unused-vars */
function waitFor(frames: string[], pred: (value: string) => boolean): Promise<string> {
/* eslint-enable no-unused-vars */
  const existing = frames.find(pred);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for frame; saw ${frames.join(' | ').slice(0, 500)}`)), 5000);
    const timerPoll = setInterval(() => {
      const found = frames.find(pred);
      if (found) {
        clearTimeout(timer);
        clearInterval(timerPoll);
        resolve(found);
      }
    }, 25);
  });
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
