/**
 * Server-backed customer Forex alerts (account-scoped). Delivery adapters are gated by config flags.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';

export type ForexCustomerAlertType =
  | 'PRICE'
  | 'BID'
  | 'ASK'
  | 'SPREAD'
  | 'MARGIN'
  | 'DRAWDOWN'
  | 'ORDER_FILLED'
  | 'PENDING_TRIGGERED'
  | 'SL_TRIGGERED'
  | 'TP_TRIGGERED'
  | 'TRAILING_TRIGGERED'
  | 'LIQUIDATION'
  | 'SESSION_OPEN'
  | 'SESSION_CLOSE';

export type ForexCustomerAlertRow = {
  alertId: string;
  accountId: string;
  alertType: ForexCustomerAlertType;
  symbol: string | null;
  condition: Record<string, unknown>;
  enabled: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: string | null;
  deliveryWeb: boolean;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED = new Set<ForexCustomerAlertType>([
  'PRICE',
  'BID',
  'ASK',
  'SPREAD',
  'MARGIN',
  'DRAWDOWN',
  'ORDER_FILLED',
  'PENDING_TRIGGERED',
  'SL_TRIGGERED',
  'TP_TRIGGERED',
  'TRAILING_TRIGGERED',
  'LIQUIDATION',
  'SESSION_OPEN',
  'SESSION_CLOSE',
]);

function rowToAlert(row: Record<string, unknown>): ForexCustomerAlertRow {
  return {
    alertId: String(row.alert_id),
    accountId: String(row.account_id),
    alertType: String(row.alert_type) as ForexCustomerAlertType,
    symbol: row.symbol == null ? null : String(row.symbol),
    condition: (row.condition_json as Record<string, unknown>) ?? {},
    enabled: Boolean(row.enabled),
    cooldownSeconds: Number(row.cooldown_seconds ?? 60),
    lastTriggeredAt: row.last_triggered_at == null ? null : String(row.last_triggered_at),
    deliveryWeb: Boolean(row.delivery_web),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listForexCustomerAlerts(accountId: string): Promise<ForexCustomerAlertRow[]> {
  const res = await db.query(
    `SELECT alert_id, account_id, alert_type, symbol, condition_json, enabled, cooldown_seconds,
            last_triggered_at, delivery_web, created_at, updated_at
     FROM forex_customer_alerts
     WHERE account_id = $1
     ORDER BY created_at DESC`,
    [accountId]
  );
  return res.rows.map((r) => rowToAlert(r as Record<string, unknown>));
}

export async function createForexCustomerAlert(accountId: string, body: Record<string, unknown>): Promise<ForexCustomerAlertRow> {
  const rawType = String(body.alertType ?? body.type ?? '').trim();
  const alertType = rawType.toUpperCase() as ForexCustomerAlertType;
  if (!rawType) {
    throw new Error('alertType is required (e.g. BID, ASK, PRICE, SPREAD, SESSION_OPEN, ORDER_FILLED)');
  }
  if (!ALLOWED.has(alertType)) {
    throw new Error(`Unsupported alert type ${alertType}. Use a supported server alert type from /forex/alerts.`);
  }
  const symbol = body.symbol != null ? String(body.symbol).trim().toUpperCase() : null;
  const condition = (body.condition && typeof body.condition === 'object' ? body.condition : body) as Record<string, unknown>;
  const cooldownSeconds = Math.max(5, Math.min(86400, Number(body.cooldownSeconds ?? 60) || 60));
  const alertId = randomUUID();
  await db.query(
    `INSERT INTO forex_customer_alerts (
       alert_id, account_id, alert_type, symbol, condition_json, enabled, cooldown_seconds, delivery_web
     ) VALUES ($1,$2,$3,$4,$5,true,$6,true)`,
    [alertId, accountId, alertType, symbol, JSON.stringify(condition), cooldownSeconds]
  );
  const rows = await listForexCustomerAlerts(accountId);
  const created = rows.find((a) => a.alertId === alertId);
  if (!created) throw new Error('Alert persist failed');
  return created;
}

export async function deleteForexCustomerAlert(accountId: string, alertId: string): Promise<boolean> {
  const res = await db.query(`DELETE FROM forex_customer_alerts WHERE account_id = $1 AND alert_id = $2::uuid`, [accountId, alertId]);
  return (res.rowCount ?? 0) > 0;
}

export async function patchForexCustomerAlert(
  accountId: string,
  alertId: string,
  patch: Record<string, unknown>
): Promise<ForexCustomerAlertRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [accountId, alertId];
  if (typeof patch.enabled === 'boolean') {
    vals.push(patch.enabled);
    sets.push(`enabled = $${vals.length}`);
  }
  if (patch.cooldownSeconds != null) {
    const cooldownSeconds = Math.max(5, Math.min(86400, Number(patch.cooldownSeconds) || 60));
    vals.push(cooldownSeconds);
    sets.push(`cooldown_seconds = $${vals.length}`);
  }
  if (patch.condition && typeof patch.condition === 'object') {
    vals.push(JSON.stringify(patch.condition));
    sets.push(`condition_json = $${vals.length}::jsonb`);
  }
  if (patch.symbol != null) {
    vals.push(String(patch.symbol).trim().toUpperCase() || null);
    sets.push(`symbol = $${vals.length}`);
  }
  if (typeof patch.alertType === 'string') {
    const alertType = String(patch.alertType).toUpperCase() as ForexCustomerAlertType;
    if (!ALLOWED.has(alertType)) throw new Error(`Unsupported alert type ${alertType}`);
    vals.push(alertType);
    sets.push(`alert_type = $${vals.length}`);
  }
  if (sets.length === 0) {
    const rows = await listForexCustomerAlerts(accountId);
    return rows.find((a) => a.alertId === alertId) ?? null;
  }
  sets.push('updated_at = CURRENT_TIMESTAMP');
  const res = await db.query(
    `UPDATE forex_customer_alerts SET ${sets.join(', ')} WHERE account_id = $1 AND alert_id = $2::uuid RETURNING alert_id`,
    vals
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const rows = await listForexCustomerAlerts(accountId);
  return rows.find((a) => a.alertId === alertId) ?? null;
}

export async function listForexCustomerAlertEvents(accountId: string, limit = 50) {
  const res = await db.query(
    `SELECT event_id, alert_id, account_id, delivery_channel, status, message, metadata, created_at
     FROM forex_customer_alert_events
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [accountId, limit]
  );
  return res.rows.map((r) => ({
    eventId: String(r.event_id),
    alertId: String(r.alert_id),
    accountId: String(r.account_id),
    deliveryChannel: String(r.delivery_channel),
    status: String(r.status),
    message: String(r.message),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
  }));
}

/** Evaluate quote-driven alerts (PRICE/BID/ASK/SPREAD). */
export async function evaluateForexPriceAlertsForQuote(args: {
  symbol: string;
  bid: string;
  ask: string;
}): Promise<number> {
  const { evaluateForexQuoteAlerts } = await import('./alert-engine.js');
  return evaluateForexQuoteAlerts(args);
}

export { listForexAlertDeliveryStatus } from './alert-delivery.js';
