/**
 * RC-003: Audited quarantine for synthetic / invalid settlement_events.
 * Status-only changes — no ledger, wallet, or trade writes.
 */
import { db } from '../../lib/database.js';
import { logger } from '../../lib/logger.js';
import { SETTLEMENT_STATUS_QUARANTINED } from './settlement-status.js';

export type SettlementQuarantineClassification = 'synthetic_load_test' | 'explicit_ids';

export type QuarantineBatchResult = {
  batchId: string;
  quarantined: number;
  eventIds: number[];
  skipped: number;
  classification: SettlementQuarantineClassification;
};

export type QuarantineRollbackResult = {
  restored: number;
  eventIds: number[];
};

const SYNTHETIC_ELIGIBLE_SQL = `
  SELECT se.id
  FROM settlement_events se
  WHERE se.status <> $1
    AND (
      (
        se.status IN ('pending', 'failed')
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = (se.payload->>'maker_user_id')::uuid
        )
      )
      OR (
        se.status = 'processed'
        AND NOT EXISTS (
          SELECT 1 FROM settlement_ledger_entries sle WHERE sle.settlement_event_id = se.id
        )
      )
    )
  ORDER BY se.id ASC
  LIMIT $2
`;

const VALID_PROCESSED_GUARD = `
  NOT (
    se.status = 'processed'
    AND EXISTS (
      SELECT 1 FROM settlement_ledger_entries sle WHERE sle.settlement_event_id = se.id
    )
  )
`;

/** Count events eligible for synthetic quarantine (read-only). */
export async function countSyntheticQuarantineEligible(): Promise<number> {
  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM settlement_events se
     WHERE se.status <> $1
       AND (
         (
           se.status IN ('pending', 'failed')
           AND NOT EXISTS (
             SELECT 1 FROM users u WHERE u.id = (se.payload->>'maker_user_id')::uuid
           )
         )
         OR (
           se.status = 'processed'
           AND NOT EXISTS (
             SELECT 1 FROM settlement_ledger_entries sle WHERE sle.settlement_event_id = se.id
           )
         )
       )`,
    [SETTLEMENT_STATUS_QUARANTINED]
  );
  return parseInt(r.rows[0]?.n ?? '0', 10) || 0;
}

/**
 * Quarantine a batch of settlement events (audited operator action).
 * Never quarantines processed rows that already have settlement_ledger_entries.
 */
export async function quarantineSettlementBatch(params: {
  classification: SettlementQuarantineClassification;
  eventIds?: number[];
  limit: number;
  reason: string;
  actorId: string;
  batchId?: string;
}): Promise<QuarantineBatchResult> {
  const { classification, reason, actorId, limit } = params;
  const batchId = params.batchId ?? `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cappedLimit = Math.min(1000, Math.max(1, limit));

  const client = await db.getSettlementClient();
  try {
    await client.query('BEGIN');

    let pickSql: string;
    let pickArgs: (string | number | number[])[];
    if (classification === 'explicit_ids') {
      const ids = (params.eventIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
      if (ids.length === 0) {
        await client.query('ROLLBACK');
        return { batchId, quarantined: 0, eventIds: [], skipped: 0, classification };
      }
      pickSql = `
        SELECT se.id
        FROM settlement_events se
        WHERE se.id = ANY($1::bigint[])
          AND se.status <> $2
          AND ${VALID_PROCESSED_GUARD}
        ORDER BY se.id ASC
        LIMIT $3
      `;
      pickArgs = [ids, SETTLEMENT_STATUS_QUARANTINED, cappedLimit];
    } else {
      pickSql = SYNTHETIC_ELIGIBLE_SQL;
      pickArgs = [SETTLEMENT_STATUS_QUARANTINED, cappedLimit];
    }

    const picked = await client.query<{ id: string }>(pickSql, pickArgs);
    const ids = picked.rows.map((r) => parseInt(r.id, 10)).filter((n) => n > 0);
    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return { batchId, quarantined: 0, eventIds: [], skipped: 0, classification };
    }

    const updated = await client.query<{ id: string }>(
      `UPDATE settlement_events se
       SET prior_status = se.status,
           status = $1,
           quarantined_at = NOW(),
           quarantine_reason = $2,
           quarantined_by = $3,
           updated_at = NOW()
       WHERE se.id = ANY($4::bigint[])
         AND se.status <> $1
         AND ${VALID_PROCESSED_GUARD}
       RETURNING se.id::text`,
      [SETTLEMENT_STATUS_QUARANTINED, reason.substring(0, 2000), actorId, ids]
    );

    const quarantinedIds = updated.rows.map((r) => parseInt(r.id, 10));
    await client.query(
      `INSERT INTO settlement_quarantine_log (batch_id, actor_id, classification, reason, event_ids, quarantined_count)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        batchId,
        actorId,
        classification,
        reason.substring(0, 2000),
        JSON.stringify(quarantinedIds),
        quarantinedIds.length,
      ]
    );

    await client.query('COMMIT');

    logger.warn('settlement_quarantine_batch', {
      batchId,
      classification,
      quarantined: quarantinedIds.length,
      actorId,
    });

    return {
      batchId,
      quarantined: quarantinedIds.length,
      eventIds: quarantinedIds,
      skipped: ids.length - quarantinedIds.length,
      classification,
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** Rollback a quarantine batch by event ids (restores prior_status). */
export async function rollbackQuarantineBatch(params: {
  eventIds: number[];
  reason: string;
  actorId: string;
}): Promise<QuarantineRollbackResult> {
  const ids = params.eventIds.filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) {
    return { restored: 0, eventIds: [] };
  }

  const client = await db.getSettlementClient();
  try {
    await client.query('BEGIN');
    const updated = await client.query<{ id: string }>(
      `UPDATE settlement_events
       SET status = COALESCE(prior_status, status),
           prior_status = NULL,
           quarantined_at = NULL,
           quarantine_reason = NULL,
           quarantined_by = NULL,
           updated_at = NOW()
       WHERE id = ANY($1::bigint[])
         AND status = $2
         AND prior_status IS NOT NULL
       RETURNING id::text`,
      [ids, SETTLEMENT_STATUS_QUARANTINED]
    );
    const restoredIds = updated.rows.map((r) => parseInt(r.id, 10));
    await client.query(
      `INSERT INTO settlement_quarantine_log (batch_id, actor_id, classification, reason, event_ids, quarantined_count)
       VALUES ($1, $2, 'rollback', $3, $4::jsonb, $5)`,
      [
        `rollback-${Date.now()}`,
        params.actorId,
        params.reason.substring(0, 2000),
        JSON.stringify(restoredIds),
        restoredIds.length,
      ]
    );
    await client.query('COMMIT');
    return { restored: restoredIds.length, eventIds: restoredIds };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}
