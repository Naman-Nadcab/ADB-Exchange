/**
 * STEP 26 — real-browser certification against the real isolated backend.
 *
 * No route interception, no mocked responses. Every page talks to the running API; the only
 * simulated component is the browser wallet extension (see browser-lib.ts). Each check verifies
 * the resulting state in the backend database where money or orders are involved.
 *
 * Run: FULL_SYSTEM_FRONTEND_URL=… FULL_SYSTEM_ADMIN_URL=… npx playwright test -c e2e/full-system/playwright.config.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Wallet } from 'ethers';
import { api, q, walletLogin, type Session } from './lib.js';
import {
  ADMIN_URL,
  FRONTEND_URL,
  SHOTS_DIR,
  WIDTHS,
  horizontalOverflow,
  installBrowserWallet,
  loginAdminThroughUi,
  loginThroughUi,
  prepareCustomer,
  slug,
  viewportFor,
  visibleText,
  watchPage,
} from './browser-lib.js';

const CUSTOMER_DIR = process.env.FULL_SYSTEM_BROWSER_CUSTOMER_DIR ?? '/tmp/s26/browser-customers';
const OVERFLOW_TOLERANCE_PX = 1;

interface StoredCustomer {
  privateKey: string;
  userId: string;
  accessToken: string;
}

/**
 * One prepared customer per viewport width. The wallet-challenge limiter is a real security
 * control (5 challenges per address per 10 minutes), so each width signs in with its own wallet
 * and the API session is cached instead of re-issuing challenges on every run.
 */
async function loadCustomer(width: number): Promise<{ wallet: Wallet; session: Session }> {
  const file = `${CUSTOMER_DIR}/${width}.json`;
  if (existsSync(file)) {
    const stored = JSON.parse(readFileSync(file, 'utf8')) as StoredCustomer;
    const wallet = new Wallet(stored.privateKey);
    const me = await api('GET', '/api/v1/auth/me', { token: stored.accessToken });
    if (me.status === 200 && me.text.includes(stored.userId)) {
      return { wallet, session: { accessToken: stored.accessToken, userId: stored.userId, address: wallet.address, refreshToken: '', wallet } };
    }
    const session = await walletLogin(wallet);
    if (session.userId === stored.userId) {
      writeFileSync(file, JSON.stringify({ ...stored, accessToken: session.accessToken } satisfies StoredCustomer));
      return { wallet, session };
    }
  }
  const prepared = await prepareCustomer();
  const transfer = await api('POST', '/api/v1/wallet/transfer', {
    token: prepared.session.accessToken,
    body: { fromAccount: 'funding', toAccount: 'trading', tokenId: await usdtTokenId(), amount: '400' },
  });
  if (transfer.status >= 300) throw new Error(`funding→trading transfer ${transfer.status} ${transfer.text.slice(0, 200)}`);
  mkdirSync(CUSTOMER_DIR, { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({ privateKey: prepared.wallet.privateKey, userId: prepared.session.userId, accessToken: prepared.session.accessToken } satisfies StoredCustomer),
  );
  return prepared;
}

async function usdtTokenId(): Promise<string> {
  const rows = await q<{ id: string }>(`SELECT id FROM tokens WHERE symbol = 'USDT' ORDER BY created_at LIMIT 1`);
  if (!rows[0]) throw new Error('USDT token missing in isolated DB');
  return rows[0].id;
}

async function settle(page: Page, ms = 1500): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(ms);
}

async function shot(page: Page, width: number, name: string): Promise<void> {
  const dir = `${SHOTS_DIR}/${width}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

function assertHealthy(watch: ReturnType<typeof watchPage>, label: string): void {
  expect(watch.serverErrors, `${label}: 5xx API responses`).toEqual([]);
  expect(watch.consoleErrors.filter((e) => !/ResizeObserver|hydration/i.test(e)), `${label}: uncaught page errors`).toEqual([]);
  for (const ext of new Set(watch.externalUnavailable)) {
    test.info().annotations.push({ type: 'external-dependency', description: `${label}: ${ext}` });
  }
}

async function assertRendered(page: Page, width: number, label: string): Promise<string> {
  const text = await visibleText(page);
  expect(text, `${label}: Next.js error boundary rendered`).not.toMatch(/Application error|Unhandled Runtime Error|This page could not be found/i);
  const overflow = await horizontalOverflow(page);
  expect(overflow, `${label}@${width}: horizontal overflow ${overflow}px`).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
  return text;
}

for (const width of WIDTHS) {
  test.describe(`customer @ ${width}px`, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(240_000);

    let wallet: Wallet;
    let session: Session;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      ({ wallet, session } = await loadCustomer(width));
      const context = await browser.newContext({ viewport: viewportFor(width), locale: 'en-US' });
      await installBrowserWallet(context, wallet);
      page = await context.newPage();
    });

    test.afterAll(async () => {
      await page?.context().close();
    });

    test('login: wallet sign-in through the real /login page creates a real session', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded' });
      await settle(page, 500);
      await assertRendered(page, width, 'login');
      await shot(page, width, 'login');
      await loginThroughUi(page);
      await settle(page);
      const text = await assertRendered(page, width, 'post-login');
      expect(text).toMatch(/Customer command center|Overview|Dashboard/i);
      // The session the browser holds must be a real session for this user.
      const me = await page.evaluate(async () => {
        const r = await fetch('/api/v1/auth/me', { credentials: 'include', headers: { authorization: `Bearer ${localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? ''}` } });
        return { status: r.status, body: await r.text() };
      });
      expect(me.status, `auth/me from the browser session: ${me.body.slice(0, 160)}`).toBe(200);
      expect(me.body).toContain(session.userId);
      assertHealthy(watch, 'login');
      watch.stop();
    });

    test('dashboard: shows the real Crypto funding balance and keeps Forex separate', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const text = await assertRendered(page, width, 'dashboard');
      expect(text).toMatch(/CRYPTO FUNDING/i);
      expect(text).toMatch(/600(\.00)?\s*USDT/); // 1000 deposited − 400 moved to Spot
      expect(text).toMatch(/Not Forex/i);
      await shot(page, width, 'dashboard');
      assertHealthy(watch, 'dashboard');
      watch.stop();
    });

    test('account: profile page renders the real UID', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/dashboard/account`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const text = await assertRendered(page, width, 'account');
      expect(text).toContain(session.userId.slice(0, 8));
      await shot(page, width, 'account');
      assertHealthy(watch, 'account');
      watch.stop();
    });

    test('security: sign-in wallet is listed, custodial deposit wallet is not mixed in', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/dashboard/security`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const text = await assertRendered(page, width, 'security');
      const short = wallet.address.slice(0, 6).toLowerCase();
      expect(text.toLowerCase(), 'sign-in wallet address not shown').toContain(short);
      const custodial = await q<{ address: string }>(`SELECT address FROM wallets WHERE user_id = $1 AND chain_id = 'ethereum'`, [session.userId]);
      if (custodial[0]) expect(text.toLowerCase()).not.toContain(custodial[0].address.slice(0, 10).toLowerCase());
      await expect(page.getByTestId('add-wallet')).toBeVisible();
      await shot(page, width, 'security');
      assertHealthy(watch, 'security');
      watch.stop();
    });

    test('wallet: overview lists USDT across Funding and Spot accounts', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/wallet`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const text = await assertRendered(page, width, 'wallet');
      expect(text).toMatch(/USDT/);
      expect(text).toMatch(/Funding Account/i);
      expect(text).toMatch(/Spot \/ Trading Account/i);
      await shot(page, width, 'wallet');
      assertHealthy(watch, 'wallet');
      watch.stop();
    });

    test('deposit: selecting USDT on Ethereum shows the customer’s real custodial address', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/wallet/deposit/crypto`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await assertRendered(page, width, 'deposit');
      // Quick-pick chips are rendered as "USDT USDT" (icon alt + label).
      await page.getByRole('button', { name: /^USDT(\s|$)/ }).first().click();
      // Picking a coin auto-selects the first supported chain; the picker button then carries that
      // chain's name, so locate it structurally (first button after the "Chains that support" hint).
      const chainPicker = page.getByText(/Chains that support USDT/i).locator('xpath=following::button[1]');
      await expect(chainPicker).toBeEnabled({ timeout: 15_000 });
      await chainPicker.click();
      await page.locator('button', { hasText: /^Ethereum/ }).filter({ hasText: /EVM|confirmation/i }).first().click();
      await expect(chainPicker).toContainText(/Ethereum/);
      const custodial = await q<{ address: string }>(`SELECT address FROM wallets WHERE user_id = $1 AND chain_id = 'ethereum'`, [session.userId]);
      expect(custodial[0]?.address, 'custodial ethereum wallet row').toBeTruthy();
      await expect(page.getByText(custodial[0]!.address, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
      const text = await visibleText(page);
      expect(text).toMatch(/Only send USDT on Ethereum/i);
      expect(text, 'the sign-in wallet must never be presented as a deposit address').not.toContain(wallet.address);
      await shot(page, width, 'deposit');
      assertHealthy(watch, 'deposit');
      watch.stop();
    });

    test('withdraw: the form validates and reaches the review step with real fee/limit data', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/wallet/withdraw/crypto`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await assertRendered(page, width, 'withdraw');
      await page.getByRole('button', { name: /Please Select/i }).first().click();
      await page.getByRole('button', { name: /^USDT\b/ }).first().click();
      const chainPicker = page.getByRole('button', { name: /Select chain/i }).first();
      if (await chainPicker.isVisible().catch(() => false)) {
        await chainPicker.click();
        await page.getByRole('button', { name: /Ethereum|ERC-?20/i }).first().click();
      }
      await page.getByPlaceholder(/enter or select from address book/i).fill(`0x${'5'.repeat(39)}c`);
      await page.locator('input[type="number"]').first().fill('25');
      const review = page.getByRole('button', { name: /Review withdrawal/i });
      await expect(review).toBeEnabled({ timeout: 15_000 });
      await review.click();
      await page.waitForTimeout(1200);
      const text = await visibleText(page);
      expect(text).toMatch(/25/);
      expect(text).toMatch(/fee/i);
      await shot(page, width, 'withdraw');
      assertHealthy(watch, 'withdraw');
      watch.stop();
    });

    test('spot: a limit buy placed through the terminal rests in the real order book and in the database', async () => {
      // Start from a clean book for this customer (a previous aborted run may have left a resting order).
      for (const o of await q<{ id: string }>(`SELECT id FROM spot_orders WHERE user_id = $1 AND UPPER(status) IN ('OPEN','NEW','PARTIALLY_FILLED')`, [session.userId])) {
        await api('POST', `/api/v1/spot/order/${o.id}/cancel`, { token: session.accessToken, body: {} });
      }
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/trade/spot?symbol=BTC_USDT`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await assertRendered(page, width, 'spot');
      // The market stream must be live and the private order/trade channels must authenticate
      // over the real socket (one-time ticket handshake) — no "Account syncing" chip left behind.
      await expect(page.getByText(/^Live$/).first(), 'spot market stream not live').toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Account syncing/i), 'spot private WS channels never authenticated').toBeHidden({ timeout: 20_000 });
      const pair = page.getByRole('combobox', { name: /Trading pair/i });
      if (await pair.isVisible().catch(() => false)) {
        await pair.selectOption({ label: 'BTC/USDT' }).catch(() => undefined);
        await page.waitForTimeout(800);
      }
      const qty = page.locator('#spot-quantity');
      if (!(await qty.isVisible().catch(() => false))) {
        // Compact layouts keep the ticket behind the "Trade" tab; open it the way a user would.
        const tab = page.getByRole('tab', { name: /^Trade$/ }).first();
        if (await tab.isVisible().catch(() => false)) await tab.click();
      }
      await expect(qty).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /^Limit$/ }).first().click().catch(() => undefined);
      // Deep below the ~100 USDT isolated last price so the order rests; 0.1 BTC keeps the
      // notional (≥ 4 USDT) above the real 1 USDT minimum enforced by the ticket.
      const price = `${(40 + Math.floor(Math.random() * 20)).toFixed(2)}`;
      await page.locator('#spot-price').fill(price);
      await qty.fill('0.1');
      const placedAfter = (await q<{ now: string }>(`SELECT NOW()::text AS now`))[0]!.now;
      await page.getByRole('button', { name: /^Buy BTC$/ }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /^Confirm$/ }).click();
      const findOrder = async () =>
        (
          await q<{ id: string; status: string }>(
            `SELECT id, status FROM spot_orders
             WHERE user_id = $1 AND side = 'buy' AND price = $2::numeric AND created_at >= $3::timestamptz
             ORDER BY created_at DESC LIMIT 1`,
            [session.userId, price, placedAfter],
          )
        )[0] ?? null;
      await expect.poll(findOrder, { timeout: 20_000, message: 'spot order row' }).not.toBeNull();
      const row = (await findOrder())!;
      expect(['open', 'new', 'accepted', 'pending']).toContain(row.status.toLowerCase());
      await expect(page.getByText(price, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
      await shot(page, width, 'spot');
      const cancel = await api('POST', `/api/v1/spot/order/${row.id}/cancel`, { token: session.accessToken, body: {} });
      expect([200, 204], `cancel resting order ${cancel.status} ${cancel.text.slice(0, 120)}`).toContain(cancel.status);
      assertHealthy(watch, 'spot');
      watch.stop();
    });

    test('p2p: marketplace renders real ads or an honest empty state, with Buy/Sell and asset filters', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/p2p`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await assertRendered(page, width, 'p2p');
      await expect(page.getByRole('tab', { name: /^Buy$/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /^Sell$/ })).toBeVisible();
      // Customer intent "Buy USDT with INR" must list the advertisers' SELL ads (default filters).
      const sellAds = await q<{ n: string; min: string; max: string }>(
        `SELECT COUNT(*)::text AS n, MIN(a.min_amount)::text AS min, MAX(a.max_amount)::text AS max
         FROM p2p_ads a JOIN tokens t ON t.id = a.token_id
         WHERE a.status = 'active' AND a.type = 'sell' AND a.fiat_currency = 'INR' AND t.symbol = 'USDT'`,
      );
      const text = await visibleText(page);
      if (Number(sellAds[0]?.n ?? 0) > 0) {
        expect(text, 'ads counter must reflect the real active sell ads').not.toMatch(/\b0 ads\b/);
        const buyAction = page.getByRole('button', { name: /^Buy USDT$/ }).first();
        await expect(buyAction).toBeVisible({ timeout: 15_000 });
        await buyAction.click();
        const dialogText = await expect
          .poll(async () => visibleText(page), { timeout: 15_000 })
          .toMatch(/Limits|Payment/i)
          .then(() => visibleText(page));
        expect(dialogText).toMatch(/USDT/);
        expect(dialogText).toMatch(new RegExp(Number(sellAds[0]!.min).toString()));
        await page.keyboard.press('Escape');
      } else {
        expect(text).toMatch(/No ads match your filters/i);
      }
      await shot(page, width, 'p2p');
      assertHealthy(watch, 'p2p');
      watch.stop();
    });

    test('forex: a 0.01-lot market buy from the terminal fills and opens a real DEMO position', async () => {
      const watch = watchPage(page);
      await page.goto(`${FRONTEND_URL}/forex/trade`, { waitUntil: 'domcontentloaded' });
      await settle(page, 2500);
      const text = await assertRendered(page, width, 'forex');
      expect(text).toMatch(/SIMULATED/);
      expect(text).toMatch(/Demo/i);
      const accountRows = await q<{ id: string }>(`SELECT account_id AS id FROM forex_accounts WHERE user_id = $1 AND account_kind = 'DEMO' ORDER BY created_at DESC LIMIT 1`, [session.userId]);
      expect(accountRows[0]?.id, 'forex demo account row').toBeTruthy();
      // DEMO accounts run in NETTING mode: a second buy on the same symbol nets into the existing
      // position instead of opening a new row, so assert on net long exposure + the filled order.
      const netLongSql = `SELECT COALESCE(SUM(CASE WHEN side = 'long' THEN volume ELSE -volume END), 0)::text AS v
                            FROM forex_positions WHERE account_id = $1 AND symbol = 'EURUSD' AND status = 'OPEN'`;
      const before = Number((await q<{ v: string }>(netLongSql, [accountRows[0]!.id]))[0]!.v);
      const placedAfter = new Date();
      // Two ticket instances exist in the DOM (docked + companion); act on the one that is actually visible.
      const volume = page.getByLabel('Volume lots').locator('visible=true').first();
      if (!(await volume.isVisible().catch(() => false))) {
        // Compact layouts start with the bottom "Trade toolbox" collapsed; expand it like a user would.
        const toolbox = page.getByRole('region', { name: /Trade toolbox/i });
        const tradeTab = toolbox.getByRole('tab', { name: /^Trade$/ });
        if (await tradeTab.isVisible().catch(() => false)) await tradeTab.click();
        const expand = toolbox.getByRole('button', { name: /^Expand$/ });
        if (await expand.isVisible().catch(() => false)) await expand.click();
      }
      await expect(volume).toBeVisible({ timeout: 15_000 });
      await volume.fill('0.01');
      await page.getByRole('button', { name: /^Market Buy/ }).locator('visible=true').first().click();
      await expect
        .poll(async () => Number((await q<{ v: string }>(netLongSql, [accountRows[0]!.id]))[0]!.v), {
          timeout: 20_000,
          message: 'net long EURUSD exposure on the DEMO account',
        })
        .toBeCloseTo(before + 0.01, 6);
      const order = await q<{ side: string; status: string; filled_volume: string; execution_mode: string }>(
        `SELECT side, status, filled_volume::text, execution_mode FROM forex_orders
          WHERE account_id = $1 AND symbol = 'EURUSD' AND created_at >= $2 ORDER BY created_at DESC LIMIT 1`,
        [accountRows[0]!.id, placedAfter.toISOString()],
      );
      expect(order[0], 'forex order row written by the terminal').toBeTruthy();
      expect(order[0]!.side.toUpperCase()).toBe('BUY');
      expect(order[0]!.status.toUpperCase()).toBe('FILLED');
      expect(Number(order[0]!.filled_volume)).toBeCloseTo(0.01, 6);
      expect(order[0]!.execution_mode.toUpperCase()).not.toBe('LIVE');
      const pos = await q<{ side: string; initial_margin: string }>(
        `SELECT side, initial_margin::text FROM forex_positions WHERE account_id = $1 AND symbol = 'EURUSD' AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1`,
        [accountRows[0]!.id],
      );
      expect(pos[0]!.side).toBe('long');
      expect(Number(pos[0]!.initial_margin)).toBeGreaterThan(0);
      await expect(page.getByText(/^Filled$/).locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
      await shot(page, width, 'forex');
      assertHealthy(watch, 'forex');
      watch.stop();
    });
  });

  test.describe(`admin @ ${width}px`, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(240_000);
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({ viewport: viewportFor(width), locale: 'en-US' });
      page = await context.newPage();
    });
    test.afterAll(async () => {
      await page?.context().close();
    });

    test('admin: login, dashboard, users, KYC, withdrawals, control center, forex and audit pages render real data', async () => {
      const watch = watchPage(page);
      await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
      await settle(page, 500);
      const loginText = await assertRendered(page, width, 'admin-login');
      expect(loginText, 'production admin build must not show dev credentials').not.toMatch(/Dev mode|admin123/);
      await shot(page, width, 'admin-login');
      await loginAdminThroughUi(page);
      await settle(page);
      const pages: Array<[string, RegExp]> = [
        ['/admin/dashboard', /Users|Deposits|Withdrawals|Revenue|Health/i],
        ['/admin/users', /rc20|isolated|Users/i],
        ['/admin/kyc', /KYC|Pending|Approved/i],
        ['/admin/withdrawals', /Withdrawals|Pending Approval|Rejected/i],
        ['/admin/control-center', /Wallet status|Trading|Emergency|Withdrawal/i],
        ['/admin/forex/overview', /Forex|Accounts|Demo|SIMULATED/i],
        ['/admin/audit', /Audit|Activity|Immutable/i],
      ];
      for (const [path, marker] of pages) {
        await page.goto(`${ADMIN_URL}${path}`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const text = await assertRendered(page, width, `admin${path}`);
        expect(text, `${path} content marker`).toMatch(marker);
        expect(text, `${path} must not expose secrets`).not.toMatch(/s26-secret-|step22-secret-value/);
        await shot(page, width, `admin-${slug(path)}`);
      }
      // The audit page must show this run's real admin actions (immutable trail).
      await page.goto(`${ADMIN_URL}/admin/audit`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      const audit = await visibleText(page);
      // Actions are humanised in the table ("Login", "Kyc approve", …).
      expect(audit).toMatch(/kyc.?approve|admin.?login|forex.?admin|system.?settings|\bLogin\b/i);
      expect(audit).toMatch(/Immutable Audit Trail|Admin Activity/i);
      assertHealthy(watch, 'admin');
      watch.stop();
    });
  });
}
