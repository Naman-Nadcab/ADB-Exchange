/**
 * Pass-3 — Finance maker-checker → ledger post (cert DB assertions).
 * FOREX_CERT_DATABASE_URL=... FOREX_CERT_API_BASE=http://127.0.0.1:4100/api/v1/admin npx tsx scripts/forex-pass3-finance-e2e.ts
 */
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
const adminBase = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const password = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';
const accountId = process.env.FOREX_CERT_FINANCE_ACCOUNT ?? 'CERT_ACC_B';
const amount = process.env.FOREX_CERT_FINANCE_AMOUNT ?? '17.25000000';

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

async function adminFetch(token: string, method: string, p: string, body?: unknown) {
  const headers: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${token}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${adminBase}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return { status: res.status, json };
}

async function main() {
  const { db } = await import('../src/lib/database.js');
  const { customerCashBalanceFromDb } = await import('../src/services/forex/ledger/persist.js');

  assert.equal(String((await db.query('SELECT current_database() AS n')).rows[0]?.n), 'exchange_forex_cert');
  record('db_identity', true, 'exchange_forex_cert');

  const maker = await login(process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local');
  const checkerA = await login(process.env.FOREX_CERT_CHECKER_A_EMAIL ?? 'cert_checker_a@cert.local');
  const checkerB = await login(process.env.FOREX_CERT_CHECKER_B_EMAIL ?? 'cert_checker_b@cert.local');
  record('admin_logins', true, 'maker + 2 checkers');

  const balanceBefore = await customerCashBalanceFromDb(accountId);
  record('balance_before', true, balanceBefore);

  const reason = `Pass3 finance E2E credit ${Date.now()}`;
  const create = await adminFetch(maker, 'POST', '/forex/finance/requests', {
    account_id: accountId,
    kind: 'CREDIT',
    amount,
    reason,
  });
  record('create_request', create.status === 202, `HTTP ${create.status}`);
  const data = create.json.data as { request_id?: string; approval_id?: string } | undefined;
  assert.ok(data?.request_id);
  assert.ok(data?.approval_id);
  const requestId = data!.request_id!;
  const approvalId = data!.approval_id!;

  const unauth = await adminFetch('', 'POST', `/approval-requests/${approvalId}/approve`, {});
  record('unauth_approve_denied', unauth.status === 401, `HTTP ${unauth.status}`);

  const self = await adminFetch(maker, 'POST', `/approval-requests/${approvalId}/approve`, {});
  record('self_approve_denied', self.status === 403 || self.status === 400, `HTTP ${self.status}`);

  const a1 = await adminFetch(checkerA, 'POST', `/approval-requests/${approvalId}/approve`, {});
  record('checker_a_approve', a1.status === 200, `HTTP ${a1.status}`);

  const a2 = await adminFetch(checkerB, 'POST', `/approval-requests/${approvalId}/approve`, {});
  record('checker_b_approve', a2.status === 200, `HTTP ${a2.status}`);

  await new Promise((r) => setTimeout(r, 1500));

  const fr = await db.query<{ status: string; ledger_transaction_id: string | null }>(
    `SELECT status, ledger_transaction_id::text FROM forex_finance_requests WHERE request_id = $1::uuid`,
    [requestId],
  );
  const row = fr.rows[0];
  record('request_completed', row?.status === 'COMPLETED', `status=${row?.status}`);
  record('ledger_tx_linked', !!row?.ledger_transaction_id, String(row?.ledger_transaction_id));

  const txId = row!.ledger_transaction_id!;
  const entries = await db.query<{ ledger_account: string; debit: string; credit: string }>(
    `SELECT ledger_account, debit::text, credit::text FROM forex_ledger_entries WHERE transaction_id = $1::uuid`,
    [txId],
  );
  record('ledger_entries_count', entries.rows.length >= 2, `count=${entries.rows.length}`);

  const cash = entries.rows.find((e) => e.ledger_account === 'CUSTOMER_CASH');
  const clearing = entries.rows.find((e) => e.ledger_account === 'CLEARING');
  record('customer_cash_credit', !!cash && Number.parseFloat(cash.credit) > 0, JSON.stringify(cash));
  record('clearing_debit', !!clearing && Number.parseFloat(clearing.debit) > 0, JSON.stringify(clearing));

  const balanceAfter = await customerCashBalanceFromDb(accountId);
  const delta = Number.parseFloat(balanceAfter) - Number.parseFloat(balanceBefore);
  record('balance_increased', Math.abs(delta - Number.parseFloat(amount)) < 0.0001, `before=${balanceBefore} after=${balanceAfter} delta=${delta}`);

  const audit = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM audit_logs_immutable WHERE resource_type = 'forex_finance_request' AND resource_id = $1`,
    [requestId],
  );
  record('audit_create', Number.parseInt(audit.rows[0]?.n ?? '0', 10) >= 1, audit.rows[0]?.n ?? '0');

  const { executeForexFinanceRequest } = await import('../src/services/forex/admin/finance-execute.js');
  const replay = await executeForexFinanceRequest(requestId, approvalId);
  record('idempotent_replay', replay.status === 'REPLAY', replay.status);

  await db.close();

  const out = {
    generated_at: new Date().toISOString(),
    account_id: accountId,
    request_id: requestId,
    approval_id: approvalId,
    ledger_transaction_id: txId,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    steps,
    ok: true,
  };
  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-finance-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: true, steps: steps.length, artifact }));
}

main().catch((e) => {
  const artifact = path.join(process.cwd(), '../../.build/forex-pass3-finance-e2e.json');
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, JSON.stringify({ ok: false, error: String(e), steps }, null, 2));
  console.error(e);
  process.exit(1);
});
