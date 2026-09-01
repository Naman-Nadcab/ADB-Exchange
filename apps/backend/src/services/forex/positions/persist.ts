import { fxq, type ForexQueryable } from '../durability/tx.js';
import type { ForexAppliedFill, ForexPositionEvent, ForexPositionRecord } from './models.js';
import type { ForexPositionMode } from './mode.js';

export async function persistPosition(
  record: ForexPositionRecord,
  expectedVersion?: number,
  client?: ForexQueryable
): Promise<boolean> {
  const q = fxq(client);
  if (expectedVersion == null) {
    await q.query(
      `INSERT INTO forex_positions (
         position_id, account_id, symbol, side, volume, entry_price, current_price, contract_size,
         leverage, initial_margin, maintenance_margin, exposure, status, mode, version,
         applied_fills, source, opened_at, updated_at, closed_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'SIMULATED',$17,$18,$19
       )
       ON CONFLICT (position_id) DO UPDATE SET
         side = EXCLUDED.side,
         volume = EXCLUDED.volume,
         entry_price = EXCLUDED.entry_price,
         current_price = EXCLUDED.current_price,
         leverage = EXCLUDED.leverage,
         initial_margin = EXCLUDED.initial_margin,
         maintenance_margin = EXCLUDED.maintenance_margin,
         exposure = EXCLUDED.exposure,
         status = EXCLUDED.status,
         version = EXCLUDED.version,
         applied_fills = EXCLUDED.applied_fills,
         updated_at = CURRENT_TIMESTAMP,
         closed_at = EXCLUDED.closed_at
       WHERE forex_positions.version = EXCLUDED.version - 1`,
      [
        record.positionId,
        record.accountId,
        record.symbol,
        record.side,
        record.volume,
        record.entryPrice,
        record.currentPrice,
        record.contractSize,
        record.leverage,
        record.initialMargin,
        record.maintenanceMargin,
        record.exposure,
        record.status,
        record.mode,
        record.version,
        JSON.stringify(record.appliedFills),
        record.openedAt,
        record.updatedAt,
        record.closedAt,
      ]
    );
    return true;
  }
  const res = await q.query(
    `UPDATE forex_positions SET
       side = $1, volume = $2, entry_price = $3, current_price = $4, leverage = $5,
       initial_margin = $6, maintenance_margin = $7, exposure = $8, status = $9,
       version = $10, applied_fills = $11, updated_at = $12, closed_at = $13
     WHERE position_id = $14 AND version = $15`,
    [
      record.side,
      record.volume,
      record.entryPrice,
      record.currentPrice,
      record.leverage,
      record.initialMargin,
      record.maintenanceMargin,
      record.exposure,
      record.status,
      record.version,
      JSON.stringify(record.appliedFills),
      record.updatedAt,
      record.closedAt,
      record.positionId,
      expectedVersion,
    ]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function persistPositionEvent(event: ForexPositionEvent, client?: ForexQueryable): Promise<void> {
  const q = fxq(client);
  await q.query(
    `INSERT INTO forex_position_events (
       event_id, position_id, account_id, symbol, side, volume, entry_price, event_type,
       source_fill_id, reason, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventId,
      event.positionId,
      event.accountId,
      event.symbol,
      event.side,
      event.volume,
      event.entryPrice,
      event.eventType,
      event.sourceFillId,
      event.reason,
      JSON.stringify(event.metadata ?? {}),
      event.timestamp,
    ]
  );
}

export async function persistAppliedFill(
  accountId: string,
  positionId: string,
  fill: ForexAppliedFill,
  client?: ForexQueryable
): Promise<boolean> {
  const q = fxq(client);
  const inserted = await q.query(
    `INSERT INTO forex_position_fills (fill_id, position_id, account_id, side, volume, price, fill_timestamp, execution_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (fill_id) DO NOTHING
     RETURNING fill_id`,
    [fill.fillId, positionId, accountId, fill.side, fill.volume, fill.price, fill.timestamp, fill.executionId ?? null]
  );
  return (inserted.rowCount ?? 0) > 0;
}

export async function loadOpenPositions(client?: ForexQueryable): Promise<ForexPositionRecord[]> {
  const res = await fxq(client).query(`SELECT * FROM forex_positions WHERE status = 'OPEN'`);
  return (res.rows as Record<string, unknown>[]).map(rowToPosition);
}

export async function loadAllPositions(client?: ForexQueryable): Promise<ForexPositionRecord[]> {
  const res = await fxq(client).query(`SELECT * FROM forex_positions`);
  return (res.rows as Record<string, unknown>[]).map(rowToPosition);
}

export async function loadAllPositionFills(client?: ForexQueryable): Promise<string[]> {
  const res = await fxq(client).query(`SELECT fill_id FROM forex_position_fills`);
  return (res.rows as { fill_id?: unknown }[]).map((r) => String(r.fill_id));
}

export async function loadPositionById(positionId: string, client?: ForexQueryable): Promise<ForexPositionRecord | null> {
  const res = await fxq(client).query(`SELECT * FROM forex_positions WHERE position_id = $1`, [positionId]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToPosition(row) : null;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function rowToPosition(row: Record<string, unknown>): ForexPositionRecord {
  const fills = Array.isArray(row.applied_fills) ? (row.applied_fills as ForexAppliedFill[]) : [];
  return {
    positionId: str(row.position_id),
    accountId: str(row.account_id),
    symbol: str(row.symbol),
    side: row.side === 'short' ? 'short' : 'long',
    volume: str(row.volume),
    entryPrice: str(row.entry_price),
    averageEntryPrice: str(row.entry_price),
    currentPrice: str(row.current_price),
    lastPriceTimestamp: str(row.updated_at),
    contractSize: str(row.contract_size),
    leverage: str(row.leverage),
    initialMargin: str(row.initial_margin),
    maintenanceMargin: str(row.maintenance_margin),
    exposure: str(row.exposure),
    status: row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    mode: (row.mode as ForexPositionMode) || 'NETTING',
    version: Number(row.version ?? 1),
    appliedFills: fills,
    source: 'SIMULATED',
    valuationKind: 'CALCULATED',
    openedAt: str(row.opened_at),
    updatedAt: str(row.updated_at),
    closedAt: row.closed_at == null ? null : str(row.closed_at),
  };
}
