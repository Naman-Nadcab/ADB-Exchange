/**
 * Admin Forex F6 — customer journal tail, forex config audit, user forex snapshot.
 */
import { db } from '../../../lib/database.js';

export type ForexAdminJournalQuery = {
  page: number;
  limit: number;
  offset: number;
  accountId: string | null;
};

export type ForexAdminAuditQuery = {
  page: number;
  limit: number;
  offset: number;
  action: string | null;
};

export type ForexAdminPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const FOREX_AUDIT_ACTIONS = [
  'forex_admin_control_update',
  'forex_instrument_trading_status',
  'forex_admin_policy_update',
  'forex_instrument_policy_update',
  'forex_lp_routing_update',
  'forex_real_forex_arm',
] as const;

const FOREX_AUDIT_RESOURCE_TYPES = [
  'forex_runtime',
  'forex_instrument',
  'forex_policy',
  'forex_routing',
] as const;

async function hasTable(name: string): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [name],
  );
  return res.rows.length > 0;
}

function parsePageLimit(raw: { page?: string; limit?: string }, maxLimit: number) {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
}

export function parseForexAdminJournalQuery(raw: {
  page?: string;
  limit?: string;
  account_id?: string;
}): ForexAdminJournalQuery {
  const { page, limit, offset } = parsePageLimit(raw, 100);
  const accountId = (raw.account_id ?? '').trim() || null;
  return { page, limit, offset, accountId };
}

export function parseForexAdminAuditQuery(raw: {
  page?: string;
  limit?: string;
  action?: string;
}): ForexAdminAuditQuery {
  const { page, limit, offset } = parsePageLimit(raw, 100);
  const action = (raw.action ?? '').trim() || null;
  return { page, limit, offset, action };
}

export type ForexAdminJournalRow = {
  id: string;
  account_id: string;
  severity: string;
  category: string;
  event_type: string;
  order_id: string | null;
  position_id: string | null;
  reference_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listForexAdminJournalEvents(
  q: ForexAdminJournalQuery,
): Promise<{ rows: ForexAdminJournalRow[]; pagination: ForexAdminPagination; tableReady: boolean }> {
  const tableReady = await hasTable('forex_journal_events');
  if (!tableReady) {
    return {
      rows: [],
      pagination: { page: q.page, limit: q.limit, total: 0, totalPages: 0 },
      tableReady: false,
    };
  }

  const params: unknown[] = [];
  let where = '1=1';
  if (q.accountId) {
    params.push(q.accountId);
    where += ` AND account_id = $${params.length}`;
  }

  const countRes = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_journal_events WHERE ${where}`,
    params,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / q.limit);

  params.push(q.limit, q.offset);
  const listRes = await db.query(
    `SELECT id, account_id, severity, category, event_type, order_id, position_id, reference_id, message, metadata, created_at
     FROM forex_journal_events
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const rows: ForexAdminJournalRow[] = listRes.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    account_id: String(r.account_id),
    severity: String(r.severity),
    category: String(r.category),
    event_type: String(r.event_type),
    order_id: r.order_id == null ? null : String(r.order_id),
    position_id: r.position_id == null ? null : String(r.position_id),
    reference_id: r.reference_id == null ? null : String(r.reference_id),
    message: String(r.message),
    metadata: typeof r.metadata === 'object' && r.metadata != null ? (r.metadata as Record<string, unknown>) : {},
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));

  return {
    rows,
    pagination: { page: q.page, limit: q.limit, total, totalPages },
    tableReady: true,
  };
}

export type ForexAdminAuditRow = {
  created_at: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_value: string | null;
  new_value: string | null;
  request_id: string | null;
};

export async function listForexAdminConfigAudit(
  q: ForexAdminAuditQuery,
): Promise<{ rows: ForexAdminAuditRow[]; pagination: ForexAdminPagination }> {
  const tableReady = await hasTable('audit_logs_immutable');
  if (!tableReady) {
    return {
      rows: [],
      pagination: { page: q.page, limit: q.limit, total: 0, totalPages: 0 },
    };
  }

  const params: unknown[] = [FOREX_AUDIT_ACTIONS, FOREX_AUDIT_RESOURCE_TYPES];
  let where = `(action = ANY($1) OR resource_type = ANY($2))`;
  if (q.action) {
    params.push(q.action);
    where += ` AND action = $${params.length}`;
  }

  const countRes = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM audit_logs_immutable WHERE ${where}`,
    params,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / q.limit);

  params.push(q.limit, q.offset);
  const listRes = await db.query(
    `SELECT created_at, actor_type, actor_id, action, resource_type, resource_id, old_value, new_value, request_id
     FROM audit_logs_immutable
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const rows: ForexAdminAuditRow[] = listRes.rows.map((r: Record<string, unknown>) => ({
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    actor_type: String(r.actor_type),
    actor_id: r.actor_id == null ? null : String(r.actor_id),
    action: String(r.action),
    resource_type: r.resource_type == null ? null : String(r.resource_type),
    resource_id: r.resource_id == null ? null : String(r.resource_id),
    old_value: r.old_value == null ? null : String(r.old_value),
    new_value: r.new_value == null ? null : String(r.new_value),
    request_id: r.request_id == null ? null : String(r.request_id),
  }));

  return { rows, pagination: { page: q.page, limit: q.limit, total, totalPages } };
}

export type ForexAdminUserForexSnapshot = {
  userId: string;
  accounts: Array<{
    account_id: string;
    currency: string;
    status: string;
    open_orders: number;
    open_positions: number;
  }>;
  journalTableReady: boolean;
  recentJournal: ForexAdminJournalRow[];
};

export async function loadForexAdminUserForexSnapshot(userId: string): Promise<ForexAdminUserForexSnapshot> {
  const uid = userId.trim();
  const acctRes = await db.query<{ account_id: string; currency: string; status: string }>(
    `SELECT account_id, currency, status FROM forex_accounts WHERE user_id = $1 ORDER BY account_id`,
    [uid],
  );

  const accounts: ForexAdminUserForexSnapshot['accounts'] = [];
  for (const row of acctRes.rows) {
    const accountId = String(row.account_id);
    const [orders, positions] = await Promise.all([
      db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM forex_orders
         WHERE account_id = $1 AND status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`,
        [accountId],
      ),
      db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
        [accountId],
      ),
    ]);
    accounts.push({
      account_id: accountId,
      currency: String(row.currency),
      status: String(row.status),
      open_orders: Number.parseInt(orders.rows[0]?.n ?? '0', 10) || 0,
      open_positions: Number.parseInt(positions.rows[0]?.n ?? '0', 10) || 0,
    });
  }

  const journalTableReady = await hasTable('forex_journal_events');
  let recentJournal: ForexAdminJournalRow[] = [];
  if (journalTableReady && accounts.length) {
    const accountIds = accounts.map((a) => a.account_id);
    const jRes = await db.query(
      `SELECT id, account_id, severity, category, event_type, order_id, position_id, reference_id, message, metadata, created_at
       FROM forex_journal_events
       WHERE account_id = ANY($1)
       ORDER BY created_at DESC
       LIMIT 15`,
      [accountIds],
    );
    recentJournal = jRes.rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      account_id: String(r.account_id),
      severity: String(r.severity),
      category: String(r.category),
      event_type: String(r.event_type),
      order_id: r.order_id == null ? null : String(r.order_id),
      position_id: r.position_id == null ? null : String(r.position_id),
      reference_id: r.reference_id == null ? null : String(r.reference_id),
      message: String(r.message),
      metadata: typeof r.metadata === 'object' && r.metadata != null ? (r.metadata as Record<string, unknown>) : {},
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  return { userId: uid, accounts, journalTableReady, recentJournal };
}
