/**
 * Forex admin audit search (immutable audit_logs_immutable).
 */
import { db } from '../../../lib/database.js';

export async function searchForexAdminAudit(raw: {
  q?: string;
  domain?: string;
  actor_id?: string;
  resource_type?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}) {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const clauses: string[] = [];

  const q = (raw.q ?? '').trim();
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
    const i = params.length;
    clauses.push(
      `(action ILIKE $${i} ESCAPE '\\' OR resource_type ILIKE $${i} ESCAPE '\\' OR resource_id::text ILIKE $${i} ESCAPE '\\' OR COALESCE(new_value,'') ILIKE $${i} ESCAPE '\\' OR COALESCE(old_value,'') ILIKE $${i} ESCAPE '\\')`,
    );
  }
  if (raw.actor_id?.trim()) {
    params.push(raw.actor_id.trim());
    clauses.push(`actor_id::text = $${params.length}`);
  }
  if (raw.resource_type?.trim()) {
    params.push(raw.resource_type.trim());
    clauses.push(`resource_type = $${params.length}`);
  }
  if (raw.from?.trim()) {
    params.push(raw.from.trim());
    clauses.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (raw.to?.trim()) {
    params.push(raw.to.trim());
    clauses.push(`created_at <= $${params.length}::timestamptz`);
  }
  const forexDomains = [
    'forex_%',
    'forex_order',
    'forex_account',
    'forex_finance_request',
    'forex_crm_%',
    'forex_dealer_%',
    'forex_compliance_%',
  ];
  if (raw.domain === 'forex') {
    clauses.push(`(resource_type LIKE 'forex_%' OR action LIKE 'forex_%')`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM audit_logs_immutable ${where}`, params);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT id, actor_type, actor_id, action, resource_type, resource_id, created_at
     FROM audit_logs_immutable ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    rows: res.rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    note: 'Immutable chain; domain filter forex uses resource_type/action prefixes',
    forex_domain_patterns: forexDomains,
  };
}
