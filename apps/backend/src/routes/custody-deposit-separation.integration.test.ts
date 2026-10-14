/**
 * Isolated proof that a credited deposit belongs to users.id economically,
 * while the deposit address and hot wallet stay platform custody.
 * No chain broadcast and no production database.
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
  console.error('Refusing custody certification against a non-isolated database');
  process.exit(1);
}
if (redisUrl.port === '6379' || (redisUrl.hostname !== '127.0.0.1' && redisUrl.hostname !== 'localhost')) {
  console.error('Refusing non-local Redis');
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.EXCHANGE_PRESERVE_SHELL_DATABASE_URL = '1';
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
process.env.REDIS_URL = redisUrlRaw;
process.env.LOG_LEVEL = 'error';
process.env.SANCTIONS_PROVIDER = 'noop';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? 'test-csrf-secret-must-be-32-chars-min';

const USER_A = 'c19a0000-0000-4000-8000-0000000000a1';
const USER_B = 'c19b0000-0000-4000-8000-0000000000b2';
const SIGN_IN = '0xabc0000000000000000000000000000000000a19';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: testUrl, ssl: false });
  const current = await pool.query<{ current_database: string }>('SELECT current_database()');
  assert.equal(current.rows[0]?.current_database, databaseName);
  assert.notEqual(databaseName, 'exchange');

  const hotCols = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'hot_wallets'`
  );
  const hotColumnNames = hotCols.rows.map((r) => r.column_name);
  assert.equal(hotColumnNames.includes('user_id'), false, 'hot_wallets must not be a per-customer table');
  assert.equal(hotColumnNames.includes('address'), true);
  assert.equal(hotColumnNames.includes('encrypted_private_key'), true);

  const walletCols = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'wallets' AND column_name IN ('user_id', 'address', 'encrypted_private_key')`
  );
  assert.equal(walletCols.rows.length, 3);

  await pool.query(
    `INSERT INTO users (id, referral_code, status) VALUES ($1, 'c19own0001', 'active'), ($2, 'c19own0002', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [USER_A, USER_B]
  );
  await pool.query(
    `INSERT INTO user_wallets (
       user_id, namespace, chain_reference, address, normalized_address, caip10, wallet_type, is_primary, is_verified, status
     ) VALUES ($1, 'eip155', '1', $2, $3, $4, 'eoa', TRUE, TRUE, 'active')
     ON CONFLICT DO NOTHING`,
    [USER_A, SIGN_IN, SIGN_IN.toLowerCase(), `eip155:1:${SIGN_IN.toLowerCase()}`]
  );

  const { walletService } = await import('../services/wallet.service.js');
  await walletService.createWalletsForUser(USER_A);
  const again = await walletService.createWalletsForUser(USER_A);
  assert.equal(again.length, 0, 'second generation must not create another deposit wallet');

  const depositRows = await pool.query<{ chain_id: string; address: string; n: string }>(
    `SELECT chain_id, address, COUNT(*)::text AS n FROM wallets WHERE user_id = $1 GROUP BY chain_id, address`,
    [USER_A]
  );
  assert.ok(depositRows.rows.length > 0);
  for (const row of depositRows.rows) {
    assert.equal(row.n, '1');
    assert.notEqual(row.address.toLowerCase(), SIGN_IN.toLowerCase());
  }
  const signInCount = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM user_wallets WHERE user_id = $1`,
    [USER_A]
  );
  assert.equal(signInCount.rows[0]?.n, '1');
  const signInIsDeposit = await pool.query(
    `SELECT 1 FROM wallets WHERE user_id = $1 AND lower(address) = lower($2)`,
    [USER_A, SIGN_IN]
  );
  assert.equal(signInIsDeposit.rows.length, 0);
  console.log('PASS sign-in wallet is not the custodial deposit address');

  const eth = depositRows.rows.find((r) => r.chain_id === 'ethereum') ?? depositRows.rows[0]!;
  const walletId = await pool.query<{ id: string }>(
    `SELECT id::text FROM wallets WHERE user_id = $1 AND chain_id = $2`,
    [USER_A, eth.chain_id]
  );
  const usdt = await pool.query<{ id: string }>(
    `SELECT id::text FROM currencies WHERE upper(symbol) = 'USDT' LIMIT 1`
  );
  assert.equal(usdt.rows.length, 1);

  const hot = await pool.query<{ address: string; userish: string | null }>(
    `SELECT address, NULL::text AS userish FROM hot_wallets`
  );
  for (const row of hot.rows) {
    assert.notEqual(row.address.toLowerCase(), SIGN_IN.toLowerCase());
    assert.notEqual(row.address.toLowerCase(), eth.address.toLowerCase());
  }
  console.log(`PASS hot wallet rows (${hot.rows.length}) are platform rows, not the sign-in wallet`);

  const beforeA = await pool.query<{ available_balance: string }>(
    `SELECT COALESCE(SUM(available_balance), 0)::text AS available_balance FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding'`,
    [USER_A, usdt.rows[0]!.id]
  );
  const beforeB = await pool.query<{ available_balance: string }>(
    `SELECT COALESCE(SUM(available_balance), 0)::text AS available_balance FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding'`,
    [USER_B, usdt.rows[0]!.id]
  );
  const { creditDepositIfConfirmed } = await import('../services/deposit-credit.service.js');
  const depositId = randomUUID();
  const otherDeposit = randomUUID();
  await pool.query(
    `INSERT INTO deposits (
       id, user_id, currency_id, chain_id, wallet_id, tx_hash, from_address, to_address,
       amount, confirmations, required_confirmations, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 12.5, 12, 1, 'pending')`,
    [depositId, USER_A, usdt.rows[0]!.id, eth.chain_id, walletId.rows[0]!.id, `step19-${depositId}`, SIGN_IN, eth.address]
  );
  await walletService.createWalletsForUser(USER_B);
  const bRow = await pool.query<{ id: string; address: string; chain_id: string }>(
    `SELECT id::text, address, chain_id FROM wallets WHERE user_id = $1 AND chain_id = $2`,
    [USER_B, eth.chain_id]
  );
  await pool.query(
    `INSERT INTO deposits (
       id, user_id, currency_id, chain_id, wallet_id, tx_hash, from_address, to_address,
       amount, confirmations, required_confirmations, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 7, 12, 1, 'pending')`,
    [otherDeposit, USER_B, usdt.rows[0]!.id, bRow.rows[0]!.chain_id, bRow.rows[0]!.id, `step19-${otherDeposit}`, SIGN_IN, bRow.rows[0]!.address]
  );

  const credited = await creditDepositIfConfirmed(depositId);
  assert.equal(credited.credited, true, JSON.stringify(credited));
  const replay = await creditDepositIfConfirmed(depositId);
  assert.equal(replay.credited, false);
  const creditedB = await creditDepositIfConfirmed(otherDeposit);
  assert.equal(creditedB.credited, true);

  const balA = await pool.query<{ available_balance: string }>(
    `SELECT available_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding' AND COALESCE(chain_id, '') = ''`,
    [USER_A, usdt.rows[0]!.id]
  );
  const balB = await pool.query<{ available_balance: string }>(
    `SELECT available_balance::text FROM user_balances
     WHERE user_id = $1 AND currency_id = $2 AND account_type = 'funding' AND COALESCE(chain_id, '') = ''`,
    [USER_B, usdt.rows[0]!.id]
  );
  assert.ok(Math.abs(Number(balA.rows[0]?.available_balance) - (Number(beforeA.rows[0]?.available_balance) + 12.5)) < 1e-6);
  assert.ok(Math.abs(Number(balB.rows[0]?.available_balance) - (Number(beforeB.rows[0]?.available_balance) + 7)) < 1e-6);
  const ledger = await pool.query<{ user_id: string; credit: string }>(
    `SELECT user_id::text, credit::text FROM balance_ledger WHERE reference_id = $1`,
    [depositId]
  );
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0]?.user_id, USER_A);
  assert.equal(Number(ledger.rows[0]?.credit), 12.5);
  console.log('PASS deposit credit is users.id ' + USER_A + ' and does not credit the other customer');

  await pool.query(
    `INSERT INTO fiat_balances (user_id, currency, available_balance, locked_balance)
     VALUES ($1, 'INR', 999, 0)
     ON CONFLICT (user_id, currency) DO UPDATE SET available_balance = 999`,
    [USER_A]
  );
  await pool.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $2, 'USD', 'ACTIVE', 'NETTING', 'DEMO')
     ON CONFLICT (account_id) DO NOTHING`,
    ['FXC19A0001', USER_A]
  );

  const { default: Fastify } = await import('fastify');
  const jwtPlugin = (await import('@fastify/jwt')).default;
  const { config } = await import('../config/index.js');
  const { createSession, isSessionValid } = await import('../services/session.service.js');
  const { default: walletRoutes } = await import('./wallet.fastify.js');
  const app = Fastify({ logger: false });
  await app.register(jwtPlugin, { secret: config.jwt.secret });
  const authenticate = async (request: { headers: { authorization?: string }; user?: unknown }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.status(401).send({ success: false });
    const decoded = app.jwt.verify<{ userId: string; role?: string; sessionId: string; type?: string }>(token);
    if (decoded.type === 'admin') return reply.status(401).send({ success: false });
    if (!(await isSessionValid(decoded.sessionId))) return reply.status(401).send({ success: false });
    request.user = { id: decoded.userId, role: decoded.role ?? 'user', sessionId: decoded.sessionId };
  };
  app.decorate('authenticate', authenticate);
  app.decorate('authenticateUser', authenticate);
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  await app.ready();
  const session = await createSession({ userId: USER_A, authMethod: 'wallet', ttlSeconds: 600 });
  const token = app.jwt.sign({ userId: USER_A, role: 'user', sessionId: session.sessionId });
  const summary = await app.inject({
    method: 'GET',
    url: '/api/v1/wallet/balances/summary',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(summary.statusCode, 200, summary.body.slice(0, 400));
  assert.equal(summary.body.includes('999'), false);
  assert.equal(summary.body.toLowerCase().includes('forex'), false);
  assert.equal(summary.body.includes('USDT USDT'), false);
  const body = summary.json() as { data?: { funding?: { totalUsd?: string }; trading?: { totalUsd?: string }; forex?: unknown } };
  assert.ok(Number(body.data?.funding?.totalUsd) >= 12.5);
  assert.equal(body.data?.forex, undefined);
  console.log('PASS balance summary credits the deposit and excludes INR and Forex');

  const other = await app.inject({
    method: 'GET',
    url: '/api/v1/wallet/balances/summary',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(other.body.includes(USER_B), false);
  await app.close();
  await pool.end();
  console.log('CUSTODY_DEPOSIT_SEPARATION_PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
