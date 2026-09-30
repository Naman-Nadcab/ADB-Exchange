/**
 * Server-side Forex customer alert evaluation (account-scoped, dedupe + cooldown).
 */
import { db } from '../../../lib/database.js';
import type { ForexCustomerAlertType } from './alerts.js';
import { deliverForexAlertEvent } from './alert-delivery.js';

type AlertRow = {
  alert_id: string;
  account_id: string;
  alert_type: string;
  symbol: string | null;
  condition_json: Record<string, unknown>;
  cooldown_seconds: number;
  last_triggered_at: string | null;
  delivery_web: boolean;
  delivery_push: boolean;
  delivery_email: boolean;
  delivery_webhook: boolean;
};

async function loadEnabledAlerts(filter: { accountId?: string; symbol?: string; types: ForexCustomerAlertType[] }): Promise<AlertRow[]> {
  const types = filter.types;
  if (types.length === 0) return [];
  const params: unknown[] = [types];
  let sql = `SELECT alert_id, account_id, alert_type, symbol, condition_json, cooldown_seconds, last_triggered_at,
                    delivery_web, delivery_push, delivery_email, delivery_webhook
             FROM forex_customer_alerts WHERE enabled = true AND alert_type = ANY($1::text[])`;
  if (filter.accountId) {
    params.push(filter.accountId);
    sql += ` AND account_id = $${params.length}`;
  }
  if (filter.symbol) {
    params.push(filter.symbol);
    sql += ` AND (symbol IS NULL OR symbol = $${params.length})`;
  }
  const res = await db.query(sql, params);
  return res.rows as AlertRow[];
}

async function fireMatched(row: AlertRow, message: string, metadata: Record<string, unknown>): Promise<boolean> {
  const now = Date.now();
  const last = row.last_triggered_at ? Date.parse(String(row.last_triggered_at)) : 0;
  const cooldown = (Number(row.cooldown_seconds) || 60) * 1000;
  if (last && now - last < cooldown) return false;

  const dedupeKey = String(metadata.dedupeKey ?? message);
  const recent = await db.query(
    `SELECT 1 FROM forex_customer_alert_events
     WHERE alert_id = $1 AND message = $2 AND created_at > NOW() - INTERVAL '2 minutes' LIMIT 1`,
    [row.alert_id, message]
  );
  if ((recent.rowCount ?? 0) > 0) return false;

  await deliverForexAlertEvent({
    alertId: String(row.alert_id),
    accountId: String(row.account_id),
    channel: 'WEB',
    message,
    metadata: { ...metadata, dedupeKey },
    enabledFlags: {
      web: Boolean(row.delivery_web),
      push: Boolean(row.delivery_push),
      email: Boolean(row.delivery_email),
      webhook: Boolean(row.delivery_webhook),
    },
  });

  await db.query(`UPDATE forex_customer_alerts SET last_triggered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE alert_id = $1`, [
    row.alert_id,
  ]);
  return true;
}

export async function evaluateForexQuoteAlerts(args: { symbol: string; bid: string; ask: string }): Promise<number> {
  const spread = Number(args.ask) - Number(args.bid);
  const rows = await loadEnabledAlerts({ symbol: args.symbol, types: ['PRICE', 'BID', 'ASK', 'SPREAD'] });
  let fired = 0;
  for (const row of rows) {
    const cond = row.condition_json ?? {};
    const side = String(cond.side ?? 'above').toLowerCase();
    const target = Number(cond.price ?? cond.level ?? cond.threshold ?? NaN);
    const t = row.alert_type as ForexCustomerAlertType;
    let hit = false;
    let ref = NaN;
    if (t === 'BID') ref = Number(args.bid);
    else if (t === 'ASK') ref = Number(args.ask);
    else if (t === 'SPREAD') ref = spread;
    else ref = Number(args.bid);
    if (!Number.isFinite(ref)) continue;
    if (t === 'SPREAD') {
      hit = side === 'below' ? ref <= target : ref >= target;
    } else {
      hit = side === 'below' ? ref <= target : ref >= target;
    }
    if (!hit) continue;
    if (await fireMatched(row, `${args.symbol} ${t} ${side} ${target}`, { symbol: args.symbol, bid: args.bid, ask: args.ask, ref })) fired += 1;
  }
  return fired;
}

export async function evaluateForexAccountEventAlerts(args: {
  accountId: string;
  alertType: ForexCustomerAlertType;
  symbol?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const rows = await loadEnabledAlerts({ accountId: args.accountId, symbol: args.symbol ?? undefined, types: [args.alertType] });
  let fired = 0;
  for (const row of rows) {
    const cond = row.condition_json ?? {};
    if (cond.orderId && args.metadata?.orderId && String(cond.orderId) !== String(args.metadata.orderId)) continue;
    if (cond.positionId && args.metadata?.positionId && String(cond.positionId) !== String(args.metadata.positionId)) continue;
    if (await fireMatched(row, args.message, { ...(args.metadata ?? {}), alertType: args.alertType })) fired += 1;
  }
  return fired;
}

export async function evaluateForexRiskAlerts(args: {
  accountId: string;
  marginLevel?: number | null;
  drawdownPct?: number | null;
}): Promise<number> {
  const rows = await loadEnabledAlerts({ accountId: args.accountId, types: ['MARGIN', 'DRAWDOWN'] });
  let fired = 0;
  for (const row of rows) {
    const cond = row.condition_json ?? {};
    const threshold = Number(cond.threshold ?? cond.level ?? NaN);
    if (!Number.isFinite(threshold)) continue;
    const side = String(cond.side ?? 'below').toLowerCase();
    const t = row.alert_type as ForexCustomerAlertType;
    const ref = t === 'MARGIN' ? args.marginLevel : args.drawdownPct;
    if (ref == null || !Number.isFinite(ref)) continue;
    const hit = side === 'below' ? ref <= threshold : ref >= threshold;
    if (!hit) continue;
    if (await fireMatched(row, `${t} ${ref} ${side} ${threshold}`, { ref, threshold })) fired += 1;
  }
  return fired;
}

export async function evaluateForexSessionAlerts(args: {
  symbol: string;
  event: 'SESSION_OPEN' | 'SESSION_CLOSE';
}): Promise<number> {
  const rows = await loadEnabledAlerts({ symbol: args.symbol, types: [args.event] });
  let fired = 0;
  for (const row of rows) {
    if (
      await fireMatched(row, `${args.symbol} ${args.event}`, {
        symbol: args.symbol,
        event: args.event,
        dedupeKey: `${args.symbol}:${args.event}`,
      })
    )
      fired += 1;
  }
  return fired;
}

/** Map order journal events → customer alert types. */
export function forexOrderEventToAlertType(eventType: string): ForexCustomerAlertType | null {
  if (eventType === 'ORDER_FILLED') return 'ORDER_FILLED';
  if (eventType === 'ORDER_TRIGGERED' || eventType === 'ORDER_TRIGGERING') return 'PENDING_TRIGGERED';
  return null;
}

/** Map protection events → SL/TP/trailing alert types. */
export function forexProtectionEventToAlertType(eventType: string, protectionType?: string): ForexCustomerAlertType | null {
  if (eventType === 'PROTECTION_TRIGGERED' || eventType === 'PROTECTION_FILLED') {
    if (protectionType === 'TAKE_PROFIT') return 'TP_TRIGGERED';
    if (protectionType === 'STOP_LOSS') return 'SL_TRIGGERED';
  }
  if (eventType === 'TRAILING_UPDATED') return 'TRAILING_TRIGGERED';
  return null;
}
