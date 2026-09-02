import { db } from '../../../lib/database.js';
import { forexIsoTimestamp, forexStr } from '../durability/tx.js';
import type { ForexAccountRiskRecord, ForexRiskEvent } from './models.js';
import type { ForexAccountRiskState } from './states.js';

export async function persistAccountRiskState(row: ForexAccountRiskRecord): Promise<void> {
  await db.query(
    `INSERT INTO forex_account_risk_states (account_id, state, reason, updated_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (account_id) DO UPDATE SET
       state = EXCLUDED.state,
       reason = EXCLUDED.reason,
       updated_at = EXCLUDED.updated_at`,
    [row.accountId, row.state, row.reason, forexIsoTimestamp(row.updatedAt, new Date().toISOString())]
  );
}

export async function persistRiskEvent(event: ForexRiskEvent): Promise<void> {
  await db.query(
    `INSERT INTO forex_risk_events (
       event_id, account_id, event_type, reason, from_state, to_state, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING`,
    [
      event.eventId,
      event.accountId,
      event.eventType,
      event.reason,
      event.fromState ?? null,
      event.toState ?? null,
      JSON.stringify(event.metadata ?? {}),
      forexIsoTimestamp(event.timestamp, new Date().toISOString()),
    ]
  );
}

export async function loadAllAccountRiskStates(): Promise<ForexAccountRiskRecord[]> {
  const res = await db.query(`SELECT * FROM forex_account_risk_states`);
  return (res.rows as Record<string, unknown>[]).map((row) => ({
    accountId: String(row.account_id),
    state: String(row.state) as ForexAccountRiskState,
    reason: row.reason == null ? null : String(row.reason),
    updatedAt: forexStr(row.updated_at),
  }));
}
