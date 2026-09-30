/**
 * Forex customer alert delivery adapters. External channels fail closed when unconfigured.
 */
import { db } from '../../../lib/database.js';
import { randomUUID } from 'node:crypto';

export type AlertDeliveryChannel = 'WEB' | 'PUSH' | 'EMAIL' | 'WEBHOOK';

export type DeliveryAdapterStatus = {
  channel: AlertDeliveryChannel;
  configured: boolean;
  available: boolean;
  reason?: string;
};

function envConfigured(key: string): boolean {
  const v = process.env[key];
  return typeof v === 'string' && v.trim().length > 0;
}

export function listForexAlertDeliveryStatus(): DeliveryAdapterStatus[] {
  return [
    { channel: 'WEB', configured: true, available: true },
    {
      channel: 'PUSH',
      configured: envConfigured('FOREX_ALERT_PUSH_URL') || envConfigured('FOREX_ALERT_PUSH_PROVIDER'),
      available: envConfigured('FOREX_ALERT_PUSH_URL'),
      reason: 'FOREX_ALERT_PUSH_URL not configured',
    },
    {
      channel: 'EMAIL',
      configured: envConfigured('FOREX_ALERT_EMAIL_FROM') && envConfigured('SMTP_HOST'),
      available: envConfigured('FOREX_ALERT_EMAIL_FROM') && envConfigured('SMTP_HOST'),
      reason: 'SMTP / FOREX_ALERT_EMAIL_FROM not configured',
    },
    {
      channel: 'WEBHOOK',
      configured: envConfigured('FOREX_ALERT_WEBHOOK_URL'),
      available: envConfigured('FOREX_ALERT_WEBHOOK_URL'),
      reason: 'FOREX_ALERT_WEBHOOK_URL not configured',
    },
  ];
}

export async function deliverForexAlertEvent(args: {
  alertId: string;
  accountId: string;
  channel: AlertDeliveryChannel;
  message: string;
  metadata: Record<string, unknown>;
  enabledFlags: { web: boolean; push: boolean; email: boolean; webhook: boolean };
}): Promise<{ eventId: string; status: 'DELIVERED' | 'NOT_CONFIGURED' | 'SKIPPED' | 'FAILED'; detail?: string }> {
  const eventId = randomUUID();
  const flag =
    args.channel === 'WEB'
      ? args.enabledFlags.web
      : args.channel === 'PUSH'
        ? args.enabledFlags.push
        : args.channel === 'EMAIL'
          ? args.enabledFlags.email
          : args.enabledFlags.webhook;

  if (!flag) {
    await db.query(
      `INSERT INTO forex_customer_alert_events (event_id, alert_id, account_id, delivery_channel, status, message, metadata)
       VALUES ($1,$2,$3,$4,'SKIPPED',$5,$6)`,
      [eventId, args.alertId, args.accountId, args.channel, args.message, JSON.stringify({ ...args.metadata, reason: 'CHANNEL_DISABLED' })]
    );
    return { eventId, status: 'SKIPPED' };
  }

  if (args.channel === 'WEB') {
    await db.query(
      `INSERT INTO forex_customer_alert_events (event_id, alert_id, account_id, delivery_channel, status, message, metadata)
       VALUES ($1,$2,$3,'WEB','DELIVERED',$4,$5)`,
      [eventId, args.alertId, args.accountId, args.message, JSON.stringify(args.metadata)]
    );
    return { eventId, status: 'DELIVERED' };
  }

  const st = listForexAlertDeliveryStatus().find((s) => s.channel === args.channel);
  if (!st?.available) {
    await db.query(
      `INSERT INTO forex_customer_alert_events (event_id, alert_id, account_id, delivery_channel, status, message, metadata)
       VALUES ($1,$2,$3,$4,'NOT_CONFIGURED',$5,$6)`,
      [
        eventId,
        args.alertId,
        args.accountId,
        args.channel,
        args.message,
        JSON.stringify({ ...args.metadata, reason: st?.reason ?? 'NOT_CONFIGURED' }),
      ]
    );
    return { eventId, status: 'NOT_CONFIGURED', detail: st?.reason };
  }

  // Provider hooks would run here; architecture only until URLs are set.
  await db.query(
    `INSERT INTO forex_customer_alert_events (event_id, alert_id, account_id, delivery_channel, status, message, metadata)
     VALUES ($1,$2,$3,$4,'FAILED',$5,$6)`,
    [eventId, args.alertId, args.accountId, args.channel, args.message, JSON.stringify({ ...args.metadata, reason: 'ADAPTER_NOT_IMPLEMENTED' })]
  );
  return { eventId, status: 'FAILED', detail: 'ADAPTER_NOT_IMPLEMENTED' };
}
