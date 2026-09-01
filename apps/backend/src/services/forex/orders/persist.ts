import { db } from '../../../lib/database.js';
import type { ForexOrderEvent, ForexOrderRecord } from './models.js';
import type { ForexOrderRequest } from './request.js';
import type { ForexOrderReason, ForexOrderState } from './states.js';

export async function persistOrder(record: ForexOrderRecord): Promise<void> {
  await db.query(
    `INSERT INTO forex_orders (
       order_id, client_order_id, client_exec_id, account_id, fingerprint, symbol, side, order_type,
       requested_volume, filled_volume, remaining_volume, requested_price, max_slippage, max_deviation,
       status, failure_reason, execution_id, fill_ids, request_json, source, execution_mode
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'SIMULATED','MOCK'
     )
     ON CONFLICT (order_id) DO UPDATE SET
       filled_volume = EXCLUDED.filled_volume,
       remaining_volume = EXCLUDED.remaining_volume,
       status = EXCLUDED.status,
       failure_reason = EXCLUDED.failure_reason,
       execution_id = EXCLUDED.execution_id,
       fill_ids = EXCLUDED.fill_ids,
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
    ]
  );
}

export async function persistOrderEvent(event: ForexOrderEvent): Promise<void> {
  await db.query(
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
      event.timestamp,
    ]
  );
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function rowToOrder(row: Record<string, unknown>, events: ForexOrderEvent[] = []): ForexOrderRecord {
  const request: ForexOrderRequest = {
    clientOrderId: str(row.client_order_id),
    symbol: str(row.symbol),
    side: row.side === 'sell' ? 'sell' : 'buy',
    orderType: row.order_type === 'limit' ? 'limit' : row.order_type === 'stop' ? 'stop' : 'market',
    volume: str(row.requested_volume),
    requestedPrice: row.requested_price != null ? str(row.requested_price) : undefined,
    maxSlippage: row.max_slippage != null ? str(row.max_slippage) : undefined,
    maxDeviation: row.max_deviation != null ? str(row.max_deviation) : undefined,
  };
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
    maxSlippage: row.max_slippage == null ? null : str(row.max_slippage),
    maxDeviation: row.max_deviation == null ? null : str(row.max_deviation),
    status: row.status as ForexOrderState,
    failureReason: row.failure_reason == null ? null : (str(row.failure_reason) as ForexOrderReason),
    executionId: row.execution_id == null ? null : str(row.execution_id),
    fillIds,
    source: 'SIMULATED',
    executionMode: 'MOCK',
    events,
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
