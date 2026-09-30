/**
 * Automation live execution — account status event triggers enabled workflow.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
const adminBase = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const password = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

if (!certUrl?.includes('exchange_forex_cert')) process.exit(1);
process.env.DATABASE_URL = certUrl;

async function login(email: string) {
  const res = await fetch(`${adminBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return ((await res.json()) as { data?: { accessToken?: string } }).data!.accessToken!;
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  const maker = await login('cert_maker@cert.local');
  const code = `AUTO_E2E_${Date.now()}`;

  const create = await fetch(`${adminBase}/forex/automation/workflows`, {
    method: 'POST',
    headers: { authorization: `Bearer ${maker}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      name: 'E2E account status notify',
      trigger_type: 'account_status_change',
      actions: [{ type: 'notify', title: 'Account status changed', body: 'Automation E2E fired', severity: 'info' }],
    }),
  });
  assert.equal(create.status, 200);
  const wfId = ((await create.json()) as { data?: { workflow_id?: string } }).data!.workflow_id!;

  const en = await fetch(`${adminBase}/forex/automation/workflows/${wfId}/enabled`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${maker}`, 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(en.status, 200);

  const { dispatchForexAutomationEvent } = await import('../src/services/forex/admin/automation-runtime.js');
  const disp = await dispatchForexAutomationEvent('account_status_change', {
    account_id: 'CERT_ACC_A',
    previous_status: 'ACTIVE',
    next_status: 'RESTRICTED',
    resource_type: 'forex_account',
    resource_id: 'CERT_ACC_A',
  });
  assert.ok(disp.runs >= 1);

  const runs = await db.query<{ status: string }>(
    `SELECT status FROM forex_automation_runs WHERE workflow_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
    [wfId],
  );
  assert.equal(runs.rows[0]?.status, 'COMPLETED');

  const notif = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_operator_notifications WHERE category = 'automation' AND title = 'Account status changed'`,
  );
  assert.ok(Number.parseInt(notif.rows[0]?.n ?? '0', 10) >= 1);

  await db.close();
  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-automation-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ ok: true, workflow_id: wfId, runs: disp.runs }, null, 2));
  console.log(JSON.stringify({ ok: true, artifact }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
