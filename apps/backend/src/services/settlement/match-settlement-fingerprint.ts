/**
 * Content-based idempotency for settlement_events — prevents duplicate settlement when
 * engine_event_id collides or is reassigned (rust_inline low IDs vs DB history).
 */
import type { Queryable } from '../../lib/database.js';
import { createHash } from 'node:crypto';

export type MatchFingerprintInput = {
  match_engine_id: string;
  symbol: string;
  taker_order_id: string;
  maker_order_id: string;
  taker_user_id: string;
  maker_user_id: string;
  taker_side: string;
  price: string;
  qty: string;
  timestamp: number | string;
};

export function computeMatchSettlementFingerprint(input: MatchFingerprintInput): string {
  const parts = [
    String(input.match_engine_id || 'default').trim() || 'default',
    String(input.symbol ?? '').trim(),
    String(input.taker_order_id ?? '').trim().toLowerCase(),
    String(input.maker_order_id ?? '').trim().toLowerCase(),
    String(input.taker_user_id ?? '').trim().toLowerCase(),
    String(input.maker_user_id ?? '').trim().toLowerCase(),
    String(input.taker_side ?? '').trim().toLowerCase(),
    String(input.price ?? '').trim(),
    String(input.qty ?? '').trim(),
    String(input.timestamp ?? '').trim(),
  ];
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
}

export function fingerprintFromPayload(
  matchEngineId: string,
  payload: Record<string, unknown>
): string {
  return computeMatchSettlementFingerprint({
    match_engine_id: matchEngineId,
    symbol: String(payload.symbol ?? ''),
    taker_order_id: String(payload.taker_order_id ?? ''),
    maker_order_id: String(payload.maker_order_id ?? ''),
    taker_user_id: String(payload.taker_user_id ?? ''),
    maker_user_id: String(payload.maker_user_id ?? ''),
    taker_side: String(payload.taker_side ?? ''),
    price: String(payload.price ?? ''),
    qty: String(payload.qty ?? ''),
    timestamp: payload.timestamp as number | string,
  });
}

/** Returns existing settlement_events.id if this match was already persisted. */
export async function findSettlementEventIdByFingerprint(
  executor: Queryable,
  matchEngineId: string,
  fingerprint: string
): Promise<number | null> {
  const r = await executor.query<{ id: string }>(
    `SELECT id::text FROM settlement_events
     WHERE match_engine_id = $1 AND match_fingerprint = $2
       AND status IN ('pending', 'processed')
     ORDER BY id ASC LIMIT 1`,
    [matchEngineId, fingerprint]
  );
  if (r.rows.length === 0) return null;
  const id = parseInt(r.rows[0]!.id, 10);
  return Number.isFinite(id) ? id : null;
}
