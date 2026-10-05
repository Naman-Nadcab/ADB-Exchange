import { db } from '../../../lib/database.js';
import { forexIsoTimestamp, forexStr, fxq, type ForexQueryable } from '../durability/tx.js';
import type { ForexOrderEvent, ForexOrderRecord } from './models.js';
import { FOREX_DEFAULT_TIME_IN_FORCE, normalizeForexTimeInForce, type ForexOrderRequest } from './request.js';
import type { ForexOrderReason, ForexOrderState } from './states.js';

export async function persistOrder(record: ForexOrderRecord, client?: ForexQueryable): Promise<void> {
  await fxq(client).query(
    `INSERT INTO forex_orders (
       order_id, client_order_id, client_exec_id, account_id, fingerprint, symbol, side, order_type,
       requested_volume, filled_volume, remaining_volume, requested_price, max_slippage, max_deviation,
       status, failure_reason, execution_id, fill_ids, request_json, limit_price, time_in_force, expire_at, source, execution_mode, venue_order_id
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
     )
     ON CONFLICT (order_id) DO UPDATE SET
       order_type = EXCLUDED.order_type,
       requested_volume = EXCLUDED.requested_volume,
       filled_volume = EXCLUDED.filled_volume,
       remaining_volume = EXCLUDED.remaining_volume,
       requested_price = EXCLUDED.requested_price,
       limit_price = EXCLUDED.limit_price,
       time_in_force = EXCLUDED.time_in_force,
       expire_at = EXCLUDED.expire_at,
       request_json = EXCLUDED.request_json,
       status = EXCLUDED.status,
       failure_reason = EXCLUDED.failure_reason,
       execution_id = EXCLUDED.execution_id,
       fill_ids = EXCLUDED.fill_ids,
       source = EXCLUDED.source,
       execution_mode = EXCLUDED.execution_mode,
       venue_order_id = EXCLUDED.venue_order_id,
       updated_at = CURRENT_TIMESTAMP`,
    [
      record.orderId,
      record.clientOrderId,
      record.clientExecId,
      record.accountId,
      record.fingerprint,
      record.symbol,
      record.side,
      record.orderType,
      record.requestedVolume,
      record.filledVolume,
      record.remainingVolume,
      record.requestedPrice,
      record.maxSlippage,
      record.maxDeviation,
      record.status,
      record.failureReason,
      record.executionId,
      record.fillIds,
      JSON.stringify(record.request),
      record.limitPrice,
      record.timeInForce,
      record.expireAt,
      record.source,
      record.executionMode,
      record.venueOrderId,
    ]
  );
}

export async function persistOrderEvent(event: ForexOrderEvent, client?: ForexQueryable): Promise<void> {
  await fxq(client).query(
    `INSERT INTO forex_order_events (
       event_id, order_id, client_order_id, event_type, reason, execution_id, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventId,
      event.orderId,
      event.clientOrderId,
      event.eventType,
      event.reason ?? null,
      event.executionId ?? null,
      JSON.stringify(event.metadata ?? {}),
      forexIsoTimestamp(event.timestamp, new Date().toISOString()),
    ]
  );
}

function str(v: unknown): string {
  return forexStr(v);
}

function rowOrderType(value: unknown): ForexOrderRequest['orderType'] {
  if (value === 'limit') return 'limit';
  if (value === 'stop') return 'stop';
  if (value === 'stop_limit') return 'stop_limit';
  return 'market';
}

function rowToOrder(row: Record<string, unknown>, events: ForexOrderEvent[] = []): ForexOrderRecord {
  const timeInForce = normalizeForexTimeInForce(row.time_in_force) ?? FOREX_DEFAULT_TIME_IN_FORCE;
  const request: ForexOrderRequest = {
    clientOrderId: str(row.client_order_id),
    symbol: str(row.symbol),
    side: row.side === 'sell' ? 'sell' : 'buy',
    orderType: rowOrderType(row.order_type),
    volume: str(row.requested_volume),
    requestedPrice: row.requested_price != null ? str(row.requested_price) : undefined,
    limitPrice: row.limit_price != null ? str(row.limit_price) : undefined,
    timeInForce,
    expireAt: row.expire_at != null ? str(row.expire_at) : undefined,
    maxSlippage: row.max_slippage != null ? str(row.max_slippage) : undefined,
    maxDeviation: row.max_deviation != null ? str(row.max_deviation) : undefined,
  };
  const rawReq = row.request_json;
  if (rawReq && typeof rawReq === 'object') {
    const j = rawReq as Record<string, unknown>;
    if (j.stopLoss != null) request.stopLoss = String(j.stopLoss);
    if (j.takeProfit != null) request.takeProfit = String(j.takeProfit);
    if (j.comment != null) request.comment = String(j.comment);
    if (j.intent != null) request.intent = j.intent as ForexOrderRequest['intent'];
    if (j.reducePositionId != null) request.reducePositionId = String(j.reducePositionId);
    if (j.expireAt != null) request.expireAt = String(j.expireAt);
  }
  const fillIds = Array.isArray(row.fill_ids) ? (row.fill_ids as unknown[]).map((x) => String(x)) : [];
  return {
    orderId: str(row.order_id),
    clientOrderId: str(row.client_order_id),
    clientExecId: str(row.client_exec_id),
    accountId: str(row.account_id),
    fingerprint: str(row.fingerprint),
    request,
    symbol: str(row.symbol),
    side: row.side === 'sell' ? 'sell' : 'buy',
    orderType: request.orderType,
    requestedVolume: str(row.requested_volume),
    filledVolume: str(row.filled_volume),
    remainingVolume: str(row.remaining_volume),
    requestedPrice: row.requested_price == null ? null : str(row.requested_price),
    limitPrice: row.limit_price == null ? null : str(row.limit_price),
    timeInForce,
    expireAt: row.expire_at == null ? null : str(row.expire_at),
    maxSlippage: row.max_slippage == null ? null : str(row.max_slippage),
    maxDeviation: row.max_deviation == null ? null : str(row.max_deviation),
    status: row.status as ForexOrderState,
    failureReason: row.failure_reason == null ? null : (str(row.failure_reason) as ForexOrderReason),
    executionId: row.execution_id == null ? null : str(row.execution_id),
    fillIds,
    source: row.source === 'LIVE' ? 'LIVE' : 'SIMULATED',
    executionMode: row.execution_mode === 'BROKER' ? 'BROKER' : 'MOCK',
    venueOrderId: row.venue_order_id == null ? null : str(row.venue_order_id),
    events,
    version: Number(row.version ?? 1) || 1,
    lastQuoteKey: row.last_quote_key == null ? null : str(row.last_quote_key),
    lastModifyKey: row.last_modify_key == null ? null : str(row.last_modify_key),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export async function loadOrderByScope(accountId: string, clientOrderId: string): Promise<ForexOrderRecord | null> {
  const res = await db.query(`SELECT * FROM forex_orders WHERE account_id = $1 AND client_order_id = $2 LIMIT 1`, [
    accountId,
    clientOrderId,
  ]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return attachEvents(row);
}

export async function loadOrderById(orderId: string): Promise<ForexOrderRecord | null> {
  const res = await db.query(`SELECT * FROM forex_orders WHERE order_id = $1 LIMIT 1`, [orderId]);
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return attachEvents(row);
}

export async function loadOpenOrders(): Promise<ForexOrderRecord[]> {
  const res = await db.query(
    `SELECT * FROM forex_orders WHERE status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`
  );
  const rows = res.rows as Record<string, unknown>[];
  return Promise.all(rows.map((row) => attachEvents(row)));
}

export async function loadPendingOrderOverlays(): Promise<
  Array<{ orderId: string; version: number; lastQuoteKey: string | null; lastModifyKey: string | null }>
> {
  const res = await db.query(`SELECT * FROM forex_pending_orders`);
  return (res.rows as Record<string, unknown>[]).map((row) => ({
    orderId: String(row.order_id),
    version: Number(row.version ?? 1),
    lastQuoteKey: row.last_quote_key == null ? null : String(row.last_quote_key),
    lastModifyKey: row.last_modify_key == null ? null : String(row.last_modify_key),
  }));
}

async function attachEvents(row: Record<string, unknown>): Promise<ForexOrderRecord> {
  const eventsRes = await db.query(
    `SELECT * FROM forex_order_events WHERE order_id = $1 ORDER BY created_at`,
    [str(row.order_id)]
  );
  const events: ForexOrderEvent[] = (eventsRes.rows as Record<string, unknown>[]).map((e) => ({
    eventId: str(e.event_id),
    orderId: str(e.order_id),
    clientOrderId: str(e.client_order_id),
    timestamp: str(e.created_at),
    eventType: e.event_type as ForexOrderEvent['eventType'],
    reason: e.reason == null ? undefined : str(e.reason),
    executionId: e.execution_id == null ? undefined : str(e.execution_id),
    metadata: (e.metadata as Record<string, unknown> | undefined) ?? {},
  }));
  return rowToOrder(row, events);
}
