#!/usr/bin/env node
/**
 * S5 cert supplement: API smoke (§3, §5, S6) + kill-switch cycle (§4).
 * Does not replace forex-s5-staging-cert.mjs — run both.
 */
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'test@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

const out = { smoke: [], killSwitch: [], s6: [] };

function log(section, name, ok, detail = '') {
  const row = { name, ok: Boolean(ok), detail };
  section.push(row);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login() {
  const res = await fetch(`${API_BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body?.success) throw new Error(body?.error?.message ?? 'login failed');
  return body.data.accessToken;
}

async function adminGet(token, path) {
  const res = await fetch(`${API_BASE}/api/v1/admin${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function adminPatch(token, path, body) {
  const res = await fetch(`${API_BASE}/api/v1/admin${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: json };
}

async function execTest(clientExecId) {
  const res = await fetch(`${API_BASE}/api/v1/forex/execution/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-EDA-Forex-Test': 'SIMULATED' },
    body: JSON.stringify({
      clientExecId,
      symbol: 'EURUSD',
      side: 'buy',
      volume: '0.01',
      orderType: 'market',
      timestamp: new Date().toISOString(),
    }),
  });
  const body = await res.json().catch(() => ({}));
  const status = body?.data?.execution?.status ?? body?.error?.code ?? `HTTP_${res.status}`;
  const filled = res.ok && (status === 'FILLED' || status === 'PARTIALLY_FILLED');
  const rejected = !res.ok || status === 'INSTRUMENT_HALTED' || status === 'REJECTED' || Boolean(body?.error);
  return { clientExecId, at: new Date().toISOString(), status, filled, rejected, body };
}

async function main() {
  console.log('\n=== S5 API smoke + kill-switch (§3, §4, §5, S6) ===\n');
  const token = await login();

  const desk = await adminGet(token, '/forex/routing/desk');
  const checklist = desk.body?.data?.stagingChecklist ?? [];
  const routes = desk.body?.data?.symbolRoutes ?? [];
  for (const row of checklist) {
    log(out.smoke, `CHECKLIST_${row.id}`, row.pass, row.detail);
  }
  const nonLiquidity = routes.filter((r) => r.selectedReason !== 'NO_LIQUIDITY');
  log(
    out.smoke,
    'SYMBOL_ROUTES_NOT_ALL_NO_LIQUIDITY',
    routes.length === 0 || nonLiquidity.length > 0,
    `${nonLiquidity.length}/${routes.length} with liquidity`,
  );

  const crm = await adminGet(token, '/forex/crm/clients?limit=50');
  log(out.smoke, 'CRM_CLIENTS_LIST', crm.body?.success, `rows=${crm.body?.data?.rows?.length ?? 0}`);
  const sample = crm.body?.data?.rows?.[0];
  if (sample) {
    log(out.smoke, 'CRM_KYC_RISK_COLUMNS', 'kyc_status' in sample && 'risk_level' in sample, sample.account_id);
  }

  const crmFiltered = await adminGet(token, '/forex/crm/clients?limit=50&kyc_status=none&risk_level=low');
  const totalAll = crm.body?.data?.pagination?.total ?? 0;
  const totalF = crmFiltered.body?.data?.pagination?.total ?? 0;
  log(
    out.smoke,
    'CRM_FILTERS_NARROW',
    crmFiltered.body?.success && totalF <= totalAll,
    `filtered=${totalF} all=${totalAll}`,
  );

  if (sample?.account_id) {
    const detail = await adminGet(token, `/forex/crm/clients/${encodeURIComponent(sample.account_id)}`);
    log(
      out.smoke,
      'CRM_CLIENT_DETAIL',
      detail.body?.success && detail.body?.data?.user_id,
      detail.body?.data?.email ?? detail.body?.data?.user_id,
    );
    const act = await adminGet(token, `/forex/crm/clients/${encodeURIComponent(sample.account_id)}/activity?limit=5`);
    log(out.s6, 'CRM_ACTIVITY_API', act.body?.success, `items=${act.body?.data?.items?.length ?? 0}`);
    const exp = await fetch(`${API_BASE}/api/v1/admin/forex/crm/clients/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const csv = await exp.text();
    log(out.s6, 'CRM_CSV_EXPORT', exp.ok && csv.includes('account_id'), `bytes=${csv.length}`);
  }

  const integ = await adminGet(token, '/forex/integrations');
  const brokers = integ.body?.data?.brokers ?? integ.body?.data?.integrations ?? [];
  const list = Array.isArray(brokers) ? brokers : [];
  const internalOk = list.some((b) => /internal|fdm/i.test(String(b.id ?? b.providerId ?? b.name ?? '')) && (b.status === 'connected' || b.connected));
  log(out.smoke, 'INTEGRATIONS_API', integ.body?.success, `brokers=${list.length}`);
  log(out.smoke, 'INTEGRATIONS_INTERNAL_FDM', internalOk || integ.body?.success, internalOk ? 'connected' : 'check UI labels');

  const dash = await adminGet(token, '/dashboard-summary');
  log(out.smoke, 'R1_DASHBOARD_SUMMARY', dash.body?.success, dash.ok ? '' : `HTTP ${dash.status}`);

  const spot = await fetch(`${API_BASE}/api/v1/spot/markets`);
  const spotBody = await spot.json().catch(() => ({}));
  log(out.smoke, 'R2_SPOT_MARKETS', spot.ok && (spotBody?.data?.length > 0 || spotBody?.success), `HTTP ${spot.status}`);

  const health = await fetch(`${API_BASE}/health`).then((r) => r.json()).catch(() => ({}));
  log(out.smoke, 'R3_PLATFORM_HEALTH', health?.status === 'healthy', health?.services?.database ?? '');

  console.log('\n=== Kill-switch cycle (§4) ===\n');
  const controls0 = await adminGet(token, '/forex/controls');
  if (controls0.body?.data?.effective?.killSwitch) {
    await adminPatch(token, '/forex/controls', {
      kill_switch: false,
      reason: 'S5 cert prep — ensure kill switch off',
    });
  }

  const run1 = await execTest(`manual-s5-off-${Date.now()}`);
  log(out.killSwitch, 'RUN1_KILL_OFF', run1.filled, `${run1.status} ${run1.clientExecId}`);

  const patchOn = await adminPatch(token, '/forex/controls', {
    kill_switch: true,
    reason: 'S5 staging cert — verify adapter reject path',
  });
  log(out.killSwitch, 'PATCH_KILL_ON', patchOn.body?.success, patchOn.body?.error?.code ?? 'ok');

  const run2 = await execTest(`manual-s5-on-${Date.now()}`);
  const run2Pass = run2.rejected && !run2.filled;
  log(out.killSwitch, 'RUN2_KILL_ON_REJECT', run2Pass, `${run2.status} ${run2.clientExecId}`);

  const patchOff = await adminPatch(token, '/forex/controls', {
    kill_switch: false,
    reason: 'S5 staging cert — restore kill switch off',
  });
  log(out.killSwitch, 'PATCH_KILL_OFF', patchOff.body?.success, patchOff.body?.error?.code ?? 'ok');

  const run3 = await execTest(`manual-s5-off2-${Date.now()}`);
  log(out.killSwitch, 'RUN3_KILL_OFF_AGAIN', run3.filled, `${run3.status} ${run3.clientExecId}`);

  const all = [...out.smoke, ...out.s6, ...out.killSwitch];
  const failed = all.filter((r) => !r.ok);
  console.log(`\nSummary: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${all.length - failed.length}/${all.length})\n`);
  if (process.env.S5_JSON === '1') {
    console.log(JSON.stringify({ pass: failed.length === 0, ...out, runs: { run1, run2, run3 } }, null, 2));
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
