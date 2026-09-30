#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.FOREX_UI_BASE || 'http://127.0.0.1:3011';
const routes = [
  '/forex',
  '/forex/trade',
  '/forex/markets',
  '/forex/portfolio',
  '/forex/orders',
  '/forex/analysis',
  '/forex/alerts',
  '/forex/account',
  '/forex/account/funds',
  '/forex/account/ledger',
  '/forex/account/accounts',
];
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];
const out = join(process.cwd(), '.build/forex-ui-screenshots-post-cert');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const log = [];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const route of routes) {
    const slug = route.replace(/\//g, '_');
    try {
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(out, `${vp.name}${slug}.png`), fullPage: false });
      const body = await page.locator('body').innerText();
      const jwtHits = (body.match(/JWT|Bearer JWT|user JWT/gi) || []).length;
      const newOrderCount = (body.match(/NEW ORDER/gi) || []).length;
      const hasMobileMenu = /\bMenu\b/.test(body);
      const hasDesktopMenus = /File/.test(body) && /View/.test(body) && /Charts/.test(body);
      log.push({
        vp: vp.name,
        route,
        status: resp?.status(),
        jwtHits,
        newOrderCount,
        hasMobileMenu,
        hasDesktopMenus,
      });
    } catch (e) {
      log.push({ vp: vp.name, route, error: String(e?.message || e).slice(0, 160) });
    }
  }
  await page.close();
}
await browser.close();
writeFileSync(join(out, 'capture-log.json'), JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), log }, null, 2));
console.log(JSON.stringify({ outDir: out, count: log.length }, null, 2));
