/**
 * Chromium against the isolated API. No page.route stubs.
 * The signature is produced by ethers in this process because no wallet
 * extension is installed. That is real server verification, not a browser provider.
 */
import { expect, test, type Page } from '@playwright/test';
import { Wallet } from 'ethers';
import { Pool } from 'pg';

const API = process.env.STEP19_API_URL ?? 'http://127.0.0.1:4019';
const DB = process.env.STEP19_DATABASE_URL ?? '';

async function walletLogin(page: Page): Promise<{ userId: string; address: string }> {
  const wallet = Wallet.createRandom();
  const challengeRes = await page.request.post(`${API}/api/v1/auth/wallet/challenge`, {
    data: { caip10: `eip155:1:${wallet.address}` },
  });
  expect(challengeRes.ok(), await challengeRes.text()).toBeTruthy();
  const challenge = await challengeRes.json();
  const issued = challenge.challenge ?? challenge.data ?? challenge;
  const message = issued.message as string | undefined;
  const challengeId = (issued.id ?? issued.challengeId) as string | undefined;
  expect(message, JSON.stringify(challenge).slice(0, 400)).toBeTruthy();
  const signature = await wallet.signMessage(message);
  const loginRes = await page.request.post(`${API}/api/v1/auth/wallet/login`, {
    data: { challengeId, message, signature },
  });
  expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
  const login = await loginRes.json();
  const access = login.data?.accessToken as string;
  const refresh = login.data?.refreshToken as string;
  const userId = login.data?.user?.id as string;
  expect(access.split('.').length).toBe(3);
  expect(userId).not.toBe(wallet.address);
  await page.context().addCookies([
    { name: 'mlive_at', value: access, url: 'http://localhost:3000', httpOnly: true, sameSite: 'Lax' },
    { name: 'mlive_rt', value: refresh, url: 'http://localhost:3000', httpOnly: true, sameSite: 'Lax' },
  ]);
  const stored = await page.context().cookies('http://localhost:3000');
  expect(stored.some((c) => c.name === 'mlive_at' && c.value.split('.').length === 3)).toBeTruthy();
  return { userId, address: wallet.address };
}

async function assertSessionApi(page: Page, label: string): Promise<void> {
  await expect(page).not.toHaveURL(/\/login/);
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
    return { status: res.status, body: (await res.text()).slice(0, 180) };
  });
  expect(me.status, `${label} ${me.body}`).toBe(200);
}

async function assertAuthed(page: Page, label: string): Promise<void> {
  const started = Date.now();
  const deadline = started + 20_000;
  let lastUrl = '';
  while (Date.now() < deadline) {
    lastUrl = page.url();
    if (/\/login/.test(lastUrl)) break;
    const menu = page.getByRole('button', { name: 'User menu' });
    if (await menu.count()) {
      if (await menu.first().isVisible().catch(() => false)) return;
    }
    await page.waitForTimeout(250);
  }
  const diag = await page.evaluate(async () => {
    const me = await fetch('/api/v1/auth/me', { credentials: 'include' }).then(async (r) => ({
      status: r.status,
      body: (await r.text()).slice(0, 240),
    })).catch((e: Error) => ({ status: 0, body: e.message }));
    return {
      href: location.href,
      storage: localStorage.getItem('auth-storage')?.slice(0, 240) ?? null,
      me,
    };
  }).catch((e: Error) => ({ error: e.message, href: page.url() }));
  throw new Error(`${label} not authenticated url=${lastUrl} diag=${JSON.stringify(diag)}`);
}

test('real isolated backend cross-venue journey', async ({ page }) => {
  test.setTimeout(180_000);
  page.on('response', (res) => {
    if (res.url().includes('/api/v1/auth/me') || res.url().includes('/auth/logout')) {
      console.log(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  const session = await walletLogin(page);
  await page.addInitScript((userId) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: {
            id: userId,
            email: null,
            status: 'active',
            emailVerified: false,
            phoneVerified: false,
            tierLevel: 0,
          },
          isAuthenticated: true,
        },
        version: 0,
      })
    );
  }, session.userId);
  const pool = DB ? new Pool({ connectionString: DB, ssl: false }) : null;
  if (pool) {
    const db = await pool.query<{ current_database: string }>('SELECT current_database()');
    expect(db.rows[0]?.current_database).not.toBe('exchange');
    const dup = await pool.query(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [session.userId]);
    expect(dup.rows[0]?.n).toBe(1);
    const custody = await pool.query(`SELECT count(*)::int AS n FROM wallets WHERE user_id = $1`, [session.userId]);
    expect(custody.rows[0]?.n).toBe(0);
  }

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await assertAuthed(page, 'dashboard');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertAuthed(page, 'dashboard-reload');

  await page.goto('/dashboard/account', { waitUntil: 'domcontentloaded' });
  await assertAuthed(page, 'account');
  await page.goto('/dashboard/security', { waitUntil: 'domcontentloaded' });
  await assertAuthed(page, 'security');
  await expect(page.getByRole('heading', { name: 'Sign-in security' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Login & password')).toHaveCount(0);
  const short = `${session.address.slice(0, 6)}…${session.address.slice(-4)}`;
  await expect(page.getByText(short)).toBeVisible();

  await page.goto('/dashboard/identity', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('This verification belongs to your exchange account')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Proof of Identity')).toBeVisible();

  if (pool) {
    await pool.query(
      `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at) VALUES ($1, 1, 'pending', NOW())`,
      [session.userId]
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Verification In Progress')).toBeVisible({ timeout: 20_000 });
    await pool.query(
      `INSERT INTO kyc_applications (user_id, kyc_level, status, rejection_reason, created_at)
       VALUES ($1, 1, 'rejected', 'step19 isolated rejection', NOW() + interval '1 second')`,
      [session.userId]
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Verification was not approved')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Proof of Identity')).toBeVisible();
    await pool.query(
      `INSERT INTO kyc_applications (user_id, kyc_level, status, created_at)
       VALUES ($1, 1, 'approved', NOW() + interval '2 seconds')`,
      [session.userId]
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Identity Verified')).toBeVisible({ timeout: 20_000 });
  }

  await page.goto('/forex', { waitUntil: 'domcontentloaded' });
  await assertSessionApi(page, 'forex');
  await expect(page.getByText('Unable to load Forex workspace.')).toHaveCount(0);
  const createDemo = page.getByRole('button', { name: /Create demo account/i });
  if (await createDemo.count()) {
    await createDemo.first().click();
  }
  const buy = page.getByRole('button', { name: /Market Buy/ });
  await expect(buy.first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Equity', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('SIMULATED').first()).toBeVisible();
  await expect(page.getByText(/Demo/).first()).toBeVisible();
  // Saturday session: the mock venue closes the market. Do not force a fill.
  await expect(page.getByText(/Market closed/).first()).toBeVisible();
  await expect(buy.first()).toBeDisabled();
  await page.goto('/forex/account', { waitUntil: 'domcontentloaded' });
  await assertSessionApi(page, 'forex-account');

  await page.goto('/wallet/deposit/crypto', { waitUntil: 'domcontentloaded' });
  await assertAuthed(page, 'deposit');
  await expect(page.getByText(/Deposit|Select coin|deposit address/i).first()).toBeVisible({ timeout: 20_000 });

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await assertAuthed(page, 'crypto-return');
  await expect(page.getByText('USDT USDT')).toHaveCount(0);
  await expect(page.getByText(/combined total/i)).toHaveCount(0);
  if (pool) await pool.end();
});
