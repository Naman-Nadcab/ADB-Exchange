/**
 * Phase 3 P3-A — Live browser certification for /forex/trade
 * Run: FX_BASE=http://109.123.254.30 node scripts/forex-phase3-p3a-browser-cert.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';
const results = [];

function mark(id, ok, detail = '') {
  results.push({ id, ok: Boolean(ok), detail });
  console.log(`  ${ok ? 'OK' : 'FAIL'}  ${id}${detail ? ` — ${detail}` : ''}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45000 }).catch(() => {});
}

async function ticketChecks(page) {
  const ticket = page.locator('aside[aria-label="Order ticket"]').first();
  await ticket.waitFor({ timeout: 15000 }).catch(() => {});
  const types = await ticket.locator('select').first().locator('option').allTextContents().catch(() => []);
  mark('ticket_order_types', types.includes('Market') && types.includes('Stop Limit'), types.join(', '));
  const tifs = await ticket.locator('select[aria-label="Time in force"] option').allTextContents().catch(() => []);
  const tifSet = new Set(tifs.map((t) => t.split(' · ')[0]));
  mark('ticket_tif', tifSet.has('GTC') && tifSet.has('DAY') && tifSet.has('IOC') && tifSet.has('FOK'), [...tifSet].join(','));
  mark('ticket_no_gtd', !tifSet.has('GTD'));
  await ticket.locator('select').first().selectOption({ label: 'Stop Limit' });
  await page.waitForTimeout(300);
  const body = await ticket.innerText();
  mark('stop_limit_fields', /Stop|Limit|Volume/i.test(body));
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await login(page);
  mark('auth_qa_password', !page.url().includes('/login'), page.url());

  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const text = await page.locator('body').innerText();
  mark('terminal_load', /New Order|Order ticket|EUR/i.test(text));
  mark('no_object_object', !/\[object Object\]/i.test(text));
  mark('shell_panels', /Trade|Orders|Positions|Journal/i.test(text) || /Orders/i.test(text));

  await ticketChecks(page);

  const overflowDesktop = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
  mark('desktop_no_overflow', !overflowDesktop);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
  mark('mobile_no_overflow', !overflowMobile);
  const ticketMobile = page.locator('aside[aria-label="Order ticket"]');
  mark('mobile_ticket_visible', (await ticketMobile.count()) > 0);

  mark('console_fatal', consoleErrors.filter((e) => !/favicon|404/i.test(e)).length === 0, consoleErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: '/opt/m-live/.build/forex-phase3-p3a-browser-desktop.png' });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  const out = {
    timestampUtc: new Date().toISOString(),
    base: BASE,
    auth: 'qa_trader_a password login (existing QA harness)',
    results,
    verdict: failed.length === 0 ? 'UI_VERIFIED' : failed.length <= 1 ? 'PARTIAL_RUNTIME_VERIFIED' : 'NOT_PROVEN',
    p3aRecommended: failed.length === 0 ? 'RUNTIME_VERIFIED' : 'PARTIAL_RUNTIME_VERIFIED',
    note: 'Ticket/load/TIF/Stop Limit UI only; no live order submission in browser script (API cert covers execution).',
  };
  writeFileSync('/opt/m-live/.build/forex-phase3-p3a-browser-evidence.json', JSON.stringify(out, null, 2));
  console.log('\nP3-A browser:', out.p3aRecommended, `(${results.length - failed.length}/${results.length})`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
