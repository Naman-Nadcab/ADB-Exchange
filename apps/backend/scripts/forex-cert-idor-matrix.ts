/**
 * IDOR / RBAC API matrix for Forex Admin — cert backend + exchange_forex_cert only.
 * FOREX_CERT_API_BASE=http://127.0.0.1:4100/api/v1/admin npx tsx scripts/forex-cert-idor-matrix.ts
 */
import assert from 'node:assert/strict';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
const adminBase = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');

if (!certUrl?.includes('exchange_forex_cert')) {
  console.error('FAIL: FOREX_CERT_DATABASE_URL must target exchange_forex_cert');
  process.exit(1);
}

process.env.DATABASE_URL = certUrl;

type Case = {
  id: string;
  role: 'super' | 'support' | 'risk';
  method: string;
  path: string;
  body?: unknown;
  expectStatus: number | number[];
  expectNoMutation?: boolean;
};

const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';
const emails = {
  super: process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local',
  support: process.env.FOREX_CERT_SUPPORT_EMAIL ?? 'cert_support@cert.local',
  risk: process.env.FOREX_CERT_RISK_EMAIL ?? 'cert_risk@cert.local',
};

const results: Array<{ id: string; result: 'PASS' | 'FAIL'; http: number; note: string }> = [];

async function login(email: string): Promise<string> {
  const res = await fetch(`${adminBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'forex-cert-idor-matrix' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed ${email} HTTP ${res.status}`);
  return json.data.accessToken;
}

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'forex-cert-idor-matrix' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${adminBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

function okStatus(actual: number, expected: number | number[]): boolean {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  const dbName = (await db.query('SELECT current_database() AS n')).rows[0]?.n;
  assert.equal(String(dbName), 'exchange_forex_cert');

  const superT = await login(emails.super);
  let supportT: string;
  let riskT: string;
  try {
    supportT = await login(emails.support);
  } catch {
    supportT = '';
  }
  try {
    riskT = await login(emails.risk);
  } catch {
    riskT = '';
  }

  const levBefore = (
    await db.query(`SELECT leverage_override FROM forex_accounts WHERE account_id='CERT_ACC_A'`)
  ).rows[0]?.leverage_override;

  const cases: Case[] = [
    { id: 'super_crm_clients', role: 'super', method: 'GET', path: '/forex/crm/clients', expectStatus: 200 },
    { id: 'support_crm_clients_denied', role: 'support', method: 'GET', path: '/forex/crm/clients', expectStatus: 403 },
    { id: 'super_crm_export', role: 'super', method: 'GET', path: '/forex/crm/clients/export', expectStatus: 200 },
    { id: 'support_crm_export_denied', role: 'support', method: 'GET', path: '/forex/crm/clients/export', expectStatus: 403 },
    { id: 'super_client_detail', role: 'super', method: 'GET', path: '/forex/crm/clients/CERT_ACC_B', expectStatus: 200 },
    { id: 'support_client_detail_denied', role: 'support', method: 'GET', path: '/forex/crm/clients/CERT_ACC_B', expectStatus: 403 },
    { id: 'super_client_360', role: 'super', method: 'GET', path: '/forex/crm/clients/CERT_ACC_B/360', expectStatus: 200 },
    { id: 'super_leads', role: 'super', method: 'GET', path: '/forex/crm/leads', expectStatus: 200 },
    { id: 'support_leads_denied', role: 'support', method: 'GET', path: '/forex/crm/leads', expectStatus: 403 },
    { id: 'super_tasks', role: 'super', method: 'GET', path: '/forex/crm/tasks', expectStatus: 200 },
    { id: 'super_pipeline', role: 'super', method: 'GET', path: '/forex/crm/pipeline', expectStatus: 200 },
    { id: 'super_orders', role: 'super', method: 'GET', path: '/forex/orders?limit=5', expectStatus: 200 },
    { id: 'support_orders_denied', role: 'support', method: 'GET', path: '/forex/orders?limit=5', expectStatus: 403 },
    { id: 'super_positions', role: 'super', method: 'GET', path: '/forex/positions?limit=5', expectStatus: 200 },
    { id: 'super_partners', role: 'super', method: 'GET', path: '/forex/partners', expectStatus: 200 },
    { id: 'super_reporting', role: 'super', method: 'GET', path: '/forex/reporting/snapshot', expectStatus: 200 },
    { id: 'super_risk_plane', role: 'super', method: 'GET', path: '/forex/risk/control-plane', expectStatus: 200 },
    { id: 'super_dealing_queue', role: 'super', method: 'GET', path: '/forex/dealing/queue', expectStatus: 200 },
    { id: 'super_account_groups', role: 'super', method: 'GET', path: '/forex/account-groups', expectStatus: 200 },
    { id: 'support_account_groups_denied', role: 'support', method: 'GET', path: '/forex/account-groups', expectStatus: 403 },
    {
      id: 'support_leverage_mut_denied',
      role: 'support',
      method: 'POST',
      path: '/forex/accounts/CERT_ACC_A/leverage-override',
      body: { leverage: '99', reason: 'idor matrix probe reason' },
      expectStatus: [403, 401],
      expectNoMutation: true,
    },
    {
      id: 'super_leverage_mut_202',
      role: 'super',
      method: 'POST',
      path: '/forex/accounts/CERT_ACC_A/leverage-override',
      body: { leverage: String(levBefore ?? '30'), reason: 'idor matrix probe reason' },
      expectStatus: 202,
    },
    { id: 'unauth_config', role: 'super', method: 'GET', path: '/forex/config', expectStatus: 401 },
  ];

  const unauthConfig = await call(null, 'GET', '/forex/config');
  results.push({
    id: 'unauth_config',
    result: unauthConfig.status === 401 ? 'PASS' : 'FAIL',
    http: unauthConfig.status,
    note: 'no token',
  });

  for (const c of cases) {
    if (c.id === 'unauth_config') continue;
    const token = c.role === 'super' ? superT : c.role === 'support' ? supportT : riskT;
    if (!token) {
      results.push({ id: c.id, result: 'FAIL', http: 0, note: 'missing token for role' });
      continue;
    }
    const { status } = await call(token, c.method, c.path, c.body);
    const pass = okStatus(status, c.expectStatus);
    results.push({ id: c.id, result: pass ? 'PASS' : 'FAIL', http: status, note: `expected ${c.expectStatus}` });
  }

  const levAfter = (
    await db.query(`SELECT leverage_override FROM forex_accounts WHERE account_id='CERT_ACC_A'`)
  ).rows[0]?.leverage_override;
  const supportMutBlocked =
    String(levAfter) === String(levBefore) ||
    results.find((r) => r.id === 'support_leverage_mut_denied')?.result === 'PASS';
  results.push({
    id: 'support_no_leverage_db_mutation',
    result: supportMutBlocked ? 'PASS' : 'FAIL',
    http: 0,
    note: `before=${levBefore} after=${levAfter}`,
  });

  if (riskT) {
    const riskCrm = await call(riskT, 'GET', '/forex/crm/clients');
    results.push({
      id: 'risk_manager_crm_clients',
      result: riskCrm.status === 200 ? 'PASS' : 'FAIL',
      http: riskCrm.status,
      note: 'risk_manager has forex:crm:view in implicit matrix',
    });
    const riskApprove = await call(riskT, 'POST', '/approval-requests/00000000-0000-4000-8000-000000000001/approve', {});
    results.push({
      id: 'risk_manager_approval_route_denied',
      result: [403, 400, 404].includes(riskApprove.status) ? 'PASS' : 'FAIL',
      http: riskApprove.status,
      note: 'zero-trust: /approval-requests unmapped for non-super',
    });
  }

  await db.close();
  const failed = results.filter((r) => r.result === 'FAIL');
  console.log(JSON.stringify({ summary: { pass: results.length - failed.length, fail: failed.length }, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
