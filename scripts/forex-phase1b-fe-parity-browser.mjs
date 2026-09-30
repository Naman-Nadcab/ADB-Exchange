/**
 * Phase 1B FE parity browser cert — Close By + Reverse UI only.
 */
import { chromium } from 'playwright';
import http from 'node:http';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const API_HOST = process.env.FX_API_HOST ?? '127.0.0.1';
const API_PORT = Number(process.env.FX_API_PORT ?? 4000);
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';
const RESULTS = [];
const SCREENSHOT = '/tmp/fx-p1b-fe-parity-browser.png';
let BEARER = null;
let USER = null;

function mark(name, ok, detail = '') {
  RESULTS.push({ name, ok: Boolean(ok), detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpJson(method, path, body, bearer) {
  const payload = body != null ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: API_HOST,
        port: API_PORT,
        path,
        method,
        headers: {
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = {};
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch {
            json = { raw: raw.slice(0, 200) };
          }
          if ((res.statusCode || 500) >= 400) {
            console.log(`  apiNode ${method} ${path} -> ${res.statusCode} ${raw.slice(0, 160)}`);
          }
          resolve({ status: res.statusCode || 0, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function apiNode(method, path, body) {
  let r = await httpJson(method, path, body, BEARER);
  if (r.status === 401) {
    await captureBearer();
    r = await httpJson(method, path, body, BEARER);
  }
  return r;
}

async function captureBearer() {
  const r = await httpJson('POST', '/api/v1/auth/login/password', {
    email: EMAIL,
    password: PASSWORD,
  });
  BEARER = r.json?.data?.accessToken ?? r.json?.data?.token ?? null;
  USER = r.json?.data?.user ?? null;
  return Boolean(BEARER);
}

async function seedUiAuth(page) {
  if (!USER) return;
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.evaluate((user) => {
        localStorage.setItem(
          'auth-storage',
          JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 })
        );
        const key = 'eda-forex-workspace-v5';
        let parsed = { state: {}, version: 0 };
        try {
          parsed = JSON.parse(localStorage.getItem(key) || '{"state":{},"version":0}');
        } catch {
          /* ignore */
        }
        parsed.state = {
          ...(parsed.state || {}),
          bottomCollapsed: false,
          chartMode: 'normal',
          bottomTab: 'positions',
        };
        localStorage.setItem(key, JSON.stringify(parsed));
      }, USER);
      return;
    } catch {
      await page.waitForTimeout(400);
    }
  }
}

async function leaveQaNetting() {
  const pos = await apiNode('GET', '/api/v1/forex/positions');
  for (const x of (pos.json?.data?.positions ?? []).filter((z) => z.status === 'OPEN')) {
    await apiNode('POST', `/api/v1/forex/positions/${x.positionId}/close`, {
      clientOrderId: `fe-end-${Date.now()}`,
      volume: x.volume,
    });
  }
  await apiNode('POST', '/api/v1/forex/account/position-mode', { mode: 'NETTING' });
}

/** Only the visible toolbox — hidden md duplicate must not receive Expand clicks. */
async function visibleToolbox(page) {
  const all = page.locator('[aria-label="Trade toolbox"]');
  const n = await all.count();
  for (let i = 0; i < n; i += 1) {
    if (await all.nth(i).isVisible()) return all.nth(i);
  }
  return all.last();
}

async function openTradePanel(page) {
  const toolbox = await visibleToolbox(page);
  await toolbox.waitFor({ timeout: 20_000 }).catch(() => {});
  // Trade tab always calls setBottomCollapsed(false). Do NOT also click Expand afterward
  // when already expanded — Expand is a toggle and would re-collapse.
  const tradeTab = toolbox.locator('[role="tab"]:has-text("Trade")').first();
  if (await tradeTab.count()) await tradeTab.click().catch(() => {});
  await page.waitForTimeout(350);
  const tip = await toolbox.innerText().catch(() => '');
  if (/Collapse/i.test(tip)) return;
  const expand = toolbox.locator('button:has-text("Expand")');
  if (await expand.count()) {
    await expand.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function firstPositionRow(page) {
  const toolbox = await visibleToolbox(page);
  const rows = toolbox.locator('table tbody tr, article');
  if ((await rows.count()) > 0) return rows.first();
  return page.locator('table tbody tr').filter({ hasText: /EURUSD|Buy|Sell/i }).first();
}

async function waitForOpenRows(page, timeoutMs = 40_000) {
  await openTradePanel(page);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const toolbox = await visibleToolbox(page);
    const tip = await toolbox.innerText().catch(() => '');
    if (/Sign in for positions/i.test(tip) || (/^\s*Sign in\s*$/m.test(tip) && !/Collapse/i.test(tip))) {
      await seedUiAuth(page);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await seedUiAuth(page);
      await page.waitForTimeout(1500);
      await openTradePanel(page);
      continue;
    }
    const n = await toolbox.locator('table tbody tr, article').count();
    if (n > 0) return { ok: true, n, tip: tip.slice(0, 160) };
    if (/No open Forex positions/i.test(tip)) return { ok: false, reason: 'EMPTY', tip: tip.slice(0, 160) };
    if (/Bottom panel collapsed/i.test(tip) || (/\bExpand\b/.test(tip) && !/\bCollapse\b/.test(tip))) {
      await openTradePanel(page);
    }
    await page.waitForTimeout(500);
  }
  const tip = await (await visibleToolbox(page)).innerText().catch(() => '');
  return { ok: false, reason: 'TIMEOUT', tip: tip.slice(0, 200) };
}

async function gotoForex(page) {
  await page.goto(`${BASE}/forex`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await seedUiAuth(page);
  await page.locator('text=EURUSD').first().waitFor({ timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function main() {
  if (!(await captureBearer())) {
    console.error('Failed to capture bearer');
    process.exit(2);
  }
  console.log(`  auth: bearer len=${BEARER.length} user=${USER?.email || USER?.id}`);

  const browser = await chromium.launch({
    headless: process.env.FX_HEADED !== '1',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (/\/api\/v1\/auth\/login/i.test(url)) {
      await route.continue();
      return;
    }
    const headers = { ...route.request().headers() };
    if (BEARER) headers.authorization = `Bearer ${BEARER}`;
    await route.continue({ headers });
  });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('input[type="email"], input[name="email"]').first().waitFor({ timeout: 20_000 });
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await seedUiAuth(page);

    await gotoForex(page);
    mark(
      'FOREX_TERMINAL_LOADS',
      await page.locator('body').innerText().then((t) => /EURUSD|Market|Trade/i.test(t))
    );

    const body = await page.locator('body').innerText();
    const hasStopLimitOption = await page
      .locator('button:has-text("Stop Limit"), option:has-text("Stop Limit")')
      .count();
    const hasTifSelect = await page
      .locator(
        'select[aria-label="Time in force"], select[aria-label="Time in Force"], label:has(span:text-is("TIF")) select'
      )
      .count();
    mark('NO_STOP_LIMIT_SELECTOR', hasStopLimitOption === 0, `count=${hasStopLimitOption}`);
    mark('NO_TIF_SELECTOR', hasTifSelect === 0, `count=${hasTifSelect}`);
    mark('MARKET_LIMIT_STOP_UI', /Market/i.test(body) && /Limit/i.test(body));

    await captureBearer();
    await apiNode('POST', '/api/v1/forex/funding/demo', {});
    {
      const p0 = await apiNode('GET', '/api/v1/forex/positions');
      for (const x of (p0.json?.data?.positions ?? []).filter((z) => z.status === 'OPEN')) {
        await apiNode('POST', `/api/v1/forex/positions/${x.positionId}/close`, {
          clientOrderId: `fe-flat-${x.positionId.slice(0, 8)}-${Date.now()}`,
          volume: x.volume,
        });
      }
    }
    const mode = await apiNode('POST', '/api/v1/forex/account/position-mode', { mode: 'HEDGING' });
    const buy = await apiNode('POST', '/api/v1/forex/orders', {
      clientOrderId: `fe-buy-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'buy',
      orderType: 'market',
      volume: '0.50',
    });
    const sell = await apiNode('POST', '/api/v1/forex/orders', {
      clientOrderId: `fe-sell-${Date.now()}`,
      symbol: 'EURUSD',
      side: 'sell',
      orderType: 'market',
      volume: '0.30',
    });
    const pos = await apiNode('GET', '/api/v1/forex/positions');
    const open = (pos.json?.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    mark(
      'HEDGING_PAIR_READY',
      open.length >= 2,
      `open=${open.length} mode=${mode.status}/${mode.json?.data?.positionMode} buy=${buy.status} sell=${sell.status}`
    );

    await gotoForex(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await seedUiAuth(page);
    await page.waitForTimeout(2500);

    const rowsReady = await waitForOpenRows(page, 45_000);
    if (!rowsReady.ok) {
      await page.screenshot({ path: SCREENSHOT, fullPage: true }).catch(() => {});
      console.log(`  screenshot: ${SCREENSHOT} — ${rowsReady.reason} ${rowsReady.tip || ''}`);
      for (const n of [
        'REVERSE_VISIBLE',
        'CLOSE_BY_VISIBLE',
        'CLOSE_BY_DIALOG',
        'CLOSE_BY_RESULT',
        'REVERSE_MENU_AGAIN',
        'REVERSE_RESULT',
        'NETTING_NO_CLOSE_BY',
        'NETTING_REVERSE_OK',
      ]) {
        mark(n, false, rowsReady.reason);
      }
    } else {
      const row = await firstPositionRow(page);
      await row.click({ button: 'right' });
      await page.waitForTimeout(500);
      const menu = page.locator('[role="menu"]');
      const menuText = (await menu.count()) ? await menu.innerText() : '';
      mark('REVERSE_VISIBLE', /Reverse/i.test(menuText), menuText.slice(0, 120));
      mark('CLOSE_BY_VISIBLE', /Close By/i.test(menuText), menuText.slice(0, 120));

      if (/Close By/i.test(menuText)) {
        await menu.locator('button:has-text("Close By")').first().click();
        await page.waitForTimeout(400);
        const dialog = page.locator('[role="dialog"][aria-label="Close By"], [aria-label="Close By"]');
        mark('CLOSE_BY_DIALOG', (await dialog.count()) > 0);
        if (await dialog.count()) {
          await dialog.locator('button:has-text("Close By")').last().click();
          await page.waitForTimeout(2500);
        }
      } else {
        await page.screenshot({ path: SCREENSHOT, fullPage: true }).catch(() => {});
        mark('CLOSE_BY_DIALOG', false, 'menu missing Close By');
      }

      const afterCbPos = await apiNode('GET', '/api/v1/forex/positions');
      const afterCb = (afterCbPos.json?.data?.positions ?? [])
        .filter((p) => p.status === 'OPEN')
        .map((p) => ({ side: p.side, volume: p.volume, symbol: p.symbol }));
      const longLeft = afterCb.find((p) => p.side === 'long' && p.symbol === 'EURUSD');
      mark(
        'CLOSE_BY_RESULT',
        afterCb.length === 1 && longLeft && Math.abs(Number(longLeft.volume) - 0.2) < 1e-9,
        JSON.stringify(afterCb)
      );

      await gotoForex(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await seedUiAuth(page);
      await page.waitForTimeout(1500);
      await waitForOpenRows(page, 25_000);
      const row2 = await firstPositionRow(page);
      await row2.click({ button: 'right' });
      await page.waitForTimeout(400);
      const menu2 = page.locator('[role="menu"]');
      const m2 = (await menu2.count()) ? await menu2.innerText() : '';
      mark('REVERSE_MENU_AGAIN', /Reverse/i.test(m2));
      if (/Reverse/i.test(m2)) {
        await menu2.locator('button:has-text("Reverse")').first().click();
        await page.waitForTimeout(2500);
      }
      const afterRevPos = await apiNode('GET', '/api/v1/forex/positions');
      const afterRev = (afterRevPos.json?.data?.positions ?? []).filter((p) => p.status === 'OPEN');
      mark(
        'REVERSE_RESULT',
        afterRev.length === 1 &&
          afterRev[0].side === 'short' &&
          Math.abs(Number(afterRev[0].volume) - 0.2) < 1e-9,
        JSON.stringify(afterRev.map((p) => ({ side: p.side, volume: p.volume })))
      );

      {
        const cur = await apiNode('GET', '/api/v1/forex/positions');
        for (const x of (cur.json?.data?.positions ?? []).filter((z) => z.status === 'OPEN')) {
          await apiNode('POST', `/api/v1/forex/positions/${x.positionId}/close`, {
            clientOrderId: `fe-nflat-${Date.now()}`,
            volume: x.volume,
          });
        }
        await apiNode('POST', '/api/v1/forex/account/position-mode', { mode: 'NETTING' });
        await apiNode('POST', '/api/v1/forex/orders', {
          clientOrderId: `fe-net-${Date.now()}`,
          symbol: 'EURUSD',
          side: 'buy',
          orderType: 'market',
          volume: '0.10',
        });
      }

      await gotoForex(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await seedUiAuth(page);
      await page.waitForTimeout(1500);
      await waitForOpenRows(page, 25_000);
      const netRow = await firstPositionRow(page);
      await netRow.click({ button: 'right' });
      await page.waitForTimeout(400);
      const netMenu = (await page.locator('[role="menu"]').count())
        ? await page.locator('[role="menu"]').innerText()
        : '';
      mark('NETTING_NO_CLOSE_BY', !/Close By/i.test(netMenu), netMenu.slice(0, 100));
      mark('NETTING_REVERSE_OK', /Reverse/i.test(netMenu));
    }

        // Keep hydrated store — only switch viewport (reload would remount mobile collapse effect).
    {
      const cur = await apiNode('GET', '/api/v1/forex/positions');
      if (!(cur.json?.data?.positions ?? []).some((z) => z.status === 'OPEN')) {
        await apiNode('POST', '/api/v1/forex/orders', {
          clientOrderId: `fe-mob-${Date.now()}`,
          symbol: 'EURUSD',
          side: 'buy',
          orderType: 'market',
          volume: '0.10',
        });
        await gotoForex(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await seedUiAuth(page);
        await page.waitForTimeout(1500);
        await waitForOpenRows(page, 20_000);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    await openTradePanel(page);
    await page.waitForTimeout(800);
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 8
    );
    mark('MOBILE_NO_OVERFLOW', !mobileOverflow);
    const tip = await (await visibleToolbox(page)).innerText().catch(() => '');
    const card = (await visibleToolbox(page)).locator('article').first();
    if (await card.count()) {
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click({ button: 'right' }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const mobMenu = (await page.locator('[role="menu"]').count())
      ? await page.locator('[role="menu"]').innerText()
      : '';
    const closeBtns = await page.locator('[aria-label="Trade toolbox"] button:has-text("Close")').count();
    mark(
      'MOBILE_ACTIONS_ACCESSIBLE',
      /Reverse|Close/i.test(mobMenu) || closeBtns > 0 || /Close|Reverse/i.test(tip),
      `closeBtns=${closeBtns} tip=${tip.slice(0, 80).replace(/\n/g, ' ')}`
    );

    await page.setViewportSize({ width: 1500, height: 900 });
    await gotoForex(page);
    await openTradePanel(page);
    const t = await page.locator('body').innerText();
    mark('SL_TP_UI_PRESENT', /\bSL\b/.test(t) || /Stop Loss|Take Profit|TP/i.test(t));
  } catch (e) {
    await page.screenshot({ path: SCREENSHOT, fullPage: true }).catch(() => {});
    console.log(`  screenshot: ${SCREENSHOT}`);
    console.error(e);
  } finally {
    try {
      await leaveQaNetting();
      console.log('  cleanup: QA left in NETTING (flat)');
    } catch (ce) {
      console.error('  cleanup failed:', ce?.message ?? ce);
    }
    await browser.close();
  }

  const failed = RESULTS.filter((r) => !r.ok);
  console.log(
    `\nPhase 1B FE parity browser: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${RESULTS.length - failed.length}/${RESULTS.length})`
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
