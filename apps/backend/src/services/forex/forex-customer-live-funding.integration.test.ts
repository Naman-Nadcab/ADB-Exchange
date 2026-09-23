/**
 * Customer live/funding readiness gates (no database).
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-customer-live-funding.integration.test.ts
 */
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerForexCustomerLiveFundingRoutes } from '../../routes/forex-customer-live-funding.fastify.js';
import { resetForexLiveApplicationsForTests } from './customer/live-account-applications.service.js';

let uid: string | null = 'live-fund-user-a';

const app = Fastify();
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
await registerForexCustomerLiveFundingRoutes(app);
await app.ready();

resetForexLiveApplicationsForTests();

const readiness = await app.inject({ method: 'GET', url: '/live/readiness' });
assert.equal(readiness.statusCode, 200);
const readyBody = readiness.json() as { success: boolean; data?: { liveForexReady: boolean; blockers?: string[] } };
assert.equal(readyBody.success, true);
assert.equal(readyBody.data?.liveForexReady, false);
assert.ok((readyBody.data?.blockers?.length ?? 0) > 0);

const deposit = await app.inject({ method: 'POST', url: '/funding/deposits', payload: { accountId: 'x', amount: '10' } });
assert.equal(deposit.statusCode, 503);

await app.close();
console.log('forex-customer-live-funding.integration.test.ts: PASS');
process.exit(0);
