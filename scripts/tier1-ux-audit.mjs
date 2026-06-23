#!/usr/bin/env node
/**
 * Tier-1 UX forensic audit — Playwright runtime + screenshots.
 * Output: audit/ux-runtime-results.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'audit', 'ux-runtime-results.json');
const SHOT_DIR = path.join(ROOT, 'audit', 'screenshots');

const FE = process.env.FRONTEND_URL || 'http://localhost:3000';
const AD = process.env.ADMIN_BASE_URL || 'http://localhost:3001';
const API = process.env.API_BASE_URL || 'http://localhost:4000';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const CRITICAL_ROUTES = [
  { route: '/', app: 'user', label: 'home' },
  { route: '/login', app: 'user', label: 'login' },
  { route: '/signup', app: 'user', label: 'signup' },
  { route: '/trade/spot', app: 'user', label: 'spot-trade' },
  { route: '/trade/spot?symbol=BTC_USDT', app: 'user', label: 'spot-btc' },
  { route: '/wallet', app: 'user', label: 'wallet-overview' },
  { route: '/wallet/deposit/crypto', app: 'user', label: 'deposit' },
  { route: '/wallet/withdraw', app: 'user', label: 'withdraw-hub' },
  { route: '/wallet/withdraw/crypto', app: 'user', label: 'withdraw-crypto' },
  { route: '/wallet/history', app: 'user', label: 'history' },
  { route: '/markets', app: 'user', label: 'markets' },
  { route: '/p2p-v2', app: 'user', label: 'p2p' },
  { route: '/dashboard', app: 'user', label: 'dashboard', auth: true },
];

const ADMIN_ROUTES = [
  '/dashboard', '/treasury', '/users', '/trades', '/liquidity', '/admin/mm-control',
  '/control-center', '/deposits', '/withdrawals', '/logs', '/settings',
];

async function auditPage(page, base, route, viewport, label) {
  const issues = [];
  const consoleErrors = [];
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); };
  page.on('console', onConsole);

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = base + route;
  let finalUrl = url;
  let bodyLen = 0;
  let hasSpinnerOnly = false;
  let overflow = false;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    finalUrl = page.url();
    const body = await page.locator('body').innerText();
    bodyLen = body.trim().length;
    hasSpinnerOnly = bodyLen < 80 && /loading|spinner/i.test(body);
    overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    if (/Unhandled Runtime Error|Application error/i.test(body)) issues.push('react-crash');
    if (bodyLen < 20 && !finalUrl.includes('login')) issues.push('blank');
    if (hasSpinnerOnly) issues.push('stuck-loading');
    if (overflow) issues.push('horizontal-overflow');
  } catch (e) {
    issues.push('navigation-fail');
  }

  const benign = (t) => /favicon|hydration|ResizeObserver|404|net::ERR_ABORTED/i.test(t);
  const filtered = consoleErrors.filter((t) => !benign(t));
  if (filtered.length) issues.push('console-error');

  const shotName = `${label}-${viewport.name}.png`;
  try {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, shotName), fullPage: false });
  } catch { /* ignore */ }

  page.removeListener('console', onConsole);
  return {
    route, viewport: viewport.name, finalUrl: finalUrl.replace(base, ''),
    issues, bodyLen, overflow, consoleErrors: filtered.slice(0, 2), screenshot: `audit/screenshots/${shotName}`,
  };
}

async function adminLogin(page) {
  await page.goto(`${AD}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[name="email"]', process.env.ADMIN_EMAIL || 'admin@example.com');
  await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = { timestamp: new Date().toISOString(), user: [], admin: [], errorStates: [], spot: [] };

  // User routes — desktop + mobile for critical
  for (const r of CRITICAL_ROUTES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (r.auth) {
      await page.addInitScript(() => {
        localStorage.setItem('accessToken', 'ux-audit-token');
        localStorage.setItem('refreshToken', 'ux-audit-refresh');
      });
      await page.route('**/api/v1/auth/**', async (route) => {
        const u = route.request().url();
        if (u.includes('/auth/me')) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'a', email: 'u@test.com', kyc_status: 'approved' } }) });
        }
        return route.continue();
      });
    }
    for (const vp of [VIEWPORTS[0], VIEWPORTS[3]]) {
      results.user.push(await auditPage(page, FE, r.route, vp, r.label));
    }
    await ctx.close();
  }

  // Spot WS + orderbook check
  const spotCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const spotPage = await spotCtx.newPage();
  const wsEvents = [];
  spotPage.on('websocket', (ws) => {
    if (ws.url().includes('/spot/ws')) {
      ws.on('framereceived', (f) => { try { wsEvents.push(JSON.parse(f.payload)); } catch { /* */ } });
    }
  });
  await spotPage.goto(`${FE}/trade/spot?symbol=BTC_USDT`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await spotPage.waitForTimeout(5000);
  const spotBody = await spotPage.locator('body').innerText();
  const hasOrderbook = /order book|asks|bids/i.test(spotBody);
  const hasChart = await spotPage.locator('canvas, [data-chart]').count() > 0;
  const railsHidden = await spotPage.evaluate(() => {
    const rail = document.querySelector('[data-spot-rail]');
    if (!rail) return null;
    const s = getComputedStyle(rail);
    return { width: s.width, pointerEvents: s.pointerEvents };
  });
  results.spot.push({
    route: '/trade/spot?symbol=BTC_USDT',
    hasOrderbookText: hasOrderbook,
    hasChartElement: hasChart,
    wsMessageCount: wsEvents.length,
    railsAtDesktop: railsHidden,
    streamBanner: /connecting|reconnecting|disconnected/i.test(spotBody),
  });
  await spotPage.screenshot({ path: path.join(SHOT_DIR, 'spot-desktop.png') });
  await spotCtx.close();

  // Error state — mock API failure on wallet
  const errCtx = await browser.newContext();
  const errPage = await errCtx.newPage();
  await errPage.route('**/api/v1/wallet/tokens**', (route) => route.fulfill({ status: 500, body: '{"success":false}' }));
  await errPage.goto(`${FE}/wallet/deposit/crypto`, { waitUntil: 'domcontentloaded' });
  await errPage.waitForTimeout(2000);
  const errBody = await errPage.locator('body').innerText();
  results.errorStates.push({
    route: '/wallet/deposit/crypto',
    apiMock: '500 wallet/tokens',
    whiteScreen: errBody.trim().length < 30,
    hasErrorUI: /error|retry|failed|unable/i.test(errBody),
    reactCrash: /Unhandled Runtime Error/i.test(errBody),
  });
  await errCtx.close();

  // Admin login + pages
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  try {
    await adminLogin(adminPage);
    for (const route of ADMIN_ROUTES) {
      const r = await auditPage(adminPage, AD, route, VIEWPORTS[0], `admin-${route.replace(/\//g, '-')}`);
      results.admin.push(r);
    }
  } catch (e) {
    results.admin.push({ error: String(e.message) });
  }
  await adminCtx.close();

  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log('Wrote', OUT);
  const broken = [...results.user, ...results.admin].filter((r) => r.issues?.length);
  console.log('Issues:', broken.length);
  broken.slice(0, 15).forEach((r) => console.log(' ', r.route || r.label, r.viewport, r.issues));
}

main().catch((e) => { console.error(e); process.exit(1); });
