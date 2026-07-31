/**
 * E2E cross-trade book isolation — shared by Phase 3 and Phase 14.
 * Limit buys sweep all asks strictly better than the limit; MM bot liquidity at lower
 * prices is correct product behaviour, not a bug. Tests must use an isolated book.
 */
import { config } from '../config.js';

const DEFAULT_TIMEOUT = 10_000;

export function parseOrderbookPrices(levels: unknown): number[] {
  if (!Array.isArray(levels)) return [];
  return levels
    .map((row) => {
      if (Array.isArray(row)) return Number(row[0]);
      if (row && typeof row === 'object' && 'price' in row) return Number((row as { price?: unknown }).price);
      return NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Asks at or below matchPrice compete with a resting maker sell at matchPrice for incoming buys. */
export function countForeignAsksAtOrBelow(asks: unknown, matchPrice: string): number {
  const limit = Number(matchPrice);
  if (!Number.isFinite(limit)) return 0;
  return parseOrderbookPrices(asks).filter((p) => p <= limit).length;
}

/** Best-effort: cancel MM + all open orders so QA cross can use an empty/competing-free ask side. */
export async function adminPrepareIsolatedCrossBook(
  baseUrl: string,
  market: string,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<boolean> {
  const email = config.adminEmail?.trim() || process.env.E2E_ADMIN_EMAIL?.trim();
  const password = config.adminPassword?.trim() || process.env.E2E_ADMIN_PASSWORD?.trim();
  if (!email || !password) return false;
  try {
    const loginRes = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const loginBody = (await loginRes.json().catch(() => ({}))) as { data?: { accessToken?: string } };
    const token = loginBody.data?.accessToken?.trim();
    if (!token) return false;
    const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    await fetch(`${baseUrl}/api/v1/admin/control/orders/cancel-all`, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify({ market }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    await fetch(`${baseUrl}/api/v1/admin/control/orders/cancel-all`, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    await fetch(`${baseUrl}/api/v1/admin/mm-control/global`, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify({ enabled: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchOrderbookAsks(
  baseUrl: string,
  market: string,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/spot/orderbook/${encodeURIComponent(market)}?limit=50`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { asks?: unknown[] } };
    if (!res.ok || !data.data) return null;
    return data.data.asks ?? [];
  } catch {
    return null;
  }
}
