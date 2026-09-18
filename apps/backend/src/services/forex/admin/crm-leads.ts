/**
 * Forex CRM — lead lifecycle (configurable stages).
 */
import { db } from '../../../lib/database.js';

export type ForexCrmLeadRow = {
  lead_id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  stage_id: string;
  status: string;
  priority: string;
  owner_admin_id: string | null;
  campaign_code: string | null;
  follow_up_at: string | null;
  created_at: string;
};

export async function listForexCrmLeadStages(): Promise<Array<{ stage_id: string; label: string; sort_order: number }>> {
  const res = await db.query<{ stage_id: string; label: string; sort_order: number }>(
    `SELECT stage_id, label, sort_order FROM forex_crm_lead_stages ORDER BY sort_order, stage_id`
  );
  return res.rows.map((r) => ({
    stage_id: String(r.stage_id),
    label: String(r.label),
    sort_order: Number(r.sort_order) || 0,
  }));
}

export type ForexCrmLeadListRow = ForexCrmLeadRow & {
  source_id: string | null;
  converted_account_id: string | null;
  last_activity_at: string | null;
  next_task_at: string | null;
};

export type ForexCrmLeadListQuery = {
  page?: string;
  limit?: string;
  stage_id?: string;
  owner_admin_id?: string;
  status?: string;
  priority?: string;
  campaign_code?: string;
  q?: string;
  created_from?: string;
  created_to?: string;
};

function buildForexCrmLeadListWhere(query: ForexCrmLeadListQuery): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, val: unknown) => {
    params.push(val);
    clauses.push(sql.replace('$?', `$${params.length}`));
  };
  if (query.stage_id?.trim()) add('l.stage_id = $?', query.stage_id.trim());
  if (query.owner_admin_id?.trim()) add('l.owner_admin_id = $?::uuid', query.owner_admin_id.trim());
  if (query.status?.trim()) add('l.status = $?', query.status.trim());
  if (query.priority?.trim()) add('l.priority = $?', query.priority.trim());
  if (query.campaign_code?.trim()) add('l.campaign_code ILIKE $?', `%${query.campaign_code.trim()}%`);
  const search = (query.q ?? '').trim();
  if (search) {
    params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`);
    const i = params.length;
    clauses.push(`(
      l.lead_id::text ILIKE $${i} ESCAPE '\\'
      OR COALESCE(l.full_name, '') ILIKE $${i} ESCAPE '\\'
      OR COALESCE(l.email, '') ILIKE $${i} ESCAPE '\\'
      OR COALESCE(l.phone, '') ILIKE $${i} ESCAPE '\\'
    )`);
  }
  if (query.created_from?.trim()) add('l.created_at >= $?::timestamptz', query.created_from.trim());
  if (query.created_to?.trim()) add('l.created_at <= $?::timestamptz', query.created_to.trim());
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

export type ForexCrmLeadSummary = {
  total: number;
  open: number;
  converted: number;
  lost: number;
  by_stage: Array<{ stage_id: string; count: number }>;
  kyc_started: number;
  scope: 'filtered';
};

export async function summarizeForexCrmLeads(query: ForexCrmLeadListQuery): Promise<ForexCrmLeadSummary> {
  const { where, params } = buildForexCrmLeadListWhere(query);
  const statusRes = await db.query<{ status: string; n: string }>(
    `SELECT l.status, COUNT(*)::text AS n FROM forex_crm_leads l ${where} GROUP BY l.status`,
    params,
  );
  let open = 0;
  let converted = 0;
  let lost = 0;
  for (const row of statusRes.rows) {
    const n = Number.parseInt(row.n, 10) || 0;
    if (row.status === 'open') open += n;
    else if (row.status === 'converted') converted += n;
    else if (row.status === 'lost') lost += n;
  }
  const stageRes = await db.query<{ stage_id: string; n: string }>(
    `SELECT l.stage_id, COUNT(*)::text AS n FROM forex_crm_leads l ${where} GROUP BY l.stage_id`,
    params,
  );
  const by_stage = stageRes.rows.map((r) => ({
    stage_id: String(r.stage_id),
    count: Number.parseInt(r.n, 10) || 0,
  }));
  const kyc_started = by_stage.find((s) => s.stage_id === 'kyc_started')?.count ?? 0;
  return {
    total: open + converted + lost,
    open,
    converted,
    lost,
    by_stage,
    kyc_started,
    scope: 'filtered',
  };
}

export async function listForexCrmLeads(
  query: ForexCrmLeadListQuery,
): Promise<{ rows: ForexCrmLeadListRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const { where, params } = buildForexCrmLeadListWhere(query);
  const countParams = [...params];
  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_crm_leads l ${where}`, countParams);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT l.*,
       (SELECT MAX(a.created_at) FROM forex_crm_activities a WHERE a.lead_id = l.lead_id) AS last_activity_at,
       (SELECT MIN(t.due_at) FROM forex_crm_tasks t WHERE t.lead_id = l.lead_id AND t.status = 'open' AND t.due_at IS NOT NULL) AS next_task_at
     FROM forex_crm_leads l
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const rows: ForexCrmLeadListRow[] = res.rows.map((r: Record<string, unknown>) => ({
    lead_id: String(r.lead_id),
    email: r.email == null ? null : String(r.email),
    phone: r.phone == null ? null : String(r.phone),
    full_name: r.full_name == null ? null : String(r.full_name),
    stage_id: String(r.stage_id),
    status: String(r.status),
    priority: String(r.priority),
    owner_admin_id: r.owner_admin_id == null ? null : String(r.owner_admin_id),
    campaign_code: r.campaign_code == null ? null : String(r.campaign_code),
    follow_up_at: r.follow_up_at instanceof Date ? r.follow_up_at.toISOString() : r.follow_up_at ? String(r.follow_up_at) : null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    source_id: r.source_id == null ? null : String(r.source_id),
    converted_account_id: r.converted_account_id == null ? null : String(r.converted_account_id),
    last_activity_at:
      r.last_activity_at instanceof Date
        ? r.last_activity_at.toISOString()
        : r.last_activity_at
          ? String(r.last_activity_at)
          : null,
    next_task_at:
      r.next_task_at instanceof Date
        ? r.next_task_at.toISOString()
        : r.next_task_at
          ? String(r.next_task_at)
          : null,
  }));
  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function createForexCrmLead(args: {
  email?: string;
  phone?: string;
  full_name?: string;
  stage_id?: string;
  source_code?: string;
  campaign_code?: string;
  owner_admin_id?: string;
  adminId: string;
}): Promise<ForexCrmLeadRow> {
  const stageId = (args.stage_id ?? 'new').trim();
  await assertLeadStage(stageId);
  const email = args.email?.trim() || null;
  const phone = args.phone?.trim() || null;
  if (!email && !phone && !(args.full_name?.trim())) {
    throw new Error('IDENTITY_REQUIRED');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('INVALID_EMAIL');
  }
  if (email) {
    const dup = await db.query(
      `SELECT lead_id FROM forex_crm_leads
       WHERE status = 'open' AND LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
      [email]
    );
    if (dup.rows.length) throw new Error('DUPLICATE_OPEN_LEAD_EMAIL');
  }
  if (phone) {
    const dup = await db.query(
      `SELECT lead_id FROM forex_crm_leads
       WHERE status = 'open' AND TRIM(phone) = TRIM($1) LIMIT 1`,
      [phone]
    );
    if (dup.rows.length) throw new Error('DUPLICATE_OPEN_LEAD_PHONE');
  }
  const res = await db.query(
    `INSERT INTO forex_crm_leads (email, phone, full_name, stage_id, campaign_code, owner_admin_id, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::uuid)
     RETURNING *`,
    [
      email,
      phone,
      args.full_name?.trim() || null,
      stageId,
      args.campaign_code?.trim() || null,
      args.owner_admin_id || null,
      args.adminId,
    ]
  );
  const r = res.rows[0] as Record<string, unknown>;
  await db.query(
    `INSERT INTO forex_crm_activities (lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1::uuid, 'lead_created', $2, $3::uuid, $4::jsonb)`,
    [r.lead_id, 'Lead created', args.adminId, JSON.stringify({ stage_id: stageId, source_code: args.source_code ?? null })]
  );
  return {
    lead_id: String(r.lead_id),
    email: r.email == null ? null : String(r.email),
    phone: r.phone == null ? null : String(r.phone),
    full_name: r.full_name == null ? null : String(r.full_name),
    stage_id: String(r.stage_id),
    status: String(r.status),
    priority: String(r.priority),
    owner_admin_id: r.owner_admin_id == null ? null : String(r.owner_admin_id),
    campaign_code: r.campaign_code == null ? null : String(r.campaign_code),
    follow_up_at: null,
    created_at: (r.created_at as Date).toISOString(),
  };
}

export async function assignForexCrmLead(args: {
  leadId: string;
  ownerAdminId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const prev = await db.query<{ owner_admin_id: string | null }>(
    `SELECT owner_admin_id FROM forex_crm_leads WHERE lead_id = $1::uuid`,
    [args.leadId]
  );
  if (!prev.rows.length) throw new Error('LEAD_NOT_FOUND');
  await db.query(
    `UPDATE forex_crm_leads SET owner_admin_id = $2::uuid, updated_at = NOW() WHERE lead_id = $1::uuid`,
    [args.leadId, args.ownerAdminId]
  );
  await db.query(
    `INSERT INTO forex_crm_activities (lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1::uuid, 'lead_assigned', $2, $3::uuid, $4::jsonb)`,
    [
      args.leadId,
      'Lead reassigned',
      args.adminId,
      JSON.stringify({
        previous_owner: prev.rows[0]!.owner_admin_id,
        new_owner: args.ownerAdminId,
        reason: args.reason,
      }),
    ]
  );
}

export async function getForexCrmLeadDetail(leadId: string): Promise<Record<string, unknown> | null> {
  const res = await db.query(`SELECT * FROM forex_crm_leads WHERE lead_id = $1::uuid`, [leadId]);
  if (!res.rows.length) return null;
  const activities = await db.query(
    `SELECT activity_id, kind, summary, metadata, actor_admin_id, created_at
     FROM forex_crm_activities WHERE lead_id = $1::uuid ORDER BY created_at DESC LIMIT 50`,
    [leadId]
  );
  const tasks = await db.query(
    `SELECT task_id, title, status, task_type, due_at, owner_admin_id, created_at
     FROM forex_crm_tasks WHERE lead_id = $1::uuid ORDER BY created_at DESC LIMIT 25`,
    [leadId]
  );
  const row = res.rows[0] as Record<string, unknown>;
  return {
    ...row,
    activities: activities.rows,
    tasks: tasks.rows,
  };
}

async function assertLeadStage(stageId: string): Promise<void> {
  const s = await db.query(`SELECT 1 FROM forex_crm_lead_stages WHERE stage_id = $1`, [stageId]);
  if (!s.rows.length) throw new Error('INVALID_STAGE');
}

export async function updateForexCrmLeadStage(args: {
  leadId: string;
  stageId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  await assertLeadStage(args.stageId);
  const prev = await db.query<{ stage_id: string }>(`SELECT stage_id FROM forex_crm_leads WHERE lead_id = $1::uuid`, [args.leadId]);
  if (!prev.rows.length) throw new Error('LEAD_NOT_FOUND');
  await db.query(`UPDATE forex_crm_leads SET stage_id = $2, updated_at = NOW() WHERE lead_id = $1::uuid`, [
    args.leadId,
    args.stageId,
  ]);
  await db.query(
    `INSERT INTO forex_crm_activities (lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1::uuid, 'lead_stage_change', $2, $3::uuid, $4::jsonb)`,
    [
      args.leadId,
      'Lead stage updated',
      args.adminId,
      JSON.stringify({ previous: prev.rows[0]!.stage_id, next: args.stageId, reason: args.reason }),
    ]
  );
}

export async function updateForexCrmLeadFields(args: {
  leadId: string;
  adminId: string;
  priority?: string;
  status?: string;
  follow_up_at?: string | null;
}): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [args.leadId];
  if (args.priority) {
    params.push(args.priority);
    fields.push(`priority = $${params.length}`);
  }
  if (args.status) {
    params.push(args.status);
    fields.push(`status = $${params.length}`);
  }
  if (args.follow_up_at !== undefined) {
    params.push(args.follow_up_at);
    fields.push(`follow_up_at = $${params.length}::timestamptz`);
  }
  if (!fields.length) throw new Error('NO_CHANGES');
  fields.push('updated_at = NOW()');
  const res = await db.query(
    `UPDATE forex_crm_leads SET ${fields.join(', ')} WHERE lead_id = $1::uuid RETURNING lead_id`,
    params
  );
  if (!res.rows.length) throw new Error('LEAD_NOT_FOUND');
  await db.query(
    `INSERT INTO forex_crm_activities (lead_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1::uuid, 'lead_updated', $2, $3::uuid, $4::jsonb)`,
    [args.leadId, 'Lead fields updated', args.adminId, JSON.stringify({ priority: args.priority, status: args.status })]
  );
}

export type ForexLeadConversionResult = {
  lead_id: string;
  user_id: string;
  account_id: string;
  idempotent: boolean;
};

export async function convertForexCrmLead(args: {
  leadId: string;
  adminId: string;
  reason: string;
  user_id?: string;
}): Promise<ForexLeadConversionResult> {
  const leadRes = await db.query<{
    email: string | null;
    status: string;
    converted_account_id: string | null;
    user_id: string | null;
    owner_admin_id: string | null;
    campaign_code: string | null;
  }>(`SELECT email, status, converted_account_id, user_id, owner_admin_id, campaign_code FROM forex_crm_leads WHERE lead_id = $1::uuid`, [
    args.leadId,
  ]);
  const lead = leadRes.rows[0];
  if (!lead) throw new Error('LEAD_NOT_FOUND');

  if (lead.status === 'converted' && lead.converted_account_id) {
    const uid = lead.user_id ?? lead.converted_account_id;
    return { lead_id: args.leadId, user_id: String(uid), account_id: String(lead.converted_account_id), idempotent: true };
  }

  let userId = (args.user_id ?? lead.user_id ?? '').trim();
  if (!userId && lead.email) {
    const u = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
      [lead.email]
    );
    if (u.rows.length) userId = String(u.rows[0]!.id);
  }
  if (!userId) throw new Error('USER_NOT_RESOLVED');

  const dupLead = await db.query(
    `SELECT lead_id FROM forex_crm_leads
     WHERE status = 'converted' AND user_id = $1 AND lead_id <> $2::uuid LIMIT 1`,
    [userId, args.leadId]
  );
  if (dupLead.rows.length) throw new Error('DUPLICATE_CONVERTED_LEAD');

  const accountId = userId;
  const existingAcct = await db.query(`SELECT account_id FROM forex_accounts WHERE account_id = $1`, [accountId]);
  if (!existingAcct.rows.length) {
    await db.query(
      `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode)
       VALUES ($1, $2, 'USD', 'ACTIVE', 'NETTING')
       ON CONFLICT (account_id) DO NOTHING`,
      [accountId, userId]
    );
  }

  await db.query(
    `UPDATE forex_crm_leads
     SET status = 'converted', user_id = $2, converted_account_id = $3, stage_id = 'account_created', updated_at = NOW()
     WHERE lead_id = $1::uuid`,
    [args.leadId, userId, accountId]
  );

  await db.query(
    `INSERT INTO forex_crm_client_profiles (account_id, user_id, lead_id, assigned_sales_admin_id, campaign_code, source_code)
     VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6)
     ON CONFLICT (account_id) DO UPDATE SET
       lead_id = EXCLUDED.lead_id,
       assigned_sales_admin_id = COALESCE(forex_crm_client_profiles.assigned_sales_admin_id, EXCLUDED.assigned_sales_admin_id),
       updated_at = NOW()`,
    [accountId, userId, args.leadId, lead.owner_admin_id, lead.campaign_code, null]
  );

  await db.query(
    `INSERT INTO forex_crm_activities (lead_id, account_id, user_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1::uuid, $2, $3, 'lead_converted', $4, $5::uuid, $6::jsonb)`,
    [args.leadId, accountId, userId, 'Lead converted to Forex account', args.adminId, JSON.stringify({ reason: args.reason })]
  );

  return { lead_id: args.leadId, user_id: userId, account_id: accountId, idempotent: false };
}
