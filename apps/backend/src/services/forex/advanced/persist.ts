/**
 * Phase-9 append-only persist. Callers must await and surface failures.
 * Never writes Crypto tables.
 */
import { fxq, type ForexQueryable } from '../durability/tx.js';
import type { ForexSwapEvent } from '../swap/service.js';

export async function persistPendingOrder(
  args: {
    orderId: string;
    accountId: string;
    symbol: string;
    version: number;
    lastQuoteKey: string | null;
    lastModifyKey: string | null;
  },
  client?: ForexQueryable
): Promise<void> {
  await fxq(client).query(
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

export async function persistOrderModification(
  args: {
    eventId: string;
    orderId: string;
    accountId: string;
    fromVersion: number;
    toVersion: number;
    requestedPrice: string | null;
    volume: string | null;
    idempotencyKey: string | null;
    metadata: Record<string, unknown>;
  },
  client?: ForexQueryable
): Promise<void> {
  await fxq(client).query(
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

export async function persistFeeEvent(
  args: {
    eventId: string;
    accountId: string;
    fillId: string | null;
    transactionId: string | null;
    symbol: string | null;
    amount: string;
    model: string;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
  },
  client?: ForexQueryable
): Promise<'inserted' | 'replay'> {
  const res = await fxq(client).query(
    `INSERT INTO forex_fee_events (
       event_id, account_id, fill_id, transaction_id, symbol, amount, model, idempotency_key, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING event_id`,
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
  return (res.rowCount ?? 0) > 0 ? 'inserted' : 'replay';
}

export async function persistSwapEvent(
  event: ForexSwapEvent,
  client?: ForexQueryable
): Promise<'inserted' | 'replay'> {
  const res = await fxq(client).query(
    `INSERT INTO forex_swap_events (
       event_id, account_id, position_id, symbol, amount, rollover_date, triple, idempotency_key, transaction_id, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING event_id`,
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
  return (res.rowCount ?? 0) > 0 ? 'inserted' : 'replay';
}

export async function persistReconciliationEvent(
  args: {
    eventId: string;
    accountId: string;
    kind: 'accounting' | 'execution';
    ok: boolean;
    reason: string | null;
    detail?: string;
  },
  client?: ForexQueryable
): Promise<void> {
  await fxq(client).query(
    `INSERT INTO forex_reconciliation_events (event_id, account_id, kind, ok, reason, detail)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (event_id) DO NOTHING`,
    [args.eventId, args.accountId, args.kind, args.ok, args.reason, args.detail ?? null]
  );
}

export async function loadSwapEvents(client?: ForexQueryable): Promise<ForexSwapEvent[]> {
  const res = await fxq(client).query(`SELECT * FROM forex_swap_events ORDER BY created_at`);
  return (res.rows as Record<string, unknown>[]).map((row) => ({
    eventId: String(row.event_id),
    accountId: String(row.account_id),
    positionId: String(row.position_id),
    symbol: String(row.symbol),
    side: 'long',
    amount: String(row.amount),
    rolloverDate: String(row.rollover_date).slice(0, 10),
    triple: Boolean(row.triple),
    idempotencyKey: String(row.idempotency_key),
    transactionId: row.transaction_id == null ? undefined : String(row.transaction_id),
    timestamp: String(row.created_at),
    source: 'SIMULATED',
  }));
}

