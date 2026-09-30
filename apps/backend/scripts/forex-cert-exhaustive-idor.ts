/**
 * Exhaustive Forex Admin API matrix — cert DB + :4100 only.
 * Output: FOREX_IDOR_ARTIFACT or .build/forex-admin-exhaustive-idor.json
 */
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
const adminBase = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const artifact =
  process.env.FOREX_IDOR_ARTIFACT?.trim() ||
  path.join(process.cwd(), '../../.build/forex-admin-exhaustive-idor.json');

if (!certUrl?.includes('exchange_forex_cert')) {
  console.error('FAIL: FOREX_CERT_DATABASE_URL must target exchange_forex_cert');
  process.exit(1);
}

process.env.DATABASE_URL = certUrl;

type RoleKey = 'none' | 'support' | 'risk' | 'super';
type Endpoint = { method: string; path: string; body?: unknown; roles: Record<RoleKey, number | number[]> };

const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function login(email: string): Promise<string> {
  const res = await fetch(`${adminBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed ${email}`);
  return json.data.accessToken;
}

function ok(actual: number, expected: number | number[]): boolean {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  assert.equal(String((await db.query('SELECT current_database() AS n')).rows[0]?.n), 'exchange_forex_cert');

  const superT = await login(process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local');
  const supportT = await login(process.env.FOREX_CERT_SUPPORT_EMAIL ?? 'cert_support@cert.local');
  const riskT = await login(process.env.FOREX_CERT_RISK_EMAIL ?? 'cert_risk@cert.local');

  const groupRow = await db.query<{ group_id: string }>(
    `SELECT group_id::text FROM forex_account_groups WHERE code='CERT_GB' LIMIT 1`,
  );
  const groupId = groupRow.rows[0]?.group_id ?? '00000000-0000-4000-8000-000000000001';
  const fakeGroup = '00000000-0000-4000-8000-000000009999';
  const fakeAccount = 'IDOR_FAKE_ACCOUNT_X';
  const fakeOrder = '00000000-0000-4000-8000-000000009998';
  const fakeLead = '00000000-0000-4000-8000-000000009997';

  const endpoints: Endpoint[] = [
    { method: 'GET', path: '/forex/config', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/overview', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/system', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/orders?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/orders/export?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/executions?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/positions?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/controls', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/policy', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/execution', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/integrations', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/clients', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/clients/export', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/clients/CERT_ACC_B', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: `/forex/crm/clients/${fakeAccount}`, roles: { none: 401, support: 403, risk: [404, 403], super: [404, 403] } },
    { method: 'GET', path: '/forex/crm/clients/CERT_ACC_B/360', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/clients/CERT_ACC_B/activity?limit=5', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/finance/accounts', roles: { none: 401, support: 403, risk: [403, 200], super: 200 } },
    { method: 'GET', path: '/forex/crm/home', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/workspace', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/activities/recent', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/segments', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/segments/vip', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/segments/nonexistent_segment', roles: { none: 401, support: 403, risk: [404, 400], super: [404, 400] } },
    { method: 'GET', path: '/forex/crm/pipeline', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/leads', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/leads/stages', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/tasks', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/crm/permissions', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/reporting/snapshot', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/risk/control-plane', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/partners', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/dealing/queue', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/routing/desk', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/ledger', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/journal?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/audit?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/audit/search?limit=3', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/risk/hub', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    { method: 'GET', path: '/forex/search?q=CERT', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    {
      method: 'POST',
      path: `/forex/dealing/orders/${fakeOrder}/assign`,
      body: { assignee_admin_id: '00000000-0000-4000-8000-000000000001', reason: 'exhaustive idor assign probe' },
      roles: { none: 401, support: 403, risk: [403, 404], super: [404, 400] },
    },
    { method: 'GET', path: '/forex/account-groups', roles: { none: 401, support: 403, risk: 200, super: 200 } },
    {
      method: 'POST',
      path: '/forex/accounts/CERT_ACC_A/leverage-override',
      body: { leverage: '30', reason: 'exhaustive idor probe reason' },
      roles: { none: 401, support: 403, risk: 403, super: 202 },
    },
    {
      method: 'POST',
      path: `/forex/accounts/${fakeAccount}/leverage-override`,
      body: { leverage: '30', reason: 'exhaustive idor probe reason' },
      roles: { none: 401, support: 403, risk: [403, 404], super: [404, 400] },
    },
    {
      method: 'POST',
      path: '/forex/account-groups',
      body: { code: 'IDOR_TEST_X', label: 'IDOR Test', leverage_default: '50' },
      roles: { none: 401, support: 403, risk: [403, 400, 200], super: [200, 400] },
    },
    {
      method: 'PATCH',
      path: `/forex/account-groups/${fakeGroup}`,
      body: { label: 'noop' },
      roles: { none: 401, support: 403, risk: [403, 404], super: [404, 400] },
    },
    {
      method: 'POST',
      path: '/forex/crm/leads',
      body: { email: `idor-${Date.now()}@cert.local`, full_name: 'IDOR Lead', stage_id: 'new' },
      roles: { none: 401, support: 403, risk: [403, 201, 400, 200], super: [201, 400, 200] },
    },
    {
      method: 'GET',
      path: `/forex/crm/leads/${fakeLead}`,
      roles: { none: 401, support: 403, risk: [404, 403], super: [404, 403] },
    },
    {
      method: 'POST',
      path: '/forex/orders/00000000-0000-4000-8000-000000000001/force-cancel',
      body: { reason: 'exhaustive idor probe reason' },
      roles: { none: 401, support: 403, risk: [403, 404, 202], super: [404, 202, 400] },
    },
    {
      method: 'POST',
      path: `/forex/orders/${fakeOrder}/force-cancel`,
      body: { reason: 'exhaustive idor probe reason' },
      roles: { none: 401, support: 403, risk: [403, 404], super: [404, 400] },
    },
    {
      method: 'POST',
      path: '/approval-requests/00000000-0000-4000-8000-000000000001/approve',
      body: {},
      roles: { none: 401, support: 403, risk: [403, 404, 400], super: [404, 400] },
    },
  ];

  const tokens: Record<Exclude<RoleKey, 'none'>, string> = { super: superT, support: supportT, risk: riskT };
  const results: Array<{
    method: string;
    path: string;
    role: RoleKey;
    expected: number | number[];
    actual: number;
    pass: boolean;
  }> = [];

  async function hit(token: string | null, method: string, p: string, body?: unknown) {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${adminBase}${p}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.status;
  }

  for (const ep of endpoints) {
    for (const role of ['none', 'support', 'risk', 'super'] as RoleKey[]) {
      const expected = ep.roles[role];
      const token = role === 'none' ? null : tokens[role];
      const actual = await hit(token, ep.method, ep.path, ep.body);
      const pass = ok(actual, expected);
      results.push({ method: ep.method, path: ep.path, role, expected, actual, pass });
    }
  }

  await db.query(`DELETE FROM forex_account_groups WHERE code = 'IDOR_TEST_X'`).catch(() => {});

  await db.close();

  const failed = results.filter((r) => !r.pass);
  const payload = {
    generated_at: new Date().toISOString(),
    admin_base: adminBase,
    database: 'exchange_forex_cert',
    summary: { total: results.length, pass: results.length - failed.length, fail: failed.length },
    failed,
    results,
  };

  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload.summary));
  if (failed.length) {
    console.error(JSON.stringify(failed.slice(0, 15), null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
