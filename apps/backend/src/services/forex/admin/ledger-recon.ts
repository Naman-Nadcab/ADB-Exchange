/**
 * Admin Forex F6+ — ledger balances & reconciliation event tail (read-only).
 */
import { db } from '../../../lib/database.js';

export type ForexAdminLedgerAccountRow = {
  account_id: string;
  user_id: string | null;
  currency: string;
  status: string;
  customer_cash_balance: string;
  savings_balance: string;
  follow_reserve_balance: string;
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

  const ids = acctRes.rows.map((row) => String(row.account_id));
  const balances = new Map<string, { cash: string; savings: string; follow: string }>();
  if (ids.length > 0) {
    const balRes = await db.query<{
      account_id: string;
      customer_cash_balance: string;
      savings_balance: string;
      follow_reserve_balance: string;
    }>(
      `SELECT account_id,
              COALESCE(SUM(credit - debit) FILTER (WHERE ledger_account = 'CUSTOMER_CASH'), 0)::text AS customer_cash_balance,
              COALESCE(SUM(credit - debit) FILTER (WHERE ledger_account = 'SAVINGS'), 0)::text AS savings_balance,
              COALESCE(SUM(credit - debit) FILTER (WHERE ledger_account = 'FOLLOW_RESERVE'), 0)::text AS follow_reserve_balance
       FROM forex_ledger_entries
       WHERE account_id = ANY($1::text[])
         AND ledger_account IN ('CUSTOMER_CASH', 'SAVINGS', 'FOLLOW_RESERVE')
       GROUP BY account_id`,
      [ids],
    );
    for (const row of balRes.rows) {
      balances.set(String(row.account_id), {
        cash: String(row.customer_cash_balance),
        savings: String(row.savings_balance),
        follow: String(row.follow_reserve_balance),
      });
    }
  }

  const accounts: ForexAdminLedgerAccountRow[] = acctRes.rows.map((row) => {
    const accountId = String(row.account_id);
    const held = balances.get(accountId);
    return {
      account_id: accountId,
      user_id: row.user_id == null ? null : String(row.user_id),
      currency: String(row.currency),
      status: String(row.status),
      customer_cash_balance: held?.cash ?? '0',
      savings_balance: held?.savings ?? '0',
      follow_reserve_balance: held?.follow ?? '0',
    };
  });

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
    note: 'Forex CUSTOMER_CASH, SAVINGS, and FOLLOW_RESERVE — crypto wallets excluded. MOCK/simulated reconciliation.',
  };
}
