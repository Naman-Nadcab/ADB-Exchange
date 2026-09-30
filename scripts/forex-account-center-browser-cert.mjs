/**
 * Account Center route smoke (Playwright).
 * FX_BASE=http://109.123.254.30 node scripts/forex-account-center-browser-cert.mjs
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';
const out = { baseUrl: BASE, results: {} };

function pass(k, ok, detail = '') {
  out.results[k] = { ok: Boolean(ok), detail };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k}${detail ? ` — ${detail}` : ''}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  return !/\/login(\?|$)/.test(page.url());
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  pass('login', await login(page));
  await page.goto(`${BASE}/forex/account/accounts`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(6000);
  const body = await page.locator('body').innerText();
  pass('accountsPageLoads', /Forex accounts/i.test(body) || /Create demo account/i.test(body), page.url());
  pass('accountsTableOrEmpty', /Account ID|No Forex accounts|Create demo/i.test(body), '');
  const createBtn = page.getByRole('button', { name: /Create demo account/i });
  pass('createDemoVisible', (await createBtn.count()) > 0, '');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  pass('mobile390NoOverflow', !overflow, '');
  await browser.close();
  writeFileSync('/opt/m-live/.build/forex-account-center-browser-cert.json', JSON.stringify({ ...out, generatedAt: new Date().toISOString() }, null, 2));
  const ok = Object.values(out.results).every((r) => r.ok);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
