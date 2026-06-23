#!/usr/bin/env node
/** Focused post-remediation UX validation (fast). */
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

const ROUTES = [
  { route: '/trade/spot?symbol=BTC_USDT', label: 'spot' },
  { route: '/wallet/deposit/crypto', label: 'deposit' },
  { route: '/wallet/withdraw/crypto', label: 'withdraw' },
  { route: '/wallet', label: 'wallet' },
];

async function checkRoute(page, route, vp) {
  const issues = [];
  await page.setViewportSize(vp);
  await page.goto(FE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(route.includes('trade/spot') ? 8000 : 3000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  const bodyLen = (await page.locator('body').innerText()).trim().length;
  if (bodyLen < 20) issues.push('blank');
  if (overflow) issues.push('horizontal-overflow');
  const shot = `${route.split('?')[0].replace(/\//g, '-').slice(1)}-${vp.width <= 500 ? 'mobile' : vp.width <= 900 ? 'tablet' : 'desktop'}.png`;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, shot), fullPage: false });
  return { route, viewport: vp.width <= 500 ? 'mobile' : vp.width <= 900 ? 'tablet' : 'desktop', issues, bodyLen, screenshot: `audit/screenshots/${shot}` };
}

async function checkSpotMobile(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FE}/trade/spot?symbol=BTC_USDT`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const tabs = await page.locator('.spot-terminal-mobile-tabs button').count();
  const tabLabels = await page.locator('.spot-terminal-mobile-tabs button').allTextContents();
  const bookVisible = await page.evaluate(() => {
    const grid = document.querySelector('.spot-terminal-grid');
    grid?.setAttribute('data-mobile-tab', 'book');
    const ob = document.querySelector('.spot-terminal-orderbook');
    if (!ob) return false;
    const s = getComputedStyle(ob);
    return s.display !== 'none' && s.pointerEvents !== 'none';
  });
  const tifVisible = await page.locator('text=TIF').count();
  const advancedVisible = await page.locator('button:has-text("Stop Limit")').count();
  await page.screenshot({ path: path.join(SHOT_DIR, 'spot-mobile-tabs.png'), fullPage: false });
  return { mobileTabs: tabs, tabLabels, bookTabAccessible: bookVisible, tifControls: tifVisible > 0, advancedOrderButtons: advancedVisible > 0 };
}

async function checkAdminLogs(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${AD}/logs`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  const body = await page.locator('body').innerText();
  const ok = !/404|not found/i.test(body) && body.trim().length > 80;
  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-logs.png'), fullPage: false });
  return { route: '/logs', loads: ok, hasTitle: /System Logs/i.test(body) };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = { timestamp: new Date().toISOString(), routes: [], spot: null, adminLogs: null };

  for (const r of ROUTES) {
    for (const vp of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      results.routes.push(await checkRoute(page, r.route, vp));
    }
  }
  results.spot = await checkSpotMobile(page);
  results.adminLogs = await checkAdminLogs(page);
  await browser.close();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log('Wrote', OUT);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
