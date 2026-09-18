/**
 * Forex trading account lifecycle transitions (audited; approval for material states).
 */
import { db } from '../../../lib/database.js';

const VALID = new Set(['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED']);

const ALLOWED: Record<string, Set<string>> = {
  ACTIVE: new Set(['RESTRICTED', 'SUSPENDED', 'CLOSED']),
  RESTRICTED: new Set(['ACTIVE', 'SUSPENDED', 'CLOSED']),
  SUSPENDED: new Set(['ACTIVE', 'RESTRICTED', 'CLOSED']),
  CLOSED: new Set([]),
};

export async function transitionForexAccountStatus(input: {
  accountId: string;
  nextStatus: string;
  reason: string;
  adminId: string;
}): Promise<{ account_id: string; previous_status: string; next_status: string }> {
  const next = input.nextStatus.trim().toUpperCase();
  const reason = input.reason.trim();
  if (!VALID.has(next)) throw new Error('INVALID_STATUS');
  if (reason.length < 8) throw new Error('REASON_REQUIRED');

  const res = await db.query<{ account_id: string; status: string }>(
    `SELECT account_id, status FROM forex_accounts WHERE account_id = $1 LIMIT 1`,
    [input.accountId.trim()],
  );
  const row = res.rows[0];
  if (!row) throw new Error('ACCOUNT_NOT_FOUND');
  const prev = String(row.status).toUpperCase();
  if (prev === next) throw new Error('NOOP_STATUS');
  if (!ALLOWED[prev]?.has(next)) throw new Error('TRANSITION_FORBIDDEN');

  if (next === 'CLOSED') {
    const open = await db.query<{ n: string }>(
      `SELECT (
         (SELECT COUNT(*) FROM forex_orders WHERE account_id = $1 AND status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED'))
         + (SELECT COUNT(*) FROM forex_positions WHERE account_id = $1 AND status = 'OPEN')
       )::text AS n`,
      [input.accountId],
    );
    if (Number.parseInt(open.rows[0]?.n ?? '0', 10) > 0) {
      throw new Error('OPEN_EXPOSURE_BLOCKS_CLOSE');
    }
  }

  await db.query(`UPDATE forex_accounts SET status = $2, updated_at = NOW() WHERE account_id = $1`, [input.accountId, next]);
  await db.query(
    `INSERT INTO forex_crm_activities (account_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, 'account_status', $2, $3::uuid, $4::jsonb)`,
    [
      input.accountId,
      `Account status ${prev} → ${next}: ${reason}`,
      input.adminId,
      JSON.stringify({ previous_status: prev, next_status: next, reason }),
    ],
  );

  void import('./automation-runtime.js').then(({ dispatchForexAutomationEvent }) =>
    dispatchForexAutomationEvent('account_status_change', {
      account_id: input.accountId,
      previous_status: prev,
      next_status: next,
      resource_type: 'forex_account',
      resource_id: input.accountId,
    }),
  );

  return { account_id: input.accountId, previous_status: prev, next_status: next };
}
