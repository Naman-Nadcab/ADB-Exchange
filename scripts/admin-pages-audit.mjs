#!/usr/bin/env node
/**
 * Full admin-panel page audit: Playwright navigation + backend API probes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const adminBase = process.env.ADMIN_BASE_URL || 'http://localhost:3001';
const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

const STATIC_ROUTES = [
  '/dashboard', '/control-center', '/admin-control', '/monitoring', '/monitoring/alert-rules',
  '/incidents', '/operations', '/triage',
  '/analytics', '/analytics/scheduled-reports',
  '/trading', '/markets', '/orders', '/trades', '/liquidity', '/admin/mm-control', '/p2p',
  '/wallets', '/treasury', '/treasury/settings', '/deposits', '/withdrawals', '/fiat-withdrawals',
  '/reconciliation', '/fees', '/staking',
  '/risk', '/risk/automation', '/risk/settings', '/risk/severity-settings', '/compliance', '/approvals',
  '/audit', '/audit/config', '/logs',
  '/users', '/users/restrictions', '/users/referrals', '/users/analytics', '/kyc', '/security', '/support',
  '/admin-users', '/notifications', '/announcements', '/integrations',
  '/system/integrations', '/settings', '/settings/system', '/settings/auth-notifications',
  '/settings/infrastructure', '/settings/integrations', '/settings/nodes',
  '/backups', '/system/page-audit',
];

const API_PROBES = [
  { page: 'Dashboard', path: '/dashboard-summary', keys: ['stats'] },
  { page: 'Control Center', path: '/control/overview', keys: ['tradingHalted'] },
  { page: 'Admin Control', path: '/system-health', keys: ['database'] },
  { page: 'Monitoring', path: '/control/exchange-health-tier1', keys: ['overall'] },
  { page: 'Alert Rules', path: '/monitoring/alert-rules' },
  { page: 'Users', path: '/users?limit=1' },
  { page: 'Withdrawals', path: '/withdrawals?limit=1' },
  { page: 'Deposits', path: '/deposits?limit=1' },
  { page: 'Fiat Withdrawals', path: '/fiat-withdrawals?limit=1' },
  { page: 'Markets', path: '/markets' },
  { page: 'Orders', path: '/trading/orders?limit=1' },
  { page: 'Trades', path: '/trading/trades?limit=1' },
  { page: 'P2P', path: '/p2p' },
  { page: 'Liquidity', path: '/liquidity-bot/config' },
  { page: 'MM Control', path: '/control/mm-control/status' },
  { page: 'Treasury', path: '/treasury' },
  { page: 'Treasury health', path: '/treasury/health' },
  { page: 'Security', path: '/security/dashboard' },
  { page: 'KYC', path: '/kyc?limit=1' },
  { page: 'Risk', path: '/risk' },
  { page: 'Compliance sanctions', path: '/compliance/sanctions' },
  { page: 'Audit activity', path: '/audit/activity?limit=1' },
  { page: 'Audit config', path: '/audit/config?limit=1' },
  { page: 'Support', path: '/support/tickets?limit=1' },
  { page: 'Admin users', path: '/admins?limit=1' },
  { page: 'Notifications', path: '/notifications/delivery-stats' },
  { page: 'Announcements', path: '/notifications/announcements' },
  { page: 'Integrations', path: '/integrations/webhook-deliveries?limit=1' },
  { page: 'Analytics volume', path: '/analytics/volume' },
  { page: 'Scheduled Reports', path: '/analytics/scheduled-reports' },
  { page: 'Reconciliation', path: '/treasury/reconciliation' },
  { page: 'Fees', path: '/fees' },
  { page: 'Staking', path: '/staking/products' },
  { page: 'Wallets', path: '/treasury/hot-wallets' },
  { page: 'Backups', path: '/operational/backups' },
  { page: 'Operations', path: '/operations/action-center' },
  { page: 'Incidents', path: '/control/incidents' },
  { page: 'Approvals', path: '/approval-requests?limit=1' },
  { page: 'Settings', path: '/settings' },
  { page: 'System settings', path: '/system/settings' },
  { page: 'Referrals', path: '/users/referrals' },
  { page: 'User analytics', path: '/users/analytics' },
];

async function adminLogin() {
  const res = await fetch(`${apiBase}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) throw new Error(`Admin login failed: ${res.status} ${JSON.stringify(json)}`);
  return json.data?.accessToken ?? json.accessToken;
}

async function probeApi(token, probe) {
  const t0 = Date.now();
  const url = `${apiBase}/api/v1/admin${probe.path}`;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
    clearTimeout(to);
    const json = await res.json().catch(() => ({}));
    let status = 'WORKING';
    let detail;
    if (!res.ok) {
      status = 'BROKEN';
      detail = `HTTP ${res.status}`;
    } else if (json.success === false) {
      status = 'PARTIAL';
      detail = json?.error?.message ?? 'success_false';
    } else if (probe.keys?.length) {
      const data = json.data ?? json;
      const missing = probe.keys.filter((k) => !(k in (data || {})));
      if (missing.length) {
        status = 'PARTIAL';
        detail = `missing: ${missing.join(',')}`;
      }
    }
    return { ...probe, status, httpStatus: res.status, ms: Date.now() - t0, detail };
  } catch (e) {
    return { ...probe, status: 'BROKEN', httpStatus: 0, ms: Date.now() - t0, detail: e.message };
  }
}

async function auditPage(page, route) {
  const result = {
    route,
    ok: true,
    httpStatus: null,
    title: '',
    consoleErrors: [],
    failedRequests: [],
    server5xx: [],
    notes: [],
  };

  const consoleErrors = [];
  const failedRequests = [];
  const server5xx = [];

  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  };
  const onRequestFailed = (req) => {
    failedRequests.push(`${req.method()} ${req.url().slice(0, 120)} — ${req.failure()?.errorText ?? 'failed'}`);
  };
  const onResponse = (res) => {
    const s = res.status();
    if (s >= 500) server5xx.push(`${s} ${res.url().slice(0, 120)}`);
  };

  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  try {
    const res = await page.goto(`${adminBase}${route}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    result.httpStatus = res?.status() ?? 0;

    if (result.httpStatus === 404) {
      result.ok = false;
      result.notes.push('page_404');
    }
    await page.waitForTimeout(1500);
    if (page.url().includes('/login')) {
      result.ok = false;
      result.notes.push('redirected_to_login');
    }

    result.title = await page.title().catch(() => '');

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/something went wrong|application error|unhandled runtime error/i.test(bodyText)) {
      result.ok = false;
      result.notes.push('runtime_error_ui');
    }
    if (/404|not found|page could not be found/i.test(bodyText) && route !== '/logs') {
      if (result.httpStatus === 404 || bodyText.length < 500) {
        result.ok = false;
        result.notes.push('not_found_ui');
      }
    }
  } catch (e) {
    result.ok = false;
    result.notes.push(`nav_error: ${e.message}`);
  } finally {
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
    result.consoleErrors = consoleErrors.slice(0, 8);
    result.failedRequests = failedRequests.slice(0, 8);
    result.server5xx = server5xx.slice(0, 8);
    if (result.consoleErrors.length || result.failedRequests.length || result.server5xx.length) {
      result.ok = false;
    }
  }
  return result;
}

async function adminLoginPage(page, loginData) {
  await page.goto(`${adminBase}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(adminEmail);
  await passwordInput.fill(adminPassword);
  await page.getByRole('button', { name: /sign in|login|continue/i }).first().click();
  const ok = await page.waitForURL(/\/dashboard/, { timeout: 30000 }).then(() => true).catch(() => false);
  if (ok) return true;
  const seeded = await page.evaluate(async ({ api, email, password, loginData }) => {
    if (loginData?.accessToken && loginData?.admin) {
      localStorage.setItem('admin-auth', JSON.stringify({ state: { accessToken: loginData.accessToken, admin: loginData.admin }, version: 0 }));
      return true;
    }
    try {
      const res = await fetch(`${api}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) return false;
      const d = payload.data ?? payload;
      if (!d?.accessToken || !d?.admin) return false;
      localStorage.setItem('admin-auth', JSON.stringify({ state: { accessToken: d.accessToken, admin: d.admin }, version: 0 }));
      return true;
    } catch {
      return false;
    }
  }, { api: apiBase, email: adminEmail, password: adminPassword, loginData });
  if (seeded) {
    await page.goto(`${adminBase}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('admin-auth');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed?.state?.accessToken === 'string' && parsed.state.accessToken.length > 0;
      } catch {
        return false;
      }
    }, { timeout: 10000 });
    return !page.url().includes('/login');
  }
  return false;
}

async function main() {
  console.log('=== Admin Panel Full Audit ===');
  console.log(`Admin: ${adminBase} | API: ${apiBase}`);

  const loginRes = await fetch(`${apiBase}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginJson?.success) {
    console.error('FATAL: Cannot login to admin API');
    process.exit(1);
  }
  const token = loginJson.data?.accessToken;

  console.log('\n--- API Probes ---');
  const apiResults = [];
  for (const p of API_PROBES) {
    const r = await probeApi(token, p);
    apiResults.push(r);
    const icon = r.status === 'WORKING' ? '✅' : r.status === 'PARTIAL' ? '⚠️' : '❌';
    console.log(`${icon} ${r.page.padEnd(22)} ${r.status.padEnd(8)} ${r.httpStatus} ${r.detail ?? ''}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const loggedIn = await adminLoginPage(page, loginJson.data);
  if (!loggedIn) {
    console.error('FATAL: Playwright admin login failed');
    await browser.close();
    process.exit(1);
  }
  console.log('Playwright login OK');

  console.log('\n--- Page Navigation ---');
  const pageResults = [];
  for (const route of STATIC_ROUTES) {
    const r = await auditPage(page, route);
    pageResults.push(r);
    const icon = r.ok ? '✅' : '❌';
    const issues = [...r.notes, ...r.server5xx.slice(0, 2), ...r.consoleErrors.slice(0, 1)].join('; ') || 'ok';
    console.log(`${icon} ${route.padEnd(35)} HTTP ${r.httpStatus ?? '?'} — ${issues.slice(0, 100)}`);
  }

  await browser.close();

  const report = {
    generated_at: new Date().toISOString(),
    admin_base: adminBase,
    api_base: apiBase,
    api_results: apiResults,
    page_results: pageResults,
    summary: {
      api_working: apiResults.filter((r) => r.status === 'WORKING').length,
      api_partial: apiResults.filter((r) => r.status === 'PARTIAL').length,
      api_broken: apiResults.filter((r) => r.status === 'BROKEN').length,
      pages_ok: pageResults.filter((r) => r.ok).length,
      pages_broken: pageResults.filter((r) => !r.ok).length,
    },
  };

  const outPath = path.join(ROOT, 'docs/reports/admin-pages-audit.latest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outPath}`);
  console.log(`API: ${report.summary.api_working} working, ${report.summary.api_partial} partial, ${report.summary.api_broken} broken`);
  console.log(`Pages: ${report.summary.pages_ok} ok, ${report.summary.pages_broken} broken / ${STATIC_ROUTES.length} total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
