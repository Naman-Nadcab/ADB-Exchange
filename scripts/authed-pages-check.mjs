#!/usr/bin/env node
/** Quick authed page runtime check with real JWT in localStorage */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const TOKEN = process.env.AUTH_TOKEN;
const REFRESH = process.env.REFRESH_TOKEN;
if (!TOKEN) { console.error('AUTH_TOKEN required'); process.exit(1); }

const ROUTES = [
  '/dashboard', '/dashboard/account', '/dashboard/security', '/wallet',
  '/wallet/deposit/crypto', '/wallet/withdraw/crypto', '/wallet/withdraw/fiat',
  '/wallet/funding', '/wallet/history', '/wallet/transfer', '/wallet/convert',
  '/p2p', '/p2p/payment-methods', '/p2p/my-ads', '/p2p/orders',
  '/orders', '/orders/spot', '/markets', '/trade/spot',
  '/dashboard/referral', '/dashboard/identity', '/dashboard/api', '/dashboard/help',
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.addInitScript(({ t, r }) => {
  localStorage.setItem('accessToken', t);
  if (r) localStorage.setItem('refreshToken', r);
}, { t: TOKEN, r: REFRESH || '' });

const results = [];
for (const route of ROUTES) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let body = '';
  let url = BASE + route;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    url = page.url();
    body = await page.locator('body').innerText();
  } catch (e) {
    errors.push(String(e.message));
  }
  page.removeAllListeners('pageerror');
  const issues = [];
  if (url.includes('/login')) issues.push('auth_lost');
  if (/Unhandled Runtime Error|Application error/i.test(body)) issues.push('runtime');
  if (errors.length) issues.push('crash');
  if (body.trim().length < 20 && !url.includes('/login')) issues.push('blank');
  results.push({ route, finalUrl: url.replace(BASE, ''), issues, ok: issues.length === 0 });
  process.stdout.write(issues.length ? 'X' : '.');
}
await browser.close();

console.log('\n');
const bad = results.filter((r) => !r.ok);
console.log(`Checked ${results.length}, issues: ${bad.length}`);
bad.forEach((r) => console.log(`  ✗ ${r.route} -> ${r.finalUrl} [${r.issues.join(',')}]`));
if (bad.length === 0) console.log('All authed pages OK');
