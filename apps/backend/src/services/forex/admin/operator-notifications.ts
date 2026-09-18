/**
 * Unified Forex operator notification center (in-app; not end-user push).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';

export type ForexOperatorNotification = {
  notification_id: string;
  category: string;
  severity: string;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: string | null;
  owner_admin_id: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

export async function createForexOperatorNotification(input: {
  category: string;
  severity?: 'info' | 'warning' | 'critical';
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
  ownerAdminId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO forex_operator_notifications (
       notification_id, category, severity, title, body, resource_type, resource_id, owner_admin_id, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::uuid,$9::jsonb)`,
    [
      id,
      input.category,
      input.severity ?? 'info',
      input.title.slice(0, 256),
      input.body ?? null,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.ownerAdminId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return id;
}

export async function listForexOperatorNotifications(raw: {
  page?: string;
  limit?: string;
  category?: string;
  unresolved_only?: string;
}): Promise<{ rows: ForexOperatorNotification[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (raw.category?.trim()) {
    params.push(raw.category.trim());
    clauses.push(`category = $${params.length}`);
  }
  if (raw.unresolved_only === '1' || raw.unresolved_only === 'true') {
    clauses.push('resolved_at IS NULL');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_operator_notifications ${where}`, params);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT notification_id, category, severity, title, body, resource_type, resource_id,
            owner_admin_id, acknowledged_at, resolved_at, created_at
     FROM forex_operator_notifications ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const rows = res.rows.map((r: Record<string, unknown>) => ({
    notification_id: String(r.notification_id),
    category: String(r.category),
    severity: String(r.severity),
    title: String(r.title),
    body: r.body == null ? null : String(r.body),
    resource_type: r.resource_type == null ? null : String(r.resource_type),
    resource_id: r.resource_id == null ? null : String(r.resource_id),
    owner_admin_id: r.owner_admin_id == null ? null : String(r.owner_admin_id),
    acknowledged_at: r.acknowledged_at instanceof Date ? r.acknowledged_at.toISOString() : r.acknowledged_at == null ? null : String(r.acknowledged_at),
    resolved_at: r.resolved_at instanceof Date ? r.resolved_at.toISOString() : r.resolved_at == null ? null : String(r.resolved_at),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
  return { rows, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function acknowledgeForexOperatorNotification(notificationId: string, adminId: string): Promise<void> {
  const res = await db.query(
    `UPDATE forex_operator_notifications
     SET acknowledged_at = COALESCE(acknowledged_at, NOW()), acknowledged_by = COALESCE(acknowledged_by, $2::uuid)
     WHERE notification_id = $1::uuid AND resolved_at IS NULL`,
    [notificationId, adminId],
  );
  if ((res.rowCount ?? 0) === 0) throw new Error('NOTIFICATION_NOT_FOUND');
}

export async function resolveForexOperatorNotification(notificationId: string, adminId: string): Promise<void> {
  const res = await db.query(
    `UPDATE forex_operator_notifications
     SET resolved_at = NOW(), resolved_by = $2::uuid
     WHERE notification_id = $1::uuid AND resolved_at IS NULL`,
    [notificationId, adminId],
  );
  if ((res.rowCount ?? 0) === 0) throw new Error('NOTIFICATION_NOT_FOUND');
}
