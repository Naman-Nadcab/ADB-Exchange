/**
 * Admin Forex S7 — CRM finance desk (ledger balances, transactions, reconciliation).
 */
import { db } from '../../../lib/database.js';
import { customerCashBalanceFromDb } from '../ledger/persist.js';

export type ForexAdminFinancePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function clampPageLimit(raw: { page?: string; limit?: string }, maxLimit = 100) {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

async function hasTable(name: string): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [name],
  );
  return res.rows.length > 0;
}

export type ForexAdminFinanceAccountRow = {
  account_id: string;
  user_id: string | null;
  email: string | null;
  currency: string;
  account_status: string;
  customer_cash_balance: string;
  ledger_transaction_count: number;
  last_reconciliation_ok: boolean | null;
  last_reconciliation_at: string | null;
};

export type ForexAdminFinanceAccountsSnapshot = {
  rows: ForexAdminFinanceAccountRow[];
  pagination: ForexAdminFinancePagination;
  note: string;
};

function buildFinanceAccountFilters(raw: { q?: string; account_status?: string }): {
  whereSql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const search = (raw.q ?? '').trim().toLowerCase();
  if (search) {
    params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`);
    const i = params.length;
    clauses.push(`(
      LOWER(fa.account_id) LIKE $${i} ESCAPE '\\'
      OR LOWER(COALESCE(fa.user_id, '')) LIKE $${i} ESCAPE '\\'
      OR LOWER(COALESCE(u.email, '')) LIKE $${i} ESCAPE '\\'
    )`);
  }
  const st = (raw.account_status ?? '').trim();
  if (st) {
    params.push(st.toUpperCase());
    clauses.push(`UPPER(fa.status) = $${params.length}`);
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereSql, params };
}

export async function buildForexAdminFinanceAccountsSnapshot(raw: {
  page?: string;
  limit?: string;
  q?: string;
  account_status?: string;
}): Promise<ForexAdminFinanceAccountsSnapshot> {
  const { page, limit, offset } = clampPageLimit(raw);
  const { whereSql, params } = buildFinanceAccountFilters(raw);
  const countRes = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_accounts fa
     LEFT JOIN users u ON u.id::text = fa.user_id AND u.deleted_at IS NULL
     ${whereSql}`,
    params,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const listParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const reconTable = await hasTable('forex_reconciliation_events');
  const reconCols = reconTable
    ? `(
         SELECT fre.ok FROM forex_reconciliation_events fre
         WHERE fre.account_id = fa.account_id ORDER BY fre.created_at DESC LIMIT 1
       ) AS last_reconciliation_ok,
       (
         SELECT fre.created_at FROM forex_reconciliation_events fre
         WHERE fre.account_id = fa.account_id ORDER BY fre.created_at DESC LIMIT 1
       ) AS last_reconciliation_at`
    : `NULL::boolean AS last_reconciliation_ok, NULL::timestamptz AS last_reconciliation_at`;

  const listRes = await db.query(
    `SELECT
       fa.account_id,
       fa.user_id,
       fa.currency,
       fa.status AS account_status,
       u.email,
       COALESCE((
         SELECT SUM(fle.credit - fle.debit)
         FROM forex_ledger_entries fle
         WHERE fle.ledger_account = 'CUSTOMER_CASH' AND fle.account_id = fa.account_id
       ), 0)::text AS customer_cash_balance,
       COALESCE((
         SELECT COUNT(*)::text FROM forex_ledger_transactions flt WHERE flt.account_id = fa.account_id
       ), '0') AS ledger_transaction_count,
       ${reconCols}
     FROM forex_accounts fa
     LEFT JOIN users u ON u.id::text = fa.user_id AND u.deleted_at IS NULL
     ${whereSql}
     ORDER BY fa.account_id
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );

  const rows: ForexAdminFinanceAccountRow[] = listRes.rows.map((r: Record<string, unknown>) => ({
    account_id: String(r.account_id),
    user_id: r.user_id == null ? null : String(r.user_id),
    email: r.email == null ? null : String(r.email),
    currency: String(r.currency),
    account_status: String(r.account_status),
    customer_cash_balance: String(r.customer_cash_balance ?? '0'),
    ledger_transaction_count: Number.parseInt(String(r.ledger_transaction_count ?? '0'), 10) || 0,
    last_reconciliation_ok: r.last_reconciliation_ok == null ? null : Boolean(r.last_reconciliation_ok),
    last_reconciliation_at:
      r.last_reconciliation_at instanceof Date
        ? r.last_reconciliation_at.toISOString()
        : r.last_reconciliation_at == null
          ? null
          : String(r.last_reconciliation_at),
  }));

  return {
    rows,
    pagination: { page, limit, total, totalPages },
    note: 'Forex CUSTOMER_CASH only — crypto wallets and spot balances excluded.',
  };
}

export type ForexAdminFinanceReconciliationRow = {
  event_id: string;
  account_id: string;
  kind: string;
  ok: boolean;
  reason: string | null;
  detail: string | null;
  created_at: string;
};

export async function listForexAdminFinanceReconciliation(raw: {
  page?: string;
  limit?: string;
  account_id?: string;
  kind?: string;
  ok?: string;
}): Promise<{ rows: ForexAdminFinanceReconciliationRow[]; pagination: ForexAdminFinancePagination; tableReady: boolean }> {
  const { page, limit, offset } = clampPageLimit(raw, 100);
  const tableReady = await hasTable('forex_reconciliation_events');
  if (!tableReady) {
    return {
      rows: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
      tableReady: false,
    };
  }

  const params: unknown[] = [];
  const clauses: string[] = [];
  const accountId = (raw.account_id ?? '').trim();
  if (accountId) {
    params.push(accountId);
    clauses.push(`account_id = $${params.length}`);
  }
  const kind = (raw.kind ?? '').trim();
  if (kind) {
    params.push(kind);
    clauses.push(`kind = $${params.length}`);
  }
  const okRaw = (raw.ok ?? '').trim().toLowerCase();
  if (okRaw === '1' || okRaw === 'true' || okRaw === 'yes') {
    clauses.push(`ok = true`);
  } else if (okRaw === '0' || okRaw === 'false' || okRaw === 'no') {
    clauses.push(`ok = false`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const countRes = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_reconciliation_events ${where}`,
    params,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  params.push(limit, offset);
  const listRes = await db.query(
    `SELECT event_id, account_id, kind, ok, reason, detail, created_at
     FROM forex_reconciliation_events
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const rows: ForexAdminFinanceReconciliationRow[] = listRes.rows.map((r: Record<string, unknown>) => ({
    event_id: String(r.event_id),
    account_id: String(r.account_id),
    kind: String(r.kind),
    ok: Boolean(r.ok),
    reason: r.reason == null ? null : String(r.reason),
    detail: r.detail == null ? null : String(r.detail),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));

  return {
    rows,
    pagination: { page, limit, total, totalPages },
    tableReady: true,
  };
}

export type ForexAdminFinanceLedgerTxRow = {
  transaction_id: string;
  type: string;
  status: string;
  currency: string;
  customer_cash_delta: string;
  created_at: string;
  idempotency_key: string;
};

export type ForexAdminFinanceAccountDetail = {
  account_id: string;
  user_id: string | null;
  email: string | null;
  currency: string;
  account_status: string;
  customer_cash_balance: string;
  recent_transactions: ForexAdminFinanceLedgerTxRow[];
  recent_reconciliation: ForexAdminFinanceReconciliationRow[];
  shortcuts: {
    crm_client_path: string;
    ledger_path: string;
    journal_path: string;
  };
};

async function loadRecentLedgerTxRows(accountId: string, limit: number): Promise<ForexAdminFinanceLedgerTxRow[]> {
  const txRes = await db.query(
    `SELECT transaction_id, type, status, currency, created_at, idempotency_key
     FROM forex_ledger_transactions
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [accountId, limit],
  );
  if (!txRes.rows.length) return [];

  const ids = txRes.rows.map((r: Record<string, unknown>) => String(r.transaction_id));
  const eRes = await db.query(
    `SELECT transaction_id, debit, credit
     FROM forex_ledger_entries
     WHERE transaction_id = ANY($1::uuid[]) AND ledger_account = 'CUSTOMER_CASH' AND account_id = $2`,
    [ids, accountId],
  );
  const deltaByTx = new Map<string, string>();
  for (const e of eRes.rows as Record<string, unknown>[]) {
    const tid = String(e.transaction_id);
    const debit = Number(e.debit ?? 0);
    const credit = Number(e.credit ?? 0);
    deltaByTx.set(tid, String(credit - debit));
  }

  return txRes.rows.map((r: Record<string, unknown>) => {
    const tid = String(r.transaction_id);
    return {
      transaction_id: tid,
      type: String(r.type),
      status: String(r.status),
      currency: String(r.currency),
      customer_cash_delta: deltaByTx.get(tid) ?? '0',
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      idempotency_key: String(r.idempotency_key),
    };
  });
}

export async function buildForexAdminFinanceAccountDetail(
  accountId: string,
  txLimitRaw?: string,
): Promise<ForexAdminFinanceAccountDetail | null> {
  const id = accountId.trim();
  if (!id) return null;

  const acctRes = await db.query(
    `SELECT fa.account_id, fa.user_id, fa.currency, fa.status AS account_status, u.email
     FROM forex_accounts fa
     LEFT JOIN users u ON u.id::text = fa.user_id AND u.deleted_at IS NULL
     WHERE fa.account_id = $1 LIMIT 1`,
    [id],
  );
  if (!acctRes.rows.length) return null;
  const row = acctRes.rows[0] as Record<string, unknown>;

  const txLimit = Math.min(50, Math.max(5, Number.parseInt(txLimitRaw ?? '20', 10) || 20));
  const balance = await customerCashBalanceFromDb(id);
  const recent_transactions = await loadRecentLedgerTxRows(id, txLimit);
  const recon = await listForexAdminFinanceReconciliation({
    page: '1',
    limit: '10',
    account_id: id,
  });

  return {
    account_id: id,
    user_id: row.user_id == null ? null : String(row.user_id),
    email: row.email == null ? null : String(row.email),
    currency: String(row.currency),
    account_status: String(row.account_status),
    customer_cash_balance: balance,
    recent_transactions,
    recent_reconciliation: recon.rows,
    shortcuts: {
      crm_client_path: `/forex/crm/clients/${encodeURIComponent(id)}`,
      ledger_path: '/forex/ledger',
      journal_path: `/forex/journal-audit?account_id=${encodeURIComponent(id)}`,
    },
  };
}
