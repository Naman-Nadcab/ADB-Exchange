#!/usr/bin/env node
/**
 * Evidence-based Forex page status — API + live browser (no HTTP-200-only PASS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.build/forex-page-by-page-truth.json');
const LIVE_ADMIN = process.env.FOREX_LIVE_ADMIN ?? 'http://109.123.254.30/admin';
const LIVE_API = process.env.FOREX_LIVE_API_BASE ?? 'http://127.0.0.1:4000/api/v1/admin';

/** Traced from admin panel components → adminFetch paths */
const ROUTE_APIS_BY_ID = {
  overview: ['/forex/overview', '/forex/config'],
  F0: ['/forex/overview', '/forex/config'],
  command: ['/forex/overview', '/forex/system', '/forex/command/attention'],
  notifications: ['/forex/notifications?limit=5'],
  compliance: ['/forex/compliance/cases?limit=5'],
  automation: ['/forex/automation/workflows'],
  instruments: ['/forex/config', '/forex/controls'],
  sessions: ['/forex/config', '/forex/holidays'],
  'market-data': ['/forex/config', '/forex/market-data/quotes'],
  orders: ['/forex/orders?limit=1'],
  executions: ['/forex/executions?limit=1'],
  positions: ['/forex/positions?limit=1'],
  protection: ['/forex/orders?limit=5'],
  'margin-risk': ['/forex/policy', '/forex/risk/hub'],
  liquidation: ['/forex/policy', '/forex/journal?limit=5'],
  dealing: ['/forex/dealing/queue', '/forex/controls'],
  'fees-swaps': ['/forex/policy'],
  accounts: ['/forex/accounts/list?limit=1'],
  'account-groups': ['/forex/account-groups'],
  'crm-home': ['/forex/crm/home'],
  'crm-my-clients': ['/forex/crm/workspace'],
  'crm-leads': ['/forex/crm/leads?limit=1', '/forex/crm/leads/summary'],
  'crm-clients': ['/forex/crm/clients?limit=1'],
  'crm-finance': ['/forex/crm/finance/accounts?limit=1'],
  'crm-tasks': ['/forex/crm/tasks?limit=1'],
  'crm-segments': ['/forex/crm/segments'],
  'crm-pipeline': ['/forex/crm/pipeline'],
  'forex-reporting': ['/forex/reporting/snapshot'],
  'risk-control': ['/forex/risk/control-plane'],
  'forex-partners': ['/forex/partners'],
  ledger: ['/forex/ledger'],
  controls: ['/forex/controls'],
  'lp-execution': ['/forex/execution'],
  'liquidity-routing': ['/forex/routing/desk'],
  integrations: ['/forex/integrations'],
  'journal-audit': ['/forex/journal?limit=5'],
  system: ['/forex/system'],
};

const ROUTE_COMPONENT_BY_ID = {
  overview: 'forex/page.tsx',
  command: 'ForexSectionPage:command',
  instruments: 'ForexInstrumentsPanel',
  sessions: 'ForexSectionPage:sessions',
  'market-data': 'ForexMarketDataPanel',
  orders: 'ForexAdminOpsTable:orders',
  executions: 'ForexAdminOpsTable:executions',
  positions: 'ForexAdminOpsTable:positions',
  protection: 'ForexProtectionPanel',
  'margin-risk': 'ForexPolicyPanel:margin-risk',
  liquidation: 'ForexLiquidationPanel',
  dealing: 'ForexDealingDeskPanel',
  'fees-swaps': 'ForexPolicyPanel:fees-swaps',
  accounts: 'ForexLedgerPanel',
  'account-groups': 'ForexAccountGroupsPanel',
  'crm-home': 'ForexCrmHomePanel',
  'crm-leads': 'ForexCrmLeadsPanel',
  'crm-pipeline': 'ForexCrmPipelinePanel',
  'crm-clients': 'ForexCrmClientsPanel',
  'crm-my-clients': 'ForexCrmMyClientsPanel',
  'crm-segments': 'ForexCrmSegmentsPanel',
  'crm-tasks': 'ForexCrmTasksPanel',
  'crm-finance': 'ForexCrmFinancePanel',
  notifications: 'ForexNotificationsPanel',
  compliance: 'ForexCompliancePanel',
  automation: 'ForexAutomationPanel',
  'forex-reporting': 'ForexReportingPanel',
  'risk-control': 'ForexRiskControlPanel + ForexRiskHubPanel',
  'forex-partners': 'ForexPartnersPanel',
  ledger: 'ForexLedgerPanel',
  controls: 'ForexGlobalControlsPanel',
  'lp-execution': 'ForexExecutionPanel',
  'liquidity-routing': 'ForexRoutingDeskPanel',
  integrations: 'ForexIntegrationsPanel',
  'journal-audit': 'ForexJournalAuditPanel',
  system: 'ForexSectionPage:system',
};

function parseAllRoutes() {
  const navPath = path.join(ROOT, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts');
  const src = fs.readFileSync(navPath, 'utf8');
  const start = src.indexOf('export const FOREX_ADMIN_ROUTES');
  if (start < 0) throw new Error('FOREX_ADMIN_ROUTES not found');
  const slice = src.slice(start);
  const routes = [];
  const entryRe = /\{\s*id:\s*'([^']+)',\s*label:[\s\S]*?href:\s*'([^']+)'/g;
  let m;
  while ((m = entryRe.exec(slice))) {
    if (!routes.some((r) => r.href === m[2])) routes.push({ id: m[1], href: m[2] });
  }
  return routes;
}

function isPrefetchConsoleNoise(msg) {
  return /Failed to fetch RSC payload|prefetch/i.test(String(msg));
}

function shellOk(browser) {
  if (!browser?.render_ok) return false;
  if (browser.aside_count >= 1) return true;
  if (browser.main_width != null && browser.main_width > 400) return true;
  if (browser.functional_hint && String(browser.final_url ?? '').includes('/forex')) return true;
  return false;
}

function isNetworkTransient(err) {
  const s = String(err ?? '');
  return /ERR_NETWORK_CHANGED|net::ERR_|interrupted by another navigation|chrome-error:/i.test(s);
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
  if (!json.success) throw new Error('admin login failed');
  return json.data;
}

async function probeApi(token, apiPath) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${LIVE_API}${apiPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return {
      path: apiPath,
      http: res.status,
      success: body?.success === true,
      errorCode: body?.error?.code ?? null,
    };
  } catch (e) {
    return { path: apiPath, http: 0, success: false, errorCode: e.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED' };
  } finally {
    clearTimeout(t);
  }
}

function classify(row) {
  const b = row.browser;
  if (!row.repo.component_exists) return 'NOT_IMPLEMENTED';
  if (b?.network_transient) return 'NETWORK_TRANSIENT';
  if (b?.final_url?.includes('/login') || b?.session_expired) return 'AUTH_BLOCKED';

  const hasApiMap = row.api_endpoints.length > 0;
  const apiOk = hasApiMap && row.api_checks.every((a) => a.success);
  const apiFail = hasApiMap && row.api_checks.some((a) => !a.success);
  const browserOk = b?.render_ok && !b?.react_error && shellOk(b);
  const dataOk = b && !b.has_failed_banner && !b.has_object_object;
  const consoleProductError =
    b?.console_errors?.some((m) => !isPrefetchConsoleNoise(m) && /Minified React error|Objects are not valid/i.test(m)) ?? false;

  if (b?.react_error || consoleProductError || b?.has_failed_banner || b?.has_object_object) return 'BROKEN';
  if (apiFail && browserOk) return 'BROKEN';
  if (apiOk && browserOk && dataOk) return 'FUNCTIONAL';
  if (apiOk && browserOk && b?.empty_valid) return 'EMPTY_VALID';
  if (!hasApiMap && browserOk && apiOk) return 'FUNCTIONAL';
  if (!hasApiMap && browserOk) return 'UI_ONLY';
  if (hasApiMap && !browserOk && apiOk && b?.render_ok && b?.functional_hint) return 'DEPLOYED';
  if (hasApiMap && !browserOk && apiOk) return 'BROKEN';
  if (row.repo.component_exists && !row.live_backend) return 'CODE_ONLY';
  return 'BROKEN';
}

async function gotoWithRetry(page, url) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(800);
      return page.url();
    } catch (e) {
      lastErr = e;
      if (!isNetworkTransient(String(e))) throw e;
      await page.waitForTimeout(1500);
    }
  }
  throw lastErr;
}

async function browserAudit(session, routes) {
  const { accessToken, admin } = session;
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return { skipped: true, reason: 'playwright not available' };
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const adminUser = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    permissions: admin.permissions ?? ['all'],
  };
  await context.addInitScript(
    ({ accessToken, adminUser: a }) => {
      localStorage.setItem('admin-auth', JSON.stringify({ state: { accessToken, admin: a }, version: 0 }));
    },
    { accessToken, adminUser },
  );
  const page = await context.newPage();

  async function seedSession() {
    await context.addInitScript(
      ({ accessToken, adminUser: a }) => {
        localStorage.setItem('admin-auth', JSON.stringify({ state: { accessToken, admin: a }, version: 0 }));
      },
      { accessToken, adminUser },
    );
    await gotoWithRetry(page, `${LIVE_ADMIN}/dashboard`);
    await page.waitForSelector('aside', { timeout: 30_000 }).catch(() => null);
    await gotoWithRetry(page, `${LIVE_ADMIN}/forex`);
    await page.waitForSelector('main', { timeout: 30_000 }).catch(() => null);
  }

  await seedSession();

  const results = {};
  for (let i = 0; i < routes.length; i += 1) {
    const r = routes[i];
    if (i > 0 && i % 8 === 0) await seedSession();
    const url = `${LIVE_ADMIN}${r.href}`;
    const consoleErrors = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    let finalUrl = url;
    let navError = null;
    try {
      finalUrl = await gotoWithRetry(page, url);
      await page.waitForSelector('main', { timeout: 20_000 }).catch(() => null);
      if (finalUrl.includes('/login') || finalUrl.includes('session_expired')) {
        await seedSession();
        finalUrl = await gotoWithRetry(page, url);
        await page.waitForSelector('main', { timeout: 20_000 }).catch(() => null);
      }
    } catch (e) {
      navError = String(e);
      results[r.href] = {
        render_ok: false,
        error: navError,
        network_transient: isNetworkTransient(navError),
      };
      await page.waitForTimeout(400);
      continue;
    }
    const bodyText = await page.locator('body').innerText().catch(() => '');
    let metrics = { aside_count: 0, main_width: null };
    try {
      metrics = await page.evaluate(() => ({
        aside_count: document.querySelectorAll('aside').length,
        main_width: document.querySelector('main')?.getBoundingClientRect().width ?? null,
      }));
    } catch {
      await page.waitForTimeout(600);
      metrics = await page
        .evaluate(() => ({
          aside_count: document.querySelectorAll('aside').length,
          main_width: document.querySelector('main')?.getBoundingClientRect().width ?? null,
        }))
        .catch(() => metrics);
    }
    results[r.href] = {
      render_ok: !finalUrl.includes('/login') && finalUrl.includes('/admin'),
      final_url: finalUrl,
      session_expired: finalUrl.includes('session_expired') || (finalUrl.includes('/login') && !url.includes('/login')),
      aside_count: metrics.aside_count,
      main_width: metrics.main_width,
      has_failed_banner: bodyText.includes('This page failed to load'),
      has_object_object: bodyText.includes('[object Object]'),
      react_error: consoleErrors.some((m) => /Minified React error|Objects are not valid/i.test(m)),
      console_errors: consoleErrors.slice(0, 5),
      empty_valid:
        (/No leads|No orders|No open|empty|0 leads|not configured/i.test(bodyText) ||
          bodyText.includes('EMPTY')) &&
        !bodyText.includes('Load failed') &&
        !bodyText.includes('Failed'),
      functional_hint:
        !bodyText.includes('Not Found') && !bodyText.includes('Load failed') && !bodyText.includes('This page failed to load'),
      network_transient: false,
    };
    await page.waitForTimeout(400);
  }
  await context.close();
  await browser.close();
  return results;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const allRoutes = parseAllRoutes();
  let session;
  try {
    session = await login();
  } catch {
    session = null;
  }
  const token = session?.accessToken ?? null;

  const backendHasCrm = execSync('docker exec exchange-backend test -f /app/dist/routes/admin-forex-crm.fastify.js && echo yes || echo no', {
    encoding: 'utf8',
  }).trim();

  const browserByHref = session ? await browserAudit(session, allRoutes) : {};

  const pages = [];
  for (const r of allRoutes) {
    const apis = ROUTE_APIS_BY_ID[r.id] ?? [];
    const compPath = path.join(
      ROOT,
      'apps/admin-panel/src/app/(protected)',
      r.href === '/forex' ? 'forex/page.tsx' : `${r.href.replace(/^\//, '')}/page.tsx`,
    );
    const component_exists = fs.existsSync(compPath) || r.href === '/forex';

    const api_checks = token && apis.length ? await Promise.all(apis.map((p) => probeApi(token, p))) : [];

    const browser = browserByHref[r.href] ?? null;
    const apiOk = api_checks.length ? api_checks.every((a) => a.success) : null;

    const row = {
      route: r.href,
      route_id: r.id,
      page_component: ROUTE_COMPONENT_BY_ID[r.id] ?? compPath,
      api_endpoints: apis,
      api_checks,
      api_status: apiOk === null ? 'UNKNOWN' : apiOk ? 'OK' : 'FAIL',
      auth_status: token ? 'OK' : 'AUTH_VERIFICATION_BLOCKED',
      db_status: r.id.startsWith('crm') ? (backendHasCrm === 'yes' ? 'SCHEMA_PRESENT' : 'UNKNOWN') : 'N/A',
      data_status: browser?.functional_hint ? 'LOADS' : browser?.empty_valid ? 'EMPTY_VALID' : browser ? 'UNKNOWN' : 'NOT_BROWSER_TESTED',
      ui_render_status: browser?.render_ok ? 'RENDERS' : browser ? 'FAIL' : 'NOT_TESTED',
      browser_console_status: browser?.react_error ? 'REACT_ERROR' : browser?.console_errors?.length ? 'WARN' : browser ? 'CLEAN' : 'NOT_TESTED',
      visual_status:
        browser?.has_failed_banner || browser?.has_object_object
          ? 'FAIL'
          : browser && shellOk(browser)
            ? 'PASS_SHELL'
            : browser
              ? 'WARN'
              : 'NOT_TESTED',
      live_deployment: {
        frontend: 'exchange-admin',
        backend: backendHasCrm === 'yes' ? 'CRM_ROUTES_IN_IMAGE' : 'STALE',
        probed_at: new Date().toISOString(),
      },
      repo: { component_exists },
      live_backend: backendHasCrm === 'yes',
      browser,
      overall_status: '',
    };
    row.overall_status = classify(row);
    pages.push(row);
  }

  const counts = {};
  for (const p of pages) counts[p.overall_status] = (counts[p.overall_status] ?? 0) + 1;

  const out = {
    generatedAt: new Date().toISOString(),
    operator_url: LIVE_ADMIN,
    api_base: LIVE_API,
    crypto_regression: 'FROZEN_OUT_OF_SCOPE',
    note: 'NETWORK_TRANSIENT is not an implementation gap. AUTH_BLOCKED requires operator session seeding.',
    pages,
    summary: { total_routes: pages.length, by_status: counts },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('Wrote', OUT, out.summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
