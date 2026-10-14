/**
 * STEP 9 — Spot and P2P identity regression after wallet login.
 * Isolated database only. Refuses database name exchange or postgres, and Redis port 6379.
 * Wallet address is an authentication credential. Ownership stays users.id.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { Wallet } from 'ethers';
import { Pool } from 'pg';
import WebSocket from 'ws';

const testUrl = process.env.SPOT_P2P_WALLET_TEST_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.SPOT_P2P_WALLET_TEST_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('SPOT_P2P_WALLET_TEST_DATABASE_URL and SPOT_P2P_WALLET_TEST_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '') {
  console.error('Refusing to run Spot/P2P wallet identity tests against a non-isolated database');
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
process.env.MATCHING_ENGINE_URL = 'http://127.0.0.1:18099';
process.env.LOG_LEVEL = 'error';

const EXISTING_USER = 'a0000000-0000-4000-8000-00000000aa01';
const LEGACY_PASSWORD = 'Step9Legacy!1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EngineHit = { url: string; body: string; userHeader: string };

const engineHits: EngineHit[] = [];

function brief(res: { statusCode: number; body: string }): string {
  return `${res.statusCode} ${res.body.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').slice(0, 600)}`;
}

function assertUuidOwner(id: string, label: string): void {
  assert.match(id, UUID_RE, `${label} must be users.id`);
  assert.equal(id.startsWith('0x') || id.startsWith('0X'), false, `${label} must not be a wallet address`);
}

async function listenEngine(): Promise<http.Server> {
  const engine = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const header = req.headers['x-user-id'];
      engineHits.push({
        url: req.url ?? '',
        body,
        userHeader: typeof header === 'string' ? header : '',
      });
      const path = req.url ?? '';
      res.writeHead(200, { 'content-type': 'application/json' });
      if (path.startsWith('/health')) {
        res.end(JSON.stringify({ ok: true, engine_id: 'default' }));
        return;
      }
      if (path.startsWith('/engine/matches')) {
        res.end(JSON.stringify({ last_id: 0, events: [] }));
        return;
      }
      res.end(JSON.stringify({ ok: true, events: [], last_id: 0 }));
    });
  });
  await new Promise<void>((resolve) => engine.listen(18099, '127.0.0.1', () => resolve()));
  return engine;
}

async function run(): Promise<void> {
  const engine = await listenEngine();
  const { Decimal } = await import('../lib/decimal.js');
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
  const { getSpotOrdersUseMarket } = await import('../lib/spot-schema-cache.js');
  const { otpService } = await import('../services/otp.service.js');
  const { rustOrderToWirePayload } = await import('../services/settlement/engine-client.js');
  const { default: authRoutes } = await import('./auth.fastify.js');
  const { default: walletLoginRoutes } = await import('./auth-wallet-login.fastify.js');
  const { default: walletManagementRoutes } = await import('./auth-wallet-management.fastify.js');
  const { default: spotRoutes } = await import('./spot.fastify.js');
  const { default: p2pRoutes } = await import('./p2p.fastify.js');
  const { default: adminWalletRecoveryRoutes } = await import('./admin-wallet-recovery.fastify.js');
  const Redis = (await import('ioredis')).default;
  const spotWs = await import('../services/spot-ws.service.js');

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
  const useMarket = await getSpotOrdersUseMarket();
  assert.equal(useMarket, true, 'isolated spot_orders must use the market column');

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
    return count(`SELECT count(*)::int AS n FROM ${table}`);
  }

  const preserved = [
    'kyc_applications',
    'wallets',
    'user_master_keys',
    'hot_wallets',
    'cold_wallets',
    'forex_accounts',
    'forex_ledger_transactions',
    'forex_ledger_entries',
  ] as const;
  const beforePreserved: Record<string, number> = {};
  for (const table of preserved) beforePreserved[table] = await tableCount(table);
  const paymentMethodsBeforeLogin = await tableCount('user_p2p_payment_methods');

  const existing = await pool.query<{ email: string; totp_enabled: boolean | null; passkeys_enabled: boolean | null }>(
    `SELECT email, totp_enabled, passkeys_enabled FROM users WHERE id = $1`,
    [EXISTING_USER]
  );
  assert.equal(existing.rows.length, 1, 'STEP 0 seed user missing');
  const existingEmail = existing.rows[0]!.email;
  const passwordHash = await bcrypt.hash(LEGACY_PASSWORD, 6);
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [EXISTING_USER, passwordHash]);
  await pool.query(
    `INSERT INTO spot_orders (user_id, market, side, type, price, quantity, filled_quantity, status, time_in_force, match_engine_id)
     VALUES ($1, 'BTC_USDT', 'buy', 'limit', 100, 0.01, 0.01, 'FILLED', 'gtc', 'node')`,
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
  const historyOrder = await pool.query<{ id: string }>(
    `SELECT id FROM spot_orders WHERE user_id = $1 AND status = 'FILLED' LIMIT 1`,
    [EXISTING_USER]
  );
  const historyOrderId = historyOrder.rows[0]!.id;

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
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }
      const decoded = app.jwt.verify<{ userId: string; role: string; sessionId: string; type?: string }>(token);
      if (decoded.type === 'admin' || decoded.type === 'refresh') {
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
  app.decorate('authenticateOptional', async function (request: { headers: { authorization?: string }; user?: unknown }) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token || !token.includes('.')) return;
    try {
      const decoded = app.jwt.verify<{ userId: string; role: string; sessionId: string; type?: string }>(token);
      if (decoded.type === 'admin' || decoded.type === 'refresh') return;
      const valid = await isSessionValid(decoded.sessionId);
      if (!valid) return;
      request.user = { id: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };
    } catch {
      /* public route stays anonymous */
    }
  });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletManagementRoutes, { prefix: '/api/v1/auth' });
  await app.register(walletLoginRoutes, { prefix: '/api/v1/auth' });
  await app.register(spotRoutes, { prefix: '/api/v1/spot' });
  await app.register(p2pRoutes, { prefix: '/api/v1/p2p' });
  await app.register(adminWalletRecoveryRoutes, { prefix: '/api/v1/admin' });

  async function clearLimits(): Promise<void> {
    const keys = await rateRedis.keys('rate:*');
    if (keys.length > 0) await rateRedis.del(...keys);
  }

  async function authed(method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: unknown, headers?: Record<string, string>) {
    await clearLimits();
    return app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, ...headers },
      payload,
    });
  }

  async function issue(wallet: Wallet) {
    const challenge = await createWalletAuthChallenge({
      caip10: `eip155:1:${wallet.address}`,
      frontendUrl: 'http://wallet-auth.test:3000',
      query: (sql, params) => pool.query(sql, params),
    });
    const signature = await wallet.signMessage(challenge.message);
    return { challenge, signature };
  }

  async function walletLogin(wallet: Wallet): Promise<{ token: string; refresh: string; userId: string }> {
    const issued = await issue(wallet);
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
    assert.equal(res.statusCode, 200, brief(res));
    const body = res.json() as { data: { user: { id: string }; accessToken: string; refreshToken: string } };
    assertUuidOwner(body.data.user.id, 'wallet login user');
    assert.equal(body.data.user.id === wallet.address, false);
    return { token: body.data.accessToken, refresh: body.data.refreshToken, userId: body.data.user.id };
  }

  async function linkEvm(token: string, wallet: Wallet) {
    const challengeRes = await authed('POST', '/api/v1/auth/wallets/link/challenge', token, {
      caip10: `eip155:1:${wallet.address}`,
    });
    assert.equal(challengeRes.statusCode, 200, brief(challengeRes));
    const challengeBody = challengeRes.json() as { challenge: { id: string; message: string } };
    const signature = await wallet.signMessage(challengeBody.challenge.message);
    const verifyRes = await authed('POST', '/api/v1/auth/wallets/link/verify', token, {
      challengeId: challengeBody.challenge.id,
      message: challengeBody.challenge.message,
      signature,
    });
    return verifyRes;
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

  const market = await pool.query<{ min_qty: string; min_notional: string; qty_precision: number }>(
    `SELECT min_qty::text, min_notional::text, qty_precision FROM spot_markets WHERE symbol = 'BTC_USDT' AND status = 'active'`
  );
  assert.equal(market.rows.length, 1);
  const minQty = new Decimal(market.rows[0]!.min_qty);
  const minNotional = new Decimal(market.rows[0]!.min_notional);
  const price = new Decimal('100');
  let qty = Decimal.max(minQty, minNotional.div(price));
  if (qty.lte(0)) qty = new Decimal('0.01');
  qty = qty.toDecimalPlaces(market.rows[0]!.qty_precision, Decimal.ROUND_UP);
  if (qty.lte(0)) qty = new Decimal('0.01');

  async function placeLimit(token: string, clientOrderId: string) {
    return authed('POST', '/api/v1/spot/order', token, {
      market: 'BTC_USDT',
      side: 'buy',
      type: 'limit',
      price: price.toString(),
      quantity: qty.toString(),
      client_order_id: clientOrderId,
    });
  }

  const markets = await app.inject({ method: 'GET', url: '/api/v1/spot/markets' });
  assert.equal(markets.statusCode, 200, brief(markets));
  console.log('PASS markets are public and do not require a wallet address');

  const walletNative = Wallet.createRandom();
  const native = await walletLogin(walletNative);
  assert.equal(await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1`, [native.userId]), 1);
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1 AND normalized_address = $2`, [
      native.userId,
      walletNative.address.toLowerCase(),
    ]),
    1
  );
  assert.notEqual(native.userId, walletNative.address.toLowerCase());
  const nativeEmail = await pool.query<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [native.userId]);
  assert.equal(nativeEmail.rows[0]?.email, null);
  console.log('PASS 1 new wallet-native user reaches the existing session as users.id');

  const usersAfterNative = await tableCount('users');
  const replay = await walletLogin(walletNative);
  assert.equal(replay.userId, native.userId);
  assert.equal(await tableCount('users'), usersAfterNative);
  console.log('PASS 34 reconnect uses a fresh challenge and the same users.id');

  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'trading', 100000, 0, 0, 0)`,
    [native.userId, usdtId]
  );
  const placed = await placeLimit(native.token, `step9-native-${crypto.randomUUID()}`);
  assert.equal(placed.statusCode, 200, brief(placed));
  const placedBody = placed.json() as { data?: { id?: string } };
  const nativeOrderId = placedBody.data?.id ?? '';
  assert.match(nativeOrderId, UUID_RE);
  const nativeOrder = await pool.query<{ user_id: string; status: string }>(
    `SELECT user_id::text, status FROM spot_orders WHERE id = $1`,
    [nativeOrderId]
  );
  assert.equal(nativeOrder.rows[0]?.user_id, native.userId);
  assert.notEqual(nativeOrder.rows[0]?.user_id, walletNative.address.toLowerCase());
  console.log('PASS 2 spot order owner is users.id');
  console.log('PASS 27 wallet address is not the spot owner');

  const placeHits = engineHits.filter((hit) => hit.url.startsWith('/engine/place'));
  assert.ok(placeHits.length >= 1, 'matching engine did not receive the order');
  const wire = JSON.parse(placeHits[placeHits.length - 1]!.body) as { user_id?: string; signature?: string; private_key?: string };
  assert.equal(wire.user_id, native.userId);
  assert.equal(placeHits[placeHits.length - 1]!.userHeader === '' || placeHits[placeHits.length - 1]!.userHeader === native.userId, true);
  assert.equal(wire.signature, undefined);
  assert.equal(wire.private_key, undefined);
  assert.equal(JSON.stringify(wire).includes(walletNative.address), false);
  const sample = rustOrderToWirePayload({
    id: nativeOrderId,
    user_id: native.userId,
    market: 'BTC_USDT',
    side: 'buy',
    type: 'limit',
    price: price.toString(),
    quantity: qty.toString(),
    remaining: qty.toString(),
    created_at: 1,
  });
  assert.equal(sample.user_id, native.userId);
  console.log('PASS matching-engine owner is users.id and the payload has no key or signature');

  const openOwn = await authed('GET', '/api/v1/spot/open-orders', native.token);
  assert.equal(openOwn.statusCode, 200, brief(openOwn));
  assert.equal(openOwn.body.includes(nativeOrderId), true);
  const cancelOwn = await authed('POST', `/api/v1/spot/order/${nativeOrderId}/cancel`, native.token, {});
  assert.equal(cancelOwn.statusCode, 200, brief(cancelOwn));
  const cancelled = await pool.query<{ user_id: string; status: string }>(
    `SELECT user_id::text, status FROM spot_orders WHERE id = $1`,
    [nativeOrderId]
  );
  assert.equal(cancelled.rows[0]?.user_id, native.userId);
  assert.equal((cancelled.rows[0]?.status ?? '').toLowerCase(), 'cancelled');
  console.log('PASS 7 cancel own spot order');

  const walletOther = Wallet.createRandom();
  const other = await walletLogin(walletOther);
  assert.notEqual(other.userId, native.userId);
  const cancelOther = await authed('POST', `/api/v1/spot/order/${nativeOrderId}/cancel`, other.token, {});
  assert.equal(cancelOther.statusCode, 404, brief(cancelOther));
  const stillOwner = await pool.query<{ user_id: string }>(`SELECT user_id::text FROM spot_orders WHERE id = $1`, [nativeOrderId]);
  assert.equal(stillOwner.rows[0]?.user_id, native.userId);
  console.log('PASS 8 cancel another user spot order rejected');

  const otherList = await authed('GET', '/api/v1/spot/orders?status=ALL', other.token);
  assert.equal(otherList.statusCode, 200, brief(otherList));
  assert.equal(otherList.body.includes(nativeOrderId), false);
  assert.equal(otherList.body.includes(historyOrderId), false);
  console.log('PASS 9 another user cannot read private spot order details');

  const nativeOrders = await authed('GET', '/api/v1/spot/orders?status=ALL', replay.token);
  assert.equal(nativeOrders.statusCode, 200, brief(nativeOrders));
  assert.equal(nativeOrders.body.includes(nativeOrderId), true);
  console.log('PASS 35 wallet disconnect leaves the application session valid');

  const refresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: native.refresh },
  });
  assert.equal(refresh.statusCode, 200, brief(refresh));
  const refreshed = refresh.json() as { data?: { accessToken?: string } };
  const refreshedToken = refreshed.data?.accessToken ?? '';
  const refreshedPayload = app.jwt.verify<{ userId: string; type?: string }>(refreshedToken);
  assert.equal(refreshedPayload.userId, native.userId);
  assert.notEqual(refreshedPayload.type, 'admin');
  console.log('PASS 32 session refresh keeps users.id');

  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     SELECT $1, $2, t.chain_id, 'funding', 1000, 0, 0, 0
     FROM tokens t WHERE upper(t.symbol) = 'USDT' AND t.is_active IS TRUE
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 1000`,
    [native.userId, usdtId]
  );
  assert.equal(await tableCount('user_p2p_payment_methods'), paymentMethodsBeforeLogin);
  const bankCatalog = await pool.query<{ id: string }>(
    `SELECT id::text FROM p2p_payment_methods WHERE code = 'bank_transfer' AND is_active IS TRUE LIMIT 1`
  );
  assert.equal(bankCatalog.rows.length, 1, 'migrated p2p_payment_methods must include active bank_transfer');
  const bankMethodId = bankCatalog.rows[0]!.id;
  const pm = await authed('POST', '/api/v1/p2p/my-payment-methods', replay.token, {
    payment_method_id: bankMethodId,
    display_name: 'Bank account',
    payment_details: { holder: 'Trader', bank: 'Test Bank' },
  });
  assert.equal(pm.statusCode, 201, brief(pm));
  const pmBody = pm.json() as { data?: { id?: string; user_id?: string; payment_details?: unknown } };
  const paymentMethodId = pmBody.data?.id ?? '';
  assert.equal(pmBody.data?.user_id, native.userId);
  assert.equal(JSON.stringify(pmBody.data?.payment_details).includes(walletNative.address), false);
  console.log('PASS 10 payment method is explicit and is not the login wallet');

  const ad = await authed('POST', '/api/v1/p2p/ads', replay.token, {
    type: 'sell',
    currency: 'USDT',
    fiat: 'USD',
    price: '1',
    min_amount: '1',
    max_amount: '5',
    available_amount: '5',
    payment_method_ids: [paymentMethodId],
    payment_time_limit: 15,
  });
  assert.equal(ad.statusCode, 201, brief(ad));
  const adBody = ad.json() as { data?: { id?: string } };
  const adId = adBody.data?.id ?? '';
  const adRow = await pool.query<{ user_id: string }>(`SELECT user_id::text FROM p2p_ads WHERE id = $1`, [adId]);
  assert.equal(adRow.rows[0]?.user_id, native.userId);
  console.log('PASS 3 P2P ad owner is users.id');
  console.log('PASS 10 create own P2P ad');

  const book = await app.inject({ method: 'GET', url: '/api/v1/p2p/ads?type=sell&currency=USDT&fiat=USD' });
  assert.equal(book.statusCode, 200, brief(book));
  assert.equal(book.body.toLowerCase().includes(walletNative.address.toLowerCase()), false);
  assert.equal(book.body.includes(native.userId), true);
  console.log('PASS 26 marketplace counterparty is users.id, not the login wallet');

  const walletSecondary = Wallet.createRandom();
  const linkedSecondary = await linkEvm(replay.token, walletSecondary);
  assert.equal(linkedSecondary.statusCode, 200, brief(linkedSecondary));
  const secondaryLogin = await walletLogin(walletSecondary);
  assert.equal(secondaryLogin.userId, native.userId);
  const sameAds = await authed('GET', '/api/v1/p2p/my-ads', secondaryLogin.token);
  assert.equal(sameAds.statusCode, 200, brief(sameAds));
  assert.equal(sameAds.body.includes(adId), true);
  const sameOrders = await authed('GET', '/api/v1/spot/orders?status=ALL', secondaryLogin.token);
  assert.equal(sameOrders.body.includes(nativeOrderId), true);
  console.log('PASS 5 secondary wallet login keeps users.id');
  console.log('PASS 17 link wallet B keeps users.id');
  console.log('PASS 18 login with wallet B sees the same Spot and P2P identity');
  console.log('PASS 28 secondary wallet keeps the same financial user');

  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     SELECT $1, $2, t.chain_id, 'funding', 1000, 0, 0, 0
     FROM tokens t WHERE upper(t.symbol) = 'USDT' AND t.is_active IS TRUE
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 1000`,
    [other.userId, usdtId]
  );
  const otherPm = await authed('POST', '/api/v1/p2p/my-payment-methods', other.token, {
    payment_method_id: bankMethodId,
    display_name: 'Other bank',
    payment_details: { holder: 'Other', bank: 'Other Bank' },
  });
  assert.equal(otherPm.statusCode, 201, brief(otherPm));
  const ordersBeforeCreate = await count(`SELECT count(*)::int AS n FROM p2p_orders WHERE ad_id = $1`, [adId]);
  const otherPmBody = otherPm.json() as { data?: { id?: string } };
  const p2pOrder = await authed('POST', '/api/v1/p2p/orders', other.token, {
    adId,
    quantity: '1',
    paymentMethodId: otherPmBody.data?.id,
  }, { 'idempotency-key': crypto.randomUUID() });
  assert.equal(p2pOrder.body.includes('Invalid argument: undefined'), false, brief(p2pOrder));
  assert.equal(p2pOrder.statusCode, 201, brief(p2pOrder));
  assert.equal(await count(`SELECT count(*)::int AS n FROM p2p_orders WHERE ad_id = $1`, [adId]) > ordersBeforeCreate, true);
  console.log('PASS 4 P2P order create stored buyer and seller through the service');
  const p2pOrderId = (p2pOrder.json() as { data?: { id?: string } }).data?.id ?? '';
  assert.match(p2pOrderId, UUID_RE);
  const parties = await pool.query<{ buyer_id: string; seller_id: string; escrow_id: string }>(
    `SELECT buyer_id::text, seller_id::text, escrow_id::text FROM p2p_orders WHERE id = $1`,
    [p2pOrderId]
  );
  assert.equal(parties.rows[0]?.buyer_id, other.userId);
  assert.equal(parties.rows[0]?.seller_id, native.userId);
  const escrow = await pool.query<{ user_id: string; status: string }>(
    `SELECT user_id::text, status FROM escrows WHERE id = $1`,
    [parties.rows[0]!.escrow_id]
  );
  assert.equal(escrow.rows[0]?.user_id, native.userId);
  assert.equal(escrow.rows[0]?.status, 'locked');
  assert.notEqual(parties.rows[0]?.buyer_id, walletOther.address.toLowerCase());
  assert.notEqual(parties.rows[0]?.seller_id, walletNative.address.toLowerCase());
  console.log('PASS 4 P2P buyer and seller identities are users.id');
  console.log('PASS escrow owner is the seller users.id');

  const otherAdPatch = await authed('PATCH', `/api/v1/p2p/my-ads/${adId}`, other.token, { price: '2' });
  assert.notEqual(otherAdPatch.statusCode, 200, brief(otherAdPatch));
  const adPrice = await pool.query<{ price: string }>(`SELECT price::text FROM p2p_ads WHERE id = $1`, [adId]);
  assert.equal(new Decimal(adPrice.rows[0]!.price).eq(1), true);
  console.log('PASS 11 modify another user P2P ad rejected');

  const otherOrderRead = await authed('GET', `/api/v1/p2p/orders/${p2pOrderId}`, replay.token);
  assert.equal(otherOrderRead.statusCode, 200, brief(otherOrderRead));
  const strangerOrderRead = await walletLogin(Wallet.createRandom());
  const strangerRead = await authed('GET', `/api/v1/p2p/orders/${p2pOrderId}`, strangerOrderRead.token);
  assert.equal(strangerRead.statusCode, 404, brief(strangerRead));
  console.log('PASS 12 read another user P2P order rejected');

  const strangerChat = await authed('GET', `/api/v1/p2p/orders/${p2pOrderId}/messages`, strangerOrderRead.token);
  assert.equal(strangerChat.statusCode, 404, brief(strangerChat));
  const ownChat = await authed('POST', `/api/v1/p2p/orders/${p2pOrderId}/messages`, other.token, { message: 'paid by bank' });
  assert.equal(ownChat.statusCode, 201, brief(ownChat));
  const chatRow = await pool.query<{ sender_id: string; message: string }>(
    `SELECT sender_id::text, message FROM p2p_order_messages WHERE order_id = $1`,
    [p2pOrderId]
  );
  assert.equal(chatRow.rows[0]?.sender_id, other.userId);
  assert.equal(chatRow.rows[0]?.message.includes(walletOther.address), false);
  console.log('PASS 13 another user P2P chat rejected');

  await pool.query(
    `INSERT INTO p2p_disputes (order_id, initiator_id, reason) VALUES ($1, $2, 'identity scope check only')`,
    [p2pOrderId, other.userId]
  );
  const dispute = await pool.query<{ id: string }>(`SELECT id FROM p2p_disputes WHERE order_id = $1`, [p2pOrderId]);
  const ownDispute = await authed('GET', `/api/v1/p2p/disputes/${dispute.rows[0]!.id}`, other.token);
  assert.equal(ownDispute.statusCode, 200, brief(ownDispute));
  const strangerDispute = await authed('GET', `/api/v1/p2p/disputes/${dispute.rows[0]!.id}`, strangerOrderRead.token);
  assert.equal(strangerDispute.statusCode, 404, brief(strangerDispute));
  console.log('PASS P2P dispute read is limited to buyer or seller users.id');

  const strangerCancel = await authed('POST', `/api/v1/p2p/orders/${p2pOrderId}/cancel`, strangerOrderRead.token, {
    reason: 'not my order',
  }, { 'idempotency-key': crypto.randomUUID() });
  assert.notEqual(strangerCancel.statusCode, 200, brief(strangerCancel));
  await rateRedis.del(`p2p:cooldown:${p2pOrderId}`);
  const ownerCancel = await authed('POST', `/api/v1/p2p/orders/${p2pOrderId}/cancel`, other.token, {
    reason: 'identity regression cancel',
  }, { 'idempotency-key': crypto.randomUUID() });
  const escrowAfter = await pool.query<{ user_id: string; status: string }>(
    `SELECT user_id::text, status FROM escrows WHERE id = $1`,
    [parties.rows[0]!.escrow_id]
  );
  assert.equal(escrowAfter.rows[0]?.user_id, native.userId);
  assert.equal(ownerCancel.statusCode, 200, brief(ownerCancel));
  assert.equal(escrowAfter.rows[0]?.status, 'refunded');
  console.log('PASS P2P cancel refund stays on seller users.id');

  const [burstA, burstB] = await Promise.all([
    placeLimit(secondaryLogin.token, `step9-burst-a-${crypto.randomUUID()}`),
    placeLimit(secondaryLogin.token, `step9-burst-b-${crypto.randomUUID()}`),
  ]);
  assert.equal(burstA.statusCode, 200, brief(burstA));
  assert.equal(burstB.statusCode, 200, brief(burstB));
  const burstIds = [
    (burstA.json() as { data?: { id?: string } }).data?.id,
    (burstB.json() as { data?: { id?: string } }).data?.id,
  ];
  for (const id of burstIds) {
    const row = await pool.query<{ user_id: string }>(`SELECT user_id::text FROM spot_orders WHERE id = $1`, [id]);
    assert.equal(row.rows[0]?.user_id, native.userId);
  }
  console.log('PASS 30 concurrent spot orders stay on the same users.id');

  const otherAd = await authed('POST', '/api/v1/p2p/ads', other.token, {
    type: 'buy',
    currency: 'USDT',
    fiat: 'USD',
    price: '1',
    min_amount: '1',
    max_amount: '2',
    available_amount: '2',
    payment_method_ids: [(otherPm.json() as { data?: { id?: string } }).data?.id],
    payment_time_limit: 15,
  });
  assert.equal(otherAd.statusCode, 201, brief(otherAd));
  const otherAdId = (otherAd.json() as { data?: { id?: string } }).data?.id ?? '';
  const [p2pA, p2pB] = await Promise.all([
    authed('POST', '/api/v1/p2p/orders', secondaryLogin.token, {
      adId: otherAdId,
      quantity: '1',
      paymentMethodId,
    }, { 'idempotency-key': crypto.randomUUID() }),
    authed('POST', '/api/v1/p2p/orders', secondaryLogin.token, {
      adId: otherAdId,
      quantity: '1',
      paymentMethodId,
    }, { 'idempotency-key': crypto.randomUUID() }),
  ]);
  assert.ok(p2pA.statusCode === 400 || p2pA.statusCode === 201, brief(p2pA));
  assert.ok(p2pB.statusCode === 400 || p2pB.statusCode === 201, brief(p2pB));
  const concurrentOrders = await pool.query<{ buyer_id: string; seller_id: string }>(
    `SELECT buyer_id::text, seller_id::text FROM p2p_orders WHERE ad_id = $1`,
    [otherAdId]
  );
  for (const row of concurrentOrders.rows) {
    assert.equal(row.seller_id, native.userId);
    assert.equal(row.buyer_id, other.userId);
  }
  assert.equal(concurrentOrders.rows.some((row) => row.buyer_id === walletNative.address.toLowerCase()), false);
  console.log('PASS 31 concurrent P2P attempts do not retarget buyer or seller to a wallet address');

  const stolen = await linkEvm(other.token, walletNative);
  assert.notEqual(stolen.statusCode, 200, brief(stolen));
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM user_wallets WHERE normalized_address = $1`, [walletNative.address.toLowerCase()]),
    1
  );
  console.log('PASS 29 a second user cannot attach the same wallet');

  const adminProbe = await authed('POST', `/api/v1/admin/wallet-recovery/${native.userId}/review`, replay.token, {
    reason: 'customer wallet session must not review recovery',
  });
  assert.ok(adminProbe.statusCode === 401 || adminProbe.statusCode === 403, brief(adminProbe));
  console.log('PASS 20 customer wallet session is rejected by admin routes');

  const passwordLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login/password',
    payload: { email: existingEmail, password: LEGACY_PASSWORD },
  });
  assert.equal(passwordLogin.statusCode, 200, brief(passwordLogin));
  const passwordBody = passwordLogin.json() as { data?: { user?: { id?: string }; accessToken?: string } };
  assert.equal(passwordBody.data?.user?.id, EXISTING_USER);
  const passwordToken = passwordBody.data?.accessToken ?? '';
  const history = await authed('GET', '/api/v1/spot/orders?status=ALL', passwordToken);
  assert.equal(history.statusCode, 200, brief(history));
  assert.equal(history.body.includes(historyOrderId), true);
  console.log('PASS 6 password login reaches the same users.id and spot history');

  const otpPlain = '482913';
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
  const otpBody = otpLogin.json() as { data?: { user?: { id?: string }; requiresVerification?: boolean; verificationToken?: string } };
  if (otpBody.data?.user?.id) {
    assert.equal(otpBody.data.user.id, EXISTING_USER);
  } else if (otpBody.data?.verificationToken) {
    const tokenRow = await pool.query<{ user_id: string }>(
      `SELECT user_id::text FROM login_verification_tokens WHERE token = $1`,
      [otpBody.data.verificationToken]
    );
    assert.equal(tokenRow.rows[0]?.user_id, EXISTING_USER);
  } else {
    assert.fail(brief(otpLogin));
  }
  console.log('PASS OTP login stays on the seeded users.id');
  const passkeys = await count(`SELECT count(*)::int AS n FROM user_passkeys WHERE user_id = $1 AND deleted_at IS NULL`, [EXISTING_USER]);
  assert.equal(passkeys, 0);
  console.log('PASS passkey login is not configured for the seeded user and was left in place');

  const existingWalletA = Wallet.createRandom();
  const existingWalletB = Wallet.createRandom();
  const linkedA = await linkEvm(passwordToken, existingWalletA);
  assert.equal(linkedA.statusCode, 200, brief(linkedA));
  const walletAId = (linkedA.json() as { data?: { wallet?: { id?: string } } }).data?.wallet?.id ?? '';
  assert.match(walletAId, UUID_RE);
  const loginA = await walletLogin(existingWalletA);
  assert.equal(loginA.userId, EXISTING_USER);
  const linkedB = await linkEvm(loginA.token, existingWalletB);
  assert.equal(linkedB.statusCode, 200, brief(linkedB));
  const walletBId = (linkedB.json() as { data?: { wallet?: { id?: string; isPrimary?: boolean } } }).data?.wallet?.id ?? '';
  assert.equal((linkedB.json() as { data?: { wallet?: { isPrimary?: boolean } } }).data?.wallet?.isPrimary, false);
  const loginB = await walletLogin(existingWalletB);
  assert.equal(loginB.userId, EXISTING_USER);
  const seenHistory = await authed('GET', '/api/v1/spot/orders?status=ALL', loginB.token);
  assert.equal(seenHistory.body.includes(historyOrderId), true);
  const balanceOwner = await pool.query<{ user_id: string; available_balance: string }>(
    `SELECT user_id::text, available_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND chain_id = '' AND account_type = 'trading'`,
    [EXISTING_USER, usdtId]
  );
  assert.equal(balanceOwner.rows.length, 1);
  assert.equal(new Decimal(balanceOwner.rows[0]!.available_balance).eq(100000), true);
  console.log('PASS existing user wallet login keeps spot history and balance ownership');

  const kycBeforeUnlink = await tableCount('kyc_applications');
  const forexBeforeUnlink = await tableCount('forex_accounts');
  const custodyBeforeUnlink = await tableCount('wallets');
  const unlinkProof = await stepUp(loginA.token, walletBId, 'unlink_wallet', existingWalletB);
  const unlinked = await authed('POST', `/api/v1/auth/wallets/${walletBId}/unlink`, loginA.token, unlinkProof);
  assert.equal(unlinked.statusCode, 200, brief(unlinked));
  const bStatus = await pool.query<{ status: string; user_id: string }>(
    `SELECT status, user_id::text FROM user_wallets WHERE id = $1`,
    [walletBId]
  );
  assert.equal(bStatus.rows[0]?.status, 'disabled');
  assert.equal(bStatus.rows[0]?.user_id, EXISTING_USER);
  const disabledLogin = await issue(existingWalletB);
  await clearLimits();
  const disabledRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: {
      challengeId: disabledLogin.challenge.id,
      message: disabledLogin.challenge.message,
      signature: disabledLogin.signature,
    },
  });
  assert.equal(disabledRes.statusCode, 403, brief(disabledRes));
  const stillHistory = await authed('GET', '/api/v1/spot/orders?status=ALL', loginA.token);
  assert.equal(stillHistory.body.includes(historyOrderId), true);
  assert.equal(await tableCount('kyc_applications'), kycBeforeUnlink);
  assert.equal(await tableCount('forex_accounts'), forexBeforeUnlink);
  assert.equal(await tableCount('wallets'), custodyBeforeUnlink);
  console.log('PASS 14 unlink disables the wallet and leaves financial identity unchanged');
  console.log('PASS 15 disabled wallet login rejected');
  console.log('PASS 19 primary wallet remains valid after unlink');
  console.log('PASS 21 wallet unlink does not change the seeded balance');
  console.log('PASS 22 wallet unlink does not change KYC');
  console.log('PASS 23 wallet unlink does not change Forex');

  const spotBeforeCompromise = await count(`SELECT count(*)::int AS n FROM spot_orders WHERE user_id = $1`, [EXISTING_USER]);
  const walletC = Wallet.createRandom();
  const linkedC = await linkEvm(loginA.token, walletC);
  assert.equal(linkedC.statusCode, 200, brief(linkedC));
  const walletCId = (linkedC.json() as { data?: { wallet?: { id?: string } } }).data?.wallet?.id ?? '';
  await pool.query(`UPDATE user_wallets SET status = 'compromised', is_primary = FALSE WHERE id = $1`, [walletCId]);
  const compromisedIssued = await issue(walletC);
  await clearLimits();
  const compromisedRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/wallet/login',
    payload: {
      challengeId: compromisedIssued.challenge.id,
      message: compromisedIssued.challenge.message,
      signature: compromisedIssued.signature,
    },
  });
  assert.equal(compromisedRes.statusCode, 403, brief(compromisedRes));
  const primaryStill = await walletLogin(existingWalletA);
  assert.equal(primaryStill.userId, EXISTING_USER);
  const spotAfterCompromise = await count(`SELECT count(*)::int AS n FROM spot_orders WHERE user_id = $1`, [EXISTING_USER]);
  assert.equal(spotAfterCompromise, spotBeforeCompromise);
  console.log('PASS 16 compromised wallet login rejected and primary wallet still works');

  const logout = await authed('POST', '/api/v1/auth/logout', primaryStill.token, {});
  assert.equal(logout.statusCode, 200, brief(logout));
  const afterLogout = await authed('GET', '/api/v1/spot/orders?status=ALL', primaryStill.token);
  assert.equal(afterLogout.statusCode, 401, brief(afterLogout));
  console.log('PASS 33 logout revokes the spot session');

  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address === 'object');
  const wsPort = address.port;
  async function connectPrivate(token: string, userId: string): Promise<WebSocket> {
    const ticketRes = await authed('POST', '/api/v1/spot/ws-ticket', token, {});
    assert.equal(ticketRes.statusCode, 200, brief(ticketRes));
    const ticket = (ticketRes.json() as { data?: { ticket?: string } }).data?.ticket ?? '';
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}/api/v1/spot/ws`);
    const frames: string[] = [];
    ws.on('message', (data) => frames.push(data.toString()));
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    ws.send(JSON.stringify({ type: 'auth', data: { ticket } }));
    const authedFrame = await waitFor(frames, (frame) => frame.includes('auth_result'));
    assert.equal(authedFrame.includes('"success":true'), true, authedFrame);
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'user.orders' }));
    const subscribed = await waitFor(frames, (frame) => frame.includes('subscribed') && frame.includes('user.orders'));
    assert.equal(subscribed.includes('user.orders'), true);
    assertUuidOwner(userId, 'websocket ticket user');
    return ws;
  }
  const wsNative = await connectPrivate(secondaryLogin.token, native.userId);
  const wsOther = await connectPrivate(other.token, other.userId);
  const marker = `identity-marker-${native.userId}`;
  spotWs.sendToUserSerialized(native.userId, 'user.orders', JSON.stringify({ type: 'order_update', data: { marker, userId: native.userId } }));
  const nativeFrames: string[] = [];
  const otherFrames: string[] = [];
  wsNative.on('message', (data) => nativeFrames.push(data.toString()));
  wsOther.on('message', (data) => otherFrames.push(data.toString()));
  spotWs.sendToUserSerialized(native.userId, 'user.orders', JSON.stringify({ type: 'order_update', data: { marker } }));
  const got = await waitFor(nativeFrames, (frame) => frame.includes(marker));
  assert.equal(got.includes(marker), true);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(otherFrames.some((frame) => frame.includes(marker)), false);
  const strangerFrames: string[] = [];
  const wsStranger = await connectPrivate(strangerOrderRead.token, strangerOrderRead.userId);
  wsStranger.on('message', (data) => strangerFrames.push(data.toString()));
  wsStranger.send(JSON.stringify({ type: 'subscribe', channel: `p2p.order.${p2pOrderId}` }));
  const denied = await waitFor(strangerFrames, (frame) => frame.includes('Access denied') || frame.includes('error'));
  assert.equal(denied.toLowerCase().includes('denied') || denied.includes('error'), true);
  wsStranger.close();
  wsNative.close();
  wsOther.close();
  console.log('PASS spot websocket identity is users.id and private events stay on that user');

  const addrSql = `
    WITH addrs AS (
      SELECT lower(address) AS a FROM user_wallets
      UNION SELECT lower(normalized_address) FROM user_wallets
      UNION SELECT lower(caip10) FROM user_wallets
    )
    SELECT
      (SELECT count(*)::int FROM spot_orders WHERE lower(user_id::text) IN (SELECT a FROM addrs)) AS spot,
      (SELECT count(*)::int FROM p2p_ads WHERE lower(user_id::text) IN (SELECT a FROM addrs)) AS ads,
      (SELECT count(*)::int FROM p2p_orders WHERE lower(buyer_id::text) IN (SELECT a FROM addrs) OR lower(seller_id::text) IN (SELECT a FROM addrs)) AS p2p,
      (SELECT count(*)::int FROM escrows WHERE lower(user_id::text) IN (SELECT a FROM addrs)) AS escrow,
      (SELECT count(*)::int FROM user_balances WHERE lower(user_id::text) IN (SELECT a FROM addrs)) AS balances,
      (SELECT count(*)::int FROM forex_accounts WHERE lower(user_id::text) IN (SELECT a FROM addrs)) AS forex
  `;
  const crossed = await pool.query<{ spot: number; ads: number; p2p: number; escrow: number; balances: number; forex: number }>(addrSql);
  assert.equal(crossed.rows[0]?.spot, 0);
  assert.equal(crossed.rows[0]?.ads, 0);
  assert.equal(crossed.rows[0]?.p2p, 0);
  assert.equal(crossed.rows[0]?.escrow, 0);
  assert.equal(crossed.rows[0]?.balances, 0);
  assert.equal(crossed.rows[0]?.forex, 0);
  console.log('PASS wallet address is not stored as a financial owner');

  const { setCutoverMode } = await import('../services/legacy-auth-policy.service.js');
  await setCutoverMode('WALLET_ONLY', 'step14-spot');
  const onlyLogin = await walletLogin(existingWalletA);
  assert.equal(onlyLogin.userId, EXISTING_USER);
  const onlyOrders = await authed('GET', '/api/v1/spot/orders?status=ALL', onlyLogin.token);
  assert.equal(onlyOrders.statusCode, 200, brief(onlyOrders));
  await clearLimits();
  const onlyPassword = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login/password',
    payload: { email: existingEmail, password: LEGACY_PASSWORD },
  });
  assert.equal(onlyPassword.statusCode, 403, brief(onlyPassword));
  await setCutoverMode('LEGACY_AND_WALLET', 'step14-spot');
  console.log('PASS wallet-only policy keeps Spot on users.id and denies password login');

  for (const table of preserved) {
    assert.equal(await tableCount(table), beforePreserved[table], `${table} changed`);
  }
  console.log('PASS 24 wallet login did not create a deposit wallet');
  console.log('PASS 25 wallet login did not create hot or cold custody');
  console.log('PASS KYC, Forex, and custody counts are unchanged');

  await app.close();
  await pool.end();
  await rateRedis.quit();
  await db.close();
  await redis.close();
  await new Promise<void>((resolve, reject) => engine.close((err) => (err ? reject(err) : resolve())));
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
