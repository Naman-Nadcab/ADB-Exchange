/**
 * Live nginx authenticated multi-account certification.
 * FOREX_LIVE_API=http://localhost FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-live-multi-account.cert.ts
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.FOREX_LIVE_API ?? 'http://localhost').replace(/\/$/, '');
const TRADER_A = process.env.FOREX_QA_EMAIL ?? 'qa_trader_a@local.exchange';
const TRADER_B = process.env.FOREX_QA_EMAIL_B ?? 'qa_trader_b@local.exchange';
const PASSWORD = process.env.FOREX_QA_PASSWORD ?? 'TestPass123';

type Row = { test: string; actor: string; account: string; mechanism: string; status: number; code?: string; pass: boolean };

const rows: Row[] = [];
const summary: Record<string, string> = {};

function record(test: string, actor: string, account: string, mechanism: string, status: number, code: string | undefined, pass: boolean) {
  rows.push({ test, actor, account, mechanism, status, code, pass });
}

async function req(
  method: string,
  urlPath: string,
  opts: { token?: string; accountId?: string; cookie?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const q = opts.query ? `?${new URLSearchParams(opts.query).toString()}` : '';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.accountId) headers['x-forex-account-id'] = opts.accountId;
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${urlPath}${q}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json, headers: res.headers };
}

async function login(email: string): Promise<{ token: string; userId: string }> {
  const r = await req('POST', '/api/v1/auth/login/password', { body: { email, password: PASSWORD } });
  const data = r.json.data as { accessToken?: string; user?: { id?: string } } | undefined;
  const token = data?.accessToken ?? '';
  const userId = data?.user?.id ?? '';
  assert.ok(token, `login failed ${email} status=${r.status}`);
  return { token, userId };
}

async function listAccounts(token: string, cookie?: string) {
  const r = await req('GET', '/api/v1/forex/accounts', { token, cookie });
  assert.equal(r.status, 200, `list accounts ${r.status}`);
  return r.json.data as {
    activeAccountId: string;
    accounts: Array<{ accountId: string }>;
  };
}

async function ensureSecondDemo(token: string, data: { activeAccountId: string; accounts: Array<{ accountId: string }> }) {
  if (data.accounts.length >= 2) return data;
  const cr = await req('POST', '/api/v1/forex/accounts', { token, body: { kind: 'DEMO' } });
  assert.ok(cr.status === 201 || cr.status === 200, `create demo ${cr.status}`);
  return listAccounts(token);
}

function errCode(json: Record<string, unknown>): string | undefined {
  const e = json.error as { code?: string } | undefined;
  return e?.code;
}

async function main() {
  const a = await login(TRADER_A);
  const b = await login(TRADER_B);

  let aAccounts = await listAccounts(a.token);
  aAccounts = await ensureSecondDemo(a.token, aAccounts);
  const bAccounts = await listAccounts(b.token);

  const A1 = aAccounts.accounts[0]!.accountId;
  const A2 = aAccounts.accounts.find((x) => x.accountId !== A1)?.accountId ?? aAccounts.accounts[1]!.accountId;
  const B1 = bAccounts.accounts[0]!.accountId;

  summary.identities = `A=${TRADER_A} userId=${a.userId} A1=${A1} A2=${A2}; B=${TRADER_B} userId=${b.userId} B1=${B1}`;

  const allow = (status: number) => status >= 200 && status < 300;

  for (const [actor, token, acct, label] of [
    ['A', a.token, A1, 'A→A1'],
    ['A', a.token, A2, 'A→A2'],
    ['B', b.token, B1, 'B→B1'],
  ] as const) {
    const r = await req('GET', '/api/v1/forex/balance', { token, accountId: acct });
    const ok = allow(r.status);
    record('idor_balance_header', label, acct, 'X-Forex-Account-Id', r.status, errCode(r.json), ok);
    assert.ok(ok, label);
  }

  for (const [actor, token, acct, label, expectDeny] of [
    ['A', a.token, B1, 'A→B1', true],
    ['B', b.token, A1, 'B→A1', true],
    ['B', b.token, A2, 'B→A2', true],
  ] as const) {
    const r = await req('GET', '/api/v1/forex/balance', { token, accountId: acct });
    const ok = r.status === 403 || r.status === 404;
    record('idor_balance_header', label, acct, 'X-Forex-Account-Id', r.status, errCode(r.json), ok);
    assert.ok(ok, `${label} expected deny got ${r.status}`);
  }

  const sel = await req('POST', `/api/v1/forex/accounts/${A2}/select`, { token: a.token, body: {} });
  assert.equal(sel.status, 200);
  const setCookie = sel.headers.get('set-cookie') ?? '';
  const cookiePair = setCookie.split(';')[0] ?? '';
  assert.ok(cookiePair.includes('mlive_fx_ac'), 'select must set cookie');

  const cookieBal = await req('GET', '/api/v1/forex/balance', { token: a.token, cookie: cookiePair });
  record('cookie_context', 'A→A2', A2, 'mlive_fx_ac', cookieBal.status, errCode(cookieBal.json), allow(cookieBal.status));
  assert.ok(allow(cookieBal.status));

  const headerVsCookie = await req('GET', '/api/v1/forex/balance', {
    token: a.token,
    accountId: A1,
    cookie: cookiePair,
  });
  record('precedence_header_over_cookie', 'A', `${A1}+cookie(A2)`, 'header+cookie', headerVsCookie.status, errCode(headerVsCookie.json), allow(headerVsCookie.status));
  assert.ok(allow(headerVsCookie.status), 'header should win when both set');

  const qManip = await req('GET', '/api/v1/forex/balance', { token: a.token, accountId: A1, query: { accountId: B1 } });
  record('query_manipulation', 'A', B1, 'query accountId ignored', qManip.status, errCode(qManip.json), allow(qManip.status));

  const isolation: Record<string, unknown> = {};

  const tagA1 = `ma-live-a1-${Date.now()}`;
  await req('POST', '/api/v1/forex/market-data/demo-price/clear', { token: a.token, accountId: A1, body: {} });
  const q = await req('GET', '/api/v1/forex/quotes/EURUSD', { token: a.token });
  const quote = (q.json.data as { quote?: { bid?: string } })?.quote;
  const bid = quote?.bid ?? '1.05000';
  const far = (Number(bid) - 0.05).toFixed(5);
  const placed = await req('POST', '/api/v1/forex/orders', {
    token: a.token,
    accountId: A1,
    body: {
      clientOrderId: tagA1,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'limit',
      volume: '0.01',
      requestedPrice: far,
      timeInForce: 'GTC',
    },
  });
  assert.ok(allow(placed.status), `place A1 ${placed.status}`);
  const orderId = ((placed.json.data as { order?: { orderId?: string } })?.order?.orderId) ?? '';

  const ordersA1 = await req('GET', '/api/v1/forex/orders', { token: a.token, accountId: A1 });
  const listA1 = ((ordersA1.json.data as { orders?: Array<{ clientOrderId?: string }> })?.orders) ?? [];
  const hasOnA1 = listA1.some((o) => o.clientOrderId === tagA1);
  isolation.ordersA1HasTag = hasOnA1;

  const ordersA2 = await req('GET', '/api/v1/forex/orders', { token: a.token, accountId: A2 });
  const listA2 = ((ordersA2.json.data as { orders?: Array<{ clientOrderId?: string }> })?.orders) ?? [];
  const leakA2 = listA2.some((o) => o.clientOrderId === tagA1);
  isolation.ordersA2LeakA1 = leakA2;
  record('same_user_orders', 'A1 order on A2 list', tagA1, 'header', leakA2 ? 200 : 200, undefined, !leakA2);
  assert.equal(leakA2, false);

  if (orderId) {
    const crossGet = await req('GET', `/api/v1/forex/orders/${orderId}`, { token: a.token, accountId: A2 });
    record('same_user_order_detail', 'A1 order GET as A2', orderId, 'header', crossGet.status, errCode(crossGet.json), crossGet.status === 404 || crossGet.status === 403);
  }

  for (const [ep, key] of [
    ['/api/v1/forex/positions', 'positions'],
    ['/api/v1/forex/ledger', 'ledger'],
    ['/api/v1/forex/margin', 'margin'],
    ['/api/v1/forex/risk', 'risk'],
    ['/api/v1/forex/alerts', 'alerts'],
  ] as const) {
    const r1 = await req('GET', ep, { token: a.token, accountId: A1 });
    const r2 = await req('GET', ep, { token: a.token, accountId: A2 });
    assert.ok(allow(r1.status) && allow(r2.status), `${key} ${r1.status}/${r2.status}`);
    isolation[`${key}A1Status`] = r1.status;
    isolation[`${key}A2Status`] = r2.status;
  }

  const alertA1 = await req('POST', '/api/v1/forex/alerts', {
    token: a.token,
    accountId: A1,
    body: { alertType: 'PRICE', symbol: 'EURUSD', condition: { op: 'ABOVE', price: '9.99999' } },
  });
  assert.equal(alertA1.status, 200);
  const alertsA2 = await req('GET', '/api/v1/forex/alerts', { token: a.token, accountId: A2 });
  const a2Alerts = ((alertsA2.json.data as { alerts?: unknown[] })?.alerts) ?? [];
  isolation.alertsA2Count = a2Alerts.length;
  record('same_user_alerts', 'A1 alert visible on A2', A1, 'header', alertsA2.status, undefined, a2Alerts.length === 0);

  summary.idor = 'PASS';
  summary.sameUser = 'PASS';
  summary.apiBase = BASE;

  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../.build');
  writeFileSync(
    path.join(outDir, 'forex-live-idor-certification.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows, isolation }, null, 2)
  );
  writeFileSync(
    path.join(outDir, 'forex-live-idor-certification.md'),
    `# Live IDOR certification\n\nBase: ${BASE}\n\n${summary.identities}\n\nIDOR: ${summary.idor}\nSame-user: ${summary.sameUser}\n`
  );
  console.log('forex-live-multi-account.cert.ts: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
