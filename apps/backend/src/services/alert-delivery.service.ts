/**
 * Delivers ops/infrastructure alerts to configured notification providers (api_settings category=alert).
 * Admin-managed — no .env required when providers are active in DB.
 */
import { logger } from '../lib/logger.js';
import { dynamicConfig, type ResolvedProvider } from './dynamic-config.service.js';
import type { OpsAlertPayload } from './ops-alert.service.js';

const LEVEL_LABEL: Record<string, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO',
};

function formatAlertText(p: OpsAlertPayload): string {
  const level = LEVEL_LABEL[p.severity] ?? p.severity.toUpperCase();
  const type = p.alertType ?? 'general';
  return `*[${level}]* [${type}] ${p.title}\n${p.body}`;
}

async function postJson(url: string, payload: Record<string, unknown>, headers?: Record<string, string>): Promise<{ ok: boolean; status: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return { ok: r.ok || r.status === 204, status: r.status };
  } finally {
    clearTimeout(t);
  }
}

async function deliverToProvider(provider: ResolvedProvider, p: OpsAlertPayload): Promise<{ success: boolean; message: string }> {
  const text = formatAlertText(p);
  const prov = provider.provider;

  try {
    if (prov === 'telegram') {
      const token = provider.apiKey?.trim();
      const chatId = provider.config.chat_id?.trim() || provider.config.chatId?.trim();
      if (!token) return { success: false, message: 'Telegram bot token missing' };
      if (!chatId) return { success: false, message: 'Telegram chat_id missing in additional_config' };
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const r = await postJson(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
      return { success: r.ok, message: r.ok ? 'Telegram message sent' : `Telegram HTTP ${r.status}` };
    }

    if (prov === 'discord') {
      const webhookUrl = provider.apiUrl?.trim() || provider.apiKey?.trim();
      if (!webhookUrl) return { success: false, message: 'Discord webhook URL missing' };
      const r = await postJson(webhookUrl, {
        content: text.slice(0, 2000),
        embeds: p.context
          ? [{ description: '```json\n' + JSON.stringify(p.context, null, 2).slice(0, 3500) + '\n```', color: p.severity === 'critical' ? 0xef4444 : p.severity === 'warning' ? 0xf59e0b : 0x22c55e }]
          : undefined,
      });
      return { success: r.ok, message: r.ok ? 'Discord webhook delivered' : `Discord HTTP ${r.status}` };
    }

    if (prov === 'pagerduty') {
      const routingKey = provider.apiSecret?.trim() || provider.apiKey?.trim();
      if (!routingKey) return { success: false, message: 'PagerDuty routing key missing' };
      const r = await postJson('https://events.pagerduty.com/v2/enqueue', {
        routing_key: routingKey,
        event_action: 'trigger',
        payload: {
          summary: p.title,
          severity: p.severity === 'critical' ? 'critical' : p.severity === 'warning' ? 'warning' : 'info',
          source: 'metherium-admin',
          custom_details: { body: p.body, ...p.context },
        },
      });
      return { success: r.ok, message: r.ok ? 'PagerDuty event queued' : `PagerDuty HTTP ${r.status}` };
    }

    if (prov === 'email') {
      const to = provider.config.to?.trim() || provider.config.recipient?.trim();
      if (!to) return { success: false, message: 'Email recipient (additional_config.to) missing' };
      const smtp = await dynamicConfig.getSmtpConfig();
      if (!smtp?.host || !smtp.user || !smtp.pass) {
        return { success: false, message: 'SMTP not configured — set up Email provider in Integrations Center first' };
      }
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
        subject: `[${LEVEL_LABEL[p.severity] ?? p.severity}] ${p.title}`,
        text: `${p.body}\n\n${p.context ? JSON.stringify(p.context, null, 2) : ''}`,
      });
      transporter.close();
      return { success: true, message: `Email sent to ${to}` };
    }

    // webhook, slack, and generic
    const url = provider.apiUrl?.trim() || provider.apiKey?.trim();
    if (!url) return { success: false, message: 'Webhook URL missing' };
    const slackPayload = {
      text,
      attachments: p.context
        ? [{
            color: p.severity === 'critical' ? 'danger' : p.severity === 'warning' ? 'warning' : '#36a64f',
            text: '```' + JSON.stringify(p.context, null, 2).slice(0, 3500) + '```',
          }]
        : undefined,
    };
    const r = await postJson(url, slackPayload);
    return { success: r.ok, message: r.ok ? 'Webhook delivered' : `Webhook HTTP ${r.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('alert_delivery: provider failed', { provider: prov, error: msg });
    return { success: false, message: msg };
  }
}

/** Send alert to a single provider by api_settings id. */
export async function sendAlertToProviderById(
  settingId: string,
  p: OpsAlertPayload,
): Promise<{ success: boolean; message: string; provider?: string }> {
  const row = await dynamicConfig.getProviderById(settingId);
  if (!row) return { success: false, message: 'Provider not found' };
  if (row.category !== 'alert') return { success: false, message: 'Not an alert provider' };
  const result = await deliverToProvider(row, p);
  return { ...result, provider: row.provider };
}

/** Fan out to all active alert providers. */
export async function deliverAlertToAllProviders(p: OpsAlertPayload): Promise<number> {
  let sent = 0;
  try {
    const providers = await dynamicConfig.getProviders('alert');
    for (const prov of providers) {
      const r = await deliverToProvider(prov, p);
      if (r.success) sent++;
    }
  } catch (e) {
    logger.warn('alert_delivery: fanout failed', { error: e instanceof Error ? e.message : String(e) });
  }
  return sent;
}

/** Standard test alert payload for admin "Send Test Alert" button. */
export function buildTestAlertPayload(): OpsAlertPayload {
  return {
    severity: 'info',
    title: 'Metherium Alert Provider Test',
    body: 'This is a test alert from the Admin Alert Providers panel. Safe to ignore.',
    dedupeKey: `test:${Date.now()}`,
    alertType: 'general',
    context: { source: 'admin_test', timestamp: new Date().toISOString() },
  };
}

/** Connection test (no side effects beyond a minimal ping). */
export async function testAlertProviderConnection(provider: ResolvedProvider): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  const prov = provider.provider;
  const testPayload = buildTestAlertPayload();

  if (prov === 'telegram') {
    const token = provider.apiKey?.trim();
    if (!token) return { success: false, message: 'Bot token missing', latencyMs: 0 };
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) });
      const data = (await r.json()) as { ok?: boolean; description?: string };
      return {
        success: Boolean(data.ok),
        message: data.ok ? 'Telegram bot token valid' : (data.description ?? `HTTP ${r.status}`),
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Telegram ping failed', latencyMs: Date.now() - start };
    }
  }

  if (prov === 'pagerduty') {
    const key = provider.apiSecret?.trim() || provider.apiKey?.trim();
    if (!key) return { success: false, message: 'Routing key missing', latencyMs: 0 };
    return { success: key.length >= 20, message: 'PagerDuty routing key configured', latencyMs: Date.now() - start };
  }

  if (prov === 'email') {
    const to = provider.config.to?.trim();
    if (!to) return { success: false, message: 'Recipient email (additional_config.to) missing', latencyMs: 0 };
    return { success: true, message: `Email recipient configured: ${to}`, latencyMs: Date.now() - start };
  }

  // webhook, slack, discord — send minimal test
  const result = await deliverToProvider(provider, testPayload);
  return { success: result.success, message: result.message, latencyMs: Date.now() - start };
}
