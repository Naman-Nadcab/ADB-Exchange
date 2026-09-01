import { db } from '../../../lib/database.js';
import type { ForexProtectionEvent, ForexProtectionRecord } from './models.js';

export async function persistProtection(p: ForexProtectionRecord): Promise<void> {
  await db.query(
    `INSERT INTO forex_protections (
       protection_id, client_protection_id, account_id, position_id, symbol, position_side, type,
       volume, trigger_price, status, fingerprint, last_quote_key, last_eval_price, last_eval_source,
       order_id, failure_reason, source, execution_mode, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'SIMULATED','MOCK',$17,$18)
     ON CONFLICT (protection_id) DO UPDATE SET
       status = EXCLUDED.status,
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
      p.status,
      p.fingerprint,
      p.lastQuoteKey,
      p.lastEvalPrice,
      p.lastEvalSource,
      p.orderId,
      p.failureReason,
      p.createdAt,
      p.updatedAt,
    ]
  );
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
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
      event.timestamp,
    ]
  );
}
