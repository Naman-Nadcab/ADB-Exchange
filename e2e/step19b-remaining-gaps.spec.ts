/**
 * Remaining STEP 19 gaps against the isolated stack.
 * Wallet discovery uses the real browser. No provider is injected.
 * Failure cases are injected at the local :4000 proxy, not with page.route.
 */
import { expect, test, chromium, type Page } from '@playwright/test';
import { Wallet } from 'ethers';
import { writeFileSync, rmSync } from 'node:fs';
import { Pool } from 'pg';

const API = process.env.STEP19_API_URL ?? 'http://127.0.0.1:4019';
const DB = process.env.STEP19_DATABASE_URL ?? '';
const FAULT = process.env.STEP19B_FAULT_FILE ?? '/tmp/step19b-fault';

function setFault(line: string | null): void {
  if (!line) {
    rmSync(FAULT, { force: true });
    return;
  }
  writeFileSync(FAULT, `${line}\n`);
}

async function walletLogin(page: Page): Promise<{ userId: string; address: string }> {
  const wallet = Wallet.createRandom();
  const challengeRes = await page.request.post(`${API}/api/v1/auth/wallet/challenge`, {
    data: { caip10: `eip155:1:${wallet.address}` },
  });
  expect(challengeRes.ok(), await challengeRes.text()).toBeTruthy();
  const challenge = await challengeRes.json();
  const issued = challenge.challenge ?? challenge.data ?? challenge;
  const message = issued.message as string;
  const challengeId = (issued.id ?? issued.challengeId) as string;
  const signature = await wallet.signMessage(message);
  const loginRes = await page.request.post(`${API}/api/v1/auth/wallet/login`, {
    data: { challengeId, message, signature },
  });
  expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
  const login = await loginRes.json();
  const access = login.data?.accessToken as string;
  const refresh = login.data?.refreshToken as string;
  const userId = login.data?.user?.id as string;
  await page.context().addCookies([
    { name: 'mlive_at', value: access, url: 'http://localhost:3000', httpOnly: true, sameSite: 'Lax' },
    { name: 'mlive_rt', value: refresh, url: 'http://localhost:3000', httpOnly: true, sameSite: 'Lax' },
  ]);
  await page.addInitScript((id) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: { id, email: null, status: 'active', emailVerified: false, phoneVerified: false, tierLevel: 0 },
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
  }, userId);
  return { userId, address: wallet.address };
}

async function assertAuthed(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 20_000 });
}

async function userCount(): Promise<number> {
  if (!DB) return -1;
  const pool = new Pool({ connectionString: DB, ssl: false });
  try {
    const db = await pool.query<{ current_database: string }>('SELECT current_database()');
    expect(db.rows[0]?.current_database).not.toBe('exchange');
    const n = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
    return n.rows[0]?.n ?? -1;
  } finally {
    await pool.end();
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const box = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(box.scroll, `${label} scroll ${box.scroll} client ${box.client}`).toBeLessThanOrEqual(box.client + 1);
}

test.describe.configure({ mode: 'serial' });

test.afterEach(() => {
  setFault(null);
});

test('system Chrome and Playwright Chromium expose no wallet provider', async ({ page }) => {
  test.setTimeout(60_000);
  const probe = async (target: Page) => {
    await target.goto('/login', { waitUntil: 'domcontentloaded' });
    const discovered = await target.evaluate(async () => {
      const announced: string[] = [];
      window.addEventListener('eip6963:announceProvider', (event) => {
        const detail = (event as CustomEvent<{ info?: { name?: string } }>).detail;
        announced.push(detail?.info?.name ?? 'unnamed');
      });
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      await new Promise((r) => setTimeout(r, 400));
      const w = window as Window & { ethereum?: unknown; solana?: unknown };
      return {
        ethereum: typeof w.ethereum,
        solana: typeof w.solana,
        announced,
      };
    });
    expect(discovered.ethereum).toBe('undefined');
    expect(discovered.solana).toBe('undefined');
    expect(discovered.announced).toEqual([]);
    await target.getByRole('button', { name: 'Sign in with your wallet' }).click();
    await expect(target.getByText('No wallet detected in this browser.')).toBeVisible();
    await expect(target.getByRole('button', { name: /MetaMask|Phantom|Coinbase|Trust/ })).toHaveCount(0);
  };

  await probe(page);

  const chrome = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await chrome.newContext({ baseURL: 'http://localhost:3000' });
    const chromePage = await context.newPage();
    await probe(chromePage);
    await context.close();
  } finally {
    await chrome.close();
  }
});

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '375', width: 375, height: 667 },
  { name: 'tablet', width: 834, height: 1112 },
];

for (const viewport of VIEWPORTS) {
  test(`responsive ${viewport.name} crypto forex crypto`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await walletLogin(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await assertAuthed(page);
    await assertNoHorizontalOverflow(page, `dashboard ${viewport.name}`);
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();

    await page.goto('/forex', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/SIMULATED/).locator('visible=true').first()).toBeVisible({ timeout: 20_000 });
    await assertNoHorizontalOverflow(page, `forex ${viewport.name}`);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await assertAuthed(page);
    await assertNoHorizontalOverflow(page, `dashboard-return ${viewport.name}`);
  });
}

test('announcement API hang shows timeout and keeps the same session', async ({ page }) => {
  test.setTimeout(60_000);
  const before = await userCount();
  const session = await walletLogin(page);
  setFault('hang /api/v1/user/announcements');
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await assertAuthed(page);
  const msg = page.getByText('Request timed out or network error');
  await expect(msg).toBeVisible({ timeout: 25_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
  const after = await userCount();
  if (before >= 0) expect(after).toBe(before + 1);
  const pool = DB ? new Pool({ connectionString: DB, ssl: false }) : null;
  if (pool) {
    const dup = await pool.query(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [session.userId]);
    expect(dup.rows[0]?.n).toBe(1);
    await pool.end();
  }
});

test('spot markets upstream 500 shows the load failure and stays signed in', async ({ page }) => {
  test.setTimeout(60_000);
  await walletLogin(page);
  setFault('status /api/v1/spot/markets 500 Failed to load markets');
  await page.goto('/trade/spot', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Failed to load markets').first()).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  const blank = await page.evaluate(() => document.body.innerText.trim().length);
  expect(blank).toBeGreaterThan(20);
});

test('p2p ads upstream 500 shows the ads error and stays signed in', async ({ page }) => {
  test.setTimeout(60_000);
  await walletLogin(page);
  setFault('status /api/v1/p2p/ads 500 Could not load ads');
  await page.goto('/p2p', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Could not load ads' })).toBeVisible({ timeout: 25_000 });
  await expect(page).not.toHaveURL(/\/login/);
});

test('forex instruments upstream 500 shows hydrate failure and keeps one account', async ({ page }) => {
  test.setTimeout(60_000);
  const session = await walletLogin(page);
  setFault('status /api/v1/forex/instruments 500 Forex hydrate failed');
  await page.goto('/forex', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Unable to load Forex workspace/)).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
    return res.status;
  });
  expect(me).toBe(200);
  if (DB) {
    const pool = new Pool({ connectionString: DB, ssl: false });
    const dup = await pool.query(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [session.userId]);
    expect(dup.rows[0]?.n).toBe(1);
    await pool.end();
  }
});
