/**
 * Multi-account ownership + customer route scoping (Forex-only).
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-multi-account.integration.test.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { db } from '../../lib/database.js';
import { getForexActiveAccountFromRequest } from './auth/forex-account-cookie.js';
import {
  resolveForexAccountIdForUser,
  setActiveForexAccountForUser,
  userOwnsForexAccount,
} from './customer/accounts-service.js';
import { registerForexAccountingRoutes } from '../../routes/forex-accounting.fastify.js';
import { registerForexCustomerAccountsRoutes } from '../../routes/forex-customer-accounts.fastify.js';

const PREFIX = 'ma-int-';
const USER_A = `${PREFIX}a-${randomUUID().slice(0, 8)}`;
const USER_B = `${PREFIX}b-${randomUUID().slice(0, 8)}`;
const A1 = `${PREFIX}A1-${randomUUID().slice(0, 6)}`;
const A2 = `${PREFIX}A2-${randomUUID().slice(0, 6)}`;
const B1 = `${PREFIX}B1-${randomUUID().slice(0, 6)}`;

async function ensureAccountRow(accountId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $2, 'USD', 'ACTIVE', 'NETTING', 'DEMO')
     ON CONFLICT (account_id) DO UPDATE SET user_id = EXCLUDED.user_id`,
    [accountId, userId]
  );
}

async function dbReachable(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function cleanup(): Promise<void> {
  for (const id of [A1, A2, B1, USER_A, USER_B]) {
    await db.query(`DELETE FROM forex_customer_active_account WHERE user_id = $1 OR account_id = $1`, [id]).catch(() => {});
    await db.query(`DELETE FROM forex_accounts WHERE account_id = $1 OR user_id = $1`, [id]).catch(() => {});
  }
  await db.query(`DELETE FROM forex_accounts WHERE account_id LIKE $1`, [`${PREFIX}%`]).catch(() => {});
  await db.query(`DELETE FROM forex_customer_active_account WHERE user_id LIKE $1`, [`${PREFIX}%`]).catch(() => {});
}

{
  const req = { headers: { 'x-forex-account-id': ' FX123 ' }, cookies: {} } as Parameters<typeof getForexActiveAccountFromRequest>[0];
  assert.equal(getForexActiveAccountFromRequest(req), 'FX123');
  console.log('  PASS  header account hint parse');
}

if (!(await dbReachable())) {
  console.log('forex-multi-account.integration.test.ts: SKIP (database unreachable)');
  process.exit(0);
}

try {
  await cleanup();
  await ensureAccountRow(A1, USER_A);
  await ensureAccountRow(A2, USER_A);
  await ensureAccountRow(B1, USER_B);

  assert.equal(await userOwnsForexAccount(USER_A, A1), true);
  assert.equal(await userOwnsForexAccount(USER_A, A2), true);
  assert.equal(await userOwnsForexAccount(USER_A, B1), false);
  assert.equal(await userOwnsForexAccount(USER_B, B1), true);
  assert.equal(await userOwnsForexAccount(USER_B, A1), false);

  await setActiveForexAccountForUser(USER_A, A2);
  assert.equal(await resolveForexAccountIdForUser(USER_A), A2);
  assert.equal(await resolveForexAccountIdForUser(USER_A, A1), A1);

  let forbidden = false;
  try {
    await resolveForexAccountIdForUser(USER_A, B1);
  } catch (e) {
    forbidden = e instanceof Error && e.message === 'FOREX_ACCOUNT_FORBIDDEN';
  }
  assert.equal(forbidden, true);
  console.log('  PASS  ownership + resolve matrix');

  const app = Fastify();
  let uid: string | null = USER_A;
  app.decorate(
    'authenticate',
    (async (request: { user?: { id: string; role: string; sessionId: string } }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
      if (!uid) {
        reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED' } });
        return;
      }
      request.user = { id: uid, role: 'user', sessionId: 's' };
    }) as never
  );
  await registerForexCustomerAccountsRoutes(app);
  await registerForexAccountingRoutes(app);
  await app.ready();

  const own = await app.inject({ method: 'GET', url: `/accounts/${A1}` });
  assert.equal(own.statusCode, 200);
  const ownBody = own.json() as { success: boolean; data?: { account?: { accountId: string }; financialSnapshot?: { ledgerBalance: string } } };
  assert.equal(ownBody.success, true);
  assert.equal(ownBody.data?.account?.accountId, A1);
  assert.ok(ownBody.data?.financialSnapshot?.ledgerBalance != null);

  uid = USER_A;
  const cross = await app.inject({
    method: 'GET',
    url: `/accounts/${B1}`,
  });
  assert.equal(cross.statusCode, 404);

  const balOk = await app.inject({
    method: 'GET',
    url: '/balance',
    headers: { 'x-forex-account-id': A1 },
  });
  assert.equal(balOk.statusCode, 200);

  const balDeny = await app.inject({
    method: 'GET',
    url: '/balance',
    headers: { 'x-forex-account-id': B1 },
  });
  assert.equal(balDeny.statusCode, 403);
  assert.equal(balDeny.json().error?.code, 'FOREX_ACCOUNT_FORBIDDEN');

  await app.close();
  console.log('  PASS  route IDOR (A→B1 balance)');
} finally {
  await cleanup();
}

console.log('forex-multi-account.integration.test.ts: PASS');
