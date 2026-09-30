/**
 * CRM lead → convert → forex account + client profile (cert DB).
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
  return ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  const token = await login('cert_maker@cert.local');
  const leadEmail = `lead-${Date.now()}@cert.local`;
  const ref = `R${Date.now()}`.slice(0, 10);
  const ins = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, referral_code, status, email_verified)
     VALUES ($1, 'x', $2, 'active', TRUE) RETURNING id::text`,
    [leadEmail, ref],
  );
  const userId = ins.rows[0]!.id.trim();

  const create = await fetch(`${adminBase}/forex/crm/leads`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: leadEmail, full_name: 'CRM Convert E2E', stage_id: 'new' }),
  });
  assert.equal(create.status, 200);
  const createJson = (await create.json()) as { data?: { lead_id?: string; lead?: { lead_id: string } } };
  const leadId = createJson.data?.lead?.lead_id ?? createJson.data?.lead_id;
  assert.ok(leadId);

  const conv = await fetch(`${adminBase}/forex/crm/leads/${leadId}/convert`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reason: `Pass3 CRM convert ${Date.now()}`, user_id: userId }),
  });
  if (conv.status !== 200) {
    const errBody = await conv.text();
    throw new Error(`convert failed ${conv.status}: ${errBody}`);
  }
  const accountId = ((await conv.json()) as { data: { account_id: string } }).data.account_id;

  const lead = await db.query<{ status: string; converted_account_id: string }>(
    `SELECT status, converted_account_id FROM forex_crm_leads WHERE lead_id = $1::uuid`,
    [leadId],
  );
  assert.equal(lead.rows[0]?.status, 'converted');
  assert.equal(String(lead.rows[0]?.converted_account_id), accountId);

  const acct = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1`, [accountId]);
  assert.ok(acct.rows.length);

  const profile = await db.query(`SELECT 1 FROM forex_crm_client_profiles WHERE account_id = $1`, [accountId]);
  assert.ok(profile.rows.length);

  const act = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_crm_activities WHERE lead_id = $1::uuid`,
    [leadId],
  );
  assert.ok(Number.parseInt(act.rows[0]?.n ?? '0', 10) >= 1);

  await db.close();
  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-crm-convert-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ ok: true, lead_id: leadId, account_id: accountId }, null, 2));
  console.log(JSON.stringify({ ok: true, artifact }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
