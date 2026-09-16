/**
 * Admin Forex F2 — paginated read-only lists (orders, executions, positions).
 */
import { db } from '../../../lib/database.js';
import { FOREX_ORDER_STATES } from '../orders/states.js';
import { FOREX_EXECUTION_STATES } from '../execution/states.js';

export type ForexAdminListQuery = {
  page: number;
  limit: number;
  offset: number;
  symbol: string | null;
  status: string | null;
  accountId: string | null;
  side: string | null;
};

export type ForexAdminPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ORDER_STATUSES = new Set<string>(FOREX_ORDER_STATES);
const EXEC_STATUSES = new Set<string>(FOREX_EXECUTION_STATES);
const POSITION_STATUSES = new Set(['OPEN', 'CLOSED']);

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (v == null) return '';
  return String(v);
}

function numStr(v: unknown): string {
  if (v == null) return '0';
  return String(v);
}

export function parseForexAdminListQuery(raw: {
  page?: string;
  limit?: string;
  symbol?: string;
  status?: string;
  account_id?: string;
  side?: string;
}): ForexAdminListQuery {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const symbol = (raw.symbol ?? '').trim().toUpperCase() || null;
  const accountId = (raw.account_id ?? '').trim() || null;
  const sideRaw = (raw.side ?? '').trim().toLowerCase();
  const side = sideRaw === 'buy' || sideRaw === 'sell' ? sideRaw : null;
  let status = (raw.status ?? '').trim().toUpperCase() || null;
  if (status === 'OPEN') status = '__OPEN__';
  return { page, limit, offset: (page - 1) * limit, symbol, status, accountId, side };
}

export type ForexAdminOrderRow = {
  order_id: string;
  client_order_id: string;
  account_id: string;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  requested_volume: string;
  filled_volume: string;
  remaining_volume: string;
  requested_price: string | null;
  execution_id: string | null;
  failure_reason: string | null;
  execution_mode: string;
  created_at: string;
  updated_at: string;
};

export async function listForexAdminOrders(
  q: ForexAdminListQuery,
): Promise<{ rows: ForexAdminOrderRow[]; pagination: ForexAdminPagination }> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (q.symbol) {
    conditions.push(`symbol = $${i++}`);
    params.push(q.symbol);
  }
  if (q.accountId) {
    conditions.push(`account_id = $${i++}`);
    params.push(q.accountId);
  }
  if (q.side) {
    conditions.push(`side = $${i++}`);
    params.push(q.side);
  }
  if (q.status === '__OPEN__') {
    conditions.push(`status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`);
  } else if (q.status && ORDER_STATUSES.has(q.status)) {
    conditions.push(`status = $${i++}`);
    params.push(q.status);
  }

  const where = conditions.join(' AND ');
  const countRes = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_orders WHERE ${where}`, params);
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;

  params.push(q.limit, q.offset);
  const res = await db.query(
    `SELECT order_id, client_order_id, account_id, symbol, side, order_type, status,
            requested_volume, filled_volume, remaining_volume, requested_price,
            execution_id, failure_reason, execution_mode, created_at, updated_at
     FROM forex_orders
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    params,
  );

  const rows = (res.rows as Record<string, unknown>[]).map((r) => ({
    order_id: String(r.order_id),
    client_order_id: String(r.client_order_id),
    account_id: String(r.account_id),
    symbol: String(r.symbol),
    side: String(r.side),
    order_type: String(r.order_type),
    status: String(r.status),
    requested_volume: numStr(r.requested_volume),
    filled_volume: numStr(r.filled_volume),
    remaining_volume: numStr(r.remaining_volume),
    requested_price: r.requested_price != null ? numStr(r.requested_price) : null,
    execution_id: r.execution_id != null ? String(r.execution_id) : null,
    failure_reason: r.failure_reason != null ? String(r.failure_reason) : null,
    execution_mode: String(r.execution_mode ?? 'MOCK'),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }));

  return {
    rows,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / q.limit) : 0,
    },
  };
}

export type ForexAdminExecutionRow = {
  execution_id: string;
  client_exec_id: string;
  account_id: string | null;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  volume: string;
  filled_volume: string;
  remaining_volume: string;
  expected_price: string | null;
  execution_price: string | null;
  selected_provider: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function listForexAdminExecutions(
  q: ForexAdminListQuery,
): Promise<{ rows: ForexAdminExecutionRow[]; pagination: ForexAdminPagination }> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (q.symbol) {
    conditions.push(`symbol = $${i++}`);
    params.push(q.symbol);
  }
  if (q.accountId) {
    conditions.push(`account_id::text = $${i++}`);
    params.push(q.accountId);
  }
  if (q.side) {
    conditions.push(`side = $${i++}`);
    params.push(q.side);
  }
  if (q.status === '__OPEN__') {
    conditions.push(`status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`);
  } else if (q.status && EXEC_STATUSES.has(q.status)) {
    conditions.push(`status = $${i++}`);
    params.push(q.status);
  }

  const where = conditions.join(' AND ');
  const countRes = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_executions WHERE ${where}`, params);
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;

  params.push(q.limit, q.offset);
  const res = await db.query(
    `SELECT execution_id, client_exec_id, account_id, symbol, side, order_type, status,
            volume, filled_volume, remaining_volume, expected_price, execution_price,
            selected_provider, failure_reason, created_at, updated_at
     FROM forex_executions
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    params,
  );

  const rows = (res.rows as Record<string, unknown>[]).map((r) => ({
    execution_id: String(r.execution_id),
    client_exec_id: String(r.client_exec_id),
    account_id: r.account_id != null ? String(r.account_id) : null,
    symbol: String(r.symbol),
    side: String(r.side),
    order_type: String(r.order_type),
    status: String(r.status),
    volume: numStr(r.volume),
    filled_volume: numStr(r.filled_volume),
    remaining_volume: numStr(r.remaining_volume),
    expected_price: r.expected_price != null ? numStr(r.expected_price) : null,
    execution_price: r.execution_price != null ? numStr(r.execution_price) : null,
    selected_provider: r.selected_provider != null ? String(r.selected_provider) : null,
    failure_reason: r.failure_reason != null ? String(r.failure_reason) : null,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }));

  return {
    rows,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / q.limit) : 0,
    },
  };
}

export type ForexAdminPositionRow = {
  position_id: string;
  account_id: string;
  symbol: string;
  side: string;
  status: string;
  mode: string;
  volume: string;
  entry_price: string;
  current_price: string;
  leverage: string;
  exposure: string;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
};

export async function listForexAdminPositions(
  q: ForexAdminListQuery,
): Promise<{ rows: ForexAdminPositionRow[]; pagination: ForexAdminPagination }> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let i = 1;

  if (q.symbol) {
    conditions.push(`symbol = $${i++}`);
    params.push(q.symbol);
  }
  if (q.accountId) {
    conditions.push(`account_id = $${i++}`);
    params.push(q.accountId);
  }
  if (q.side) {
    const posSide = q.side === 'buy' ? 'long' : q.side === 'sell' ? 'short' : null;
    if (posSide) {
      conditions.push(`side = $${i++}`);
      params.push(posSide);
    }
  }
  if (q.status && POSITION_STATUSES.has(q.status)) {
    conditions.push(`status = $${i++}`);
    params.push(q.status);
  } else if (q.status === '__OPEN__') {
    conditions.push(`status = 'OPEN'`);
  }

  const where = conditions.join(' AND ');
  const countRes = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_positions WHERE ${where}`, params);
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;

  params.push(q.limit, q.offset);
  const res = await db.query(
    `SELECT position_id, account_id, symbol, side, status, mode, volume, entry_price,
            current_price, leverage, exposure, opened_at, updated_at, closed_at
     FROM forex_positions
     WHERE ${where}
     ORDER BY updated_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    params,
  );

  const rows = (res.rows as Record<string, unknown>[]).map((r) => ({
    position_id: String(r.position_id),
    account_id: String(r.account_id),
    symbol: String(r.symbol),
    side: String(r.side),
    status: String(r.status),
    mode: String(r.mode),
    volume: numStr(r.volume),
    entry_price: numStr(r.entry_price),
    current_price: numStr(r.current_price),
    leverage: numStr(r.leverage),
    exposure: numStr(r.exposure),
    opened_at: iso(r.opened_at),
    updated_at: iso(r.updated_at),
    closed_at: r.closed_at != null ? iso(r.closed_at) : null,
  }));

  return {
    rows,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / q.limit) : 0,
    },
  };
}
