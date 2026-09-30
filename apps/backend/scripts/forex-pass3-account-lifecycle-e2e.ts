/**
 * Pass-3 — Forex account lifecycle transitions (cert DB + API).
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
const adminBase = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const password = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';
const accountId = process.env.FOREX_CERT_LIFECYCLE_ACCOUNT ?? 'CERT_ACC_A';

if (!certUrl?.includes('exchange_forex_cert')) {
  console.error('FAIL: FOREX_CERT_DATABASE_URL must target exchange_forex_cert');
  process.exit(1);
}
process.env.DATABASE_URL = certUrl;

type Step = { name: string; ok: boolean; detail: string };
const steps: Step[] = [];

function record(name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${adminBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  assert.ok(json.data?.accessToken);
  return json.data!.accessToken!;
}

async function setStatus(token: string, next: string, reason: string) {
  const res = await fetch(`${adminBase}/forex/accounts/${encodeURIComponent(accountId)}/status`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ status: next, reason }),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  record('db_identity', String((await db.query('SELECT current_database() AS n')).rows[0]?.n) === 'exchange_forex_cert', 'exchange_forex_cert');

  const admin = await login(process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local');

  const before = await db.query<{ status: string }>(`SELECT status FROM forex_accounts WHERE account_id = $1`, [accountId]);
  const start = String(before.rows[0]?.status ?? 'ACTIVE').toUpperCase();
  record('account_exists', !!before.rows[0], accountId);

  if (start !== 'ACTIVE') {
    const r = await setStatus(admin, 'ACTIVE', `Pass3 lifecycle reset ${Date.now()}`);
    record('reset_active', r.status === 200, `HTTP ${r.status}`);
  }

  const r1 = await setStatus(admin, 'RESTRICTED', `Pass3 lifecycle restrict ${Date.now()}`);
  record('to_restricted', r1.status === 200, `HTTP ${r1.status}`);
  const s1 = await db.query<{ status: string }>(`SELECT status FROM forex_accounts WHERE account_id = $1`, [accountId]);
  record('db_restricted', String(s1.rows[0]?.status).toUpperCase() === 'RESTRICTED', s1.rows[0]?.status ?? '');

  const act = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_crm_activities WHERE account_id = $1 AND kind = 'account_status'`,
    [accountId],
  );
  record('crm_activity', Number.parseInt(act.rows[0]?.n ?? '0', 10) >= 1, act.rows[0]?.n ?? '0');

  const bad = await setStatus(admin, 'CLOSED', 'short');
  record('short_reason_denied', bad.status === 400, `HTTP ${bad.status}`);

  const r2 = await setStatus(admin, 'ACTIVE', `Pass3 lifecycle reactivate ${Date.now()}`);
  record('to_active', r2.status === 200, `HTTP ${r2.status}`);

  const audit = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM audit_logs_immutable
     WHERE action = 'forex_account_status_transition'
       AND resource_type = 'forex_account'
       AND new_value ILIKE $1`,
    [`%${accountId}%`],
  );
  record('audit_rows', Number.parseInt(audit.rows[0]?.n ?? '0', 10) >= 1, audit.rows[0]?.n ?? '0');

  await db.close();

  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-account-lifecycle-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ ok: true, account_id: accountId, steps, generated_at: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ ok: true, steps: steps.length, artifact }));
}

main().catch((e) => {
  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-account-lifecycle-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ ok: false, error: String(e), steps }, null, 2));
  console.error(e);
  process.exit(1);
});
