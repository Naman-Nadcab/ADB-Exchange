import { db } from '../../../lib/database.js';
import type { ForexLiquidationEvent, ForexLiquidationRecord } from './models.js';

export async function persistLiquidation(l: ForexLiquidationRecord): Promise<void> {
  await db.query(
    `INSERT INTO forex_liquidations (
       liquidation_id, account_id, status, reason, equity, used_margin, maintenance_margin,
       margin_level, selected_position_id, attempt, order_ids, source, execution_mode, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SIMULATED','MOCK',$12,$13)
     ON CONFLICT (liquidation_id) DO UPDATE SET
       status = EXCLUDED.status,
       reason = EXCLUDED.reason,
       equity = EXCLUDED.equity,
       used_margin = EXCLUDED.used_margin,
       maintenance_margin = EXCLUDED.maintenance_margin,
       margin_level = EXCLUDED.margin_level,
       selected_position_id = EXCLUDED.selected_position_id,
       attempt = EXCLUDED.attempt,
       order_ids = EXCLUDED.order_ids,
       updated_at = EXCLUDED.updated_at`,
    [
      l.liquidationId,
      l.accountId,
      l.status,
      l.reason,
      l.equity,
      l.usedMargin,
      l.maintenanceMargin,
      l.marginLevel,
      l.selectedPositionId,
      l.attempt,
      l.orderIds,
      l.createdAt,
      l.updatedAt,
    ]
  );
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function rowToLiquidation(row: Record<string, unknown>): ForexLiquidationRecord {
  const ids = Array.isArray(row.order_ids) ? (row.order_ids as unknown[]).map((x) => String(x)) : [];
  return {
    liquidationId: str(row.liquidation_id),
    accountId: str(row.account_id),
    status: str(row.status) as ForexLiquidationRecord['status'],
    reason: str(row.reason),
    equity: row.equity == null ? null : str(row.equity),
    usedMargin: str(row.used_margin),
    maintenanceMargin: str(row.maintenance_margin),
    marginLevel: row.margin_level == null ? null : str(row.margin_level),
    selectedPositionId: row.selected_position_id == null ? null : str(row.selected_position_id),
    attempt: Number(row.attempt ?? 0),
    orderIds: ids,
    source: 'SIMULATED',
    executionMode: 'MOCK',
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export async function loadAllLiquidations(): Promise<ForexLiquidationRecord[]> {
  const res = await db.query(`SELECT * FROM forex_liquidations`);
  return (res.rows as Record<string, unknown>[]).map(rowToLiquidation);
}

export async function loadLiquidationById(liquidationId: string): Promise<ForexLiquidationRecord | null> {
  const res = await db.query(`SELECT * FROM forex_liquidations WHERE liquidation_id = $1 LIMIT 1`, [liquidationId]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToLiquidation(row) : null;
}

export async function persistLiquidationEvent(event: ForexLiquidationEvent): Promise<void> {
  await db.query(
    `INSERT INTO forex_liquidation_events (
       event_id, liquidation_id, account_id, event_type, reason, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventId,
      event.liquidationId,
      event.accountId,
      event.eventType,
      event.reason ?? null,
      JSON.stringify(event.metadata ?? {}),
      event.timestamp,
    ]
  );
}
