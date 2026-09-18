/**
 * Admin Forex CRM S6 — unified activity timeline (orders, executions, journal).
 */
import { db } from '../../../lib/database.js';
import {
  listForexAdminExecutions,
  listForexAdminOrders,
  parseForexAdminListQuery,
} from './lists.js';
import { listForexAdminJournalEvents, parseForexAdminJournalQuery } from './journal-audit.js';
import { resolveForexCrmSectionAccess, scopeForexCrmClientActivity } from './crm-client-scope.js';

export type ForexAdminCrmActivityKind = 'order' | 'execution' | 'journal';

export type ForexAdminCrmActivityItem = {
  kind: ForexAdminCrmActivityKind;
  id: string;
  occurred_at: string;
  title: string;
  status: string;
  symbol: string | null;
  side: string | null;
  volume: string | null;
  detail: string | null;
  reference_id: string | null;
};

export type ForexAdminCrmClientActivitySnapshot = {
  account_id: string;
  items: ForexAdminCrmActivityItem[];
  limits: { orders: number; executions: number; journal: number };
  shortcuts: {
    orders_path: string;
    executions_path: string;
    journal_path: string;
    positions_path: string;
  };
};

function perSourceLimit(totalLimit: number): number {
  return Math.min(30, Math.max(5, Math.ceil(totalLimit / 3)));
}

export async function buildForexAdminCrmClientActivityScoped(
  accountId: string,
  adminRole: string,
  rawLimit?: string,
) {
  const snap = await buildForexAdminCrmClientActivity(accountId, rawLimit);
  if (!snap) return null;
  return scopeForexCrmClientActivity(snap, resolveForexCrmSectionAccess(adminRole));
}

export async function buildForexAdminCrmClientActivity(
  accountId: string,
  rawLimit?: string,
): Promise<ForexAdminCrmClientActivitySnapshot | null> {
  const id = accountId.trim();
  if (!id) return null;

  const exists = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1 LIMIT 1`, [id]);
  if (!exists.rows.length) return null;

  const totalLimit = Math.min(60, Math.max(10, Number.parseInt(rawLimit ?? '30', 10) || 30));
  const slice = perSourceLimit(totalLimit);

  const [orders, executions, journal] = await Promise.all([
    listForexAdminOrders(
      parseForexAdminListQuery({ page: '1', limit: String(slice), account_id: id }),
    ),
    listForexAdminExecutions(
      parseForexAdminListQuery({ page: '1', limit: String(slice), account_id: id }),
    ),
    listForexAdminJournalEvents(
      parseForexAdminJournalQuery({ page: '1', limit: String(slice), account_id: id }),
    ),
  ]);

  const items: ForexAdminCrmActivityItem[] = [];

  for (const o of orders.rows) {
    items.push({
      kind: 'order',
      id: o.order_id,
      occurred_at: o.created_at,
      title: `${o.order_type} ${o.side} ${o.symbol}`,
      status: o.status,
      symbol: o.symbol,
      side: o.side,
      volume: o.requested_volume,
      detail: o.failure_reason,
      reference_id: o.client_order_id,
    });
  }

  for (const e of executions.rows) {
    items.push({
      kind: 'execution',
      id: e.execution_id,
      occurred_at: e.created_at,
      title: `${e.order_type} ${e.side} ${e.symbol}`,
      status: e.status,
      symbol: e.symbol,
      side: e.side,
      volume: e.volume,
      detail: e.selected_provider,
      reference_id: e.client_exec_id,
    });
  }

  for (const j of journal.rows) {
    items.push({
      kind: 'journal',
      id: j.id,
      occurred_at: j.created_at,
      title: j.event_type,
      status: j.severity,
      symbol: null,
      side: null,
      volume: null,
      detail: j.message,
      reference_id: j.order_id ?? j.position_id,
    });
  }

  items.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));

  return {
    account_id: id,
    items: items.slice(0, totalLimit),
    limits: { orders: slice, executions: slice, journal: slice },
    shortcuts: {
      orders_path: `/forex/orders?account_id=${encodeURIComponent(id)}`,
      executions_path: `/forex/executions?account_id=${encodeURIComponent(id)}`,
      journal_path: `/forex/journal-audit?account_id=${encodeURIComponent(id)}`,
      positions_path: `/forex/positions?account_id=${encodeURIComponent(id)}`,
    },
  };
}
