/**
 * Forex compliance case management (manual review; external providers NOT_CONNECTED).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';

export async function listForexComplianceCases(raw: {
  page?: string;
  limit?: string;
  status?: string;
  subject_id?: string;
}) {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (raw.status?.trim()) {
    params.push(raw.status.trim().toUpperCase());
    clauses.push(`status = $${params.length}`);
  }
  if (raw.subject_id?.trim()) {
    params.push(raw.subject_id.trim());
    clauses.push(`subject_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_compliance_cases ${where}`, params);
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT case_id, subject_type, subject_id, case_type, status, priority, summary, assignee_admin_id, created_at
     FROM forex_compliance_cases ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows: res.rows, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function createForexComplianceCase(input: {
  subjectType: 'CLIENT' | 'ACCOUNT' | 'LEAD';
  subjectId: string;
  caseType: string;
  summary: string;
  priority?: string;
  openedBy: string;
}) {
  const summary = input.summary.trim();
  if (summary.length < 8) throw new Error('SUMMARY_REQUIRED');
  const id = randomUUID();
  await db.query(
    `INSERT INTO forex_compliance_cases (case_id, subject_type, subject_id, case_type, summary, priority, opened_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::uuid)`,
    [id, input.subjectType, input.subjectId.trim(), input.caseType.trim(), summary, input.priority ?? 'medium', input.openedBy],
  );
  return { case_id: id };
}

export async function assignForexComplianceCase(caseId: string, assigneeAdminId: string) {
  const res = await db.query(
    `UPDATE forex_compliance_cases SET assignee_admin_id = $2::uuid, updated_at = NOW()
     WHERE case_id = $1::uuid AND status IN ('OPEN','IN_REVIEW','ESCALATED')`,
    [caseId, assigneeAdminId],
  );
  if ((res.rowCount ?? 0) === 0) throw new Error('CASE_NOT_FOUND');
}

const CASE_STATUSES = new Set(['OPEN', 'IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED']);
const CASE_TRANSITIONS: Record<string, Set<string>> = {
  OPEN: new Set(['IN_REVIEW', 'ESCALATED', 'CLOSED']),
  IN_REVIEW: new Set(['ESCALATED', 'RESOLVED', 'CLOSED']),
  ESCALATED: new Set(['IN_REVIEW', 'RESOLVED', 'CLOSED']),
  RESOLVED: new Set(['CLOSED']),
  CLOSED: new Set([]),
};

export async function transitionForexComplianceCaseStatus(input: {
  caseId: string;
  nextStatus: string;
  note: string;
  adminId: string;
}) {
  const next = input.nextStatus.trim().toUpperCase();
  const note = input.note.trim();
  if (!CASE_STATUSES.has(next)) throw new Error('INVALID_STATUS');
  if (note.length < 8) throw new Error('NOTE_REQUIRED');
  const cur = await db.query<{ status: string; metadata: unknown }>(
    `SELECT status, metadata FROM forex_compliance_cases WHERE case_id = $1::uuid`,
    [input.caseId],
  );
  const row = cur.rows[0];
  if (!row) throw new Error('CASE_NOT_FOUND');
  const prev = String(row.status).toUpperCase();
  if (prev === next) throw new Error('NOOP_STATUS');
  if (!CASE_TRANSITIONS[prev]?.has(next)) throw new Error('TRANSITION_FORBIDDEN');
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const trail = Array.isArray(meta.status_trail) ? [...(meta.status_trail as unknown[])] : [];
  trail.push({ at: new Date().toISOString(), from: prev, to: next, note, admin_id: input.adminId });
  await db.query(
    `UPDATE forex_compliance_cases
     SET status = $2::varchar,
         decision = CASE WHEN $2::text IN ('RESOLVED','CLOSED') THEN $3::text ELSE decision END,
         closed_at = CASE WHEN $2::text IN ('RESOLVED','CLOSED') THEN NOW() ELSE closed_at END,
         metadata = $4::jsonb,
         updated_at = NOW()
     WHERE case_id = $1::uuid`,
    [input.caseId, next, note, JSON.stringify({ ...meta, status_trail: trail })],
  );
  return { case_id: input.caseId, previous_status: prev, next_status: next };
}

export async function closeForexComplianceCase(caseId: string, decision: string, adminId: string) {
  return transitionForexComplianceCaseStatus({
    caseId,
    nextStatus: 'CLOSED',
    note: decision,
    adminId,
  });
}
