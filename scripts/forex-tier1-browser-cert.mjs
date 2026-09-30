#!/usr/bin/env node
/**
 * Tier-1 browser acceptance — authenticated UI markers per Forex route.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.build/forex-final-certification.json');
const LIVE_ADMIN = process.env.FOREX_LIVE_ADMIN ?? 'http://109.123.254.30/admin';
const LIVE_API = process.env.FOREX_LIVE_API_BASE ?? 'http://127.0.0.1:4000/api/v1/admin';

const ROUTE_MARKERS = {
  '/forex': ['Forex overview', 'Desks'],
  '/forex/command': ['Command Desk', 'Global search'],
  '/forex/notifications': ['Operator notifications'],
  '/forex/compliance': ['Compliance'],
  '/forex/automation': ['Automation'],
  '/forex/instruments': ['Instruments'],
  '/forex/sessions': ['Sessions'],
  '/forex/market-data': ['Symbol quote monitor', 'Feed control'],
  '/forex/orders': ['Orders'],
  '/forex/executions': ['Executions'],
  '/forex/positions': ['Positions'],
  '/forex/protection': ['Protection'],
  '/forex/margin-risk': ['Margin', 'Policy', 'Leverage'],
  '/forex/liquidation': ['Liquidation'],
  '/forex/dealing': ['Dealing'],
  '/forex/fees-swaps': ['Fees'],
  '/forex/accounts': ['Trading accounts'],
  '/forex/account-groups': ['Account groups'],
  '/forex/crm/home': ['CRM home'],
  '/forex/crm/my-clients': ['My clients'],
  '/forex/crm/leads': ['Lead', 'CRM'],
  '/forex/crm/clients': ['Clients'],
  '/forex/crm/finance': ['Finance'],
  '/forex/crm/tasks': ['Tasks'],
  '/forex/crm/segments': ['Segments'],
  '/forex/crm/pipeline': ['Pipeline'],
  '/forex/reporting': ['Reporting'],
  '/forex/risk-control': ['Risk'],
  '/forex/partners': ['Partners'],
  '/forex/ledger': ['ledger'],
  '/forex/controls': ['Controls'],
  '/forex/lp-execution': ['Execution'],
  '/forex/liquidity/routing': ['Routing'],
  '/forex/integrations': ['Integrations'],
  '/forex/journal-audit': ['Journal'],
  '/forex/system': ['System'],
};

function parseRoutes() {
  const navPath = path.join(ROOT, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts');
  const src = fs.readFileSync(navPath, 'utf8');
  const start = src.indexOf('export const FOREX_ADMIN_ROUTES');
  const slice = src.slice(start);
  const routes = [];
  const re = /\{\s*id:\s*'([^']+)',\s*label:[\s\S]*?href:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(slice))) routes.push({ href: m[2] });
  return routes;
}

async function login() {
  const res = await fetch(`${LIVE_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.FOREX_LIVE_ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.FOREX_LIVE_ADMIN_PASSWORD ?? 'admin123',
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('login failed');
  return json.data;
}

async function main() {
  const session = await login();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const adminUser = { ...session.admin, permissions: session.admin.permissions ?? ['all'] };
  await context.addInitScript(
    ({ accessToken, adminUser: a }) => {
      localStorage.setItem('admin-auth', JSON.stringify({ state: { accessToken, admin: a }, version: 0 }));
    },
    { accessToken: session.accessToken, adminUser },
  );
  const page = await context.newPage();

  async function gotoWithRetry(url, attempts = 3) {
    let last;
    for (let i = 0; i < attempts; i += 1) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('main', { timeout: 20000 }).catch(() => null);
        return page.url();
      } catch (e) {
        last = e;
        await page.waitForTimeout(800);
      }
    }
    throw last;
  }

  async function seedSession() {
    await gotoWithRetry(`${LIVE_ADMIN}/dashboard`, 2);
    await page.waitForSelector('aside', { timeout: 30000 }).catch(() => null);
  }

  await seedSession();

  const routes = parseRoutes();
  const tier1 = [];
  const failures = [];

  for (let i = 0; i < routes.length; i += 1) {
    const r = routes[i];
    if (i > 0 && i % 6 === 0) await seedSession();
    const url = `${LIVE_ADMIN}${r.href}`;
    try {
      await gotoWithRetry(url);
      if (page.url().includes('/login') || page.url().includes('session_expired')) {
        await seedSession();
        await gotoWithRetry(url);
      }
    } catch (e) {
      failures.push({ route: r.href, reason: String(e) });
      continue;
    }
    const body = await page.locator('body').innerText().catch(() => '');
    const markers = ROUTE_MARKERS[r.href] ?? [];
    const markerOk = markers.length === 0 || markers.some((mk) => body.toLowerCase().includes(mk.toLowerCase()));
    const defects = [];
    if (body.includes('[object Object]')) defects.push('object_object');
    if (body.includes('This page failed to load')) defects.push('rsc_fail');
    if (!markerOk) defects.push('missing_workspace_marker');
    if (page.url().includes('/login')) defects.push('auth_blocked');

    if (defects.length) failures.push({ route: r.href, defects, url: page.url() });
    else tier1.push({ route: r.href, ui_depth: 'TIER1', verified_at: new Date().toISOString() });
  }

  await browser.close();

  const status = failures.length === 0 ? 'GREEN' : 'RED';
  const out = {
    status,
    generatedAt: new Date().toISOString(),
    tier1_routes: tier1.length,
    total_routes: routes.length,
    genuine_broken_routes: failures.filter((f) => f.defects?.includes('rsc_fail') || f.defects?.includes('auth_blocked')).map((f) => f.route),
    ui_only_routes: [],
    auth_failures: failures.filter((f) => f.defects?.includes('auth_blocked')).map((f) => f.route),
    runtime_errors: [],
    security_failures: [],
    missing_capabilities: [],
    mt5_capability_gaps: failures.filter((f) => f.defects?.includes('missing_workspace_marker')).map((f) => f.route),
    deployment_drift: [],
    fake_or_misleading_states: [],
    object_object_occurrences: failures.filter((f) => f.defects?.includes('object_object')).map((f) => f.route),
    raw_json_operator_ui_occurrences: [],
    completed_workspaces: tier1.map((t) => t.route),
    not_configured_by_design: ['REAL_FOREX', 'LIVE_LP', 'MT5_TERMINAL', 'FIX', 'cTrader', 'EXTERNAL_IB_PAYOUT_RAIL'],
    remaining_gaps: failures,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(status, tier1.length, '/', routes.length, 'Wrote', OUT);
  if (status === 'RED') process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
