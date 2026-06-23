/**
 * Web Push (VAPID) service — self-hosted, no 3rd-party key needed.
 *
 * Use `sendPushToUser(userId, payload)` anywhere in backend to dispatch a notification
 * to every active subscription for that user (browsers / devices the user opted into).
 *
 * Failures are swallowed per-subscription and 404/410 responses automatically mark the
 * subscription as disabled (browser unsubscribed / expired).
 */
import webpush from 'web-push';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

interface EffectiveVapid {
  subject: string;
  publicKey: string;
  privateKey: string;
}

// Short in-process cache so we don't hit the DB on every push, while still
// picking up admin changes within ~30s automatically (or instantly via reset).
const CONFIG_TTL_MS = 30_000;
let cachedVapid: EffectiveVapid | null = null;
let cacheExpiry = 0;
let appliedKey: string | null = null; // last "subject|public|private" passed to setVapidDetails

/** Force the next call to reload VAPID config from DB (called by admin on save/generate). */
export function resetPushConfigCache(): void {
  cachedVapid = null;
  cacheExpiry = 0;
}

/**
 * Resolve effective VAPID config: dynamic DB (api_settings category='web_push', active) first,
 * then fall back to env (config.webPush). Returns null when push is not configured.
 */
async function loadEffectiveVapid(): Promise<EffectiveVapid | null> {
  const now = Date.now();
  if (now < cacheExpiry) return cachedVapid;

  let resolved: EffectiveVapid | null = null;
  try {
    const r = await db.query<{
      api_key: string | null;
      api_secret: string | null;
      additional_config: Record<string, string> | null;
    }>(
      `SELECT api_key, api_secret, additional_config
         FROM api_settings
        WHERE category = 'web_push' AND is_active = TRUE
        ORDER BY is_default DESC, updated_at DESC
        LIMIT 1`
    );
    const row = r.rows[0];
    if (row?.api_key && row?.api_secret) {
      resolved = {
        subject: row.additional_config?.subject || config.webPush.subject || 'mailto:admin@example.com',
        publicKey: row.api_key,
        privateKey: row.api_secret,
      };
    }
  } catch (err) {
    // Table may not exist yet in early boot — fall back to env silently.
    logger.debug?.('web_push DB config read failed; using env fallback', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  if (!resolved && config.webPush.enabled && config.webPush.publicKey && config.webPush.privateKey) {
    resolved = {
      subject: config.webPush.subject,
      publicKey: config.webPush.publicKey,
      privateKey: config.webPush.privateKey,
    };
  }

  cachedVapid = resolved;
  cacheExpiry = now + CONFIG_TTL_MS;
  return resolved;
}

/** Ensure webpush has the current VAPID details applied. Returns false when not configured. */
async function ensureInit(): Promise<boolean> {
  const eff = await loadEffectiveVapid();
  if (!eff) return false;
  const fingerprint = `${eff.subject}|${eff.publicKey}|${eff.privateKey}`;
  if (appliedKey !== fingerprint) {
    try {
      webpush.setVapidDetails(eff.subject, eff.publicKey, eff.privateKey);
      appliedKey = fingerprint;
    } catch (err) {
      logger.warn('Web Push init failed', { error: err instanceof Error ? err.message : 'Unknown' });
      return false;
    }
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export async function isPushEnabled(): Promise<boolean> {
  return ensureInit();
}

export async function getVapidPublicKey(): Promise<string | null> {
  const eff = await loadEffectiveVapid();
  return eff?.publicKey ?? null;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!(await ensureInit())) return { sent: 0, failed: 0 };

  const r = await db.query<SubRow>(
    `SELECT id, endpoint, p256dh, auth
       FROM push_subscriptions
      WHERE user_id = $1 AND disabled_at IS NULL`,
    [userId]
  );
  if (r.rows.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(r.rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        body,
        { TTL: 60 }
      );
      sent++;
      // Best-effort: update last_used_at. Never fail the send on this.
      db.query(`UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});
    } catch (err: any) {
      failed++;
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Endpoint gone — disable row permanently.
        db.query(
          `UPDATE push_subscriptions SET disabled_at = NOW() WHERE id = $1`,
          [row.id]
        ).catch(() => {});
      } else {
        logger.warn('Push send failed', { subId: row.id, status, err: err?.message });
      }
    }
  }));

  return { sent, failed };
}

export async function saveSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string
): Promise<void> {
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       disabled_at = NULL,
       last_used_at = NOW()`,
    [userId, endpoint, p256dh, auth, userAgent || null]
  );
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await db.query(
    `UPDATE push_subscriptions SET disabled_at = NOW() WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint]
  );
}
