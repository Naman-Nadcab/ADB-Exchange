/**
 * Dynamic Configuration Service
 * Reads integration config (SMTP, SMS, RPC, KYC) from api_settings table with Redis caching.
 * Falls back to process.env when no active DB config exists.
 * Admin UI updates → DB → Redis cache invalidated on next TTL expiry or explicit flush.
 */
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { resolveProviderSecret } from '../lib/provider-secret.js';

const CACHE_PREFIX = 'dynconf:';
const DEFAULT_TTL_SEC = 60; // 1 minute cache — balance between freshness and DB load

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export interface SmsConfig {
  provider: 'twilio' | 'msg91' | 'textlocal' | 'fast2sms';
  apiKey: string;
  apiSecret?: string;
  senderId?: string;
  messageId?: string;
  route?: string;
}

export interface KycConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
  sandboxMode: boolean;
}

export interface RpcConfig {
  chainSlug: string;
  rpcUrl: string;
  wsUrl?: string;
  backupUrl?: string;
  timeout: number;
}

interface ApiSettingRow {
  id: string;
  category: string;
  provider: string;
  name: string;
  api_key: string | null;
  api_secret: string | null;
  api_url: string | null;
  additional_config: Record<string, string> | null;
  is_active: boolean;
  is_default: boolean;
  secret_encrypted?: boolean | null;
  priority?: number | null;
  environment?: string | null;
}

/** Resolved provider returned by the generic getProvider()/getProviders() facade. */
export interface ResolvedProvider {
  id: string;
  category: string;
  provider: string;
  name: string;
  apiKey: string | null;
  /** Decrypted secret (dual-read aware). */
  apiSecret: string | null;
  apiUrl: string | null;
  config: Record<string, string>;
  priority: number;
  environment: string;
  isDefault: boolean;
}

class DynamicConfigService {
  private async getCached<T>(key: string): Promise<T | null> {
    try {
      return await redis.getJson<T>(`${CACHE_PREFIX}${key}`);
    } catch {
      return null;
    }
  }

  private async setCache<T>(key: string, value: T, ttl = DEFAULT_TTL_SEC): Promise<void> {
    try {
      await redis.setJson(`${CACHE_PREFIX}${key}`, value, ttl);
    } catch { /* best effort */ }
  }

  async flushCategory(category: string): Promise<void> {
    try {
      await redis.del(`${CACHE_PREFIX}${category}:active`);
      logger.info(`Dynamic config cache flushed for category: ${category}`);
    } catch { /* best effort */ }
  }

  async flushAll(): Promise<void> {
    const categories = ['email', 'sms', 'kyc', 'rpc', 'chart', 'market_data', 'push', 'oauth', 'recaptcha', 'social_login', 'web_push', 'aml', 'alert', 'captcha', 'monitoring', 'analytics', 'storage', 'ai', 'travel_rule', 'custody', 'support'];
    await Promise.all(categories.map(c => this.flushCategory(c)));
  }

  private async getActiveSettings(category: string): Promise<ApiSettingRow[]> {
    const cacheKey = `${category}:active`;
    // Cache stores RAW rows (api_secret may be ciphertext); we decrypt on return
    // so plaintext secrets are never persisted in Redis.
    let rows = await this.getCached<ApiSettingRow[]>(cacheKey);
    if (!rows) {
      try {
        const result = await db.query<ApiSettingRow>(
          `SELECT id, category, provider, name, api_key, api_secret, api_url, additional_config,
                  is_active, is_default, secret_encrypted, priority, environment
           FROM api_settings WHERE category = $1 AND is_active = TRUE
           ORDER BY priority ASC, is_default DESC, updated_at DESC`,
          [category]
        );
        rows = result.rows;
        await this.setCache(cacheKey, rows);
      } catch (error) {
        logger.error('Failed to fetch dynamic config', { category, error: error instanceof Error ? error.message : String(error) });
        return [];
      }
    }
    return rows.map((r) => ({ ...r, api_secret: resolveProviderSecret(r.api_secret, r.secret_encrypted) }));
  }

  /**
   * Generic provider resolver — single source of truth for all categories.
   * Returns the highest-priority active provider (env fallback handled by callers).
   */
  async getProvider(category: string): Promise<ResolvedProvider | null> {
    const list = await this.getProviders(category);
    return list[0] ?? null;
  }

  /** Priority-ordered active providers for a category (primary first, then failovers). */
  async getProviders(category: string): Promise<ResolvedProvider[]> {
    const rows = await this.getActiveSettings(category);
    return rows
      .filter((r) => r.api_key || r.api_url || r.api_secret)
      .map((r) => ({
        id: r.id,
        category: r.category,
        provider: r.provider,
        name: r.name,
        apiKey: r.api_key,
        apiSecret: r.api_secret,
        apiUrl: r.api_url,
        config: r.additional_config || {},
        priority: r.priority ?? 100,
        environment: r.environment ?? 'production',
        isDefault: r.is_default,
      }));
  }

  /** Load a single provider by id (includes inactive — for admin test/send). */
  async getProviderById(id: string): Promise<ResolvedProvider | null> {
    try {
      const result = await db.query<ApiSettingRow>(
        `SELECT id, category, provider, name, api_key, api_secret, api_url, additional_config,
                is_active, is_default, secret_encrypted, priority, environment
         FROM api_settings WHERE id = $1`,
        [id],
      );
      const r = result.rows[0];
      if (!r) return null;
      const secret = resolveProviderSecret(r.api_secret, r.secret_encrypted);
      return {
        id: r.id,
        category: r.category,
        provider: r.provider,
        name: r.name,
        apiKey: r.api_key,
        apiSecret: secret,
        apiUrl: r.api_url,
        config: r.additional_config || {},
        priority: r.priority ?? 100,
        environment: r.environment ?? 'production',
        isDefault: r.is_default,
      };
    } catch {
      return null;
    }
  }

  async getSmtpConfig(): Promise<SmtpConfig | null> {
    const rows = await this.getActiveSettings('email');
    if (rows.length > 0) {
      const built = this.smtpFromRow(rows[0]!);
      if (built) return built;
    }

    if (config.email.user && (config.email.password || process.env.SMTP_PASS)) {
      let fromEmail = config.email.from;
      let fromName = 'Metherium';
      const angleMatch = fromEmail.match(/<([^>]+)>/);
      if (angleMatch) {
        fromName = fromEmail.replace(/<[^>]+>/, '').replace(/^["'\s]+|["'\s]+$/g, '').trim() || fromName;
        fromEmail = angleMatch[1]!;
      }
      return {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        user: config.email.user,
        pass: config.email.password || process.env.SMTP_PASS || '',
        fromEmail,
        fromName,
      };
    }

    return null;
  }

  async getSmsConfig(): Promise<SmsConfig | null> {
    const rows = await this.getActiveSettings('sms');
    if (rows.length > 0) {
      const row = rows[0]!;
      const extra = row.additional_config || {};
      if (row.api_key) {
        return {
          provider: row.provider as SmsConfig['provider'],
          apiKey: row.api_key,
          apiSecret: row.api_secret ?? extra.api_secret ?? undefined,
          senderId: extra.sender_id || 'INRXPE',
          messageId: extra.message_id || '181649',
          route: extra.route || 'dlt',
        };
      }
    }

    const twilioSid = config.sms.twilio.accountSid;
    const twilioToken = config.sms.twilio.authToken;
    const twilioPhone = config.sms.twilio.phoneNumber;
    if (twilioSid && twilioToken && twilioPhone) {
      return { provider: 'twilio', apiKey: twilioSid, apiSecret: twilioToken, senderId: twilioPhone };
    }

    if (process.env.SMS_API_KEY) {
      return {
        provider: (process.env.SMS_PROVIDER || 'twilio') as SmsConfig['provider'],
        apiKey: process.env.SMS_API_KEY,
        apiSecret: process.env.SMS_API_SECRET,
        senderId: process.env.SMS_SENDER_ID,
      };
    }

    return null;
  }

  async getKycConfig(): Promise<KycConfig | null> {
    const rows = await this.getActiveSettings('kyc');
    if (rows.length > 0) {
      const row = rows[0]!;
      const extra = row.additional_config || {};
      if (row.api_key) {
        return {
          provider: row.provider,
          baseUrl: row.api_url || extra.base_url || '',
          apiKey: row.api_key,
          apiSecret: row.api_secret ?? undefined,
          webhookSecret: extra.webhook_secret,
          sandboxMode: extra.sandbox_mode === 'true',
        };
      }
    }

    if (config.kyc.hyperverge.appId && config.kyc.hyperverge.appKey) {
      return {
        provider: 'hyperverge',
        baseUrl: config.kyc.hyperverge.baseUrl || '',
        apiKey: config.kyc.hyperverge.appId,
        apiSecret: config.kyc.hyperverge.appKey,
        sandboxMode: false,
      };
    }

    return null;
  }

  async getRpcConfigs(): Promise<RpcConfig[]> {
    const rows = await this.getActiveSettings('rpc');
    const configs: RpcConfig[] = [];

    for (const row of rows) {
      const extra = row.additional_config || {};
      configs.push({
        chainSlug: row.provider,
        rpcUrl: row.api_url || row.api_key || '',
        wsUrl: extra.ws_url,
        backupUrl: extra.backup_url,
        timeout: parseInt(extra.timeout || '30000', 10),
      });
    }

    return configs;
  }

  /** Test SMTP connection by sending a test email or verifying transport */
  async testSmtp(settingId: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const result = await db.query<ApiSettingRow>('SELECT * FROM api_settings WHERE id = $1', [settingId]);
      if (result.rows.length === 0) return { success: false, message: 'Setting not found', latencyMs: 0 };

      const row = result.rows[0]!;
      const extra = row.additional_config || {};
      const host = extra.host || row.api_url;
      const port = parseInt(extra.port || '465', 10);
      const user = row.api_key;
      const pass = resolveProviderSecret(row.api_secret, row.secret_encrypted);

      if (!host || !user || !pass) {
        return { success: false, message: 'Missing SMTP credentials (host, user, or password)', latencyMs: Date.now() - start };
      }

      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host,
        port,
        secure: port === 465,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        auth: { user, pass },
      });

      await transporter.verify();
      transporter.close();
      return { success: true, message: `SMTP connection to ${host}:${port} verified`, latencyMs: Date.now() - start };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error', latencyMs: Date.now() - start };
    }
  }

  /** Test SMS by sending to the provider's validation endpoint (no actual SMS sent) */
  async testSms(settingId: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const result = await db.query<ApiSettingRow>('SELECT * FROM api_settings WHERE id = $1', [settingId]);
      if (result.rows.length === 0) return { success: false, message: 'Setting not found', latencyMs: 0 };

      const row = result.rows[0]!;
      if (!row.api_key) return { success: false, message: 'API key is missing', latencyMs: Date.now() - start };
      const smsSecret = resolveProviderSecret(row.api_secret, row.secret_encrypted);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      let testUrl: string;
      let testOpts: RequestInit;

      switch (row.provider) {
        case 'twilio': {
          testUrl = `https://api.twilio.com/2010-04-01/Accounts/${row.api_key}.json`;
          testOpts = {
            headers: { Authorization: 'Basic ' + Buffer.from(`${row.api_key}:${smsSecret}`).toString('base64') },
            signal: controller.signal,
          };
          break;
        }
        case 'fast2sms': {
          testUrl = `https://www.fast2sms.com/dev/wallet`;
          testOpts = {
            headers: { authorization: row.api_key, 'cache-control': 'no-cache' },
            signal: controller.signal,
          };
          break;
        }
        case 'msg91': {
          testUrl = `https://control.msg91.com/api/v5/report/all?authkey=${row.api_key}&limit=1`;
          testOpts = { signal: controller.signal };
          break;
        }
        default: {
          clearTimeout(timeout);
          return { success: true, message: `Provider '${row.provider}' has no test endpoint; credentials saved.`, latencyMs: Date.now() - start };
        }
      }

      const res = await fetch(testUrl, testOpts);
      clearTimeout(timeout);

      if (res.ok) {
        return { success: true, message: `${row.provider} API responded OK (${res.status})`, latencyMs: Date.now() - start };
      }
      return { success: false, message: `${row.provider} returned ${res.status}: ${res.statusText}`, latencyMs: Date.now() - start };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error', latencyMs: Date.now() - start };
    }
  }

  /** Test RPC by calling eth_blockNumber or equivalent */
  async testRpc(settingId: string): Promise<{ success: boolean; message: string; latencyMs: number; blockNumber?: string }> {
    const start = Date.now();
    try {
      const result = await db.query<ApiSettingRow>('SELECT * FROM api_settings WHERE id = $1', [settingId]);
      if (result.rows.length === 0) return { success: false, message: 'Setting not found', latencyMs: 0 };

      const row = result.rows[0]!;
      const rpcUrl = row.api_url || row.api_key;
      if (!rpcUrl) return { success: false, message: 'RPC URL is missing', latencyMs: Date.now() - start };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        try { const { recordRpcCall } = await import('./rpc-metrics.service.js'); await recordRpcCall(row.provider, false, `HTTP ${res.status}`); } catch { /* best-effort */ }
        return { success: false, message: `RPC returned ${res.status}`, latencyMs: Date.now() - start };
      }

      const data = await res.json() as { result?: string; error?: { message?: string } };
      if (data.error) {
        try { const { recordRpcCall } = await import('./rpc-metrics.service.js'); await recordRpcCall(row.provider, false, data.error.message || 'RPC error'); } catch { /* best-effort */ }
        return { success: false, message: data.error.message || 'RPC error', latencyMs: Date.now() - start };
      }

      try { const { recordRpcCall } = await import('./rpc-metrics.service.js'); await recordRpcCall(row.provider, true); } catch { /* best-effort */ }
      const blockNum = data.result ? parseInt(data.result, 16).toString() : 'unknown';
      return { success: true, message: `Connected. Latest block: ${blockNum}`, latencyMs: Date.now() - start, blockNumber: blockNum };
    } catch (error) {
      try { const { recordRpcCall } = await import('./rpc-metrics.service.js'); await recordRpcCall('unknown', false, error instanceof Error ? error.message : 'unknown'); } catch { /* best-effort */ }
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error', latencyMs: Date.now() - start };
    }
  }

  /** Test KYC provider by hitting its health/status endpoint */
  async testKyc(settingId: string): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const result = await db.query<ApiSettingRow>('SELECT * FROM api_settings WHERE id = $1', [settingId]);
      if (result.rows.length === 0) return { success: false, message: 'Setting not found', latencyMs: 0 };

      const row = result.rows[0]!;
      const baseUrl = row.api_url;

      if (!baseUrl || !row.api_key) {
        return { success: false, message: 'Base URL or API key is missing', latencyMs: Date.now() - start };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const healthUrl = baseUrl.replace(/\/$/, '') + '/api/v1/health';
      const res = await fetch(healthUrl, {
        headers: { 'appId': row.api_key, 'appKey': resolveProviderSecret(row.api_secret, row.secret_encrypted) || '' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return { success: true, message: `KYC provider (${row.provider}) is reachable`, latencyMs: Date.now() - start };
      }
      return { success: false, message: `KYC provider returned ${res.status}`, latencyMs: Date.now() - start };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error', latencyMs: Date.now() - start };
    }
  }

  /** Alert channels from api_settings (category alert) with legacy system_settings fallback. */
  async getAlertChannelsConfig(): Promise<{
    webhookUrl: string;
    slackWebhookUrl: string;
    pagerdutyKey: string;
    opsAlertEmail: string;
  }> {
    const providers = await this.getProviders('alert');
    let webhookUrl = '';
    let slackWebhookUrl = '';
    let pagerdutyKey = '';
    for (const p of providers) {
      const url = p.apiUrl || p.apiKey || '';
      if (p.provider === 'webhook' && url) webhookUrl = url;
      if (p.provider === 'slack' && url) slackWebhookUrl = url;
      if (p.provider === 'pagerduty' && (p.apiSecret || p.apiKey)) pagerdutyKey = p.apiSecret || p.apiKey || '';
    }
    if (!webhookUrl || !slackWebhookUrl || !pagerdutyKey) {
      try {
        const rows = await db.query<{ key: string; value: unknown }>(
          `SELECT key, value FROM system_settings WHERE key = ANY($1::text[])`,
          [['alert_webhook_url', 'alert_slack_webhook_url', 'alert_pagerduty_key']],
        );
        for (const r of rows.rows ?? []) {
          const v = typeof r.value === 'string' ? r.value : String(r.value ?? '').replace(/^"|"$/g, '');
          if (r.key === 'alert_webhook_url' && !webhookUrl) webhookUrl = v;
          if (r.key === 'alert_slack_webhook_url' && !slackWebhookUrl) slackWebhookUrl = v;
          if (r.key === 'alert_pagerduty_key' && !pagerdutyKey) pagerdutyKey = v;
        }
      } catch { /* best-effort legacy */ }
    }
    return {
      webhookUrl,
      slackWebhookUrl,
      pagerdutyKey,
      opsAlertEmail: process.env.OPS_ALERT_EMAIL?.trim() || '',
    };
  }

  /** Active CAPTCHA provider (turnstile, hcaptcha, google recaptcha). */
  async getCaptchaConfig(): Promise<{
    provider: string;
    siteKey: string;
    secretKey: string;
  } | null> {
    for (const cat of ['captcha', 'recaptcha'] as const) {
      const p = await this.getProvider(cat);
      if (p?.apiKey && p.apiSecret) {
        return { provider: p.provider, siteKey: p.apiKey, secretKey: p.apiSecret };
      }
    }
    return null;
  }

  /** Sentry DSN from monitoring/sentry row. */
  async getSentryConfig(): Promise<{ dsn: string; environment: string } | null> {
    const p = await this.getProvider('monitoring');
    if (!p || p.provider !== 'sentry') {
      const rows = await this.getActiveSettings('monitoring');
      const sentry = rows.find((r) => r.provider === 'sentry');
      if (!sentry) return null;
      const extra = sentry.additional_config || {};
      const dsn = extra.dsn || sentry.api_url || sentry.api_key || '';
      if (!dsn.trim()) return null;
      return { dsn: dsn.trim(), environment: sentry.environment ?? 'production' };
    }
    const dsn = p.config.dsn || p.apiUrl || p.apiKey || '';
    if (!dsn.trim()) return null;
    return { dsn: dsn.trim(), environment: p.environment };
  }

  /** External price feed sources from chart/market_data providers. */
  async getPriceFeedBaseUrls(): Promise<string[]> {
    const chart = await this.getProviders('chart');
    const market = await this.getProviders('market_data');
    const urls: string[] = [];
    for (const p of [...chart, ...market]) {
      const u = (p.apiUrl || p.config.base_url || '').trim();
      if (u) urls.push(u.replace(/\/$/, ''));
    }
    if (urls.length > 0) return urls;
    if (config.externalPriceFeed.sourceBaseUrls.length > 0) {
      return config.externalPriceFeed.sourceBaseUrls;
    }
    const b = config.externalPriceFeed.baseUrl?.trim();
    return [b || 'https://api.binance.com'];
  }

  async isPriceFeedEnabled(): Promise<boolean> {
    const active = await this.getProviders('chart');
    if (active.some((p) => p.apiUrl || p.apiKey)) return true;
    return config.externalPriceFeed.enabled;
  }

  /** Object storage config for KYC uploads etc. */
  async getStorageConfig(): Promise<{
    provider: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    endpoint: string;
  } | null> {
    const p = await this.getProvider('storage');
    if (!p?.apiKey || !p.apiSecret) return null;
    const extra = p.config;
    const bucket = extra.bucket?.trim();
    if (!bucket) return null;
    return {
      provider: p.provider,
      accessKey: p.apiKey,
      secretKey: p.apiSecret,
      bucket,
      region: extra.region?.trim() || 'us-east-1',
      endpoint: p.apiUrl?.trim() || '',
    };
  }

  /** AML / sanctions config from api_settings (primary) — syncs legacy system_settings when found. */
  async getSanctionsProviderConfig(): Promise<{
    provider: string;
    apiUrl: string;
    apiKey: string;
  } | null> {
    const rows = await this.getActiveSettings('aml');
    const row = rows[0];
    if (!row) return null;
    const key = resolveProviderSecret(row.api_secret, row.secret_encrypted) || row.api_key?.trim() || '';
    if (!key && row.provider !== 'noop') return null;
    return {
      provider: row.provider,
      apiUrl: row.api_url?.trim() || '',
      apiKey: key,
    };
  }

  /** Build SMS config from a resolved provider row (for failover sends). */
  smsFromResolved(p: ResolvedProvider): SmsConfig | null {
    const extra = p.config || {};
    if (!p.apiKey) return null;
    return {
      provider: p.provider as SmsConfig['provider'],
      apiKey: p.apiKey,
      apiSecret: p.apiSecret ?? extra.api_secret ?? undefined,
      senderId: extra.sender_id || 'INRXPE',
      messageId: extra.message_id || '181649',
      route: extra.route || 'dlt',
    };
  }

  /** Build SMTP config from a resolved provider row (for failover sends). */
  smtpFromResolved(p: ResolvedProvider): SmtpConfig | null {
    const extra = p.config || {};
    const pass = p.apiSecret || '';
    if (!p.apiKey || !(extra.host || p.apiUrl)) return null;
    return {
      host: extra.host || p.apiUrl || '',
      port: parseInt(extra.port || '465', 10),
      secure: extra.secure === 'true' || parseInt(extra.port || '465', 10) === 465,
      user: p.apiKey,
      pass,
      fromEmail: extra.from_email || extra.from || config.email.from,
      fromName: extra.from_name || 'Metherium',
    };
  }

  private smtpFromRow(row: ApiSettingRow): SmtpConfig | null {
    const extra = row.additional_config || {};
    const pass = resolveProviderSecret(row.api_secret, row.secret_encrypted) || '';
    if (!row.api_key || !(extra.host || row.api_url)) return null;
    return {
      host: extra.host || row.api_url || '',
      port: parseInt(extra.port || '465', 10),
      secure: extra.secure === 'true' || parseInt(extra.port || '465', 10) === 465,
      user: row.api_key,
      pass,
      fromEmail: extra.from_email || extra.from || config.email.from,
      fromName: extra.from_name || 'Metherium',
    };
  }

  /** Try providers in priority order; invoke fn until one succeeds (email/SMS fallback). */
  async withProviderFallback<T>(
    category: string,
    fn: (provider: ResolvedProvider) => Promise<T>,
  ): Promise<T> {
    const list = await this.getProviders(category);
    if (list.length === 0) throw new Error(`No active ${category} provider configured`);
    let lastError: unknown;
    for (const p of list) {
      try {
        return await fn(p);
      } catch (e) {
        lastError = e;
        logger.warn(`Provider ${category}/${p.provider} failed; trying next`, {
          error: e instanceof Error ? e.message : String(e),
        });
        if (p.id) {
          try {
            await db.query(
              `UPDATE api_settings SET last_failure_at = NOW(), last_error = $2,
               health_status = 'degraded' WHERE id = $1`,
              [p.id, e instanceof Error ? e.message : String(e)],
            );
          } catch { /* best-effort */ }
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

export const dynamicConfig = new DynamicConfigService();
