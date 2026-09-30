/**
 * Forex multi-account browser E2E (account switch, refresh, logout, race, responsive, a11y spot-check).
 * FX_BASE=http://109.123.254.30 node scripts/forex-multi-account-browser-cert.mjs
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';

const results = {};

function pass(key, ok, detail = '') {
  results[key] = { ok: Boolean(ok), detail };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${key}${detail ? ` — ${detail}` : ''}`);
}

async function login(page, navigate = true) {
  if (navigate) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2000);
  }
  const emailBox = page.locator('input[type="email"], input[name="email"]').first();
  await emailBox.waitFor({ timeout: 20_000 });
  await emailBox.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForTimeout(5000);
  return !/\/login(\?|$)/.test(page.url());
}

async function activeAccountIdFromUi(page) {
  const btn = page.getByRole('button', { name: 'Active Forex account' });
  await btn.waitFor({ timeout: 15_000 });
  const text = await btn.innerText();
  const m = text.match(/#([^\s]+)/);
  return m ? m[1] : null;
}

async function openSwitcher(page) {
  await page.getByRole('button', { name: 'Active Forex account' }).click();
  await page.locator('[role="listbox"]').waitFor({ timeout: 5000 });
}

async function selectAccountOption(page, accountIdSuffix) {
  const opt = page.locator('[role="listbox"] [role="option"]').filter({ hasText: accountIdSuffix });
  await opt.first().click();
  await page.waitForTimeout(3500);
}

async function apiActiveAndOrders(page) {
  return page.evaluate(async () => {
    const token = localStorage.getItem('accessToken') ?? sessionStorage.getItem('accessToken');
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const acc = await fetch('/api/v1/forex/accounts', { headers }).then((r) => r.json());
    const active = acc?.data?.activeAccountId ?? null;
    const h2 = { ...headers, 'X-Forex-Account-Id': active };
    const orders = await fetch('/api/v1/forex/orders', { headers: h2 }).then((r) => r.json());
    return {
      active,
      orderCount: (orders?.data?.orders ?? []).length,
      orderIds: (orders?.data?.orders ?? []).slice(0, 5).map((o) => o.orderId ?? o.clientOrderId),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  pass('login', await login(page), page.url());
  if (!results.login.ok) {
    await browser.close();
    writeOut();
    process.exit(1);
  }

  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(8000);

  const id0 = await activeAccountIdFromUi(page);
  pass('switcherVisible', Boolean(id0), id0 ?? 'no active id in UI');

  await openSwitcher(page);
  const options = await page.locator('[role="listbox"] [role="option"]').allInnerTexts();
  pass('twoAccountsListed', options.length >= 2, `count=${options.length}`);

  const ids = [];
  for (const t of options) {
    const m = t.match(/#([^\s]+)/);
    if (m) ids.push(m[1]);
  }
  const other = ids.find((id) => id !== id0) ?? ids[1];
  await selectAccountOption(page, other);
  const id1 = await activeAccountIdFromUi(page);
  pass('accountSwitch', id1 === other, `${id0} → ${id1} (expected ${other})`);

  const snap1 = await apiActiveAndOrders(page);
  pass('apiActiveMatchesUiAfterSwitch', snap1.active === id1, `api=${snap1.active} ui=${id1}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const idAfterRefresh = await activeAccountIdFromUi(page);
  pass('refreshPersistsAccount', idAfterRefresh === id1, `after reload ${idAfterRefresh}`);

  await page.evaluate(() => location.reload(true));
  await page.waitForTimeout(8000);
  const idHard = await activeAccountIdFromUi(page);
  pass('hardRefreshPersistsAccount', idHard === id1, `after hard reload ${idHard}`);

  await openSwitcher(page);
  const back = ids.find((id) => id !== id1) ?? ids[0];
  await selectAccountOption(page, back);
  const id2 = await activeAccountIdFromUi(page);
  const snap2 = await apiActiveAndOrders(page);
  pass('switchBack', id2 === back, snap2.active === back ? 'api aligned' : `api=${snap2.active}`);

  // Race: rapid toggles
  for (let i = 0; i < 4; i++) {
    await openSwitcher(page);
    await selectAccountOption(page, i % 2 === 0 ? other : back);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(5000);
  const idRace = await activeAccountIdFromUi(page);
  const snapRace = await apiActiveAndOrders(page);
  pass('raceStaleState', idRace === snapRace.active, `ui=${idRace} api=${snapRace.active}`);

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const idNav = await activeAccountIdFromUi(page);
  const snapNav = await apiActiveAndOrders(page);
  pass('navigateAwayReturn', idNav === snapNav.active, `ui=${idNav} api=${snapNav.active}`);

  // Logout / login (API revoke + clear client auth, same as performLogout)
  await page.evaluate(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    const headers = token.includes('.') ? { authorization: `Bearer ${token}` } : {};
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include', headers });
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2000);
  const emailVisible = (await page.locator('input[type="email"], input[name="email"]').count()) > 0;
  pass('logout', emailVisible, page.url());

  if (await login(page, false)) {
    await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    const idLogin = await activeAccountIdFromUi(page);
    const snapLogin = await apiActiveAndOrders(page);
    pass('loginRestoresForexContext', Boolean(idLogin) && snapLogin.active === idLogin, idLogin);
  } else {
    pass('loginRestoresForexContext', false, 're-login failed');
  }

  // Responsive
  for (const [name, w, h] of [
    ['desktop1440', 1440, 900],
    ['laptop1280', 1280, 800],
    ['tablet768', 768, 1024],
    ['mobile390', 390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    const switcherOk = (await page.getByRole('button', { name: 'Active Forex account' }).count()) > 0;
    pass(`responsive_${name}`, switcherOk && !overflow, overflow ? 'horizontal overflow' : 'ok');
  }

  // Accessibility spot-check
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const switcherBtn = page.getByRole('button', { name: 'Active Forex account' });
  await switcherBtn.focus();
  const focusOk = await page.evaluate(() => {
    const ae = document.activeElement;
    return ae?.getAttribute('aria-label') === 'Active Forex account';
  });
  pass('a11y_focusSwitcher', focusOk, 'keyboard focus on switcher');
  await switcherBtn.press('Enter');
  await page.waitForTimeout(500);
  const expanded = await switcherBtn.getAttribute('aria-expanded');
  pass('a11y_keyboardOpenListbox', expanded === 'true', `aria-expanded=${expanded}`);

  await browser.close();
  writeOut();
  const allCritical = [
    'login',
    'accountSwitch',
    'refreshPersistsAccount',
    'raceStaleState',
    'loginRestoresForexContext',
  ].every((k) => results[k]?.ok);
  process.exit(allCritical ? 0 : 1);
}

function writeOut() {
  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    user: EMAIL,
    results,
  };
  writeFileSync('/opt/m-live/.build/forex-browser-e2e-certification.json', JSON.stringify(out, null, 2));
  console.log('Wrote .build/forex-browser-e2e-certification.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
