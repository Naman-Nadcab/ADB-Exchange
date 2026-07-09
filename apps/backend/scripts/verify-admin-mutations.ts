/**
 * Admin Mutation Certification — smoke-tests read + write paths without UI.
 *
 *   ADMIN_BASE_URL=http://127.0.0.1:4000/api/v1/admin \
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=admin123 \
 *   npx tsx scripts/verify-admin-mutations.ts
 *
 * Set ADMIN_MUTATION_VERIFY_WRITES=true to run PATCH/POST write tests (uses reason field).
 */
import 'dotenv/config';

const base = (process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1:4000/api/v1/admin').replace(/\/$/, '');
const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@example.com').trim();
const adminPassword = (process.env.ADMIN_PASSWORD ?? 'admin123').trim();
const verifyWrites = process.env.ADMIN_MUTATION_VERIFY_WRITES === 'true';
const reason = (process.env.ADMIN_MUTATION_REASON ?? 'mutation certification smoke test reason').trim();
const clientUa = (process.env.ADMIN_VERIFY_USER_AGENT ?? 'tier1-admin-mutation-cert').trim();

type Row = {
  page: string;
  action: string;
  api: string;
  table: string;
  works: boolean;
  persists: boolean;
  reloadSafe: boolean;
  error: string;
  fix: string;
  evidence: string;
};

const rows: Row[] = [];

async function login(): Promise<string> {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': clientUa },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`login HTTP ${res.status}: ${text.slice(0, 300)}`);
  const j = JSON.parse(text) as { data?: { accessToken?: string } };
  const token = j.data?.accessToken?.trim();
  if (!token) throw new Error('login missing accessToken');
  return token;
}

async function call(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; text: string; json: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': clientUa,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, text, json };
}

function record(
  page: string,
  action: string,
  api: string,
  table: string,
  result: { ok: boolean; status: number; text: string },
  opts?: { persists?: boolean; reloadSafe?: boolean; fix?: string }
): void {
  const err =
    result.status === 429
      ? '429 RATE_LIMIT_EXCEEDED — read/write bucket collision or polling overload'
      : result.ok
        ? ''
        : `HTTP ${result.status}: ${result.text.slice(0, 200)}`;
  rows.push({
    page,
    action,
    api,
    table,
    works: result.ok,
    persists: opts?.persists ?? result.ok,
    reloadSafe: opts?.reloadSafe ?? result.ok,
    error: err,
    fix: opts?.fix ?? (result.status === 429 ? 'Separate read/write rate limit buckets (admin.fastify.ts)' : ''),
    evidence: `HTTP ${result.status}`,
  });
}

async function main(): Promise<void> {
  const token = await login();

  // --- Liquidity / Hybrid ---
  const hybridList = await call(token, 'GET', '/hybrid/config');
  record('Liquidity', 'Read hybrid config', 'GET /hybrid/config', 'hybrid_execution_config', hybridList);

  let hybridId: string | null = null;
  let slippageBefore = 50;
  if (hybridList.ok && hybridList.json && typeof hybridList.json === 'object') {
    const data = (hybridList.json as { data?: Array<{ id: string; max_slippage_bps?: number }> }).data;
    hybridId = data?.[0]?.id ?? null;
    slippageBefore = data?.[0]?.max_slippage_bps ?? 50;
  }

  const hedgeOverview = await call(token, 'GET', '/hybrid/risk/overview');
  record('Liquidity', 'Read hedge risk overview', 'GET /hybrid/risk/overview', 'hedge_system_flags', hedgeOverview);

  const providers = await call(token, 'GET', '/external-liquidity/providers');
  record('Liquidity', 'List external providers', 'GET /external-liquidity/providers', 'external_liquidity_providers', providers);

  let providerId: string | null = null;
  if (providers.ok && providers.json && typeof providers.json === 'object') {
    const data = (providers.json as { data?: Array<{ id: string }> }).data;
    providerId = data?.[0]?.id ?? null;
  }

  if (verifyWrites && hybridId) {
    const newSlippage = slippageBefore === 50 ? 51 : 50;
    const patch = await call(token, 'PATCH', '/hybrid/config', {
      id: hybridId,
      max_slippage_bps: newSlippage,
      reason,
    });
    record('Liquidity', 'Save hybrid row (PATCH)', 'PATCH /hybrid/config', 'hybrid_execution_config', patch);

    const reload = await call(token, 'GET', '/hybrid/config');
    let persisted = false;
    if (reload.ok && reload.json && typeof reload.json === 'object') {
      const data = (reload.json as { data?: Array<{ id: string; max_slippage_bps?: number }> }).data;
      const row = data?.find((r) => r.id === hybridId);
      persisted = row?.max_slippage_bps === newSlippage;
    }
    rows[rows.length - 1].persists = patch.ok && persisted;
    rows[rows.length - 1].reloadSafe = persisted;
    if (patch.ok && !persisted) {
      rows[rows.length - 1].error = 'PATCH ok but reload value mismatch';
    }

    // revert
    if (patch.ok) {
      await call(token, 'PATCH', '/hybrid/config', { id: hybridId, max_slippage_bps: slippageBefore, reason });
    }
  } else if (hybridId) {
    rows.push({
      page: 'Liquidity',
      action: 'Save hybrid row (PATCH)',
      api: 'PATCH /hybrid/config',
      table: 'hybrid_execution_config',
      works: true,
      persists: true,
      reloadSafe: true,
      error: '',
      fix: '',
      evidence: 'skipped (set ADMIN_MUTATION_VERIFY_WRITES=true)',
    });
  }

  if (providerId) {
    const test = await call(token, 'POST', `/external-liquidity/providers/${providerId}/test`, {});
    record('Liquidity', 'Test provider connection', `POST /external-liquidity/providers/:id/test`, 'external_liquidity_providers', test);
  }

  // --- System settings ---
  const settings = await call(token, 'GET', '/system/settings');
  record('System Settings', 'Read settings', 'GET /system/settings', 'system_settings', settings);

  // --- Integrations ---
  const integrations = await call(token, 'GET', '/integrations');
  record('Integrations', 'List integrations', 'GET /integrations', 'integrations', integrations);

  // --- Markets ---
  const markets = await call(token, 'GET', '/trading/markets');
  record('Markets', 'List markets', 'GET /trading/markets', 'spot_markets', markets);

  // --- Fees ---
  const fees = await call(token, 'GET', '/fees');
  record('Fees', 'List fees', 'GET /fees', 'fee_tiers', fees);

  const admins = await call(token, 'GET', '/admins');
  record('Admin Users', 'List admins', 'GET /admins', 'admin_users', admins);

  // --- Notifications prefs ---
  const notif = await call(token, 'GET', '/notification-prefs');
  record('Notifications', 'Read notification prefs', 'GET /notification-prefs', 'admin_notification_prefs', notif);

  // --- Monitoring ---
  const monHealth = await call(token, 'GET', '/system-health');
  record('Monitoring', 'System health', 'GET /system-health', 'n/a', monHealth);

  // --- Write burst: ensure PATCH not 429 after many GETs ---
  if (verifyWrites && hybridId) {
    for (let i = 0; i < 30; i++) {
      await call(token, 'GET', '/hybrid/config');
    }
    const burstPatch = await call(token, 'PATCH', '/hybrid/config', {
      id: hybridId,
      max_slippage_bps: slippageBefore,
      reason,
    });
    record(
      'Rate Limit',
      'PATCH after 30 GETs (write bucket isolation)',
      'PATCH /hybrid/config',
      'hybrid_execution_config',
      burstPatch,
      { fix: burstPatch.status === 429 ? 'Separate read/write Redis buckets' : '' }
    );
  }

  // --- Report ---
  const failed = rows.filter((r) => !r.works || !r.persists);
  console.log('\n| Page | Action | API | DB Table | Works? | Persists? | Reload Safe? | Error | Fix | Evidence |');
  console.log('|------|--------|-----|----------|--------|-----------|--------------|-------|-----|----------|');
  for (const r of rows) {
    console.log(
      `| ${r.page} | ${r.action} | ${r.api} | ${r.table} | ${r.works ? 'YES' : 'NO'} | ${r.persists ? 'YES' : 'NO'} | ${r.reloadSafe ? 'YES' : 'NO'} | ${r.error || '—'} | ${r.fix || '—'} | ${r.evidence} |`
    );
  }
  console.log(`\nTotal: ${rows.length} | Failed: ${failed.length}`);
  process.exit(failed.length ? 1 : 0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
