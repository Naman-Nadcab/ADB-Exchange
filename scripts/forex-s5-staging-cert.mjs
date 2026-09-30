#!/usr/bin/env node
/**
 * Forex S5 staging certification — admin API + optional MOCK execution test.
 *
 * Run (staging / non-prod only):
 *   node scripts/forex-s5-staging-cert.mjs
 *
 * Env:
 *   API_BASE          Backend origin (default http://127.0.0.1:4000)
 *   ADMIN_EMAIL       Admin login email
 *   ADMIN_PASSWORD    Admin password
 *   S5_STRICT=1       Fail if FOREX_ROUTING_V2 or FOREX_ADAPTER_LAYER_HOOK not enabled on worker
 *   S5_RUN_EXEC_TEST=1  POST /api/v1/forex/execution/test (needs FOREX_EXECUTION_TEST_API=1 on worker)
 *   S5_JSON=1         Print machine-readable summary JSON at end
 *
 * Exit 0 = all automated checks passed. Manual steps in FOREX_S5_STAGING_CERT.md still required for full sign-off.
 */
const API_BASE = (process.env.API_BASE ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.ADMIN_USER ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const STRICT = process.env.S5_STRICT === '1' || process.env.S5_STRICT === 'true';
const RUN_EXEC_TEST = process.env.S5_RUN_EXEC_TEST === '1' || process.env.S5_RUN_EXEC_TEST === 'true';
const JSON_OUT = process.env.S5_JSON === '1';

const RESULTS = [];

function mark(name, ok, detail = '') {
  RESULTS.push({ name, ok: Boolean(ok), detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(msg) {
  console.log(`  WARN  ${msg}`);
}

async function adminLogin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    mark('ADMIN_CREDENTIALS', false, 'Set ADMIN_EMAIL and ADMIN_PASSWORD');
    return null;
  }
  const res = await fetch(`${API_BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    mark('ADMIN_LOGIN', false, body?.error?.message ?? `HTTP ${res.status}`);
    return null;
  }
  const token = body?.data?.accessToken ?? body?.accessToken;
  if (!token) {
    mark('ADMIN_LOGIN', false, 'No accessToken in response');
    return null;
  }
  mark('ADMIN_LOGIN', true);
  return token;
}

async function adminGet(token, path) {
  const res = await fetch(`${API_BASE}/api/v1/admin${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function forexExecTest(payload) {
  const res = await fetch(`${API_BASE}/api/v1/forex/execution/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-EDA-Forex-Test': 'SIMULATED',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log('\nForex S5 staging cert (automated)\n');
  console.log(`  API_BASE=${API_BASE}`);
  console.log(`  S5_STRICT=${STRICT}  S5_RUN_EXEC_TEST=${RUN_EXEC_TEST}\n`);

  const token = await adminLogin();
  if (!token) {
    finish(1);
    return;
  }

  const pubReady = await fetch(`${API_BASE}/api/v1/forex/readiness`).then((r) => r.json()).catch(() => ({}));
  mark('FOREX_READINESS_API', pubReady?.success === true, pubReady?.data?.reason ?? '');
  mark('ECONOMIC_READY', pubReady?.data?.economicReady === true, pubReady?.data?.reason ?? '');

  const config = await adminGet(token, '/forex/config');
  mark('FOREX_CONFIG_API', config.ok && config.body?.success, config.ok ? '' : `HTTP ${config.status}`);
  const flags = config.body?.data?.runtime?.featureFlags ?? {};
  const routingV2 = Boolean(flags.routingV2Enabled);
  const adapterHook = Boolean(flags.adapterLayerHookEnabled);
  mark('FLAG_ROUTING_V2', STRICT ? routingV2 : true, routingV2 ? 'enabled' : STRICT ? 'required in S5_STRICT' : 'off (ok for pre-staging)');
  mark('FLAG_ADAPTER_HOOK', STRICT ? adapterHook : true, adapterHook ? 'enabled' : STRICT ? 'required in S5_STRICT' : 'off (ok for pre-staging)');

  const desk = await adminGet(token, '/forex/routing/desk');
  mark('ROUTING_DESK_API', desk.ok && desk.body?.success, desk.ok ? '' : `HTTP ${desk.status}`);
  const checklist = desk.body?.data?.stagingChecklist ?? [];
  if (checklist.length === 0) {
    mark('STAGING_CHECKLIST_PRESENT', false, 'Empty stagingChecklist — deploy S5 backend?');
  } else {
    mark('STAGING_CHECKLIST_PRESENT', true, `${checklist.length} items`);
    for (const row of checklist) {
      const required = STRICT || !['routing-v2', 'adapter-hook'].includes(row.id);
      mark(`CHECKLIST_${row.id.toUpperCase().replace(/-/g, '_')}`, required ? row.pass : true, row.detail);
    }
  }

  const crm = await adminGet(token, '/forex/crm/clients?limit=5');
  mark('CRM_CLIENTS_API', crm.ok && crm.body?.success, crm.ok ? `rows=${crm.body?.data?.rows?.length ?? 0}` : `HTTP ${crm.status}`);
  if (crm.body?.data?.rows?.[0]) {
    const row = crm.body.data.rows[0];
    mark('CRM_KYC_RISK_FIELDS', 'risk_level' in row && 'kyc_status' in row, `sample=${row.account_id}`);
  } else {
    warn('CRM list empty — create a forex account or skip row-level KYC check');
  }

  const integrations = await adminGet(token, '/forex/integrations');
  mark('INTEGRATIONS_API', integrations.ok && integrations.body?.success, integrations.ok ? '' : `HTTP ${integrations.status}`);

  const controls = await adminGet(token, '/forex/controls');
  const killSwitch = controls.body?.data?.effective?.killSwitch === true;
  mark('KILL_SWITCH_OFF', !killSwitch, killSwitch ? 'ON — disable before customer/staging exec cert' : 'off');

  if (RUN_EXEC_TEST) {
    const execEnabled = controls.body?.data?.effective?.executionTestApiEnabled === true;
    if (!execEnabled) {
      mark('EXEC_TEST_API_ENABLED', false, 'Set FOREX_EXECUTION_TEST_API=1 or enable via admin controls');
    } else {
      mark('EXEC_TEST_API_ENABLED', true);
      const clientExecId = `s5-cert-${Date.now()}`;
      const attempt = await forexExecTest({
        clientExecId,
        symbol: 'EURUSD',
        side: 'buy',
        volume: '0.01',
        orderType: 'market',
        timestamp: new Date().toISOString(),
      });
      const status = attempt.body?.data?.execution?.status ?? attempt.body?.error?.code;
      const pass = attempt.ok && (status === 'FILLED' || status === 'PARTIALLY_FILLED');
      mark('EXEC_TEST_ORDER', pass, String(status ?? attempt.status));
    }
  } else {
    warn('S5_RUN_EXEC_TEST not set — skip MOCK execution test (see FOREX_S5_STAGING_CERT.md manual kill-switch step)');
  }

  console.log('\n--- Manual sign-off (required) ---');
  console.log('  1. Admin UI: /forex/liquidity/routing — S5 checklist all Pass (after env flags on staging).');
  console.log('  2. Admin UI: /forex/crm/clients — KYC/Risk columns + filters.');
  console.log('  3. Kill switch ON → repeat exec test → expect reject → kill switch OFF.');
  console.log('  4. Record result in FOREX_S5_STAGING_CERT.md sign-off table.\n');

  const failed = RESULTS.filter((r) => !r.ok);
  finish(failed.length ? 1 : 0);
}

function finish(code) {
  const failed = RESULTS.filter((r) => !r.ok);
  console.log(`S5 automated: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${RESULTS.length - failed.length}/${RESULTS.length})`);
  if (JSON_OUT) {
    console.log(JSON.stringify({ pass: failed.length === 0, results: RESULTS }, null, 2));
  }
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
