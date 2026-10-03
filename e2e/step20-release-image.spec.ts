/**
 * Browser certification against the isolated release images behind nginx.
 * Wallet signatures are produced by ethers in this process. No provider is injected.
 */
import { expect, test, type Page } from '@playwright/test';
import { Wallet } from 'ethers';
import { writeFileSync, rmSync } from 'node:fs';

const API = process.env.RC20_API_URL ?? 'http://127.0.0.1:18080';
const FAULT = process.env.RC20_FAULT_URL ?? 'http://127.0.0.1:18081';
const FAULT_FILE = process.env.RC20_FAULT_FILE ?? '/tmp/step20-fault';

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '375', width: 375, height: 667 },
  { name: '834', width: 834, height: 1112 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
];

async function walletLogin(page: Page, origin: string): Promise<void> {
  const wallet = Wallet.createRandom();
  const challengeRes = await page.request.post(`${origin}/api/v1/auth/wallet/challenge`, {
    data: { caip10: `eip155:1:${wallet.address}` },
  });
  expect(challengeRes.ok(), await challengeRes.text()).toBeTruthy();
  const challenge = await challengeRes.json();
  const issued = challenge.challenge ?? challenge.data ?? challenge;
  const message = issued.message as string;
  const challengeId = (issued.id ?? issued.challengeId) as string;
  const signature = await wallet.signMessage(message);
  const loginRes = await page.request.post(`${origin}/api/v1/auth/wallet/login`, {
    data: { challengeId, message, signature },
  });
  expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
  const login = await loginRes.json();
  const userId = login.data?.user?.id as string;
  expect(userId).not.toBe(wallet.address);
  await page.context().addCookies([
    { name: 'mlive_at', value: login.data.accessToken, url: origin, httpOnly: true, sameSite: 'Lax' },
    { name: 'mlive_rt', value: login.data.refreshToken, url: origin, httpOnly: true, sameSite: 'Lax' },
  ]);
  await page.addInitScript((id) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { user: { id, email: null, status: 'active', emailVerified: false, phoneVerified: false, tierLevel: 0 }, isAuthenticated: true },
      version: 0,
    }));
  }, userId);
}

async function noOverflow(page: Page): Promise<void> {
  const box = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
}

test.describe.configure({ mode: 'serial' });

test('no browser wallet provider in system Chrome or Chromium', async ({ playwright }) => {
  test.setTimeout(60_000);
  for (const channel of [undefined, 'chrome'] as const) {
    const browser = await playwright.chromium.launch(channel ? { channel, headless: true } : { headless: true });
    const page = await browser.newPage();
    await page.goto(`${API}/login`, { waitUntil: 'domcontentloaded' });
    const discovered = await page.evaluate(async () => {
      const announced: string[] = [];
      window.addEventListener('eip6963:announceProvider', (event) => {
        const detail = (event as CustomEvent).detail as { info?: { name?: string } };
        if (detail?.info?.name) announced.push(detail.info.name);
      });
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      await new Promise((r) => setTimeout(r, 400));
      return {
        ethereum: typeof (window as { ethereum?: unknown }).ethereum,
        solana: typeof (window as { solana?: unknown }).solana,
        announced,
      };
    });
    expect(discovered.ethereum).toBe('undefined');
    expect(discovered.solana).toBe('undefined');
    expect(discovered.announced).toEqual([]);
    await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
    await expect(page.getByText('No wallet detected in this browser.')).toBeVisible();
    await browser.close();
  }
});

test('release images keep the session across viewports', async ({ page }) => {
  test.setTimeout(180_000);
  await walletLogin(page, API);
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 20_000 });
    await noOverflow(page);
    await page.goto('/forex', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/SIMULATED/).locator('visible=true').first()).toBeVisible({ timeout: 20_000 });
    await noOverflow(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/login/);
    await noOverflow(page);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dashboard/security', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Security Center' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
  await page.goto('/dashboard/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
  await page.goto('/dashboard/identity', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Proof of Identity')).toBeVisible({ timeout: 20_000 });
  await page.goto('/wallet/deposit/crypto', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Deposit|Select coin|deposit address/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
});

test('release image fault responses keep the session', async ({ page }) => {
  test.setTimeout(90_000);
  await walletLogin(page, FAULT);
  writeFileSync(FAULT_FILE, 'hang /api/v1/user/announcements\n');
  await page.goto(`${FAULT}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Request timed out or network error')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
  rmSync(FAULT_FILE, { force: true });

  writeFileSync(FAULT_FILE, 'status /api/v1/spot/markets 500 Failed to load markets\n');
  await page.goto(`${FAULT}/trade/spot`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Failed to load markets')).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  rmSync(FAULT_FILE, { force: true });

  writeFileSync(FAULT_FILE, 'status /api/v1/p2p/ads 500 Could not load ads\n');
  await page.goto(`${FAULT}/p2p`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Could not load ads' })).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  rmSync(FAULT_FILE, { force: true });

  writeFileSync(FAULT_FILE, 'status /api/v1/forex/instruments 500 Forex hydrate failed\n');
  await page.goto(`${FAULT}/forex`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Unable to load Forex workspace.')).toBeVisible({ timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  rmSync(FAULT_FILE, { force: true });
});
