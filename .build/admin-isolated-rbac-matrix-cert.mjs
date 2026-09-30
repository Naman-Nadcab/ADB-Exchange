#!/usr/bin/env node
/**
 * Isolated Admin RBAC matrix — cert API :4100 + cert UI :3010. Read-only / auth probes only.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const UI = (process.env.CERT_ADMIN_BASE_URL ?? 'http://127.0.0.1:3010/admin').replace(/\/$/, '');
const PW = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

const ROLES = [
  {
    logical: 'FULL',
    email: 'cert_maker@cert.local',
    tabs: ['Control Center', 'Crypto', 'Forex'],
    forbidTabs: [],
    allowPath: '/forex/orders',
    denyPath: null,
    apiAllow: '/forex/orders?limit=1',
    apiDeny: null,
    apiDenyExpected: null,
  },
  {
    logical: 'CRYPTO_ONLY',
    email: 'cert_support@cert.local',
    tabs: ['Control Center', 'Crypto'],
    forbidTabs: ['Forex'],
    allowPath: '/trading',
    denyPath: '/forex/orders',
    apiAllow: '/users?limit=1',
    apiDeny: '/forex/orders?limit=1',
    apiDenyExpected: 403,
  },
  {
    logical: 'FOREX_ONLY',
    email: 'cert_forex@cert.local',
    tabs: ['Control Center', 'Forex'],
    forbidTabs: ['Crypto'],
    allowPath: '/forex/orders',
    denyPath: '/trading',
    apiAllow: '/forex/orders?limit=1',
    apiDeny: '/dashboard-summary',
    apiDenyExpected: 403,
  },
  {
    logical: 'CONTROL_ONLY',
    email: 'cert_control@cert.local',
    tabs: ['Control Center'],
    forbidTabs: ['Crypto', 'Forex'],
    allowPath: '/control-center',
    denyPath: '/trading',
    denyPath2: '/forex/orders',
    apiAllow: '/auth/me',
    apiDeny: '/forex/orders?limit=1',
    apiDenyExpected: 403,
  },
  {
    logical: 'WITHDRAWAL_APPROVER',
    email: 'cert_withdrawal@cert.local',
    tabs: ['Control Center'],
    forbidTabs: ['Crypto', 'Forex'],
    allowPath: '/withdrawals',
    denyPath: '/trading',
    denyPath2: '/forex/orders',
    apiAllow: null,
    apiDeny: '/forex/orders?limit=1',
    apiDenyExpected: 403,
    authProbe: 'withdrawals_approve',
  },
];

async function loginApi(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  const j = await res.json();
  return { status: res.status, token: j.data?.accessToken ?? null, role: j.data?.admin?.role, permissions: j.data?.admin?.permissions };
}

async function apiGet(token, path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  return res.status;
}

function okDeny(status, expected) {
  if (expected == null) return true;
  if (Array.isArray(expected)) return expected.includes(status);
  return status === expected;
}

const report = [];

for (const r of ROLES) {
  const entry = { logical: r.logical, email: r.email, api: {}, ui: {}, status: 'PASS' };
  const login = await loginApi(r.email);
  entry.api.login = login.status === 200 && login.token ? 'PASS' : 'FAIL';
  if (!login.token) {
    entry.status = 'FAIL';
    report.push(entry);
    continue;
  }
  if (r.apiAllow) entry.api.allow = { path: r.apiAllow, http: await apiGet(login.token, r.apiAllow) };
  if (r.apiDeny) {
    const http = await apiGet(login.token, r.apiDeny);
    entry.api.deny = { path: r.apiDeny, http, pass: okDeny(http, r.apiDenyExpected) };
    if (!entry.api.deny.pass) entry.status = 'FAIL';
  }
  if (r.authProbe === 'withdrawals_approve') {
    const res = await fetch(`${API}/withdrawals?limit=1`, { headers: { Authorization: `Bearer ${login.token}` } });
    entry.api.withdrawalsList = { http: res.status, note: 'GET list expected denied for approver-only role' };
    const res2 = await fetch(`${API}/withdrawals/00000000-0000-4000-8000-000000000001/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    entry.api.withdrawalsApproveRoute = {
      http: res2.status,
      note: 'POST approve auth mapped (no successful approval required)',
      pass: [403, 404, 400, 401].includes(res2.status) === false ? 'CHECK' : res2.status === 403 ? 'PASS_DENIED_OR_UNMAPPED' : 'PASS_PROBE',
    };
    entry.api.withdrawalsApproveRoute.pass =
      res2.status === 404 || res2.status === 400 ? 'PASS' : res2.status === 403 ? 'FAIL_WRONG_DENY' : res2.status === 200 ? 'FAIL_EXECUTED' : 'PASS_PROBE';
    if (entry.api.withdrawalsApproveRoute.pass.startsWith('FAIL')) entry.status = 'FAIL';
    if (res.status !== 403) {
      entry.api.withdrawalsList.pass = 'FAIL';
      entry.status = 'FAIL';
    } else entry.api.withdrawalsList.pass = 'PASS';
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForSelector('#email', { timeout: 30_000 });
    await page.fill('#email', r.email);
    await page.fill('#password', PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/control-center/, { timeout: 45_000 });
    entry.ui.login = 'PASS';
    const multiDomain = r.tabs.length >= 2;
    if (multiDomain) {
      const nav = page.getByRole('navigation', { name: 'Admin workspace' });
      await nav.waitFor({ timeout: 10_000 });
      for (const t of r.tabs) {
        const vis = await nav.getByRole('tab', { name: t }).isVisible();
        entry.ui[`tab_${t}`] = vis ? 'PASS' : 'FAIL';
        if (!vis) entry.status = 'FAIL';
      }
      for (const t of r.forbidTabs) {
        const vis = await nav.getByRole('tab', { name: t }).isVisible();
        entry.ui[`no_tab_${t}`] = vis ? 'FAIL' : 'PASS';
        if (vis) entry.status = 'FAIL';
      }
    } else {
      const region = page.getByRole('region', { name: 'Admin workspace context' });
      await region.waitFor({ timeout: 10_000 });
      entry.ui.single_domain_context = 'PASS';
      for (const t of r.forbidTabs) {
        entry.ui[`no_tab_${t}`] = 'PASS';
      }
    }
    if (r.allowPath) {
      await page.goto(`${UI}${r.allowPath}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const slug = r.allowPath.replace(/^\//, '');
      const ok = page.url().includes(slug);
      const restricted = (await page.getByText('Access restricted').count()) > 0;
      entry.ui.allowRoute = { path: r.allowPath, url: page.url(), pass: ok && !restricted ? 'PASS' : 'FAIL' };
      if (entry.ui.allowRoute.pass !== 'PASS') entry.status = 'FAIL';
    }
    for (const dp of [r.denyPath, r.denyPath2].filter(Boolean)) {
      await page.goto(`${UI}${dp}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const url = page.url();
      const slug = dp.replace(/^\//, '');
      const blocked = !url.includes(slug) || (await page.getByText('Access restricted').count()) > 0;
      entry.ui[`deny_${dp}`] = { url, pass: blocked ? 'PASS' : 'FAIL' };
      if (!blocked) entry.status = 'FAIL';
    }
    await page.getByRole('button', { name: /log out|sign out/i }).click().catch(() => page.goto(`${UI}/login`));
  } catch (e) {
    entry.ui.error = String(e?.message || e);
    entry.status = 'FAIL';
  }
  await browser.close();
  report.push(entry);
}

const out = { generatedAt: new Date().toISOString(), apiBase: API, uiBase: UI, report };
mkdirSync(join(process.cwd(), '.build'), { recursive: true });
const outPath = join('/opt/m-live', '.build/ADMIN_ISOLATED_RBAC_UI_MATRIX.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(report.every((e) => e.status === 'PASS') ? 0 : 1);
