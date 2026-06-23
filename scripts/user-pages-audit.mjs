#!/usr/bin/env node
/**
 * Deep user-side page audit: HTTP status + Playwright runtime/console errors.
 * Outputs JSON summary to stdout and writes report to /tmp/user-pages-audit.json
 */
import { chromium } from 'playwright';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'apps/frontend/src/app');

const SAMPLES = {
  id: 'a0000000-0000-4000-8000-00000000aa01',
  orderId: 'a0000000-0000-4000-8000-00000000aa02',
  userId: 'a0000000-0000-4000-8000-00000000aa01',
  symbol: 'BTC',
  crypto: 'BTC',
  fiat: 'INR',
  type: 'buy',
};

function walkPages(dir, acc = []) {
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) walkPages(p, acc);
    else if (ent === 'page.tsx') acc.push(p);
  }
  return acc;
}

function pagePathToRoute(file) {
  let rel = relative(APP, file).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
  // route groups (auth) don't affect URL
  rel = rel.replace(/^\([^)]+\)\//, '');
  if (rel === 'page.tsx' || rel === '') return '/';
  const parts = rel.split('/').map((seg) => {
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const key = seg.slice(1, -1);
      return SAMPLES[key] ?? '00000000-0000-4000-8000-000000000099';
    }
    return seg;
  });
  return '/' + parts.join('/');
}

function categorize(route) {
  if (route.startsWith('/admin')) return 'admin-skip';
  if (route.startsWith('/dashboard') || route.startsWith('/wallet') && route !== '/wallet') return 'auth';
  if (['/login', '/signup', '/forgot-password', '/privacy', '/terms', '/cookies'].some((p) => route === p || route.startsWith(p + '/'))) return 'public-auth';
  if (route.startsWith('/auth/callback')) return 'callback';
  return 'public';
}

const pageFiles = walkPages(APP);
const routes = [...new Set(pageFiles.map(pagePathToRoute))].sort();

async function httpCheck(route) {
  const url = BASE + route;
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const loc = res.headers.get('location') || '';
    return { status: res.status, redirect: loc };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

async function browserCheck(browser, route, mode) {
  const url = BASE + route;
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message).slice(0, 300)));

  let finalUrl = url;
  let bodyText = '';
  let hasRuntimeError = false;
  let hasNextError = false;
  let blank = false;

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200);
    finalUrl = page.url();
    bodyText = await page.locator('body').innerText().catch(() => '');
    hasRuntimeError = /Unhandled Runtime Error|Application error|Something went wrong/i.test(bodyText);
    hasNextError = await page.locator('text=Application error').count().then((c) => c > 0).catch(() => false);
    blank = bodyText.trim().length < 20;
  } catch (e) {
    pageErrors.push(`goto: ${e.message}`);
  }

  // Filter noisy but benign console errors
  const filteredConsole = consoleErrors.filter((t) =>
    !/favicon|hydration|DevTools|Failed to load resource.*404|net::ERR|ResizeObserver/i.test(t)
  );

  await page.close();

  const issues = [];
  if (pageErrors.length) issues.push('pageerror');
  if (filteredConsole.length) issues.push('console');
  if (hasRuntimeError || hasNextError) issues.push('runtime_ui');
  if (blank && !finalUrl.includes('/login')) issues.push('blank');

  return {
    finalUrl,
    consoleErrors: filteredConsole.slice(0, 3),
    pageErrors: pageErrors.slice(0, 3),
    issues,
    ok: issues.length === 0,
  };
}

async function authedBrowserCheck(browser, routes) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'audit-fake-token');
    localStorage.setItem('refreshToken', 'audit-fake-refresh');
  });
  await page.route('**/api/v1/auth/**', async (route) => {
    const u = route.request().url();
    if (u.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'a0000000-0000-4000-8000-00000000aa01', email: 'audit@test.com', username: 'audituser', email_verified: true, phone_verified: false, kyc_status: 'approved', allowWithdraw: true } }) });
    }
    if (u.includes('/auth/preferences')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { display_currency: 'INR', theme: 'dark' } }) });
    }
    if (u.includes('/auth/refresh')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accessToken: 'audit-fake-token', refreshToken: 'audit-fake-refresh' } }) });
    }
    return route.continue();
  });

  const results = [];
  for (const route of routes) {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); });
    page.on('pageerror', (err) => pageErrors.push(String(err.message).slice(0, 300)));
    let issues = [];
    let finalUrl = BASE + route;
    let bodyText = '';
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      finalUrl = page.url();
      bodyText = await page.locator('body').innerText().catch(() => '');
      const filteredConsole = consoleErrors.filter((t) => !/favicon|hydration|DevTools|ResizeObserver/i.test(t));
      if (pageErrors.length) issues.push('pageerror');
      if (filteredConsole.length) issues.push('console');
      if (/Unhandled Runtime Error|Application error/i.test(bodyText)) issues.push('runtime_ui');
      if (bodyText.trim().length < 20 && !finalUrl.includes('/login')) issues.push('blank');
      if (finalUrl.includes('/login') && route.startsWith('/dashboard')) issues.push('auth_redirect');
      results.push({ route, finalUrl, issues, consoleErrors: filteredConsole.slice(0, 2), pageErrors: pageErrors.slice(0, 2), ok: issues.length === 0 });
    } catch (e) {
      results.push({ route, issues: ['timeout'], error: e.message, ok: false });
    }
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  }
  await ctx.close();
  return results;
}

console.log(`Auditing ${routes.length} routes against ${BASE}...\n`);

const httpResults = [];
for (const route of routes) {
  const cat = categorize(route);
  if (cat === 'admin-skip') continue;
  const http = await httpCheck(route);
  httpResults.push({ route, cat, ...http });
}

const publicRoutes = httpResults.filter((r) => r.cat === 'public' || r.cat === 'public-auth' || r.cat === 'callback').map((r) => r.route);
const authRoutes = httpResults.filter((r) => r.cat === 'auth').map((r) => r.route);

const browser = await chromium.launch({ headless: true });

const publicBrowser = [];
for (const route of publicRoutes.slice(0, 60)) {
  publicBrowser.push({ route, ...(await browserCheck(browser, route, 'public')) });
}

const authBrowser = await authedBrowserCheck(browser, authRoutes.slice(0, 55));
await browser.close();

const report = {
  scannedAt: new Date().toISOString(),
  base: BASE,
  totalRoutes: routes.length,
  http: httpResults,
  publicBrowser,
  authBrowser,
};

writeFileSync('/tmp/user-pages-audit.json', JSON.stringify(report, null, 2));

// Summarize
const httpBad = httpResults.filter((r) => r.status === 0 || r.status >= 500);
const httpRedirect = httpResults.filter((r) => r.status >= 300 && r.status < 400);
const pubBroken = publicBrowser.filter((r) => !r.ok);
const authBroken = authBrowser.filter((r) => !r.ok);

console.log('=== HTTP SUMMARY ===');
console.log(`Total checked: ${httpResults.length}`);
console.log(`5xx/timeout: ${httpBad.length}`);
console.log(`3xx redirects: ${httpRedirect.length}`);
if (httpBad.length) httpBad.forEach((r) => console.log(`  FAIL HTTP ${r.status} ${r.route}`));

console.log('\n=== PUBLIC BROWSER (${publicBrowser.length} sampled) ===');
console.log(`Broken: ${pubBroken.length}`);
pubBroken.forEach((r) => console.log(`  ✗ ${r.route} [${r.issues?.join(',')}] ${r.pageErrors?.[0] || r.consoleErrors?.[0] || ''}`));

console.log(`\n=== AUTH BROWSER (${authBrowser.length} dashboard/wallet routes, mocked auth) ===`);
console.log(`Broken: ${authBroken.length}`);
authBroken.forEach((r) => console.log(`  ✗ ${r.route} [${r.issues?.join(',')}] ${r.pageErrors?.[0] || r.consoleErrors?.[0] || ''}`));

const authRedirects = authBrowser.filter((r) => r.issues?.includes('auth_redirect'));
console.log(`Auth redirects to login (mock failed): ${authRedirects.length}`);

console.log('\nReport: /tmp/user-pages-audit.json');
