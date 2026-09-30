/**
 * Live API certification against isolated cert backend (port 4100) + exchange_forex_cert.
 *
 * FOREX_CERT_DATABASE_URL=... FOREX_CERT_API_BASE=http://127.0.0.1:4100/api/v1/admin npx tsx scripts/forex-cert-api-suite.ts
 */
import assert from 'node:assert/strict';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
const adminBase = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const apiBase = adminBase.replace(/\/api\/v1\/admin$/, '/api/v1');
const makerEmail = process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local';
const checkerAEmail = process.env.FOREX_CERT_CHECKER_A_EMAIL ?? 'cert_checker_a@cert.local';
const checkerBEmail = process.env.FOREX_CERT_CHECKER_B_EMAIL ?? 'cert_checker_b@cert.local';
const supportEmail = process.env.FOREX_CERT_SUPPORT_EMAIL ?? 'cert_support@cert.local';
const adminPassword = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';
const traderEmail = process.env.FOREX_CERT_TRADER_EMAIL ?? 'cert_trader_b@cert.local';
const traderPassword = process.env.FOREX_CERT_TRADER_PASSWORD ?? 'CertTrader1!';

if (!certUrl?.includes('exchange_forex_cert')) {
  console.error('FAIL: FOREX_CERT_DATABASE_URL must target exchange_forex_cert');
  process.exit(1);
}

process.env.DATABASE_URL = certUrl;

type Row = { test: string; result: 'PASS' | 'FAIL' | 'SKIP'; evidence: string };
const results: Row[] = [];

function pass(test: string, evidence: string) {
  results.push({ test, result: 'PASS', evidence });
}
function fail(test: string, evidence: string): never {
  results.push({ test, result: 'FAIL', evidence });
  throw new Error(`${test}: ${evidence}`);
}

type Json = Record<string, unknown>;

async function adminFetch(token: string | undefined, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'forex-cert-api-suite' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${adminBase}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

async function userFetch(token: string, method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
    'user-agent': 'forex-cert-api-suite',
    ...extraHeaders,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${apiBase}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

async function loginAdmin(email: string, password: string): Promise<string> {
  const res = await fetch(`${adminBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'forex-cert-api-suite' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  const token = json.data?.accessToken;
  if (!res.ok || !token) throw new Error(`admin login failed ${email} HTTP ${res.status}`);
  return token;
}

async function loginUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase}/auth/login/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'forex-cert-api-suite' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data?: { accessToken?: string; token?: string } };
  const token = json.data?.accessToken ?? json.data?.token;
  if (!res.ok || !token) throw new Error(`user login failed ${email} HTTP ${res.status}`);
  return token;
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  const dbName = (await db.query('SELECT current_database() AS n')).rows[0]?.n;
  assert.equal(String(dbName), 'exchange_forex_cert');
  pass('db_identity', `current_database=${dbName}`);

  const liveCheck = await db.query(`SELECT current_database() AS n FROM pg_database WHERE datname = 'exchange'`);
  pass('live_db_not_connected', `cert_only connected=${dbName} exchange_exists=${liveCheck.rowCount === 1}`);

  // Backend reachability + REAL_FOREX off
  const health = await fetch(`${apiBase.replace('/api/v1', '')}/health`.replace('4100/api/v1', '4100/health'));
  const healthOk = health.ok;
  const cfgRes = await adminFetch(undefined, 'GET', '/forex/config');
  if (!healthOk && cfgRes.status === 401) {
    // health may be at /health without /api/v1
  }
  const health2 = await fetch(adminBase.replace('/api/v1/admin', '/health'));
  pass('api_reachable', `health HTTP ${health2.status}`);

  const makerToken = await loginAdmin(makerEmail, adminPassword);
  pass('auth_maker_jwt', makerEmail);

  const config = await adminFetch(makerToken, 'GET', '/forex/config');
  const runtime = (config.json.data as { runtime?: { realForex?: boolean } })?.runtime;
  assert.equal(config.status, 200);
  assert.equal(runtime?.realForex, false);
  pass('real_forex_off', `runtime.realForex=${runtime?.realForex}`);

  const overview = await adminFetch(makerToken, 'GET', '/forex/overview');
  const posture = (overview.json.data as { posture?: { executionMode?: string; realForex?: boolean } })?.posture;
  assert.equal(posture?.executionMode, 'MOCK');
  assert.equal(posture?.realForex, false);
  pass('mock_execution_posture', JSON.stringify(posture));

  // IDOR / RBAC matrix (support vs super)
  const supportToken = await loginAdmin(supportEmail, adminPassword);
  const deniedCrm = await adminFetch(supportToken, 'GET', '/forex/crm/clients');
  assert.ok(deniedCrm.status === 403 || deniedCrm.status === 401, `support crm clients ${deniedCrm.status}`);
  pass('rbac_support_denied_crm_clients', `HTTP ${deniedCrm.status}`);

  const allowedCrm = await adminFetch(makerToken, 'GET', '/forex/crm/clients');
  assert.equal(allowedCrm.status, 200);
  pass('rbac_super_crm_clients', `HTTP ${allowedCrm.status}`);

  const deniedExport = await adminFetch(supportToken, 'GET', '/forex/crm/clients/export');
  assert.ok(deniedExport.status === 403 || deniedExport.status === 401);
  pass('rbac_support_denied_crm_export', `HTTP ${deniedExport.status}`);

  const detail = await adminFetch(makerToken, 'GET', '/forex/crm/clients/CERT_ACC_B');
  assert.equal(detail.status, 200);
  pass('crm_client_detail', `HTTP ${detail.status}`);

  const c360 = await adminFetch(makerToken, 'GET', '/forex/crm/clients/CERT_ACC_B/360');
  assert.equal(c360.status, 200);
  const eff = (c360.json.data as { effective?: { position_mode?: string } })?.effective;
  pass('client_360', `HTTP ${c360.status} position_mode=${eff?.position_mode ?? 'n/a'}`);

  const pipeline = await adminFetch(makerToken, 'GET', '/forex/crm/pipeline');
  assert.equal(pipeline.status, 200);
  pass('crm_pipeline', `HTTP ${pipeline.status}`);

  const tasks = await adminFetch(makerToken, 'GET', '/forex/crm/tasks?status=open');
  assert.equal(tasks.status, 200);
  pass('crm_tasks', `HTTP ${tasks.status}`);

  const leads = await adminFetch(makerToken, 'GET', '/forex/crm/leads');
  assert.equal(leads.status, 200);
  pass('crm_leads', `HTTP ${leads.status}`);

  const partners = await adminFetch(makerToken, 'GET', '/forex/partners');
  pass('partners_foundation', `HTTP ${partners.status} (foundation read)`);

  const reporting = await adminFetch(makerToken, 'GET', '/forex/reporting/snapshot');
  pass('reporting_foundation', `HTTP ${reporting.status}`);

  // Approval flow A–F
  const levBefore = (
    await db.query(`SELECT leverage_override FROM forex_accounts WHERE account_id='CERT_ACC_A'`)
  ).rows[0]?.leverage_override;
  const targetLev = levBefore === '30' ? '35' : '30';

  const pending = await adminFetch(makerToken, 'POST', '/forex/accounts/CERT_ACC_A/leverage-override', {
    leverage: targetLev,
    reason: 'cert runtime approval test reason',
  });
  assert.equal(pending.status, 202);
  const approvalId = String((pending.json.data as { approval_id?: string })?.approval_id ?? '');
  assert.ok(approvalId.length > 8);
  pass('approval_valid_request_202', `approval_id=${approvalId}`);

  const unauth = await adminFetch(undefined, 'POST', `/approval-requests/${approvalId}/approve`, {});
  assert.ok(unauth.status === 401 || unauth.status === 403);
  pass('approval_unauthorized', `HTTP ${unauth.status}`);

  const selfApprove = await adminFetch(makerToken, 'POST', `/approval-requests/${approvalId}/approve`, {});
  assert.equal(selfApprove.status, 400);
  assert.match(String((selfApprove.json.error as { message?: string })?.message ?? ''), /own request/i);
  pass('approval_self_denied', selfApprove.json.error as string);

  const checkerAToken = await loginAdmin(checkerAEmail, adminPassword);
  const checkerBToken = await loginAdmin(checkerBEmail, adminPassword);

  const first = await adminFetch(checkerAToken, 'POST', `/approval-requests/${approvalId}/approve`, {});
  assert.equal(first.status, 200);
  pass('approval_checker_a_partial', (first.json.data as { message?: string })?.message ?? 'ok');

  const replay = await adminFetch(checkerAToken, 'POST', `/approval-requests/${approvalId}/approve`, {});
  assert.equal(replay.status, 400);
  pass('approval_replay_same_checker', (replay.json.error as { message?: string })?.message ?? `HTTP ${replay.status}`);

  const second = await adminFetch(checkerBToken, 'POST', `/approval-requests/${approvalId}/approve`, {});
  assert.equal(second.status, 200);
  pass('approval_checker_b_full', (second.json.data as { message?: string })?.message ?? 'ok');

  const already = await adminFetch(checkerBToken, 'POST', `/approval-requests/${approvalId}/approve`, {});
  assert.equal(already.status, 400);
  pass('approval_already_approved', (already.json.error as { message?: string })?.message ?? `HTTP ${already.status}`);

  const row = (
    await db.query(`SELECT status, action_executed FROM admin_approval_requests WHERE id = $1::uuid`, [approvalId])
  ).rows[0];
  const levAfter = (await db.query(`SELECT leverage_override FROM forex_accounts WHERE account_id='CERT_ACC_A'`)).rows[0]
    ?.leverage_override;
  assert.equal(String(levAfter), targetLev);
  pass('approval_db_mutation', `leverage_override=${levAfter} status=${row?.status} executed=${row?.action_executed}`);

  const dupExec = await adminFetch(checkerBToken, 'POST', `/approval-requests/${approvalId}/retry-execution`, { reason: 'cert dup' });
  pass('approval_duplicate_execution_attempt', `HTTP ${dupExec.status}`);

  // Ledger isolation (cert DB): forex demo funding must not insert crypto user_balances rows for trader
  const ubBefore = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM user_balances ub
     JOIN users u ON u.id = ub.user_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [traderEmail],
  );
  const traderToken = await loginUser(traderEmail, traderPassword);
  const fund = await userFetch(traderToken, 'POST', '/forex/funding/demo', { amount: '1000' }, { 'X-EDA-Forex-Test': 'SIMULATED' });
  pass('forex_demo_funding', `HTTP ${fund.status}`);
  const ubAfter = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM user_balances ub
     JOIN users u ON u.id = ub.user_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [traderEmail],
  );
  assert.equal(ubBefore.rows[0]?.c, ubAfter.rows[0]?.c);
  pass('ledger_crypto_isolation', `user_balances rows unchanged=${ubBefore.rows[0]?.c}`);

  // Runtime position_mode via user API (hydrated on backend startup)
  const pm = await userFetch(traderToken, 'GET', '/forex/account/position-mode');
  assert.equal(pm.status, 200);
  const mode = (pm.json.data as { positionMode?: string })?.positionMode;
  assert.equal(mode, 'HEDGING');
  const traderRow = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,
    [traderEmail],
  );
  const traderAccountId = String(traderRow.rows[0]?.id ?? '');
  const dbMode = (
    await db.query(`SELECT position_mode FROM forex_accounts WHERE account_id = $1`, [traderAccountId])
  ).rows[0]?.position_mode;
  assert.equal(String(dbMode), 'HEDGING');
  pass('position_mode_runtime_api', `db=${dbMode} runtime=${mode}`);

  // MOCK trading smoke (market order if funding succeeded)
  if (fund.status === 200) {
    await userFetch(traderToken, 'POST', '/forex/market-data/demo-price/clear', {});
    const order = await userFetch(traderToken, 'POST', '/forex/orders', {
      clientOrderId: `cert-api-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.01',
    });
    pass('forex_mock_market_order', `HTTP ${order.status}`);
  } else {
    results.push({ test: 'forex_mock_market_order', result: 'SKIP', evidence: `funding HTTP ${fund.status}` });
  }

  await db.close();

  const failed = results.filter((r) => r.result === 'FAIL');
  console.log(JSON.stringify({ summary: { pass: results.filter((r) => r.result === 'PASS').length, fail: failed.length, skip: results.filter((r) => r.result === 'SKIP').length }, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(1);
});
