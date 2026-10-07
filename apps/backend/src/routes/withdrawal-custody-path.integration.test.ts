/**
 * Isolated withdrawal preview and request. Does not start the signing processor
 * and does not broadcast a transaction.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const testUrl = process.env.STEP19_DATABASE_URL?.trim() ?? '';
const redisUrlRaw = process.env.STEP19_REDIS_URL?.trim() ?? '';
if (!testUrl || !redisUrlRaw) {
  console.error('STEP19_DATABASE_URL and STEP19_REDIS_URL are required');
  process.exit(1);
}
const databaseName = new URL(testUrl).pathname.replace(/^\//, '').split('/')[0] ?? '';
const redisUrl = new URL(redisUrlRaw);
if (databaseName === 'exchange' || databaseName === 'postgres' || databaseName === '' || testUrl.includes('169.58.39.2')) {
  console.error('Refusing withdrawal certification against a non-isolated database');
  process.exit(1);
}
if (redisUrl.port === '6379' || (redisUrl.hostname !== '127.0.0.1' && redisUrl.hostname !== 'localhost')) {
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.EXCHANGE_PRESERVE_SHELL_DATABASE_URL = '1';
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
process.env.REDIS_URL = redisUrlRaw;
process.env.LOG_LEVEL = 'error';
process.env.SANCTIONS_PROVIDER = 'noop';
process.env.WITHDRAWAL_WHITELIST_RELAXED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? 'test-csrf-secret-must-be-32-chars-min';

const USER_A = 'd19a0000-0000-4000-8000-0000000000a1';
const USER_B = 'd19b0000-0000-4000-8000-0000000000b2';
const USER_COOL = 'd19c0000-0000-4000-8000-0000000000c3';
const SIGN_IN = '0xabc0000000000000000000000000000000000d19';
const DESTINATION = '0x2222222222222222222222222222222222220d19';
const HOT = '0x1111111111111111111111111111111111110d19';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: testUrl, ssl: false });
  const current = await pool.query<{ current_database: string }>('SELECT current_database()');
  assert.equal(current.rows[0]?.current_database, databaseName);

  const token = await pool.query<{ id: string; symbol: string; chain_id: string; withdrawal_fee: string }>(
    `SELECT t.id::text, t.symbol, t.chain_id, t.withdrawal_fee::text
     FROM tokens t WHERE upper(t.symbol) = 'USDT' AND t.is_active IS TRUE ORDER BY t.chain_id LIMIT 1`
  );
  assert.equal(token.rows.length, 1, 'USDT token required');
  const asset = token.rows[0]!;
  const currency = await pool.query<{ id: string }>(`SELECT id::text FROM currencies WHERE upper(symbol) = 'USDT' LIMIT 1`);

  for (const [id, code] of [
    [USER_A, 'd19wd00001'],
    [USER_B, 'd19wd00002'],
    [USER_COOL, 'd19wd00003'],
  ] as const) {
    await pool.query(
      `INSERT INTO users (id, referral_code, status) VALUES ($1, $2, 'active') ON CONFLICT (id) DO NOTHING`,
      [id, code]
    );
  }
  await pool.query(
    `INSERT INTO user_wallets (
       user_id, namespace, chain_reference, address, normalized_address, caip10, wallet_type, is_primary, is_verified, status
     ) VALUES ($1, 'eip155', '1', $2, $3, $4, 'eoa', TRUE, TRUE, 'active')
     ON CONFLICT DO NOTHING`,
    [USER_A, SIGN_IN, SIGN_IN.toLowerCase(), `eip155:1:${SIGN_IN.toLowerCase()}`]
  );
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'funding', 50, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 50, locked_balance = 0`,
    [USER_A, currency.rows[0]!.id]
  );
  await pool.query(
    `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, escrow_balance)
     VALUES ($1, $2, '', 'funding', 50, 0, 0, 0)
     ON CONFLICT (user_id, currency_id, chain_id, account_type)
     DO UPDATE SET available_balance = 50, locked_balance = 0`,
    [USER_COOL, currency.rows[0]!.id]
  );
  await pool.query(
    `INSERT INTO hot_wallets (chain_id, address, encrypted_private_key, balance_cache, min_balance_alert, min_hot_balance, is_active)
     VALUES ($1, $2, 'isolated-test-ciphertext-not-a-key', 0, 0, 0, TRUE)
     ON CONFLICT (chain_id) DO NOTHING`,
    [asset.chain_id, HOT]
  );
  const hot = await pool.query<{ address: string }>(
    `SELECT address FROM hot_wallets WHERE chain_id = $1 AND is_active IS TRUE`,
    [asset.chain_id]
  );
  assert.equal(hot.rows.length, 1);
  assert.notEqual(hot.rows[0]!.address.toLowerCase(), SIGN_IN.toLowerCase());
  assert.notEqual(hot.rows[0]!.address.toLowerCase(), DESTINATION.toLowerCase());

  await pool.query(
    `INSERT INTO withdrawal_address_whitelist (user_id, asset, address, enabled)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (user_id, asset, address) DO UPDATE SET enabled = TRUE`,
    [USER_A, asset.symbol.toUpperCase(), DESTINATION.toLowerCase()]
  );
  const wl = await pool.query<{ id: string }>(
    `SELECT id::text FROM withdrawal_address_whitelist WHERE user_id = $1 AND lower(address) = lower($2)`,
    [USER_A, DESTINATION]
  );
  await pool.query(
    `INSERT INTO withdrawal_address_timelocks (user_id, address_id, unlock_at) VALUES ($1, $2, NOW() - interval '1 hour')`,
    [USER_A, wl.rows[0]!.id]
  );
  await pool.query(
    `INSERT INTO security_cooldowns (user_id, reason, cooldown_until) VALUES ($1, 'step19 recovery cooldown', NOW() + interval '2 hours')`,
    [USER_COOL]
  );

  const { default: Fastify } = await import('fastify');
  const jwtPlugin = (await import('@fastify/jwt')).default;
  const { config } = await import('../config/index.js');
  const { createSession, isSessionValid } = await import('../services/session.service.js');
  const { default: walletRoutes } = await import('./wallet.fastify.js');
  const app = Fastify({ logger: false });
  await app.register(jwtPlugin, { secret: config.jwt.secret });
  const authenticate = async (request: { headers: { authorization?: string }; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const raw = request.headers.authorization?.replace('Bearer ', '');
    if (!raw) return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' } });
    const decoded = app.jwt.verify<{ userId: string; role?: string; sessionId: string; type?: string }>(raw);
    if (decoded.type === 'admin') return reply.status(401).send({ success: false });
    if (!(await isSessionValid(decoded.sessionId))) return reply.status(401).send({ success: false, error: { code: 'SESSION_EXPIRED' } });
    request.user = { id: decoded.userId, role: decoded.role ?? 'user', sessionId: decoded.sessionId };
  };
  app.decorate('authenticate', authenticate);
  app.decorate('authenticateUser', authenticate);
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  await app.ready();

  async function bearer(userId: string): Promise<string> {
    const session = await createSession({ userId, authMethod: 'wallet', ttlSeconds: 600 });
    return app.jwt.sign({ userId, role: 'user', sessionId: session.sessionId });
  }
  const Redis = (await import('ioredis')).default;
  const rateRedis = new Redis(redisUrlRaw);
  const clearRates = async () => {
    const rateKeys = await rateRedis.keys('rate:*');
    if (rateKeys.length > 0) await rateRedis.del(...rateKeys);
  };
  await clearRates();
  const tokenA = await bearer(USER_A);
  const tokenB = await bearer(USER_B);
  const tokenCool = await bearer(USER_COOL);

  const preview = await app.inject({
    method: 'GET',
    url: `/api/v1/wallet/withdraw/preview?symbol=USDT&chainId=${encodeURIComponent(asset.chain_id)}&amount=10`,
    headers: { authorization: `Bearer ${tokenA}` },
  });
  assert.equal(preview.statusCode, 200, preview.body.slice(0, 400));
  const previewBody = preview.json() as { success?: boolean; data?: { fee?: string; net_amount?: string } };
  assert.equal(previewBody.success, true);
  assert.equal(previewBody.data?.fee !== undefined, true);
  console.log('PASS withdrawal preview from isolated backend, fee ' + previewBody.data?.fee);

  const missingDest = await app.inject({
    method: 'POST',
    url: '/api/v1/wallet/withdrawals',
    headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': randomUUID() },
    payload: { symbol: 'USDT', chainId: asset.chain_id, amount: '10', type: 'onchain' },
  });
  assert.equal(missingDest.statusCode, 400, missingDest.body.slice(0, 300));
  console.log('PASS withdrawal without an explicit destination is rejected');

  const cool = await app.inject({
    method: 'POST',
    url: '/api/v1/wallet/withdrawals',
    headers: { authorization: `Bearer ${tokenCool}`, 'idempotency-key': randomUUID() },
    payload: { symbol: 'USDT', chainId: asset.chain_id, amount: '10', toAddress: DESTINATION, type: 'onchain' },
  });
  assert.equal(cool.statusCode, 403, cool.body.slice(0, 400));
  assert.equal(cool.json().error.code, 'WITHDRAWAL_COOLDOWN_ACTIVE');
  console.log('PASS recovery cooldown blocks withdrawal');

  await pool.query(`DELETE FROM kyc_applications WHERE user_id = $1`, [USER_A]);
  const noKyc = await app.inject({
    method: 'POST',
    url: '/api/v1/wallet/withdrawals',
    headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': randomUUID() },
    payload: { symbol: 'USDT', chainId: asset.chain_id, amount: '10', toAddress: DESTINATION, type: 'onchain', accountType: 'funding' },
  });
  assert.equal(noKyc.statusCode, 403, noKyc.body.slice(0, 400));
  assert.equal(noKyc.json().error.code, 'KYC_REQUIRED');
  console.log('PASS withdrawal requires approved KYC for this users.id');
  await pool.query(
    `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, 'approved', NOW())`,
    [USER_A]
  );
  await clearRates();

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/wallet/withdrawals',
    headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': `step19-${randomUUID()}` },
    payload: { symbol: 'USDT', chainId: asset.chain_id, amount: '10', toAddress: DESTINATION, type: 'onchain', accountType: 'funding' },
  });
  assert.equal(created.statusCode, 200, created.body.slice(0, 800));
  const createdBody = created.json() as { success?: boolean; data?: { id?: string; status?: string; toAddress?: string } };
  assert.equal(createdBody.success, true);
  assert.equal(createdBody.data?.toAddress?.toLowerCase(), DESTINATION.toLowerCase());
  assert.notEqual(createdBody.data?.status, 'completed');
  assert.notEqual(createdBody.data?.status, 'pending_email_verify');
  const withdrawalId = createdBody.data!.id!;

  const row = await pool.query<{ user_id: string; to_address: string; status: string; tx_hash: string | null }>(
    `SELECT user_id::text, to_address, status, tx_hash FROM withdrawals WHERE id = $1`,
    [withdrawalId]
  );
  assert.equal(row.rows[0]?.user_id, USER_A);
  assert.equal(row.rows[0]?.to_address.toLowerCase(), DESTINATION.toLowerCase());
  assert.notEqual(row.rows[0]?.to_address.toLowerCase(), SIGN_IN.toLowerCase());
  assert.equal(row.rows[0]?.tx_hash, null);
  assert.ok(row.rows[0]?.status === 'pending' || row.rows[0]?.status === 'pending_approval');

  const bal = await pool.query<{ available_balance: string; locked_balance: string }>(
    `SELECT available_balance::text, locked_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding' AND COALESCE(chain_id, '') = ''`,
    [USER_A, currency.rows[0]!.id]
  );
  assert.ok(Number(bal.rows[0]?.available_balance) < 50);
  assert.ok(Number(bal.rows[0]?.locked_balance) > 0);
  const signInUnchanged = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM user_wallets WHERE user_id = $1 AND lower(address) = lower($2)`,
    [USER_A, SIGN_IN]
  );
  assert.equal(signInUnchanged.rows[0]?.n, '1');
  const destIsLogin = await pool.query(
    `SELECT 1 FROM user_wallets WHERE lower(address) = lower($1)`,
    [DESTINATION]
  );
  assert.equal(destIsLogin.rows.length, 0);
  console.log('PASS withdrawal debits internal balance, destination is explicit, sign-in wallet is unchanged, tx_hash is null');

  const idor = await app.inject({
    method: 'POST',
    url: `/api/v1/wallet/withdrawals/${withdrawalId}/cancel`,
    headers: { authorization: `Bearer ${tokenB}` },
  });
  assert.ok(idor.statusCode === 404 || idor.statusCode === 400, idor.body.slice(0, 300));
  const still = await pool.query<{ status: string; user_id: string }>(
    `SELECT status, user_id::text FROM withdrawals WHERE id = $1`,
    [withdrawalId]
  );
  assert.equal(still.rows[0]?.user_id, USER_A);
  assert.equal(still.rows[0]?.status, row.rows[0]?.status);
  const listB = await app.inject({
    method: 'GET',
    url: '/api/v1/wallet/withdrawals',
    headers: { authorization: `Bearer ${tokenB}` },
  });
  assert.equal(listB.statusCode, 200, listB.body.slice(0, 300));
  assert.equal(listB.body.includes(withdrawalId), false);
  console.log('PASS user B cannot cancel or list user A withdrawal');

  await rateRedis.quit();
  await app.close();
  await pool.end();
  console.log('WITHDRAWAL_CUSTODY_PATH_PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
