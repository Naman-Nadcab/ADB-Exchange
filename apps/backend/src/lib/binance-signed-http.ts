/**
 * Minimal Binance Spot signed HTTP (HMAC SHA256). baseUrl and credentials come from DB only.
 */
import crypto from 'node:crypto';
import { assertUrlIsSafeForEgress, SsrfError, parseHostAllowlist } from './ssrf-guard.js';

const BINANCE_HTTP_TIMEOUT_MS = 15_000;

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * H-7 FIX: the base_url is admin/DB-controlled and we attach signed API credentials, so a malicious
 * or misconfigured base_url could exfiltrate keys to an internal/attacker host or probe internal
 * services. Refuse to send to private/loopback/link-local targets; optionally restrict to an
 * allowlist via EXTERNAL_LIQUIDITY_ALLOWED_HOSTS (e.g. "api.binance.com,testnet.binance.vision").
 */
function egressOptions(): { allowedProtocols: string[]; allowedHosts: string[] } {
  return {
    allowedProtocols: ['https:', 'http:'],
    allowedHosts: parseHostAllowlist(process.env.EXTERNAL_LIQUIDITY_ALLOWED_HOSTS),
  };
}

export function signBinanceQuery(queryString: string, apiSecret: string): string {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

export async function binanceSignedGet(
  baseUrl: string,
  path: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string | number | undefined>
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const u = new URL(path, trimBaseUrl(baseUrl));
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  const sig = signBinanceQuery(qs, apiSecret);
  u.search = `${qs}&signature=${sig}`;
  try {
    await assertUrlIsSafeForEgress(u.toString(), egressOptions());
  } catch (e) {
    return { ok: false, status: 0, body: { code: 'BINANCE_HTTP_SSRF_BLOCKED', message: e instanceof SsrfError ? e.message : 'URL not allowed' } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BINANCE_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { 'X-MBX-APIKEY': apiKey },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      /* keep raw */
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: {
        code: 'BINANCE_HTTP_GET_FAILED',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function binanceSignedPost(
  baseUrl: string,
  path: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string | number | undefined>
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const u = new URL(path, trimBaseUrl(baseUrl));
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  const sig = signBinanceQuery(qs, apiSecret);
  try {
    await assertUrlIsSafeForEgress(u.toString(), egressOptions());
  } catch (e) {
    return { ok: false, status: 0, body: { code: 'BINANCE_HTTP_SSRF_BLOCKED', message: e instanceof SsrfError ? e.message : 'URL not allowed' } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BINANCE_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `${qs}&signature=${sig}`,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      /* keep raw */
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: {
        code: 'BINANCE_HTTP_POST_FAILED',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function toBinanceSymbol(internalMarket: string): string {
  return internalMarket.replace(/_/g, '').toUpperCase();
}
