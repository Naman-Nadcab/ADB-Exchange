/**
 * Forex CRM tasks — operational follow-ups (no external comms).
 */
import { db } from '../../../lib/database.js';

const TASK_TYPES = new Set(['CALL', 'EMAIL', 'FOLLOW_UP', 'KYC_FOLLOWUP', 'FUNDING_FOLLOWUP', 'RETENTION', 'OTHER']);

export type ForexCrmTaskRow = {
  task_id: string;
  account_id: string | null;
  lead_id: string | null;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  due_at: string | null;
  owner_admin_id: string | null;
  created_at: string;
};

export async function createForexCrmTask(args: {
  title: string;
  task_type?: string;
  account_id?: string;
  lead_id?: string;
  owner_admin_id?: string;
  due_at?: string;
  description?: string;
  adminId: string;
}): Promise<ForexCrmTaskRow> {
  const title = args.title.trim();
  if (title.length < 2) throw new Error('INVALID_TITLE');
  const taskType = (args.task_type ?? 'OTHER').toUpperCase();
  if (!TASK_TYPES.has(taskType)) throw new Error('INVALID_TASK_TYPE');

  const res = await db.query(
    `INSERT INTO forex_crm_tasks (account_id, lead_id, title, description, task_type, owner_admin_id, created_by_admin_id, due_at)
     VALUES ($1, $2::uuid, $3, $4, $5, $6::uuid, $7::uuid, $8::timestamptz)
     RETURNING *`,
    [
      args.account_id ?? null,
      args.lead_id ?? null,
      title,
      args.description ?? null,
      taskType,
      args.owner_admin_id ?? null,
      args.adminId,
      args.due_at ?? null,
    ]
  );
  const r = res.rows[0] as Record<string, unknown>;
  await db.query(
    `INSERT INTO forex_crm_activities (account_id, lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, $2::uuid, 'task_created', $3, $4::uuid, $5::jsonb)`,
    [args.account_id ?? null, args.lead_id ?? null, `Task: ${title}`, args.adminId, JSON.stringify({ task_type: taskType })]
  );
  return mapTaskRow(r);
}

function mapTaskRow(r: Record<string, unknown>): ForexCrmTaskRow {
  return {
    task_id: String(r.task_id),
    account_id: r.account_id == null ? null : String(r.account_id),
    lead_id: r.lead_id == null ? null : String(r.lead_id),
    title: String(r.title),
    task_type: String(r.task_type ?? 'OTHER'),
    status: String(r.status),
    priority: 'normal',
    due_at: r.due_at instanceof Date ? r.due_at.toISOString() : r.due_at ? String(r.due_at) : null,
    owner_admin_id: r.owner_admin_id == null ? null : String(r.owner_admin_id),
    created_at: (r.created_at as Date).toISOString(),
  };
}

export async function listForexCrmTasks(query: {
  page?: string;
  limit?: string;
  status?: string;
  owner_admin_id?: string;
  lead_id?: string;
  account_id?: string;
  q?: string;
  overdue?: string;
}): Promise<{ rows: ForexCrmTaskRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, val: unknown) => {
    params.push(val);
    clauses.push(sql.replace('$?', `$${params.length}`));
  };
  if (query.status?.trim()) add('t.status = $?', query.status.trim());
  if (query.owner_admin_id?.trim()) add('t.owner_admin_id = $?::uuid', query.owner_admin_id.trim());
  if (query.lead_id?.trim()) add('t.lead_id = $?::uuid', query.lead_id.trim());
  if (query.account_id?.trim()) add('t.account_id = $?', query.account_id.trim());
  if (query.overdue === 'true' || query.overdue === '1') {
    clauses.push(`t.due_at IS NOT NULL AND t.due_at < NOW() AND t.status IN ('open','in_progress')`);
  }
  const search = (query.q ?? '').trim();
  if (search) {
    params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`);
    const i = params.length;
    clauses.push(`(t.title ILIKE $${i} ESCAPE '\\' OR t.task_id::text ILIKE $${i} ESCAPE '\\')`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_crm_tasks t ${where}`, [...params]);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT t.* FROM forex_crm_tasks t ${where} ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    rows: res.rows.map((r) => mapTaskRow(r as Record<string, unknown>)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function completeForexCrmTask(args: {
  taskId: string;
  adminId: string;
}): Promise<void> {
  const res = await db.query(
    `UPDATE forex_crm_tasks
     SET status = 'done', completed_at = NOW(), updated_at = NOW()
     WHERE task_id = $1::uuid AND status IN ('open','in_progress')
     RETURNING task_id, account_id, lead_id, title`,
    [args.taskId]
  );
  if (!res.rows.length) throw new Error('TASK_NOT_FOUND_OR_DONE');
  const row = res.rows[0] as { account_id: string | null; lead_id: string | null; title: string };
  await db.query(
    `INSERT INTO forex_crm_activities (account_id, lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, $2::uuid, 'task_completed', $3, $4::uuid, $5::jsonb)`,
    [row.account_id, row.lead_id, `Task completed: ${row.title}`, args.adminId, JSON.stringify({ task_id: args.taskId })]
  );
}

export async function reassignForexCrmTask(args: {
  taskId: string;
  ownerAdminId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  if (args.reason.trim().length < 8) throw new Error('REASON_REQUIRED');
  const prev = await db.query<{ owner_admin_id: string | null; account_id: string | null; lead_id: string | null }>(
    `SELECT owner_admin_id, account_id, lead_id FROM forex_crm_tasks WHERE task_id = $1::uuid`,
    [args.taskId]
  );
  if (!prev.rows.length) throw new Error('TASK_NOT_FOUND');
  await db.query(
    `UPDATE forex_crm_tasks SET owner_admin_id = $2::uuid, updated_at = NOW() WHERE task_id = $1::uuid`,
    [args.taskId, args.ownerAdminId]
  );
  const p = prev.rows[0]!;
  await db.query(
    `INSERT INTO forex_crm_activities (account_id, lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, $2::uuid, 'task_reassigned', $3, $4::uuid, $5::jsonb)`,
    [
      p.account_id,
      p.lead_id,
      'Task reassigned',
      args.adminId,
      JSON.stringify({ previous_owner: p.owner_admin_id, new_owner: args.ownerAdminId, reason: args.reason }),
    ]
  );
}
