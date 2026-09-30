#!/usr/bin/env node
/**
 * Pre-market browser audit — auth, terminal UI, responsive, no live trading required.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, '.build');
mkdirSync(BUILD, { recursive: true });

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';

const out = { kind: 'forex-pre-market-browser', base: BASE, viewports: {}, tests: {}, pass: true };
const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 950 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

function mark(name, ok, detail = '') {
  out.tests[name] = { ok: Boolean(ok), detail };
  if (!ok) out.pass = false;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2000);
  const emailBox = page.locator('input[type="email"], input[name="email"]').first();
  await emailBox.waitFor({ timeout: 20_000 });
  await emailBox.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForTimeout(5000);
  return !/\/login(\?|$)/.test(page.url());
}

async function auditViewport(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const prefix = vp.name;

  const loggedIn = await login(page);
  mark(`${prefix}_login`, loggedIn, page.url());
  if (!loggedIn) {
    await ctx.close();
    return;
  }

  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(8000);

  const text = await page.locator('body').innerText().catch(() => '');
  mark(`${prefix}_terminal_route`, /Market Watch|market watch/i.test(text) || /EUR/i.test(text), 'forex/trade loaded');
  mark(`${prefix}_no_object_object`, !/\[object Object\]/i.test(text));
  mark(`${prefix}_no_raw_json_blob`, !/\{"success":/i.test(text));

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  mark(`${prefix}_no_horizontal_overflow`, !overflow);

  const ticketCount =
    (await page.getByRole('button', { name: /market/i }).count()) +
    (await page.getByText(/Order Ticket/i).count()) +
    (await page.locator('[aria-label="Order ticket"]').count());
  mark(`${prefix}_ticket_present`, ticketCount > 0 || /GTC|IOC|FOK|DAY/i.test(text));

  const sessionHint = /closed|weekend|session/i.test(text);
  mark(`${prefix}_session_state_visible`, sessionHint || /SIMULATED|MOCK/i.test(text), sessionHint ? 'session closed copy present' : 'simulated label');

  const wsProbe = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/v1/forex/account', { credentials: 'include' });
      return res.status === 200;
    } catch {
      return false;
    }
  });
  mark(`${prefix}_cookie_api_session`, wsProbe);

  if (vp.name === 'desktop') {
    const wsOk = await page.evaluate(async () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${location.host}/api/v1/forex/ws`;
      return await new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          resolve(v);
        };
        const t = setTimeout(() => finish(false), 8000);
        try {
          const ws = new WebSocket(url);
          ws.onmessage = (ev) => {
            const s = String(ev.data);
            if (s.includes('subscribed') && s.includes('fx.risk')) {
              clearTimeout(t);
              ws.close();
              finish(true);
            }
          };
          ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', channel: 'fx.risk' }));
          ws.onerror = () => finish(false);
        } catch {
          finish(false);
        }
      });
    });
    mark('desktop_ws_cookie_subscribe', wsOk, wsOk ? 'mlive_at cookie WS' : 'WS subscribe failed');
  }

  out.viewports[vp.name] = { width: vp.width, height: vp.height, overflow, url: page.url() };
  await page.screenshot({ path: path.join(BUILD, `forex-pre-market-${vp.name}.png`), fullPage: false });
  await ctx.close();
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const vp of VIEWPORTS) {
    await auditViewport(browser, vp);
  }
} finally {
  await browser.close();
}

out.completedAtUtc = new Date().toISOString();
writeFileSync(path.join(BUILD, 'forex-pre-market-browser.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ pass: out.pass }, null, 2));
process.exit(out.pass ? 0 : 1);
