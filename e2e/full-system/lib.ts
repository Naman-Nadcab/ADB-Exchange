/**
 * STEP 26 full-system harness. Talks to a REAL backend (no stubs) and to the
 * SAME isolated PostgreSQL the backend uses, so assertions can check durable state.
 *
 * Env:
 *   FULL_SYSTEM_API_URL       default http://127.0.0.1:4000
 *   FULL_SYSTEM_DATABASE_URL  default postgresql://rc20:rc20-isolated-db-password@127.0.0.1:15432/rc20
 *   FULL_SYSTEM_ADMIN_EMAIL / FULL_SYSTEM_ADMIN_PASSWORD  admin credentials of the isolated runtime
 */
import { randomUUID } from 'node:crypto';
import { Wallet } from 'ethers';
import { Pool } from 'pg';

export const API = (process.env.FULL_SYSTEM_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
export const DB_URL =
  process.env.FULL_SYSTEM_DATABASE_URL ?? 'postgresql://rc20:rc20-isolated-db-password@127.0.0.1:15432/rc20';

export const db = new Pool({ connectionString: DB_URL, max: 4 });

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.query(sql, params);
  return r.rows as T[];
}

export interface ApiResult {
  status: number;
  ok: boolean;
  json: any;
  text: string;
  headers: Headers;
}

export interface Session {
  userId: string;
  address: string;
  accessToken: string;
  refreshToken: string;
  wallet: Wallet;
}

export async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string>; cookie?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  // The real frontend sends a fresh Idempotency-Key on every money-moving POST; mirror that contract.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && !Object.keys(headers).some((h) => h.toLowerCase() === 'idempotency-key')) {
    headers['idempotency-key'] = randomUUID();
  }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.cookie = opts.cookie;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

/** Minimal valid 1x1 PNG (passes the server's magic-byte check) for P2P payment-proof uploads. */
export const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** multipart/form-data request (mirrors the frontend's P2P mark-paid upload). */
export async function apiMultipart(
  path: string,
  opts: { token: string; fields: Record<string, string>; file?: { field: string; name: string; type: string; data: Buffer } },
): Promise<ApiResult> {
  const form = new FormData();
  for (const [k, v] of Object.entries(opts.fields)) form.append(k, v);
  if (opts.file) form.append(opts.file.field, new Blob([opts.file.data], { type: opts.file.type }), opts.file.name);
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${opts.token}`, 'idempotency-key': randomUUID() },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

/** Wallet challenge/login are rate limited to 10/min per IP (a real control); the harness backs off instead of failing. */
async function withRateLimitBackoff(label: string, fn: () => Promise<ApiResult>): Promise<ApiResult> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fn();
    if (res.status !== 429) return res;
    const retryAfter = Number(res.headers.get('retry-after') ?? '0');
    const waitMs = (retryAfter > 0 ? retryAfter : 15) * 1000;
    console.log(`  (rate limited on ${label}; waiting ${waitMs / 1000}s)`);
    await sleep(waitMs);
  }
  throw new Error(`${label}: still rate limited after retries`);
}

export async function walletLogin(wallet: Wallet = Wallet.createRandom() as unknown as Wallet): Promise<Session> {
  const challenge = await withRateLimitBackoff('wallet/challenge', () =>
    api('POST', '/api/v1/auth/wallet/challenge', { body: { caip10: `eip155:1:${wallet.address}` } }),
  );
  if (!challenge.ok) throw new Error(`wallet/challenge ${challenge.status} ${challenge.text.slice(0, 300)}`);
  const issued = challenge.json.challenge ?? challenge.json.data ?? challenge.json;
  const message = issued.message as string;
  const challengeId = (issued.id ?? issued.challengeId) as string;
  const signature = await wallet.signMessage(message);
  const login = await withRateLimitBackoff('wallet/login', () =>
    api('POST', '/api/v1/auth/wallet/login', { body: { challengeId, message, signature } }),
  );
  if (!login.ok) throw new Error(`wallet/login ${login.status} ${login.text.slice(0, 300)}`);
  const data = login.json.data;
  return {
    userId: data.user.id,
    address: wallet.address,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    wallet,
  };
}

export interface AdminSession {
  token: string;
  adminId: string;
  cookie: string;
}

export async function adminLogin(
  email = process.env.FULL_SYSTEM_ADMIN_EMAIL ?? '',
  password = process.env.FULL_SYSTEM_ADMIN_PASSWORD ?? '',
): Promise<AdminSession> {
  if (!email || !password) throw new Error('FULL_SYSTEM_ADMIN_EMAIL / FULL_SYSTEM_ADMIN_PASSWORD not set');
  const res = await api('POST', '/api/v1/admin/auth/login', { body: { email, password } });
  if (!res.ok) throw new Error(`admin/login ${res.status} ${res.text.slice(0, 300)}`);
  const data = res.json.data ?? res.json;
  const token: string = data.token ?? data.accessToken;
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie
    .split(/,(?=[^;]+=)/)
    .map((c) => c.split(';')[0]!.trim())
    .filter(Boolean)
    .join('; ');
  return { token, adminId: data.admin?.id ?? data.adminId ?? data.id ?? '', cookie };
}

export function adminHeaders(a: AdminSession): Record<string, string> {
  const h: Record<string, string> = {};
  if (a.token) h.authorization = `Bearer ${a.token}`;
  if (a.cookie) h.cookie = a.cookie;
  return h;
}

/**
 * Real KYC flow: the customer initiates (kyc_applications row, status pending) and an admin with
 * kyc:review approves it through the admin API. No direct status writes.
 */
export async function approveKycThroughAdmin(s: { accessToken: string; userId: string }): Promise<string> {
  const existing = await q<{ id: string; status: string }>(
    `SELECT id, status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [s.userId],
  );
  let applicationId = existing[0]?.status === 'pending' ? existing[0].id : '';
  if (existing[0]?.status === 'approved') return existing[0].id;
  if (!applicationId) {
    const init = await api('POST', '/api/v1/kyc/initiate', {
      token: s.accessToken,
      body: { country: 'US', documentType: 'passport', provider: 'manual' },
    });
    if (!init.ok) throw new Error(`kyc/initiate ${init.status} ${init.text.slice(0, 200)}`);
    applicationId = init.json.data.id;
  }
  const admin = await adminLogin();
  const review = await api('PATCH', `/api/v1/admin/kyc/${applicationId}/review`, {
    headers: adminHeaders(admin),
    body: { action: 'approve' },
  });
  if (!review.ok) throw new Error(`admin kyc review ${review.status} ${review.text.slice(0, 200)}`);
  const after = await api('GET', '/api/v1/wallet/kyc-status', { token: s.accessToken });
  if (!after.ok || after.json?.data?.verified !== true) {
    throw new Error(`kyc-status after approval: ${after.status} ${after.text.slice(0, 200)}`);
  }
  return applicationId;
}

/** Simulates what the indexer writes when it observes an on-chain deposit, then credits through the real path. */
export async function fixtureDeposit(
  userId: string,
  symbol: string,
  amount: string,
  opts: { txHash?: string; chainId?: string } = {},
): Promise<{ depositId: string; txHash: string }> {
  const cur = await q<{ id: string }>(`SELECT id FROM currencies WHERE symbol = $1 LIMIT 1`, [symbol]);
  if (!cur[0]) throw new Error(`currency ${symbol} missing`);
  const chainId = opts.chainId ?? 'ethereum';
  const wallet = await q<{ id: string; address: string }>(
    `SELECT id, address FROM wallets WHERE user_id = $1 AND chain_id = $2 ORDER BY created_at ASC LIMIT 1`,
    [userId, chainId],
  );
  if (!wallet[0]) throw new Error(`user ${userId} has no custodial ${chainId} deposit wallet yet (call GET /wallet/deposit-address/${chainId} first)`);
  const txHash = opts.txHash ?? `0xstep26${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  const rows = await q<{ id: string }>(
    `INSERT INTO deposits (user_id, currency_id, chain_id, wallet_id, tx_hash, to_address, amount, confirmations, required_confirmations, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, 12, 1, 'pending', NOW(), NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [userId, cur[0].id, chainId, wallet[0].id, txHash, wallet[0].address, amount],
  );
  return { depositId: rows[0]?.id ?? '', txHash };
}

export async function balance(userId: string, symbol: string, accountType = 'funding'): Promise<{ available: string; locked: string }> {
  const rows = await q<{ available: string; locked: string }>(
    `SELECT COALESCE(SUM(ub.available_balance),0)::text AS available, COALESCE(SUM(ub.locked_balance),0)::text AS locked
     FROM user_balances ub JOIN currencies c ON c.id = ub.currency_id
     WHERE ub.user_id = $1 AND c.symbol = $2 AND ub.account_type = $3`,
    [userId, symbol, accountType],
  );
  return rows[0] ?? { available: '0', locked: '0' };
}

export function num(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`not a number: ${String(v)}`);
  return n;
}

export function approx(a: unknown, b: unknown, eps = 1e-6): boolean {
  return Math.abs(num(a) - num(b)) <= eps;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 15_000, step = 250): Promise<T> {
  const deadline = Date.now() + ms;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v as T;
      last = v;
    } catch (e) {
      last = e;
    }
    await sleep(step);
  }
  throw new Error(`waitFor timed out: ${last instanceof Error ? last.message : JSON.stringify(last)}`);
}

/** Minimal test harness: each check is a real assertion; failures are never converted to skips. */
export class Suite {
  readonly results: { name: string; ok: boolean; detail?: string }[] = [];
  constructor(readonly name: string) {}

  async check(name: string, fn: () => Promise<void> | void): Promise<boolean> {
    try {
      await fn();
      this.results.push({ name, ok: true });
      console.log(`  PASS ${name}`);
      return true;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      this.results.push({ name, ok: false, detail });
      console.log(`  FAIL ${name}\n       ${detail.split('\n').join('\n       ')}`);
      return false;
    }
  }

  get passed(): number {
    return this.results.filter((r) => r.ok).length;
  }

  get failed(): number {
    return this.results.filter((r) => !r.ok).length;
  }
}

export function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function expectStatus(res: ApiResult, status: number | number[], label: string): void {
  const list = Array.isArray(status) ? status : [status];
  if (!list.includes(res.status)) {
    throw new Error(`${label}: expected ${list.join('|')} got ${res.status} ${res.text.slice(0, 400)}`);
  }
}
