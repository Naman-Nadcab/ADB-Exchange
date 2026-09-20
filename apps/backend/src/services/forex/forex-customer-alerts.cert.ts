/**
 * Live customer Forex alerts certification (server persistence + account isolation).
 * FOREX_SILENT_LOG=1 FOREX_LIVE_API=http://127.0.0.1:4000 npx tsx src/services/forex/forex-customer-alerts.cert.ts
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.FOREX_LIVE_API ?? 'http://127.0.0.1:4000';
const EMAIL_A = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const EMAIL_B = process.env.FOREX_QA_EMAIL_B ?? 'qa_trader_b@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';

const RESULTS: Record<string, 'PASS' | 'FAIL'> = {};

async function req<T>(
  method: string,
  urlPath: string,
  opts: { token?: string; accountId?: string; body?: unknown } = {}
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.accountId) headers['x-forex-account-id'] = opts.accountId;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

function mark(name: string, ok: boolean): void {
  RESULTS[name] = ok ? 'PASS' : 'FAIL';
  if (!ok) throw new Error(`FAIL ${name}`);
}

async function login(email: string): Promise<string> {
  const r = await req('POST', '/api/v1/auth/login/password', { body: { email, password: PASSWORD } });
  const data = r.json.data as { accessToken?: string } | undefined;
  const token = data?.accessToken ?? '';
  assert.ok(token, `login ${email}`);
  return token;
}

void (async () => {
  const tokenA = await login(EMAIL_A);
  const tokenB = await login(EMAIL_B);

  const bad = await req('POST', '/api/v1/forex/alerts', { token: tokenA, body: { condition: { price: '1' } } });
  mark('CREATE_REQUIRES_TYPE', bad.status === 400);

  const accA = await req('GET', '/api/v1/forex/accounts', { token: tokenA });
  const activeA = (accA.json.data as { activeAccountId?: string })?.activeAccountId ?? '';
  mark('ACTIVE_ACCOUNT', Boolean(activeA));

  const q = await req('GET', '/api/v1/forex/quotes/EURUSD', { token: tokenA });
  const bid = Number((q.json.data as { quote?: { bid?: string } })?.quote?.bid ?? 1.05);
  const level = (bid * 0.5).toFixed(5);

  const created = await req('POST', '/api/v1/forex/alerts', {
    token: tokenA,
    accountId: activeA,
    body: {
      alertType: 'BID',
      symbol: 'EURUSD',
      condition: { side: 'above', price: level },
      cooldownSeconds: 60,
    },
  });
  const alert = (created.json.data as { alert?: { alertId?: string; accountId?: string } })?.alert;
  mark('CREATE_UI_PAYLOAD', created.status === 200 && Boolean(alert?.alertId));
  const alertId = alert!.alertId!;

  const listA = await req('GET', '/api/v1/forex/alerts', { token: tokenA, accountId: activeA });
  const alertsA = (listA.json.data as { alerts?: Array<{ alertId: string }> })?.alerts ?? [];
  mark('LIST_PERSIST', alertsA.some((a) => a.alertId === alertId));

  const patched = await req('PATCH', `/api/v1/forex/alerts/${alertId}`, {
    token: tokenA,
    accountId: activeA,
    body: { enabled: false },
  });
  mark('PATCH_DISABLE', patched.status === 200);

  const accB = await req('GET', '/api/v1/forex/accounts', { token: tokenB });
  const activeB = (accB.json.data as { activeAccountId?: string })?.activeAccountId ?? '';

  const leak = await req('GET', '/api/v1/forex/alerts', { token: tokenB, accountId: activeB });
  const alertsB = (leak.json.data as { alerts?: Array<{ alertId: string }> })?.alerts ?? [];
  mark('ACCOUNT_ISOLATION', !alertsB.some((a) => a.alertId === alertId));

  const del = await req('DELETE', `/api/v1/forex/alerts/${alertId}`, { token: tokenA, accountId: activeA });
  mark('DELETE', del.status === 200);

  const delivery = await req('GET', '/api/v1/forex/alerts/delivery-status', { token: tokenA });
  mark('DELIVERY_STATUS', delivery.status === 200);

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
  const out = { ok: true, api: BASE, results: RESULTS, generatedAt: new Date().toISOString() };
  writeFileSync(path.join(root, '.build/forex-customer-alerts-certification.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e instanceof Error ? e.message : e), results: RESULTS }, null, 2));
  process.exit(1);
});
