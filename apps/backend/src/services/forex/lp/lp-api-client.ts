/**
 * The only module that speaks HTTP to the liquidity provider.
 *
 * Leave FOREX_LP_BASE_URL empty and the rest of Forex stays MOCK.
 * Arm live routing by setting:
 *   FOREX_LP_BASE_URL
 *   FOREX_LP_API_KEY
 *   FOREX_LP_WEBHOOK_SECRET
 *   FOREX_REAL_FOREX_ALLOWED=true
 *
 * Paths default to the contract below. If the vendor uses different paths but
 * the same JSON, override FOREX_LP_PATH_* . If the JSON shape differs, change
 * only the map* functions at the bottom of this file.
 *
 * Contract (JSON):
 *   GET  /v1/health
 *        { "ok": true, "accounts": true, "funding": true }
 *   GET  /v1/quotes
 *        { "quotes": [{ "symbol", "bid", "ask", "timestamp", "sequence" }] }
 *   POST /v1/orders
 *        { "symbol", "side", "volume", "price?", "clientExecId" }
 *        → { "venueOrderId", "status", "filledVolume", "remainingVolume", "avgPrice", "rejectReason" }
 *   POST /v1/orders/:id/cancel → { "cancelled": true }
 *   POST /v1/accounts
 *        { "userId", "applicationId", "currency", "leverage", "positionMode", "groupCode", "idempotencyKey" }
 *        → { "brokerTradingLogin", "brokerServer", "internalAccountId", "providerReference" }
 *   POST /v1/accounts/:id/credentials
 *        { "kind": "TRADING"|"INVESTOR", "idempotencyKey" } → { "status": "REQUESTED" }
 *   POST /v1/funding/deposits|withdrawals
 *        { "accountId", "amount", "idempotencyKey", "currency": "USD" }
 *        → { "status": "settled"|"pending"|"rejected", "providerReference", "message" }
 *
 * Webhook signature is hex HMAC-SHA256 of
 *   eventId|type|accountId|amount|idempotencyKey
 * using FOREX_LP_WEBHOOK_SECRET. Header: x-forex-lp-signature.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type LpFundingStatus = 'settled' | 'pending' | 'rejected';

export type LpSettings = {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  timeoutMs: number;
  paths: {
    health: string;
    quotes: string;
    orders: string;
    accounts: string;
    deposits: string;
    withdrawals: string;
  };
};

export class LpApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function pathEnv(name: string, fallback: string): string {
  const raw = env(name);
  return raw || fallback;
}

export function lpApiSettings(): LpSettings {
  const timeout = Number.parseInt(env('FOREX_LP_TIMEOUT_MS') || '4000', 10);
  return {
    baseUrl: env('FOREX_LP_BASE_URL').replace(/\/$/, ''),
    apiKey: env('FOREX_LP_API_KEY'),
    webhookSecret: env('FOREX_LP_WEBHOOK_SECRET'),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 4000,
    paths: {
      health: pathEnv('FOREX_LP_PATH_HEALTH', '/v1/health'),
      quotes: pathEnv('FOREX_LP_PATH_QUOTES', '/v1/quotes'),
      orders: pathEnv('FOREX_LP_PATH_ORDERS', '/v1/orders'),
      accounts: pathEnv('FOREX_LP_PATH_ACCOUNTS', '/v1/accounts'),
      deposits: pathEnv('FOREX_LP_PATH_DEPOSITS', '/v1/funding/deposits'),
      withdrawals: pathEnv('FOREX_LP_PATH_WITHDRAWALS', '/v1/funding/withdrawals'),
    },
  };
}

/** Base URL is present. Does not by itself send orders. */
export function lpApiConfigured(): boolean {
  return lpApiSettings().baseUrl.length > 0;
}

/** URL, API key, webhook secret, and the explicit allow flag. This is the go-live switch. */
export function lpPlugArmed(): boolean {
  const s = lpApiSettings();
  const allowed = env('FOREX_REAL_FOREX_ALLOWED').toLowerCase();
  return s.baseUrl.length > 0 && s.apiKey.length > 0 && s.webhookSecret.length > 0 && (allowed === '1' || allowed === 'true');
}

async function lpRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const settings = lpApiSettings();
  if (!settings.baseUrl) throw new LpApiError('LP_NOT_CONFIGURED', 'FOREX_LP_BASE_URL is empty');
  if (!settings.apiKey) throw new LpApiError('LP_NOT_CONFIGURED', 'FOREX_LP_API_KEY is empty');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  try {
    const response = await fetch(`${settings.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${settings.apiKey}`,
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = typeof parsed === 'object' && parsed && 'message' in parsed ? String((parsed as { message: unknown }).message) : text || response.statusText;
      throw new LpApiError('LP_HTTP_ERROR', message || `LP HTTP ${response.status}`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof LpApiError) throw error;
    if (error instanceof SyntaxError) throw new LpApiError('LP_BAD_RESPONSE', 'LP response was not JSON');
    throw new LpApiError('LP_UNREACHABLE', error instanceof Error ? error.message : 'LP request failed');
  } finally {
    clearTimeout(timer);
  }
}

export async function lpHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  accounts: boolean;
  funding: boolean;
  message: string;
  latencyMs?: number;
}> {
  if (!lpApiConfigured()) {
    return { configured: false, connected: false, accounts: false, funding: false, message: 'FOREX_LP_BASE_URL is empty' };
  }
  const started = Date.now();
  try {
    const body = await lpRequest('GET', lpApiSettings().paths.health);
    const mapped = mapHealth(body);
    return { configured: true, ...mapped, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      accounts: false,
      funding: false,
      message: error instanceof Error ? error.message : 'LP health failed',
      latencyMs: Date.now() - started,
    };
  }
}

export type LpQuoteTick = { symbol: string; bid: string; ask: string; timestamp: string; sequence: string };

export async function lpFetchQuotes(): Promise<LpQuoteTick[]> {
  const body = await lpRequest('GET', lpApiSettings().paths.quotes);
  return mapQuotes(body);
}

export type LpOrderAck = {
  venueOrderId: string | null;
  status: 'accepted' | 'rejected' | 'partial';
  filledVolume: string;
  remainingVolume: string;
  avgPrice: string | null;
  rejectReason: string | null;
};

export async function lpPlaceOrder(input: {
  symbol: string;
  side: 'buy' | 'sell';
  volume: string;
  price?: string;
  clientExecId: string;
}): Promise<LpOrderAck> {
  const body = await lpRequest('POST', lpApiSettings().paths.orders, input);
  return mapOrderAck(body);
}

export async function lpCancelOrder(venueOrderId: string): Promise<{ cancelled: boolean; reason: string | null }> {
  const path = `${lpApiSettings().paths.orders}/${encodeURIComponent(venueOrderId)}/cancel`;
  const body = await lpRequest('POST', path, {});
  return mapCancel(body);
}

export async function lpProvisionAccount(input: {
  userId: string;
  applicationId: string;
  currency: 'USD';
  leverage: string | null;
  positionMode: 'NETTING' | 'HEDGING';
  groupCode: string | null;
  idempotencyKey: string;
}): Promise<{ brokerTradingLogin: string; brokerServer: string; internalAccountId: string; providerReference: string }> {
  const body = await lpRequest('POST', lpApiSettings().paths.accounts, input);
  return mapAccount(body);
}

export async function lpChangePassword(input: {
  accountId: string;
  kind: 'TRADING' | 'INVESTOR';
  idempotencyKey: string;
}): Promise<{ status: 'REQUESTED' }> {
  const path = `${lpApiSettings().paths.accounts}/${encodeURIComponent(input.accountId)}/credentials`;
  const body = await lpRequest('POST', path, { kind: input.kind, idempotencyKey: input.idempotencyKey });
  return mapCredentials(body);
}

export type LpFundingAck = { status: LpFundingStatus; providerReference: string | null; message: string | null };

export async function lpRequestDeposit(input: { accountId: string; amount: string; idempotencyKey: string }): Promise<LpFundingAck> {
  const body = await lpRequest('POST', lpApiSettings().paths.deposits, { ...input, currency: 'USD' });
  return mapFunding(body);
}

export async function lpRequestWithdrawal(input: { accountId: string; amount: string; idempotencyKey: string }): Promise<LpFundingAck> {
  const body = await lpRequest('POST', lpApiSettings().paths.withdrawals, { ...input, currency: 'USD' });
  return mapFunding(body);
}

export function lpWebhookCanonical(event: { eventId: string; type: string; accountId: string; amount: string; idempotencyKey: string }): string {
  return `${event.eventId}|${event.type}|${event.accountId}|${event.amount}|${event.idempotencyKey}`;
}

export function signLpWebhook(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

export function verifyLpWebhook(signature: string, event: { eventId: string; type: string; accountId: string; amount: string; idempotencyKey: string }): boolean {
  const secret = lpApiSettings().webhookSecret;
  if (!secret || !signature) return false;
  const expected = signLpWebhook(secret, lpWebhookCanonical(event));
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** Vendor response mapping. Edit these if the LP JSON uses different field names. */
export function mapHealth(body: unknown): { connected: boolean; accounts: boolean; funding: boolean; message: string } {
  const row = asRecord(body);
  const connected = row.ok === true || row.status === 'ok' || row.status === 'connected';
  return {
    connected,
    accounts: row.accounts !== false && connected,
    funding: row.funding !== false && connected,
    message: connected ? 'LP health ok' : 'LP health did not report ok',
  };
}

export function mapQuotes(body: unknown): LpQuoteTick[] {
  const row = asRecord(body);
  const list = Array.isArray(row.quotes) ? row.quotes : Array.isArray(body) ? body : [];
  return list.map((item) => {
    const q = asRecord(item);
    return {
      symbol: String(q.symbol ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
      bid: String(q.bid ?? ''),
      ask: String(q.ask ?? ''),
      timestamp: String(q.timestamp ?? new Date().toISOString()),
      sequence: String(q.sequence ?? '0'),
    };
  }).filter((q) => q.symbol && q.bid && q.ask);
}

export function mapOrderAck(body: unknown): LpOrderAck {
  const row = asRecord(body);
  const statusRaw = String(row.status ?? 'rejected').toLowerCase();
  const status = statusRaw === 'accepted' || statusRaw === 'filled' ? 'accepted' : statusRaw === 'partial' ? 'partial' : 'rejected';
  return {
    venueOrderId: row.venueOrderId == null ? null : String(row.venueOrderId),
    status,
    filledVolume: String(row.filledVolume ?? '0'),
    remainingVolume: String(row.remainingVolume ?? '0'),
    avgPrice: row.avgPrice == null ? null : String(row.avgPrice),
    rejectReason: row.rejectReason == null ? null : String(row.rejectReason),
  };
}

export function mapCancel(body: unknown): { cancelled: boolean; reason: string | null } {
  const row = asRecord(body);
  return { cancelled: row.cancelled === true, reason: row.reason == null ? null : String(row.reason) };
}

export function mapAccount(body: unknown): { brokerTradingLogin: string; brokerServer: string; internalAccountId: string; providerReference: string } {
  const row = asRecord(body);
  const brokerTradingLogin = String(row.brokerTradingLogin ?? '');
  const internalAccountId = String(row.internalAccountId ?? '');
  if (!brokerTradingLogin || !internalAccountId) {
    throw new LpApiError('LP_BAD_RESPONSE', 'LP account response is missing brokerTradingLogin or internalAccountId');
  }
  return {
    brokerTradingLogin,
    brokerServer: String(row.brokerServer ?? ''),
    internalAccountId,
    providerReference: String(row.providerReference ?? brokerTradingLogin),
  };
}

export function mapCredentials(body: unknown): { status: 'REQUESTED' } {
  const row = asRecord(body);
  if (String(row.status ?? '').toUpperCase() !== 'REQUESTED') {
    throw new LpApiError('LP_BAD_RESPONSE', 'LP credential response was not REQUESTED');
  }
  return { status: 'REQUESTED' };
}

export function mapFunding(body: unknown): LpFundingAck {
  const row = asRecord(body);
  const statusRaw = String(row.status ?? 'rejected').toLowerCase();
  const status: LpFundingStatus = statusRaw === 'settled' || statusRaw === 'accepted' ? 'settled' : statusRaw === 'pending' ? 'pending' : 'rejected';
  return {
    status,
    providerReference: row.providerReference == null ? null : String(row.providerReference),
    message: row.message == null ? null : String(row.message),
  };
}
