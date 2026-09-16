/**
 * Admin Forex F6+ — ledger balances & reconciliation event tail (read-only).
 */
import { db } from '../../../lib/database.js';
import { customerCashBalanceFromDb } from '../ledger/persist.js';

export type ForexAdminLedgerAccountRow = {
  account_id: string;
  user_id: string | null;
  currency: string;
  status: string;
  customer_cash_balance: string;
};

export type ForexAdminReconciliationRow = {
  event_id: string;
  account_id: string;
  kind: string;
  ok: boolean;
  reason: string | null;
  detail: string | null;
  created_at: string;
};

export type ForexAdminLedgerSnapshot = {
  accounts: ForexAdminLedgerAccountRow[];
  reconciliation: ForexAdminReconciliationRow[];
  totals: { accounts: number; reconciliationEvents: number };
  note: string;
};

async function hasTable(name: string): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [name],
  );
  return res.rows.length > 0;
}

export async function buildForexAdminLedgerSnapshot(limit = 50): Promise<ForexAdminLedgerSnapshot> {
  const acctRes = await db.query<{ account_id: string; user_id: string | null; currency: string; status: string }>(
    `SELECT account_id, user_id, currency, status FROM forex_accounts ORDER BY account_id LIMIT 200`,
  );

  const accounts: ForexAdminLedgerAccountRow[] = [];
  for (const row of acctRes.rows) {
    const accountId = String(row.account_id);
    const balance = await customerCashBalanceFromDb(accountId);
    accounts.push({
      account_id: accountId,
      user_id: row.user_id == null ? null : String(row.user_id),
      currency: String(row.currency),
      status: String(row.status),
      customer_cash_balance: balance,
    });
  }

  let reconciliation: ForexAdminReconciliationRow[] = [];
  if (await hasTable('forex_reconciliation_events')) {
    const recRes = await db.query(
      `SELECT event_id, account_id, kind, ok, reason, detail, created_at
       FROM forex_reconciliation_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
    reconciliation = recRes.rows.map((r: Record<string, unknown>) => ({
      event_id: String(r.event_id),
      account_id: String(r.account_id),
      kind: String(r.kind),
      ok: Boolean(r.ok),
      reason: r.reason == null ? null : String(r.reason),
      detail: r.detail == null ? null : String(r.detail),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  return {
    accounts,
    reconciliation,
    totals: { accounts: accounts.length, reconciliationEvents: reconciliation.length },
    note: 'Forex CUSTOMER_CASH ledger only — crypto wallets excluded. MOCK/simulated reconciliation.',
  };
}
