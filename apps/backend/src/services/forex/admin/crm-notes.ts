/**
 * Forex CRM — client notes (operational layer on top of read model).
 */
import { db } from '../../../lib/database.js';

export type ForexCrmNoteRow = {
  note_id: string;
  account_id: string;
  body: string;
  visibility: string;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
};

export async function listForexCrmNotes(accountId: string, limit = 50): Promise<ForexCrmNoteRow[]> {
  const id = accountId.trim();
  if (!id) return [];
  const res = await db.query<{
    note_id: string;
    account_id: string;
    body: string;
    visibility: string;
    created_by_admin_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT note_id, account_id, body, visibility, created_by_admin_id, created_at, updated_at
     FROM forex_crm_notes
     WHERE account_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [id, Math.min(200, Math.max(1, limit))]
  );
  return res.rows.map((r) => ({
    note_id: String(r.note_id),
    account_id: String(r.account_id),
    body: String(r.body),
    visibility: String(r.visibility),
    created_by_admin_id: String(r.created_by_admin_id),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}

export async function createForexCrmNote(args: {
  accountId: string;
  userId?: string | null;
  body: string;
  visibility: 'internal' | 'compliance' | 'sales';
  adminId: string;
}): Promise<ForexCrmNoteRow> {
  const accountId = args.accountId.trim();
  const body = args.body.trim();
  if (!accountId || body.length < 1) {
    throw new Error('INVALID_NOTE');
  }
  const exists = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1 LIMIT 1`, [accountId]);
  if (!exists.rows.length) {
    throw new Error('ACCOUNT_NOT_FOUND');
  }
  const res = await db.query<{
    note_id: string;
    account_id: string;
    body: string;
    visibility: string;
    created_by_admin_id: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO forex_crm_notes (account_id, user_id, body, visibility, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5::uuid)
     RETURNING note_id, account_id, body, visibility, created_by_admin_id, created_at, updated_at`,
    [accountId, args.userId ?? null, body, args.visibility, args.adminId]
  );
  const row = res.rows[0]!;
  await db.query(
    `INSERT INTO forex_crm_activities (account_id, user_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, $2, 'note_created', $3, $4::uuid, $5::jsonb)`,
    [accountId, args.userId ?? null, 'CRM note added', args.adminId, JSON.stringify({ visibility: args.visibility })]
  );
  return {
    note_id: String(row.note_id),
    account_id: String(row.account_id),
    body: String(row.body),
    visibility: String(row.visibility),
    created_by_admin_id: String(row.created_by_admin_id),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
