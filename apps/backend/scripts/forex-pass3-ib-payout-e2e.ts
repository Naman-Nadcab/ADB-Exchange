/**
 * IB partner accrual → payout request → maker-checker → ledger (cert DB).
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
  const json = (await res.json()) as { data?: { accessToken?: string } };
  return json.data!.accessToken!;
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  await db.query(`CREATE TABLE IF NOT EXISTS forex_partner_commission_accruals (
    accrual_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL,
    account_id VARCHAR(64),
    volume_lots NUMERIC(20,8) NOT NULL DEFAULT 0,
    commission_amount NUMERIC(20,8) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status VARCHAR(16) NOT NULL DEFAULT 'ACCRUED',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});
  await db.query(`CREATE TABLE IF NOT EXISTS forex_partner_payout_requests (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL,
    amount NUMERIC(20,8) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL,
    approval_request_id UUID,
    ledger_transaction_id UUID,
    external_rail_status VARCHAR(24) NOT NULL DEFAULT 'NOT_CONFIGURED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {});

  let partner = await db.query<{ partner_id: string }>(`SELECT partner_id::text FROM forex_partner_profiles LIMIT 1`);
  if (!partner.rows[0]) {
    await db.query(
      `INSERT INTO forex_partner_profiles (code, label, status) VALUES ('CERT_IB', 'Cert IB Partner', 'active') ON CONFLICT (code) DO NOTHING`,
    );
    partner = await db.query(`SELECT partner_id::text FROM forex_partner_profiles WHERE code='CERT_IB' LIMIT 1`);
  }
  const partnerId = partner.rows[0]!.partner_id;

  const maker = await login('cert_maker@cert.local');
  const checkerA = await login('cert_checker_a@cert.local');
  const checkerB = await login('cert_checker_b@cert.local');

  const accRes = await fetch(`${adminBase}/forex/partners/${partnerId}/accruals`, {
    method: 'POST',
    headers: { authorization: `Bearer ${maker}`, 'content-type': 'application/json' },
    body: JSON.stringify({ volume_lots: '2.5', commission_amount: '12.50', reason: `Pass3 IB accrual ${Date.now()}` }),
  });
  assert.equal(accRes.status, 200);

  const payRes = await fetch(`${adminBase}/forex/partners/${partnerId}/payout-requests`, {
    method: 'POST',
    headers: { authorization: `Bearer ${maker}`, 'content-type': 'application/json' },
    body: JSON.stringify({ amount: '12.50000000', reason: `Pass3 IB payout request ${Date.now()}` }),
  });
  assert.equal(payRes.status, 202);
  const payJson = (await payRes.json()) as { data?: { payout_id?: string; approval_id?: string } };
  const payoutId = payJson.data!.payout_id!;
  const approvalId = payJson.data!.approval_id!;

  for (const t of [checkerA, checkerB]) {
    const ar = await fetch(`${adminBase}/approval-requests/${approvalId}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(ar.status, 200);
  }
  await new Promise((r) => setTimeout(r, 1200));

  const pr = await db.query<{ status: string; ledger_transaction_id: string | null; external_rail_status: string }>(
    `SELECT status, ledger_transaction_id::text, external_rail_status FROM forex_partner_payout_requests WHERE payout_id = $1::uuid`,
    [payoutId],
  );
  assert.equal(pr.rows[0]?.status, 'COMPLETED');
  assert.ok(pr.rows[0]?.ledger_transaction_id);
  assert.equal(pr.rows[0]?.external_rail_status, 'NOT_CONFIGURED');

  const entries = await db.query(
    `SELECT ledger_account FROM forex_ledger_entries WHERE transaction_id = $1::uuid`,
    [pr.rows[0]!.ledger_transaction_id],
  );
  assert.ok(entries.rows.some((e) => e.ledger_account === 'PARTNER_PAYABLE'));

  await db.close();
  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-ib-payout-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ ok: true, payout_id: payoutId, partner_id: partnerId }, null, 2));
  console.log(JSON.stringify({ ok: true, artifact }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
