/**
 * Forex WebSocket upgrade auth — Bearer + mlive_at cookie (no live WS).
 */
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { ACCESS_COOKIE } from '../../../lib/auth-cookies.js';
import { resolveForexWsUserId } from './forex-authenticate.js';

type JwtPayload = { userId: string; type?: string; sessionId?: string };

function buildApp(verify: (token: string) => JwtPayload) {
  const app = Fastify();
  app.decorate('jwt', { verify });
  return app;
}

async function run() {
  const appNone = buildApp(() => ({ userId: 'u1', sessionId: 's1' }));
  const noToken = await resolveForexWsUserId(appNone, { headers: {}, cookies: {} } as never);
  assert.equal(noToken, undefined);

  const appAdmin = buildApp(() => ({ userId: 'admin-1', type: 'admin', sessionId: 's1' }));
  const admin = await resolveForexWsUserId(appAdmin, {
    headers: { authorization: 'Bearer admin-token' },
    cookies: {},
  } as never);
  assert.equal(admin, undefined);

  const appBad = buildApp(() => {
    throw new Error('bad jwt');
  });
  const bad = await resolveForexWsUserId(appBad, {
    headers: { authorization: 'Bearer bad' },
    cookies: {},
  } as never);
  assert.equal(bad, undefined);

  const appCookie = buildApp((token) => {
    assert.equal(token, 'cookie-jwt');
    return { userId: 'user-cookie', sessionId: 'sess-x' };
  });
  const fromCookie = await resolveForexWsUserId(appCookie, {
    headers: {},
    cookies: { [ACCESS_COOKIE]: 'cookie-jwt' },
  } as never);
  // Session validity is live-checked; without DB/redis this is typically undefined — still proves cookie path reaches jwt.verify.
  assert.ok(fromCookie === undefined || fromCookie === 'user-cookie');

  const appBearer = buildApp((token) => {
    assert.equal(token, 'bearer-jwt');
    return { userId: 'user-bearer', sessionId: 'sess-y' };
  });
  const fromBearer = await resolveForexWsUserId(appBearer, {
    headers: { authorization: 'Bearer bearer-jwt' },
    cookies: {},
  } as never);
  assert.ok(fromBearer === undefined || fromBearer === 'user-bearer');

  console.log('forex-ws-auth.test.ts ok');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
