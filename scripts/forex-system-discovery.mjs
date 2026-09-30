#!/usr/bin/env node
/**
 * Forensic Forex discovery — repo routes, live API probes, container hints.
 * Does not mutate state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DISCOVERY = path.join(ROOT, '.build/forex-final-system-discovery.json');
const OUT_INVENTORY = path.join(ROOT, '.build/forex-repository-capability-inventory.json');
const OUT_DEPLOY = path.join(ROOT, '.build/forex-deployment-diff.json');

const LIVE_API = process.env.FOREX_LIVE_API_BASE ?? 'http://127.0.0.1:4000/api/v1/admin';
const ADMIN_EMAIL = process.env.FOREX_LIVE_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.FOREX_LIVE_ADMIN_PASSWORD ?? 'admin123';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return e.stdout?.toString?.()?.trim() ?? null;
  }
}

function readForexRoutes() {
  const navPath = path.join(ROOT, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts');
  const src = fs.readFileSync(navPath, 'utf8');
  const routes = [];
  const re = /id:\s*'([^']+)'[\s\S]*?href:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    if (!routes.some((r) => r.id === m[1])) routes.push({ id: m[1], href: m[2] });
  }
  return routes;
}

function globPanels() {
  const dir = path.join(ROOT, 'apps/admin-panel/src/components/forex/panels');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, ''));
}

async function login() {
  const res = await fetch(`${LIVE_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('live admin login failed');
  return json.data.accessToken;
}

async function probe(token, apiPath, method = 'GET') {
  const res = await fetch(`${LIVE_API}${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const ok = res.ok && body?.success !== false;
  return { http: res.status, ok, code: body?.error?.code ?? null };
}

const API_MAP = {
  overview: '/forex/overview',
  command: '/forex/overview',
  sessions: '/forex/config',
  instruments: '/forex/config',
  'market-data': '/forex/market-data/snapshot',
  orders: '/forex/orders?limit=1',
  executions: '/forex/executions?limit=1',
  positions: '/forex/positions?limit=1',
  dealing: '/forex/dealing/queue',
  'crm-home': '/forex/crm/home',
  'crm-leads': '/forex/crm/leads?limit=1',
  'crm-pipeline': '/forex/crm/pipeline',
  'crm-clients': '/forex/crm/clients?limit=1',
  'crm-my-clients': '/forex/crm/workspace',
  'crm-segments': '/forex/crm/segments',
  'crm-tasks': '/forex/crm/tasks?limit=1',
  'crm-finance': '/forex/crm/finance/accounts?limit=1',
  'forex-reporting': '/forex/reporting/snapshot',
  'risk-control': '/forex/risk/control-plane',
  'margin-risk': '/forex/risk/hub',
  'forex-partners': '/forex/partners',
  ledger: '/forex/ledger/accounts',
  accounts: '/forex/ledger/accounts',
  compliance: '/forex/compliance/cases?limit=1',
  automation: '/forex/automation/workflows',
  controls: '/forex/controls',
  'journal-audit': '/forex/journal?limit=1',
  'lp-execution': '/forex/execution',
  'liquidity-routing': '/forex/routing/desk',
  integrations: '/forex/integrations',
  system: '/forex/system',
  notifications: '/forex/notifications',
  protection: '/forex/protection',
  liquidation: '/forex/liquidation/journal?limit=1',
  accounts: '/forex/ledger/accounts?limit=1',
  'account-groups': '/forex/account-groups',
  'fees-swaps': '/forex/config',
};

async function main() {
  fs.mkdirSync(path.join(ROOT, '.build'), { recursive: true });
  const gitHead = sh('git -C ' + ROOT + ' rev-parse HEAD');
  const gitBranch = sh('git -C ' + ROOT + ' branch --show-current');
  const adminCreated = sh('docker inspect exchange-admin --format "{{.Created}}" 2>/dev/null');
  const adminImage = sh('docker inspect exchange-admin --format "{{.Config.Image}}" 2>/dev/null');
  const backendCreated = sh('docker inspect exchange-backend --format "{{.Created}}" 2>/dev/null');
  const routes = readForexRoutes();
  const panels = globPanels();

  let token = null;
  let authBlocked = false;
  try {
    token = await login();
  } catch {
    authBlocked = true;
  }

  const apiProbes = {};
  if (token) {
    for (const [routeId, apiPath] of Object.entries(API_MAP)) {
      apiProbes[routeId] = await probe(token, apiPath);
    }
  }

  const discovery = {
    generatedAt: new Date().toISOString(),
    repository: { gitHead, gitBranch, dirty: sh('git -C ' + ROOT + ' status -sb | wc -l') },
    liveTopology: {
      operatorUrl: 'http://109.123.254.30/admin',
      nginx: 'exchange-nginx → admin-panel:3001, backend:4000',
      adminContainer: { name: 'exchange-admin', image: adminImage, created: adminCreated },
      backendContainer: { name: 'exchange-backend', created: backendCreated },
      probedApiBase: LIVE_API,
      authBlocked,
    },
    forexRouteCount: routes.length,
    forexPanelComponents: panels.length,
    liveApiProbes: apiProbes,
  };

  const capabilities = routes.map((r) => {
    const panelGuess = panels.find((p) => p.toLowerCase().includes(r.id.replace(/-/g, '')));
    const api = API_MAP[r.id];
    const probe = api ? apiProbes[r.id] : null;
    return {
      routeId: r.id,
      href: r.href,
      repo: { uiRoute: true, panel: panelGuess ?? null },
      live: {
        apiPath: api ?? null,
        apiOk: probe?.ok ?? null,
        http: probe?.http ?? null,
      },
    };
  });

  const deployDiff = capabilities.map((c) => ({
    feature: c.routeId,
    href: c.href,
    REPO: 'YES',
    LIVE_FRONTEND: adminCreated ? 'LIKELY' : 'UNKNOWN',
    LIVE_API: c.live.apiOk === true ? 'YES' : c.live.apiOk === false ? 'NO' : 'UNKNOWN',
    STATUS:
      c.live.apiOk === true
        ? 'LIVE_API_OK'
        : c.live.apiPath && c.live.apiOk === false
          ? 'LIVE_API_GAP_OR_AUTH'
          : 'UI_ONLY_OR_UNMAPPED',
  }));

  fs.writeFileSync(OUT_DISCOVERY, JSON.stringify(discovery, null, 2));
  fs.writeFileSync(OUT_INVENTORY, JSON.stringify({ generatedAt: discovery.generatedAt, capabilities }, null, 2));
  fs.writeFileSync(OUT_DEPLOY, JSON.stringify({ generatedAt: discovery.generatedAt, items: deployDiff }, null, 2));
  console.log('Wrote', OUT_DISCOVERY, OUT_INVENTORY, OUT_DEPLOY);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
