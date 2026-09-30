import { db } from '../../../lib/database.js';
import { forexIsoTimestamp, forexStr } from '../durability/tx.js';
import type { ForexProtectionEvent, ForexProtectionRecord } from './models.js';

let trailingColumnReady = false;

async function ensureTrailingColumn(): Promise<void> {
  if (trailingColumnReady) return;
  await db.query(`ALTER TABLE forex_protections ADD COLUMN IF NOT EXISTS trailing_distance NUMERIC(20,8)`);
  trailingColumnReady = true;
}

export async function persistProtection(p: ForexProtectionRecord): Promise<void> {
  await ensureTrailingColumn();
  await db.query(
    `INSERT INTO forex_protections (
       protection_id, client_protection_id, account_id, position_id, symbol, position_side, type,
       volume, trigger_price, trailing_distance, status, fingerprint, last_quote_key, last_eval_price, last_eval_source,
       order_id, failure_reason, source, execution_mode, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'SIMULATED','MOCK',$18,$19)
     ON CONFLICT (protection_id) DO UPDATE SET
       status = EXCLUDED.status,
       trigger_price = EXCLUDED.trigger_price,
       trailing_distance = EXCLUDED.trailing_distance,
       fingerprint = EXCLUDED.fingerprint,
       last_quote_key = EXCLUDED.last_quote_key,
       last_eval_price = EXCLUDED.last_eval_price,
       last_eval_source = EXCLUDED.last_eval_source,
       order_id = EXCLUDED.order_id,
       failure_reason = EXCLUDED.failure_reason,
       updated_at = EXCLUDED.updated_at`,
    [
      p.protectionId,
      p.clientProtectionId,
      p.accountId,
      p.positionId,
      p.symbol,
      p.positionSide,
      p.type,
      p.volume,
      p.triggerPrice,
      p.trailingDistance ?? null,
      p.status,
      p.fingerprint,
      p.lastQuoteKey,
      p.lastEvalPrice,
      p.lastEvalSource,
      p.orderId,
      p.failureReason,
      forexIsoTimestamp(p.createdAt, new Date().toISOString()),
      forexIsoTimestamp(p.updatedAt, new Date().toISOString()),
    ]
  );
}

function str(v: unknown): string {
  return forexStr(v);
}

function rowToProtection(row: Record<string, unknown>): ForexProtectionRecord {
  return {
    protectionId: str(row.protection_id),
    clientProtectionId: str(row.client_protection_id),
    accountId: str(row.account_id),
    positionId: str(row.position_id),
    symbol: str(row.symbol),
    positionSide: row.position_side === 'short' ? 'short' : 'long',
    type: row.type === 'TAKE_PROFIT' ? 'TAKE_PROFIT' : 'STOP_LOSS',
    volume: str(row.volume),
    triggerPrice: str(row.trigger_price),
    trailingDistance: row.trailing_distance == null ? null : str(row.trailing_distance),
    status: str(row.status) as ForexProtectionRecord['status'],
    fingerprint: str(row.fingerprint),
    lastQuoteKey: row.last_quote_key == null ? null : str(row.last_quote_key),
    lastEvalPrice: row.last_eval_price == null ? null : str(row.last_eval_price),
    lastEvalSource: row.last_eval_source === 'ASK' ? 'ASK' : row.last_eval_source === 'BID' ? 'BID' : null,
    orderId: row.order_id == null ? null : str(row.order_id),
    failureReason: row.failure_reason == null ? null : str(row.failure_reason),
    source: 'SIMULATED',
    executionMode: 'MOCK',
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export async function loadAllProtections(): Promise<ForexProtectionRecord[]> {
  const res = await db.query(`SELECT * FROM forex_protections`);
  return (res.rows as Record<string, unknown>[]).map(rowToProtection);
}

export async function loadProtectionById(protectionId: string): Promise<ForexProtectionRecord | null> {
  const res = await db.query(`SELECT * FROM forex_protections WHERE protection_id = $1 LIMIT 1`, [protectionId]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToProtection(row) : null;
}

export async function persistProtectionEvent(event: ForexProtectionEvent): Promise<void> {
  await db.query(
    `INSERT INTO forex_protection_events (
       event_id, protection_id, account_id, event_type, quote_key, reason, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING`,
    [
      event.eventId,
      event.protectionId,
      event.accountId,
      event.eventType,
      event.quoteKey ?? null,
      event.reason ?? null,
      JSON.stringify(event.metadata ?? {}),
      forexIsoTimestamp(event.timestamp, new Date().toISOString()),
    ]
  );
}
