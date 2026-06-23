#!/usr/bin/env node
/** Runtime audit: Playwright console/page errors on critical user routes */
import { chromium } from 'playwright';

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

const PUBLIC_ROUTES = [
  '/', '/login', '/signup', '/markets', '/earn', '/p2p', '/trade/spot', '/orders', '/wallet',
  '/wallet/funding', '/wallet/deposit/crypto', '/wallet/withdraw/crypto', '/wallet/withdraw/fiat',
  '/wallet/history', '/wallet/convert', '/wallet/transfer', '/p2p/payment-methods', '/p2p/create-ad',
  '/p2p/my-ads', '/p2p/orders', '/forgot-password', '/privacy', '/terms',
];

const AUTH_ROUTES = [
  '/dashboard', '/dashboard/account', '/dashboard/security', '/dashboard/api',
  '/dashboard/withdraw/fiat', '/dashboard/deposit/crypto', '/dashboard/withdraw/crypto',
  '/dashboard/assets/funding', '/dashboard/assets/overview', '/dashboard/orders',
  '/dashboard/orders/spot', '/dashboard/orders/p2p', '/dashboard/p2p',
  '/dashboard/p2p/payment-methods', '/dashboard/referral', '/dashboard/preferences',
  '/dashboard/identity', '/dashboard/help', '/dashboard/convert', '/dashboard/transfer',
  '/dashboard/events', '/dashboard/fee-rates', '/dashboard/security/2fa',
];

async function auditRoute(page, route) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); };
  const onPageError = (err) => pageErrors.push(String(err.message));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  let body = '';
  let finalUrl = BASE + route;
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    finalUrl = page.url();
    body = await page.locator('body').innerText();
  } catch (e) {
    pageErrors.push('goto: ' + e.message);
  }
  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  const benign = (t) => /favicon|hydration|ResizeObserver|Failed to load resource.*404|net::ERR_ABORTED/i.test(t);
  const filtered = consoleErrors.filter((t) => !benign(t));
  const issues = [];
  if (pageErrors.length) issues.push('crash');
  if (filtered.length) issues.push('console');
  if (/Unhandled Runtime Error|Application error: a client-side exception/i.test(body)) issues.push('runtime');
  if (body.trim().length < 15 && !finalUrl.includes('login')) issues.push('blank');

  return { route, finalUrl, issues, pageErrors: pageErrors.slice(0, 2), consoleErrors: filtered.slice(0, 2), ok: issues.length === 0 };
}

const browser = await chromium.launch({ headless: true });

console.log('=== PUBLIC RUNTIME ===');
const pubCtx = await browser.newContext();
const pubPage = await pubCtx.newPage();
const pubResults = [];
for (const r of PUBLIC_ROUTES) {
  pubResults.push(await auditRoute(pubPage, r));
  process.stdout.write(pubResults.at(-1).ok ? '.' : 'X');
}
await pubCtx.close();
console.log('');

console.log('=== AUTH RUNTIME (mocked) ===');
const authCtx = await browser.newContext();
const authPage = await authCtx.newPage();
await authPage.addInitScript(() => {
  localStorage.setItem('accessToken', 'audit-token');
  localStorage.setItem('refreshToken', 'audit-refresh');
});
await authPage.route('**/api/v1/auth/**', async (route) => {
  const u = route.request().url();
  if (u.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'a0000000-0000-4000-8000-00000000aa01', email: 'a@test.com', username: 'audit', email_verified: true, kyc_status: 'approved', allowWithdraw: true } }) });
  if (u.includes('/auth/preferences')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { display_currency: 'INR' } }) });
  if (u.includes('/auth/refresh')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { accessToken: 'audit-token', refreshToken: 'audit-refresh' } }) });
  return route.continue();
});
const authResults = [];
for (const r of AUTH_ROUTES) {
  authResults.push(await auditRoute(authPage, r));
  const last = authResults.at(-1);
  process.stdout.write(last.ok ? '.' : (last.finalUrl.includes('/login') ? 'L' : 'X'));
}
await authCtx.close();
await browser.close();

const pubBroken = pubResults.filter((r) => !r.ok);
const authBroken = authResults.filter((r) => !r.ok);
const authLogin = authResults.filter((r) => r.finalUrl.includes('/login'));

console.log(`\nPublic: ${pubResults.length} checked, ${pubBroken.length} issues`);
pubBroken.forEach((r) => console.log('  ✗', r.route, r.issues, r.pageErrors[0] || r.consoleErrors[0] || ''));

console.log(`Auth: ${authResults.length} checked, ${authBroken.length} issues, ${authLogin.length} redirected login`);
authBroken.forEach((r) => console.log('  ✗', r.route, '->', r.finalUrl.replace(BASE,''), r.issues, r.pageErrors[0] || r.consoleErrors[0] || ''));
