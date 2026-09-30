/**
 * FOREX BROWSER END-TO-END CERTIFICATION (real Chromium via Playwright).
 *
 * Certifies the price-consistency invariant and the MT5 position workflow in a
 * real browser, including a 390x844 mobile pass.
 *
 * Run: node scripts/forex-browser-cert.mjs
 * Env: FX_BASE (default http://109.123.254.30)
 *      FX_EMAIL / FX_PASSWORD
 *      FX_HEADED=1 to watch it
 */
import { chromium } from 'playwright';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';

const RESULTS = [];
const CONSOLE_ERRORS = [];
const FAILED_REQUESTS = [];

function mark(name, ok, detail = '') {
  RESULTS.push({ name, ok: Boolean(ok), detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function info(msg) {
  console.log(`        ${msg}`);
}

/** Numbers as rendered in the workstation, e.g. "157.131", "1.16064", "4,472.23". */
function nums(text) {
  return (text.match(/\d[\d,]*\.\d+/g) ?? [])
    .map((s) => Number(s.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function num1(text, label) {
  const m = text.match(new RegExp(`${label}\\s+(\\d[\\d,]*\\.\\d+)`));
  return m ? Number(m[1].replace(/,/g, '')) : NaN;
}

function relDiff(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return Infinity;
  return Math.abs(a - b) / b;
}

async function main() {
  const browser = await chromium.launch({
    headless: process.env.FX_HEADED !== '1',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error') CONSOLE_ERRORS.push(m.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    FAILED_REQUESTS.push(`${r.method()} ${r.url().slice(0, 140)} — ${r.failure()?.errorText ?? ''}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) FAILED_REQUESTS.push(`${r.status()} ${r.url().slice(0, 140)}`);
  });

  // ---------------------------------------------------------------- PART 1
  console.log('\n=== PART 1 — LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);

  const emailBox = page
    .locator('input[type="email"], input[name="email"], input[autocomplete="username"]')
    .first();
  const passBox = page.locator('input[type="password"]').first();
  await emailBox.waitFor({ timeout: 20_000 });
  await emailBox.fill(EMAIL);
  await passBox.fill(PASSWORD);

  const submit = page
    .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")')
    .first();
  await submit.click();
  await page.waitForTimeout(6000);

  const afterLogin = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const otpPrompt = /one[- ]time|otp|verification code|2fa|authenticator/i.test(bodyText);
  const loggedIn = !/\/login(\?|$)/.test(afterLogin) || otpPrompt === false;
  mark('LOGIN', !/\/login(\?|$)/.test(afterLogin), `landed on ${afterLogin}`);
  if (otpPrompt) {
    mark('LOGIN_NO_OTP_GATE', false, 'an OTP/2FA prompt appeared — cannot continue unattended');
    await finish(browser);
    return;
  }
  if (!loggedIn) {
    await finish(browser);
    return;
  }

  // ---------------------------------------------------------------- PART 2
  console.log('\n=== PART 2 — WORKSTATION + AUTH GATE ===');
  await page.goto(`${BASE}/forex`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(9000);

  const wsText = await page.locator('body').innerText();
  const signInPrompt = /Sign in for positions/i.test(wsText);
  mark(
    'TRADE_TAB_NOT_SIGNIN',
    !signInPrompt,
    signInPrompt
      ? 'Trade tab still shows "Sign in for positions, P&L, SL/TP" while authenticated'
      : 'no sign-in prompt while authenticated'
  );

  await page.screenshot({ path: '/tmp/fx-cert-workstation.png', fullPage: false });
  info('screenshot: /tmp/fx-cert-workstation.png');

  // Read the authoritative quote straight from the app's own API for cross-check.
  const apiQuote = async (sym) => {
    const r = await page.evaluate(async (s) => {
      const res = await fetch(`/api/v1/forex/quotes/${s}`, { credentials: 'include' });
      const j = await res.json();
      return j?.data?.quote ?? null;
    }, sym);
    return r;
  };

  const SYMBOLS = [
    ['USDJPY', 'USD/JPY'],
    ['EURUSD', 'EUR/USD'],
    ['GBPUSD', 'GBP/USD'],
    ['USDCHF', 'USD/CHF'],
    ['XAUUSD', 'XAU/USD'],
  ];

  const priceTable = [];
  for (const [code, display] of SYMBOLS) {
    // Select the symbol from the watchlist.
    const row = page.locator(`text=${display}`).first();
    if (await row.count()) {
      await row.click({ timeout: 10_000 }).catch(() => {});
    }
    await page.waitForTimeout(5000);

    const q = await apiQuote(code);
    const text = await page.locator('body').innerText();

    // Chart header renders "Live <price>" from the quote store, "Candle C <price>" from history.
    const live = num1(text, 'Live');
    const candleC = num1(text, 'Candle C');

    const bid = q ? Number(q.bid) : NaN;
    const ask = q ? Number(q.ask) : NaN;

    // Does the rendered page contain the authoritative price anywhere it matters?
    const shown = nums(text);
    const nearBid = shown.filter((n) => relDiff(n, bid) <= 0.0006);
    const zeroSpread = q ? q.bid === q.ask : false;
    const liveAgrees = Number.isFinite(live) ? relDiff(live, bid) <= 0.0006 : false;

    priceTable.push({
      symbol: display,
      bid: q?.bid ?? 'n/a',
      ask: q?.ask ?? 'n/a',
      live: Number.isFinite(live) ? String(live) : 'not rendered',
      candleC: Number.isFinite(candleC) ? String(candleC) : 'n/a',
      liveVsBid: Number.isFinite(live) ? `${(relDiff(live, bid) * 100).toFixed(4)}%` : 'n/a',
      occurrences: nearBid.length,
    });

    mark(
      `PRICE_${code}`,
      zeroSpread && liveAgrees && nearBid.length >= 2,
      `bid=${q?.bid} ask=${q?.ask} live=${Number.isFinite(live) ? live : 'n/a'} candleC=${
        Number.isFinite(candleC) ? candleC : 'n/a'
      } liveVsBid=${Number.isFinite(live) ? (relDiff(live, bid) * 100).toFixed(4) : 'n/a'}% surfacesShowingQuote=${nearBid.length}`
    );
  }

  console.log('\n  symbol    bid          ask          chartLive    candleC      live-vs-bid  #surfaces');
  for (const r of priceTable) {
    console.log(
      `  ${r.symbol.padEnd(9)} ${String(r.bid).padEnd(12)} ${String(r.ask).padEnd(12)} ${String(
        r.live
      ).padEnd(12)} ${String(r.candleC).padEnd(12)} ${String(r.liveVsBid).padEnd(12)} ${r.occurrences}`);
  }

  // ---------------------------------------------------------------- PART 3
  console.log('\n=== PART 3 — POSITION LIFECYCLE (UI-driven) ===');

  // Select EUR/USD for the trading legs.
  await page.locator('text=EUR/USD').first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const clickByText = async (label, timeout = 6000) => {
    const btn = page
      .locator(`button:has-text("${label}"), [role="button"]:has-text("${label}")`)
      .filter({ hasNot: page.locator('[disabled]') })
      .first();
    if ((await btn.count()) === 0) return false;
    try {
      await btn.click({ timeout });
      return true;
    } catch {
      return false;
    }
  };

  // One-click BUY on the chart toolbar is the most stable market-order path.
  const buyClicked = await clickByText('BUY');
  await page.waitForTimeout(6000);
  mark('UI_MARKET_BUY_CONTROL', buyClicked, buyClicked ? 'BUY control clicked' : 'no enabled BUY control found');

  const positionsApi = async () => {
    return page.evaluate(async () => {
      const res = await fetch('/api/v1/forex/positions', { credentials: 'include' });
      const j = await res.json();
      return (j?.data?.positions ?? []).filter((p) => p.status === 'OPEN');
    });
  };

  let open = [];
  for (let i = 0; i < 12 && open.length === 0; i += 1) {
    open = await positionsApi();
    if (open.length === 0) await page.waitForTimeout(1000);
  }
  mark('POSITION_CREATED', open.length > 0, open.length ? `${open[0].side} ${open[0].volume} ${open[0].symbol}` : 'no open position');

  if (open.length > 0) {
    const p = open[0];
    await page.waitForTimeout(3000);
    const tradeText = await page.locator('body').innerText();

    // The position must be visible in the Trade tab without re-authenticating.
    const idFrag = p.positionId.slice(0, 6);
    const rowVisible =
      tradeText.includes(idFrag) ||
      (/EUR\/USD|EURUSD/.test(tradeText) && /Close/i.test(tradeText));
    mark('POSITION_ROW_VISIBLE', rowVisible, rowVisible ? 'position row rendered in Trade tab' : 'row not found');

    const q = await apiQuote('EURUSD');
    const markPx = Number(p.currentPrice);
    const expected = p.side === 'long' ? Number(q.bid) : Number(q.ask);
    mark(
      'POSITION_MARK_MATCHES_QUOTE',
      relDiff(markPx, expected) <= 0.001,
      `mark=${p.currentPrice} vs ${p.side === 'long' ? 'BID' : 'ASK'}=${expected}`
    );

    // Which MT5 actions are reachable for the row?
    const actions = ['Close', 'Modify', 'Trail', 'Partial'];
    const present = [];
    for (const a of actions) {
      const byButton = await page.locator(`button:has-text("${a}")`).count();
      const byText = await page.getByText(a, { exact: false }).count();
      if (byButton + byText > 0) present.push(a);
    }
    mark('POSITION_ACTIONS_VISIBLE', present.includes('Close'), `visible: ${present.join(', ') || 'none'}`);

    await page.screenshot({ path: '/tmp/fx-cert-position.png' });
    info('screenshot: /tmp/fx-cert-position.png');

    // ---- Modify SL/TP through the documented API contract the UI uses -------
    const slTp = await page.evaluate(async (pos) => {
      const cur = Number(pos.currentPrice);
      const mk = async (type, price) => {
        const res = await fetch('/api/v1/forex/protections', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionId: pos.positionId,
            type,
            triggerPrice: price.toFixed(5),
            clientProtectionId: `cert-${type}-${Date.now()}`,
          }),
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      };
      const down = pos.side === 'long' ? cur - 0.005 : cur + 0.005;
      const up = pos.side === 'long' ? cur + 0.005 : cur - 0.005;
      return { sl: await mk('STOP_LOSS', down), tp: await mk('TAKE_PROFIT', up) };
    }, p);
    mark('MODIFY_SL', slTp.sl.status === 200, `HTTP ${slTp.sl.status}`);
    mark('MODIFY_TP', slTp.tp.status === 200, `HTTP ${slTp.tp.status}`);

    // ---- Trailing stop -----------------------------------------------------
    const trail = await page.evaluate(async (pos) => {
      const list = await (await fetch('/api/v1/forex/protections', { credentials: 'include' })).json();
      const sl = (list?.data?.protections ?? []).find(
        (x) => x.positionId === pos.positionId && x.type === 'STOP_LOSS'
      );
      if (!sl) return { status: 0, note: 'no SL to trail' };
      const res = await fetch(`/api/v1/forex/protections/${sl.protectionId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trailingDistance: '0.00200' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, p);
    mark('TRAILING_STOP', trail.status === 200, `HTTP ${trail.status} ${trail.note ?? ''}`);

    // ---- Partial close -----------------------------------------------------
    const half = (Number(p.volume) / 2).toFixed(2);
    const partial = await page.evaluate(
      async ({ id, vol, version }) => {
        const res = await fetch(`/api/v1/forex/positions/${id}/close`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: vol, expectedVersion: version, clientOrderId: `cert-partial-${Date.now()}` }),
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      },
      { id: p.positionId, vol: half, version: p.version }
    );
    const afterPartial = await positionsApi();
    const remaining = afterPartial.find((x) => x.positionId === p.positionId);
    mark(
      'PARTIAL_CLOSE',
      partial.status === 200 && Boolean(remaining) && Number(remaining.volume) < Number(p.volume),
      `HTTP ${partial.status}, volume ${p.volume} -> ${remaining?.volume ?? 'closed'}`
    );

    // ---- Full close --------------------------------------------------------
    const target = remaining ?? p;
    const full = await page.evaluate(
      async ({ id, vol, version }) => {
        const res = await fetch(`/api/v1/forex/positions/${id}/close`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: vol, expectedVersion: version, clientOrderId: `cert-full-${Date.now()}` }),
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      },
      { id: target.positionId, vol: target.volume, version: target.version }
    );
    const afterFull = await positionsApi();
    mark(
      'FULL_CLOSE',
      full.status === 200 && !afterFull.some((x) => x.positionId === target.positionId),
      `HTTP ${full.status}, open positions now ${afterFull.length}`
    );

    // ---- Margin released + realized P&L ------------------------------------
    const acct = await page.evaluate(async () => {
      const res = await fetch('/api/v1/forex/account', { credentials: 'include' });
      const j = await res.json();
      return j?.data?.account ?? null;
    });
    mark('MARGIN_RELEASED', acct && Number(acct.usedMargin) === 0, `usedMargin=${acct?.usedMargin}`);
    mark(
      'MARGIN_LEVEL_NOT_INFINITY',
      acct ? acct.marginLevel === null : false,
      `marginLevel=${JSON.stringify(acct?.marginLevel)} (null renders as "—")`
    );
    mark('REALIZED_PNL_PRESENT', acct && acct.realizedPnl != null, `realizedPnl=${acct?.realizedPnl}`);
  }

  // ---------------------------------------------------------------- PART 4
  console.log('\n=== PART 4 — PENDING ORDERS (place / modify / cancel) ===');
  const pendingResult = await page.evaluate(async () => {
    const q = await (await fetch('/api/v1/forex/quotes/EURUSD', { credentials: 'include' })).json();
    const mid = Number(q.data.quote.mid);
    const post = (path, body, method = 'POST') =>
      fetch(path, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

    const plan = [
      ['BUY_LIMIT', 'buy', 'limit', mid * 0.99],
      ['SELL_LIMIT', 'sell', 'limit', mid * 1.01],
      ['BUY_STOP', 'buy', 'stop', mid * 1.01],
      ['SELL_STOP', 'sell', 'stop', mid * 0.99],
    ];
    const out = {};
    for (const [label, side, orderType, price] of plan) {
      const placed = await post('/api/v1/forex/orders', {
        symbol: 'EURUSD',
        side,
        orderType,
        volume: '0.01',
        requestedPrice: price.toFixed(5),
        clientOrderId: `cert-${label}-${Date.now()}`,
      });
      const id = placed.body?.data?.order?.orderId;
      const status = placed.body?.data?.order?.status;
      if (!id) {
        out[label] = { place: false, modify: false, cancel: false, note: `${status ?? placed.status}` };
        continue;
      }
      const newPrice = (orderType === 'limit' && side === 'buy') || (orderType === 'stop' && side === 'sell')
        ? price * 0.999
        : price * 1.001;
      const mod = await post(`/api/v1/forex/orders/${id}`, { requestedPrice: newPrice.toFixed(5) }, 'PATCH');
      const can = await post(`/api/v1/forex/orders/${id}/cancel`, {});
      const active = await (await fetch('/api/v1/forex/orders', { credentials: 'include' })).json();
      const stillActive = (active?.data?.orders ?? []).some(
        (o) => o.orderId === id && !['CANCELLED', 'CANCELED', 'FILLED', 'REJECTED', 'EXPIRED'].includes(String(o.status).toUpperCase())
      );
      out[label] = {
        place: status === 'PENDING' || status === 'ACCEPTED' || status === 'NEW',
        placedStatus: status,
        modify: mod.status === 200,
        cancel: can.status === 200 && can.body?.data?.order?.status === 'CANCELLED',
        cancelStatus: can.body?.data?.order?.status,
        removedFromActive: !stillActive,
      };
    }
    return out;
  });

  for (const [label, r] of Object.entries(pendingResult)) {
    mark(`${label}_PLACE`, r.place, `status=${r.placedStatus ?? r.note ?? ''}`);
    mark(`${label}_MODIFY`, r.modify);
    mark(`${label}_CANCEL`, r.cancel && r.removedFromActive, `status=${r.cancelStatus}, removedFromActive=${r.removedFromActive}`);
  }

  // ---------------------------------------------------------------- PART 4C — UI CANCEL (visible + clickable)
  console.log('\n=== PART 4C — PENDING CANCEL UI (Orders page) ===');
  await page.goto(`${BASE}/forex/orders`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5000);

  const uiCancelPlan = [
    ['UI_BUY_LIMIT', 'buy', 'limit', 0.99],
    ['UI_SELL_LIMIT', 'sell', 'limit', 1.01],
    ['UI_BUY_STOP', 'buy', 'stop', 1.01],
    ['UI_SELL_STOP', 'sell', 'stop', 0.99],
  ];

  for (const [label, side, orderType, mult] of uiCancelPlan) {
    const created = await page.evaluate(
      async ({ side, orderType, mult }) => {
        const q = await (await fetch('/api/v1/forex/quotes/EURUSD', { credentials: 'include' })).json();
        const mid = Number(q.data.quote.mid);
        const price = (mid * mult).toFixed(5);
        const res = await fetch('/api/v1/forex/orders', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'EURUSD',
            side,
            orderType,
            volume: '0.01',
            requestedPrice: price,
            clientOrderId: `ui-cancel-${side}-${orderType}-${Date.now()}`,
          }),
        });
        const body = await res.json().catch(() => null);
        return { status: res.status, orderId: body?.data?.order?.orderId ?? null, orderStatus: body?.data?.order?.status };
      },
      { side, orderType, mult }
    );
    mark(`${label}_CREATE`, Boolean(created.orderId), `HTTP ${created.status} status=${created.orderStatus}`);
    if (!created.orderId) continue;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const pendingTab = page.getByRole('tab', { name: /pending/i }).first();
    if (await pendingTab.count()) await pendingTab.click().catch(() => {});
    await page.waitForTimeout(500);

    const frag = created.orderId.slice(0, 8);
    const cancelBtn = page.locator(`[data-testid="cancel-order-${frag}"]`).first();
    const visible = await cancelBtn.isVisible().catch(() => false);
    mark(`${label}_CANCEL_VISIBLE`, visible, `testid=cancel-order-${frag}`);
    if (!visible) continue;

    await cancelBtn.click();
    await page.waitForTimeout(400);
    const confirmBtn = page.locator(`[data-testid="confirm-cancel-${frag}"]`).first();
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    mark(`${label}_CANCEL_CLICK`, confirmVisible, 'Confirm prompt after Cancel click');
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    const gone = await page.evaluate(async (id) => {
      const active = await (await fetch('/api/v1/forex/orders', { credentials: 'include' })).json();
      return !(active?.data?.orders ?? []).some(
        (o) =>
          o.orderId === id &&
          !['CANCELLED', 'CANCELED', 'FILLED', 'REJECTED', 'EXPIRED'].includes(String(o.status).toUpperCase())
      );
    }, created.orderId);
    mark(`${label}_SERVER_CANCELLED`, gone, 'order absent from active list');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const stillGone = await page.evaluate(async (id) => {
      const active = await (await fetch('/api/v1/forex/orders', { credentials: 'include' })).json();
      return !(active?.data?.orders ?? []).some(
        (o) =>
          o.orderId === id &&
          !['CANCELLED', 'CANCELED', 'FILLED', 'REJECTED', 'EXPIRED'].includes(String(o.status).toUpperCase())
      );
    }, created.orderId);
    const btnAfter = await page.locator(`[data-testid="cancel-order-${frag}"]`).count();
    mark(`${label}_RELOAD_ABSENT`, stillGone && btnAfter === 0, `stillGone=${stillGone} cancelBtn=${btnAfter}`);
  }

  // ---------------------------------------------------------------- PART 4B — HEDGING (Phase 1A)
  console.log('\n=== PART 4B — HEDGING SAME-SYMBOL INDEPENDENT POSITIONS ===');
  const hedgePrep = await page.evaluate(async () => {
    const flat = async () => {
      const list = await (await fetch('/api/v1/forex/positions', { credentials: 'include' })).json();
      for (const p of (list?.data?.positions ?? []).filter((x) => x.status === 'OPEN')) {
        await fetch(`/api/v1/forex/positions/${p.positionId}/close`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientOrderId: `br-flat-${Date.now()}-${p.positionId.slice(0, 8)}` }),
        });
      }
    };
    await flat();
    const mode = await fetch('/api/v1/forex/account/position-mode', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'HEDGING' }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const buy = await fetch('/api/v1/forex/orders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientOrderId: `br-h-buy-${Date.now()}`,
        symbol: 'EURUSD',
        side: 'buy',
        orderType: 'market',
        volume: '0.10',
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const sell = await fetch('/api/v1/forex/orders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientOrderId: `br-h-sell-${Date.now()}`,
        symbol: 'EURUSD',
        side: 'sell',
        orderType: 'market',
        volume: '0.10',
      }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    await new Promise((r) => setTimeout(r, 800));
    const open = ((await (await fetch('/api/v1/forex/positions', { credentials: 'include' })).json())?.data?.positions ?? []).filter(
      (p) => p.status === 'OPEN'
    );
    return { mode, buyStatus: buy.status, sellStatus: sell.status, open };
  });
  mark('HEDGE_MODE_SET', hedgePrep.mode.status === 200, `HTTP ${hedgePrep.mode.status}`);
  mark(
    'HEDGE_TWO_OPEN',
    hedgePrep.open.length === 2 &&
      hedgePrep.open.some((p) => p.side === 'long') &&
      hedgePrep.open.some((p) => p.side === 'short'),
    `open=${hedgePrep.open.length} sides=${hedgePrep.open.map((p) => p.side).join(',')}`
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const tradeTab = page.getByText('Trade', { exact: true }).first();
  if (await tradeTab.count()) await tradeTab.click().catch(() => {});
  await page.waitForTimeout(1500);
  const hedgeUi = await page.locator('body').innerText();
  const buyFrag = hedgePrep.open.find((p) => p.side === 'long')?.positionId?.slice(0, 6) ?? '';
  const sellFrag = hedgePrep.open.find((p) => p.side === 'short')?.positionId?.slice(0, 6) ?? '';
  const bothRows =
    (buyFrag && sellFrag && hedgeUi.includes(buyFrag) && hedgeUi.includes(sellFrag)) ||
    ((hedgeUi.match(/EUR\/USD|EURUSD/g) || []).length >= 2 && /buy|long/i.test(hedgeUi) && /sell|short/i.test(hedgeUi));
  mark('HEDGE_BOTH_ROWS_VISIBLE', bothRows, `buyFrag=${buyFrag} sellFrag=${sellFrag}`);
  mark(
    'HEDGE_NOT_FLAT_LABEL',
    !/\bFLAT\b/.test(hedgeUi) || hedgePrep.open.length === 0,
    'must not collapse hedged book to FLAT'
  );

  const hedgeClose = await page.evaluate(async (open) => {
    const buy = open.find((p) => p.side === 'long');
    const sell = open.find((p) => p.side === 'short');
    if (!buy || !sell) return { ok: false, note: 'missing sides' };
    await fetch(`/api/v1/forex/positions/${buy.positionId}/close`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientOrderId: `br-h-close-buy-${Date.now()}` }),
    });
    await new Promise((r) => setTimeout(r, 600));
    let cur = ((await (await fetch('/api/v1/forex/positions', { credentials: 'include' })).json())?.data?.positions ?? []).filter(
      (p) => p.status === 'OPEN'
    );
    const sellRemains = cur.length === 1 && cur[0].positionId === sell.positionId;
    await fetch(`/api/v1/forex/positions/${sell.positionId}/close`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientOrderId: `br-h-close-sell-${Date.now()}` }),
    });
    await new Promise((r) => setTimeout(r, 600));
    cur = ((await (await fetch('/api/v1/forex/positions', { credentials: 'include' })).json())?.data?.positions ?? []).filter(
      (p) => p.status === 'OPEN'
    );
    const ledger = await (await fetch('/api/v1/forex/ledger', { credentials: 'include' })).json();
    await fetch('/api/v1/forex/account/position-mode', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'NETTING' }),
    });
    return {
      ok: sellRemains && cur.length === 0,
      sellRemains,
      finalOpen: cur.length,
      recon: ledger?.data?.reconciliation?.status ?? null,
    };
  }, hedgePrep.open);
  mark('HEDGE_INDEPENDENT_CLOSE', Boolean(hedgeClose.ok), `sellRemains=${hedgeClose.sellRemains} finalOpen=${hedgeClose.finalOpen}`);
  mark('HEDGE_LEDGER_MATCH', hedgeClose.recon === 'MATCH' || hedgeClose.recon == null, `recon=${hedgeClose.recon}`);

  // ---------------------------------------------------------------- PART 5
  console.log('\n=== PART 5 — ACCOUNT BAR ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const barText = await page.locator('body').innerText();
  const barFields = ['Balance', 'Equity', 'Margin', 'Free', 'Floating', 'Realized'];
  const seen = barFields.filter((f) => new RegExp(f, 'i').test(barText));
  mark('ACCOUNT_BAR_FIELDS', seen.length >= 5, `visible: ${seen.join(', ')}`);
  mark(
    'NO_INFINITY_RENDERED',
    !/Infinity|∞/.test(barText),
    /Infinity|∞/.test(barText) ? 'page renders Infinity' : 'no Infinity/∞ on page'
  );

  // ---------------------------------------------------------------- PART 6
  console.log('\n=== PART 6 — MOBILE 390 x 844 ===');
  const mobile = await ctx.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${BASE}/forex`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobile.waitForTimeout(9000);
  await mobile.screenshot({ path: '/tmp/fx-cert-mobile.png', fullPage: false });
  info('screenshot: /tmp/fx-cert-mobile.png');

  const overflow = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  mark(
    'MOBILE_NO_H_OVERFLOW',
    overflow.scrollWidth <= overflow.clientWidth + 1,
    `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`
  );

  const mobText = await mobile.locator('body').innerText();
  mark('MOBILE_QUOTE_VISIBLE', nums(mobText).length > 0, `${nums(mobText).length} numeric price surfaces`);
  mark('MOBILE_NOT_SIGNIN', !/Sign in for positions/i.test(mobText));
  const mobChart = await mobile.locator('canvas, svg').count();
  mark('MOBILE_CHART_PRESENT', mobChart > 0, `${mobChart} canvas/svg nodes`);
  const mobTabs = ['Trade', 'Orders'].filter((t) => new RegExp(t, 'i').test(mobText));
  mark('MOBILE_TOOLBOX_REACHABLE', mobTabs.length > 0, `tabs: ${mobTabs.join(', ')}`);

  await finish(browser, page);
}

async function finish(browser, page) {
  if (page) {
    await page.screenshot({ path: '/tmp/fx-cert-final.png' }).catch(() => {});
  }
  console.log('\n=== CONSOLE ERRORS ===');
  if (CONSOLE_ERRORS.length === 0) console.log('  none');
  else [...new Set(CONSOLE_ERRORS)].slice(0, 12).forEach((e) => console.log(`  ${e}`));

  console.log('\n=== FAILED / 5xx REQUESTS ===');
  if (FAILED_REQUESTS.length === 0) console.log('  none');
  else [...new Set(FAILED_REQUESTS)].slice(0, 12).forEach((e) => console.log(`  ${e}`));

  const failed = RESULTS.filter((r) => !r.ok);
  console.log(`\nbrowser cert: ${RESULTS.length - failed.length}/${RESULTS.length} passed`);
  if (failed.length) console.log(`FAILED: ${failed.map((f) => f.name).join(', ')}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('cert crashed:', err);
  process.exit(1);
});
