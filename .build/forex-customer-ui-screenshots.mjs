#!/usr/bin/env node
/** Read-only Forex customer UI screenshots — writes under .build/ only */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.FOREX_UI_BASE || 'http://127.0.0.1';
const routes = [
  '/forex/trade',
  '/forex/markets',
  '/forex/portfolio',
  '/forex/orders',
  '/forex/analysis',
  '/forex/alerts',
  '/forex/account',
];
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

const out = join(process.cwd(), '.build/forex-ui-screenshots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const log = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120)); });
  for (const route of routes) {
    const slug = route.replace(/\//g, '_');
    try {
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(out, `${vp.name}${slug}.png`), fullPage: false });
      log.push({ vp: vp.name, route, status: resp?.status(), url: page.url(), consoleErrors: consoleErrors.slice(0, 3) });
    } catch (e) {
      log.push({ vp: vp.name, route, error: String(e?.message || e).slice(0, 200) });
    }
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ outDir: out, log }, null, 2));
