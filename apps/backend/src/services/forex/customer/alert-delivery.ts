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

  const sent = await dispatchConfiguredForexAlert({
    channel: args.channel,
    message: args.message,
    metadata: args.metadata,
  });
  const status = sent.ok ? 'DELIVERED' : 'FAILED';
  await db.query(
    `INSERT INTO forex_customer_alert_events (event_id, alert_id, account_id, delivery_channel, status, message, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      eventId,
      args.alertId,
      args.accountId,
      args.channel,
      status,
      args.message,
      JSON.stringify({ ...args.metadata, reason: sent.ok ? 'SENT' : sent.detail }),
    ]
  );
  return { eventId, status, detail: sent.ok ? undefined : sent.detail };
}

type AlertFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

let alertFetchImpl: AlertFetch | null = null;

export function setForexAlertFetchForTests(fetchImpl: AlertFetch | null): void {
  alertFetchImpl = fetchImpl;
}

async function postJson(url: string, payload: unknown): Promise<{ ok: boolean; status: number }> {
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
  if (alertFetchImpl) return alertFetchImpl(url, init);
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status };
}

/** Sends only after the channel is configured. A failed post is not DELIVERED. */
export async function dispatchConfiguredForexAlert(args: {
  channel: AlertDeliveryChannel;
  message: string;
  metadata: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (args.channel === 'WEB') return { ok: true };
  if (args.channel === 'PUSH' || args.channel === 'WEBHOOK') {
    const url = (args.channel === 'PUSH' ? process.env.FOREX_ALERT_PUSH_URL : process.env.FOREX_ALERT_WEBHOOK_URL)?.trim() ?? '';
    if (!url) return { ok: false, detail: 'NOT_CONFIGURED' };
    try {
      const res = await postJson(url, { channel: args.channel, message: args.message, metadata: args.metadata });
      if (!res.ok) return { ok: false, detail: `HTTP_${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : 'SEND_FAILED' };
    }
  }
  const host = process.env.SMTP_HOST?.trim() ?? '';
  const from = process.env.FOREX_ALERT_EMAIL_FROM?.trim() ?? '';
  const to = (typeof args.metadata.email === 'string' ? args.metadata.email : process.env.FOREX_ALERT_EMAIL_TO)?.trim() ?? '';
  if (!host || !from || !to) return { ok: false, detail: 'NOT_CONFIGURED' };
  try {
    const nodemailer = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT ?? '587');
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS ?? '';
    const transport = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
    await transport.sendMail({ from, to, subject: 'Forex alert', text: args.message });
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'SEND_FAILED' };
  }
}
