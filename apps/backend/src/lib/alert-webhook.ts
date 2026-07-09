/**
 * Alert webhook: POST to Slack/email webhook on circuit_open and integrity_mismatch.
 * Fire-and-forget; never throws. Logs on failure.
 * URL: config/env first, then system_settings.alert_webhook_url.
 */

import { config } from '../config/index.js';
import { logger } from './logger.js';
import { db } from './database.js';

export type AlertPayload = {
  type: 'circuit_open' | 'integrity_mismatch' | 'engine_unavailable' | 'settlement_backlog' | 'tier1_reconciliation';
  violation?: string;
  source?: string;
  mismatches?: number;
  message?: string;
  /** For settlement_backlog: pending count */
  pendingCount?: number;
  /** For engine_unavailable: error message */
  error?: string;
};

function alertText(payload: AlertPayload): string {
  switch (payload.type) {
    case 'circuit_open':
      return `[EXCHANGE ALERT] Circuit breaker OPEN. Violation: ${payload.violation ?? 'unknown'}`;
    case 'integrity_mismatch':
      return `[EXCHANGE ALERT] Integrity mismatch. Source: ${payload.source ?? 'unknown'}. Mismatches: ${payload.mismatches ?? '?'}`;
    case 'engine_unavailable':
      return `[EXCHANGE ALERT] Matching engine unavailable. Match poller in backoff. ${payload.error ?? ''}`;
    case 'settlement_backlog':
      return `[EXCHANGE ALERT] Settlement backlog high: ${payload.pendingCount ?? '?'} pending (check SLO).`;
    case 'tier1_reconciliation':
      return `[EXCHANGE ALERT] Tier-1 reconciliation mismatch (no auto-fix). ${payload.message ?? ''}`.trim();
    default:
      return `[EXCHANGE ALERT] ${payload.message ?? payload.type}`;
  }
}

async function getAlertWebhookUrlFromSettings(): Promise<string | null> {
  try {
    const r = await db.query<{ value: unknown }>(`SELECT value FROM system_settings WHERE key = 'alert_webhook_url'`);
    const v = r.rows[0]?.value;
    if (v != null && typeof v === 'string' && v.trim()) return v.trim();
    return null;
  } catch {
    return null;
  }
}

/** When no webhook URL is configured, deliver critical alerts via SMTP (Resend/etc.). */
async function sendAlertEmailFallback(text: string, payload: AlertPayload): Promise<void> {
  const to = process.env.OPS_ALERT_EMAIL?.trim();
  if (!to) return;
  try {
    const { dynamicConfig } = await import('../services/dynamic-config.service.js');
    const smtp = await dynamicConfig.getSmtpConfig();
    if (!smtp?.host || !smtp.user || !smtp.pass) return;
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transporter.sendMail({
      from: `${smtp.fromName} <${smtp.fromEmail}>`,
      to,
      subject: `[EXCHANGE ALERT] ${payload.type}`,
      text,
    });
    transporter.close();
  } catch (err) {
    logger.warn('Alert email fallback failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function sendAlertWebhook(payload: AlertPayload): Promise<void> {
  const text = alertText(payload);
  let url = config.monitoring?.alertWebhookUrl ?? process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) url = await getAlertWebhookUrlFromSettings() ?? '';

  try {
    const { dynamicConfig } = await import('../services/dynamic-config.service.js');
    const channels = await dynamicConfig.getAlertChannelsConfig();
    if (!url && channels.webhookUrl) url = channels.webhookUrl;
    if (channels.slackWebhookUrl) {
      await postJson(channels.slackWebhookUrl, { text });
    }
    if (channels.pagerdutyKey) {
      await postJson('https://events.pagerduty.com/v2/enqueue', {
        routing_key: channels.pagerdutyKey,
        event_action: 'trigger',
        payload: { summary: text, severity: 'critical', source: 'exchange' },
      });
    }
  } catch {
    /* best-effort dynamic channels */
  }

  if (!url) {
    await sendAlertEmailFallback(text, payload);
    logger.warn('Alert webhook not configured; alert logged' + (process.env.OPS_ALERT_EMAIL?.trim() ? ' and emailed' : ' only'), {
      alert: text,
      type: payload.type,
    });
    return;
  }

  await postJson(url, { text, ...payload, timestamp: new Date().toISOString() });
}

async function postJson(url: string, body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn('Alert webhook non-2xx', { url: url.replace(/\/\/[^@]+@/, '//***@'), status: res.status });
    }
  } catch (err) {
    logger.warn('Alert webhook failed', { error: err instanceof Error ? err.message : String(err) });
  }
}
