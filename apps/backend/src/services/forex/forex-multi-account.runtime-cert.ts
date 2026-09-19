/**
 * Runtime certification (inject + DB). FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-multi-account.runtime-cert.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { db } from '../../lib/database.js';
import { FOREX_ACTIVE_ACCOUNT_COOKIE } from './auth/forex-account-cookie.js';
import { registerForexAdvancedRoutes } from '../../routes/forex-advanced.fastify.js';
import { registerForexCustomerAccountsRoutes } from '../../routes/forex-customer-accounts.fastify.js';

const P = 'ma-rt-';
const USER_A = `${P}a-${randomUUID().slice(0, 8)}`;
const A1 = `${P}1-${randomUUID().slice(0, 6)}`;
const A2 = `${P}2-${randomUUID().slice(0, 6)}`;

async function seed(accountId: string, userId: string) {
  await db.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1,$2,'USD','ACTIVE','NETTING','DEMO') ON CONFLICT (account_id) DO UPDATE SET user_id=EXCLUDED.user_id`,
    [accountId, userId]
  );
}

async function cleanup() {
  await db.query(`DELETE FROM forex_customer_alerts WHERE account_id LIKE $1`, [`${P}%`]).catch(() => {});
  await db.query(`DELETE FROM forex_customer_active_account WHERE user_id = $1`, [USER_A]).catch(() => {});
  await db.query(`DELETE FROM forex_accounts WHERE account_id LIKE $1`, [`${P}%`]).catch(() => {});
}

async function main(): Promise<void> {
  try {
    await db.query('SELECT 1');
    await cleanup();
    await seed(A1, USER_A);
    await seed(A2, USER_A);

    const app = Fastify();
    await app.register(cookie);
    app.decorate(
      'authenticate',
      (async (request: { user?: { id: string } }) => {
        request.user = { id: USER_A };
      }) as never
    );
    await registerForexCustomerAccountsRoutes(app);
    await registerForexAdvancedRoutes(app);
    await app.ready();

    const list = await app.inject({ method: 'GET', url: '/accounts' });
    assert.equal(list.statusCode, 200);
    assert.ok((list.json() as { data: { count: number } }).data.count >= 2);

    const sel = await app.inject({ method: 'POST', url: `/accounts/${A2}/select` });
    assert.equal(sel.statusCode, 200);
    assert.ok(String(sel.headers['set-cookie'] ?? '').includes(FOREX_ACTIVE_ACCOUNT_COOKIE));

    const alertA1 = await app.inject({
      method: 'POST',
      url: '/alerts',
      headers: { 'x-forex-account-id': A1 },
      payload: { alertType: 'PRICE', symbol: 'EURUSD', condition: { op: 'ABOVE', price: '9.99999' } },
    });
    assert.equal(alertA1.statusCode, 200, alertA1.body);

    const listA2 = await app.inject({ method: 'GET', url: '/alerts', headers: { 'x-forex-account-id': A2 } });
    assert.equal((listA2.json() as { data: { alerts: unknown[] } }).data.alerts.length, 0);

    const listA1 = await app.inject({ method: 'GET', url: '/alerts', headers: { 'x-forex-account-id': A1 } });
    assert.equal((listA1.json() as { data: { alerts: unknown[] } }).data.alerts.length, 1);

    const cookieSel = await app.inject({
      method: 'GET',
      url: '/accounts',
      headers: { cookie: `${FOREX_ACTIVE_ACCOUNT_COOKIE}=${A2}` },
    });
    assert.equal((cookieSel.json() as { data: { activeAccountId: string } }).data.activeAccountId, A2);

    await app.close();
    console.log('forex-multi-account.runtime-cert.ts: PASS');
  } finally {
    await cleanup();
    await db.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
