/**
 * Phase-9 append-only persist. Failures are swallowed by callers.
 * Never writes Crypto tables.
 */
import { db } from '../../../lib/database.js';
import type { ForexSwapEvent } from '../swap/service.js';

export async function persistPendingOrder(args: {
  orderId: string;
  accountId: string;
  symbol: string;
  version: number;
  lastQuoteKey: string | null;
  lastModifyKey: string | null;
}): Promise<void> {
  await db.query(
    `INSERT INTO forex_pending_orders (order_id, account_id, symbol, version, last_quote_key, last_modify_key)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (order_id) DO UPDATE SET
       version = EXCLUDED.version,
       last_quote_key = EXCLUDED.last_quote_key,
       last_modify_key = EXCLUDED.last_modify_key,
       updated_at = CURRENT_TIMESTAMP`,
    [args.orderId, args.accountId, args.symbol, args.version, args.lastQuoteKey, args.lastModifyKey]
  );
}

export async function persistOrderModification(args: {
  eventId: string;
  orderId: string;
  accountId: string;
  fromVersion: number;
  toVersion: number;
  requestedPrice: string | null;
  volume: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await db.query(
    `INSERT INTO forex_order_modifications (
       event_id, order_id, account_id, from_version, to_version, requested_price, volume, idempotency_key, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      args.eventId,
      args.orderId,
      args.accountId,
      args.fromVersion,
      args.toVersion,
      args.requestedPrice,
      args.volume,
      args.idempotencyKey,
      JSON.stringify(args.metadata),
    ]
  );
}

export async function persistFeeEvent(args: {
  eventId: string;
  accountId: string;
  fillId: string | null;
  transactionId: string | null;
  symbol: string | null;
  amount: string;
  model: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await db.query(
    `INSERT INTO forex_fee_events (
       event_id, account_id, fill_id, transaction_id, symbol, amount, model, idempotency_key, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      args.eventId,
      args.accountId,
      args.fillId,
      args.transactionId,
      args.symbol,
      args.amount,
      args.model,
      args.idempotencyKey,
      JSON.stringify(args.metadata),
    ]
  );
}

export async function persistSwapEvent(event: ForexSwapEvent): Promise<void> {
  await db.query(
    `INSERT INTO forex_swap_events (
       event_id, account_id, position_id, symbol, amount, rollover_date, triple, idempotency_key, transaction_id, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventId,
      event.accountId,
      event.positionId,
      event.symbol,
      event.amount,
      event.rolloverDate,
      event.triple,
      event.idempotencyKey,
      event.transactionId ?? null,
      JSON.stringify({ source: event.source }),
    ]
  );
}

export async function persistReconciliationEvent(args: {
  eventId: string;
  accountId: string;
  kind: 'accounting' | 'execution';
  ok: boolean;
  reason: string | null;
  detail?: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO forex_reconciliation_events (event_id, account_id, kind, ok, reason, detail)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (event_id) DO NOTHING`,
    [args.eventId, args.accountId, args.kind, args.ok, args.reason, args.detail ?? null]
  );
}
