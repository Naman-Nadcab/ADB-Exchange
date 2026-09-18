/**
 * Forex trading accounts — operator list with balances and activity signals.
 */
import { db } from '../../../lib/database.js';
import { customerCashBalanceFromDb } from '../ledger/persist.js';

export type ForexAdminTradingAccountRow = {
  account_id: string;
  user_id: string | null;
  currency: string;
  status: string;
  group_code: string | null;
  leverage_default: string | null;
  customer_cash_balance: string;
  open_positions: number;
  open_orders: number;
  last_activity_at: string | null;
  created_at: string | null;
};

export async function listForexAdminTradingAccounts(raw: {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
}): Promise<{
  rows: ForexAdminTradingAccountRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  note: string;
}> {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const q = (raw.q ?? '').trim();
  const status = (raw.status ?? '').trim().toUpperCase();

  const params: unknown[] = [];
  const where: string[] = ['1=1'];
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(fa.account_id ILIKE $${i} OR fa.user_id::text ILIKE $${i})`);
  }
  if (status) {
    params.push(status);
    where.push(`UPPER(fa.status) = $${params.length}`);
  }
  const whereSql = where.join(' AND ');

  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_accounts fa WHERE ${whereSql}`, params);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);

  const res = await db.query(
    `SELECT fa.account_id, fa.user_id, fa.currency, fa.status, fa.created_at,
            g.code AS group_code, g.leverage_default::text AS leverage_default,
            (SELECT COUNT(*)::int FROM forex_positions p WHERE p.account_id = fa.account_id AND p.status = 'OPEN') AS open_positions,
            (SELECT COUNT(*)::int FROM forex_orders o WHERE o.account_id = fa.account_id AND o.status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')) AS open_orders,
            (SELECT GREATEST(
               COALESCE((SELECT MAX(updated_at) FROM forex_positions WHERE account_id = fa.account_id), 'epoch'::timestamptz),
               COALESCE((SELECT MAX(updated_at) FROM forex_orders WHERE account_id = fa.account_id), 'epoch'::timestamptz)
             )) AS last_activity_at
     FROM forex_accounts fa
     LEFT JOIN forex_account_groups g ON g.group_id = fa.group_id
     WHERE ${whereSql}
     ORDER BY fa.account_id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const rows: ForexAdminTradingAccountRow[] = [];
  for (const r of res.rows as Record<string, unknown>[]) {
    const accountId = String(r.account_id);
    const balance = await customerCashBalanceFromDb(accountId);
    rows.push({
      account_id: accountId,
      user_id: r.user_id == null ? null : String(r.user_id),
      currency: String(r.currency),
      status: String(r.status),
      group_code: r.group_code == null ? null : String(r.group_code),
      leverage_default: r.leverage_default == null ? null : String(r.leverage_default),
      customer_cash_balance: balance,
      open_positions: Number(r.open_positions ?? 0) || 0,
      open_orders: Number(r.open_orders ?? 0) || 0,
      last_activity_at:
        r.last_activity_at instanceof Date
          ? r.last_activity_at.toISOString()
          : r.last_activity_at
            ? String(r.last_activity_at)
            : null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at ? String(r.created_at) : null,
    });
  }

  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    note: 'Balances from CUSTOMER_CASH ledger · isolated from crypto wallets',
  };
}
