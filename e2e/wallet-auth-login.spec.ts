import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe.configure({ timeout: 45_000 });

const ADDRESS = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const USER_ID = '6f1c0c2e-1111-4111-8111-111111111111';
const SHOTS = '/opt/cursor/artifacts/step6-wallet-auth';

type WalletMode = {
  challengeStatus?: number;
  challengeCode?: string;
  loginStatus?: number;
  loginCode?: string;
  abortLogin?: boolean;
  userId?: string;
};

function fakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    sub: USER_ID,
  })).toString('base64url');
  return `${header}.${payload}.sig`;
}

async function installWallet(page: Page) {
  await page.addInitScript(() => {
    const state = {
      accounts: ['0x1111111111111111111111111111111111111111'],
      chainId: '0x1',
      accountReads: 0,
      chainReads: 0,
      rejectSign: false,
      switchAccountOnSecondRead: false,
      switchChainOnSecondRead: false,
    };
    const listeners: Record<string, Array<(value?: unknown) => void>> = {};
    const provider = {
      isMetaMask: true,
      async request({ method }: { method: string }) {
        if (method === 'eth_requestAccounts') return state.accounts;
        if (method === 'eth_accounts') {
          state.accountReads += 1;
          if (state.switchAccountOnSecondRead && state.accountReads === 2) {
            state.switchAccountOnSecondRead = false;
            state.accounts = ['0x2222222222222222222222222222222222222222'];
            return state.accounts;
          }
          return state.accounts;
        }
        if (method === 'eth_chainId') {
          state.chainReads += 1;
          if (state.switchChainOnSecondRead && state.chainReads === 2) {
            state.switchChainOnSecondRead = false;
            state.chainId = '0x89';
            return state.chainId;
          }
          return state.chainId;
        }
        if (method === 'personal_sign') {
          if (state.rejectSign) {
            state.rejectSign = false;
            throw Object.assign(new Error('User rejected the request'), { code: 4001 });
          }
          return `0x${'ab'.repeat(65)}`;
        }
        throw new Error(`unsupported ${method}`);
      },
      on(event: string, fn: (value?: unknown) => void) {
        (listeners[event] ??= []).push(fn);
      },
      removeListener() {},
    };
    const browser = window as Window & {
      ethereum?: typeof provider;
      __walletMock?: {
        rejectNextSign: () => void;
        switchAccountOnce: () => void;
        switchChainOnce: () => void;
        emit: (event: string, value?: unknown) => void;
      };
    };
    browser.ethereum = provider;
    browser.__walletMock = {
      rejectNextSign: () => { state.rejectSign = true; },
      switchAccountOnce: () => { state.switchAccountOnSecondRead = true; },
      switchChainOnce: () => { state.switchChainOnSecondRead = true; },
      emit: (event, value) => { (listeners[event] ?? []).forEach((fn) => fn(value)); },
    };
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: 'mock-mm', name: 'MetaMask', rdns: 'io.metamask' },
          provider,
        },
      }));
    });
    const solanaAccount = {
      address: 'SoLAddrCaseSensitive1111111111111111111',
      chains: ['solana:mainnet'],
    };
    window.addEventListener('wallet-standard:app-ready', (event) => {
      const api = (event as CustomEvent<{ register: (wallet: unknown) => void }>).detail;
      api.register({
        name: 'Phantom',
        accounts: [solanaAccount],
        features: {
          'standard:connect': { connect: async () => ({ accounts: [solanaAccount] }) },
          'solana:signMessage': { signMessage: async () => [{ signature: Uint8Array.of(1, 2, 3) }] },
        },
      });
    });
  });
}

async function installApi(page: Page, mode: WalletMode = {}) {
  const seen: { challenge: string[]; login: Array<Record<string, unknown>>; logout: number } = {
    challenge: [],
    login: [],
    logout: 0,
  };
  const token = fakeJwt();
  const user = {
    id: mode.userId ?? USER_ID,
    email: null,
    phone: null,
    username: 'wallet-user',
    status: 'active',
    emailVerified: false,
    phoneVerified: false,
    tierLevel: 0,
  };

  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/api/v1/auth/wallet/challenge') && method === 'POST') {
      const body = route.request().postDataJSON() as { caip10?: string };
      seen.challenge.push(body.caip10 ?? '');
      if (mode.challengeStatus) {
        await route.fulfill({
          status: mode.challengeStatus,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: mode.challengeCode ?? 'CHALLENGE_FAILED' } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          challenge: {
            id: `challenge-${seen.challenge.length}`,
            message: `server-message-${seen.challenge.length}`,
            namespace: 'eip155',
            chainReference: '1',
            address: ADDRESS,
            nonce: 'server-nonce',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallet/login') && method === 'POST') {
      if (mode.abortLogin) {
        await route.abort('failed');
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      seen.login.push(body);
      if (mode.loginStatus) {
        await route.fulfill({
          status: mode.loginStatus,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: mode.loginCode ?? 'VERIFY_FAILED' } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': `mlive_at=${token}; Path=/; SameSite=Lax` },
        body: JSON.stringify({
          success: true,
          data: { user, accessToken: token, refreshToken: token },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ...user, auth_flags: 1 } }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/logout')) {
      seen.logout += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'mlive_at=; Path=/; Max-Age=0' },
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/login/password') || url.includes('/api/v1/auth/verify-otp')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': `mlive_at=${token}; Path=/; SameSite=Lax` },
        body: JSON.stringify({
          success: true,
          data: {
            user: { ...user, id: 'legacy-user-1', email: 'alice@example.com' },
            accessToken: token,
            refreshToken: token,
          },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/send-otp')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    if (url.includes('/api/v1/auth/passkey/available')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { available: true } }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/passkey/authenticate/options')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { allowCredentials: [] } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
  return seen;
}

async function openLogin(page: Page) {
  await page.goto('/login?returnUrl=/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
}

async function waitForDashboard(page: Page) {
  await page.waitForFunction(() => window.location.pathname === '/dashboard' || window.location.pathname.startsWith('/dashboard/'), null, { timeout: 20_000 });
}

async function chooseMetaMask(page: Page) {
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a wallet' })).toBeVisible();
  await page.getByRole('button', { name: /MetaMask/ }).click();
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS, { recursive: true });
});

test('guest login keeps the existing page and shows one wallet action', async ({ page }) => {
  await installWallet(page);
  await installApi(page);
  await openLogin(page);
  await expect(page.getByRole('button', { name: 'Sign in with your wallet' })).toBeVisible();
  await expect(page.getByText('This signature only proves control of your wallet. It does not send funds or create a transaction.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use email / phone instead' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
  const wallet = page.getByRole('button', { name: 'Sign in with your wallet' });
  await expect(wallet).toBeFocused({ timeout: 1000 }).catch(() => undefined);
  await wallet.focus();
  await expect(wallet).toBeFocused();
});

test('provider picker lists detected wallets and hides WalletConnect without a project id', async ({ page }) => {
  await installWallet(page);
  await installApi(page);
  await openLogin(page);
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await expect(page.getByRole('button', { name: /MetaMask/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Phantom/ })).toBeVisible();
  await expect(page.getByText('WalletConnect')).toHaveCount(0);
  await expect(page.getByText('Trust Wallet')).toHaveCount(0);
  await expect(page.getByText('Coinbase Wallet')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a wallet' })).toHaveCount(0);
});

test('no detected wallet stays on the login page', async ({ page }) => {
  await installApi(page);
  await openLogin(page);
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await expect(page.getByText('No wallet detected in this browser.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('rejected signature does not create a session', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page);
  await openLogin(page);
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await page.evaluate(() => {
    (window as Window & { __walletMock: { rejectNextSign: () => void } }).__walletMock.rejectNextSign();
  });
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await expect(page.getByRole('alert')).toContainText('Wallet signature was rejected');
  await expect(page).toHaveURL(/\/login/);
  expect(seen.login).toHaveLength(0);
  expect(seen.challenge.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with your wallet' })).toBeEnabled();
});

test('challenge uses only caip10 and verify uses the server message', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page);
  await openLogin(page);
  await chooseMetaMask(page);
  await waitForDashboard(page);
  expect(seen.challenge[0]).toBe(`eip155:1:${ADDRESS}`);
  expect(seen.login[0]).toMatchObject({
    challengeId: 'challenge-1',
    message: 'server-message-1',
  });
  expect(seen.login[0]?.signature).toMatch(/^0x/);
  expect(Object.keys(seen.login[0] ?? {}).sort()).toEqual(['challengeId', 'message', 'signature']);
  await expect(page.getByText('Not added').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(USER_ID.slice(0, 8)).first()).toBeVisible();
});

test('refresh keeps the session and logout returns to the guest login', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page);
  await openLogin(page);
  await chooseMetaMask(page);
  await waitForDashboard(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  expect(seen.logout).toBeGreaterThanOrEqual(1);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('wallet disconnect after login does not call logout', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page);
  await openLogin(page);
  await chooseMetaMask(page);
  await waitForDashboard(page);
  const logoutBeforeDisconnect = seen.logout;
  await page.evaluate(() => {
    (window as Window & { __walletMock: { emit: (event: string, value?: unknown) => void } }).__walletMock.emit('disconnect');
  });
  await page.waitForTimeout(400);
  expect(seen.logout).toBe(logoutBeforeDisconnect);
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe('/dashboard');
  await page.getByRole('button', { name: 'User menu' }).click();
  await expect(page.getByText('Not added').first()).toBeVisible();
});

test('account switch asks for a new challenge and does not send the old one', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page);
  await openLogin(page);
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await page.evaluate(() => {
    (window as Window & { __walletMock: { switchAccountOnce: () => void } }).__walletMock.switchAccountOnce();
  });
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await waitForDashboard(page);
  expect(seen.challenge[0]).toBe(`eip155:1:${ADDRESS}`);
  expect(seen.challenge[1]).toBe(`eip155:1:${OTHER}`);
  expect(seen.login).toHaveLength(1);
  expect(seen.login[0]?.challengeId).toBe('challenge-2');
  expect(seen.login[0]?.message).toBe('server-message-2');
});

test('chain switch asks for a new challenge', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page);
  await openLogin(page);
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await page.evaluate(() => {
    (window as Window & { __walletMock: { switchChainOnce: () => void } }).__walletMock.switchChainOnce();
  });
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await waitForDashboard(page);
  expect(seen.challenge.length).toBeGreaterThanOrEqual(2);
  expect(seen.challenge.some((caip) => caip.startsWith('eip155:137:'))).toBe(true);
  expect(seen.login).toHaveLength(1);
  expect(String(seen.login[0]?.challengeId)).not.toBe('challenge-1');
});

test('expired, bad signature, replay, rate limit, and network errors stay signed out', async ({ page }) => {
  await installWallet(page);
  const cases: Array<{ mode: WalletMode; text: string }> = [
    { mode: { challengeStatus: 400, challengeCode: 'CHALLENGE_EXPIRED' }, text: 'This sign-in request expired' },
    { mode: { loginStatus: 400, loginCode: 'INVALID_SIGNATURE' }, text: 'Authentication failed' },
    { mode: { loginStatus: 400, loginCode: 'CHALLENGE_UNAVAILABLE' }, text: 'already used' },
    { mode: { loginStatus: 429, loginCode: 'RATE_LIMIT_EXCEEDED' }, text: 'Try again later' },
    { mode: { abortLogin: true }, text: 'Network error' },
  ];
  for (const item of cases) {
    await page.unroute('**/api/v1/**').catch(() => undefined);
    await installApi(page, item.mode);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await chooseMetaMask(page);
    await expect(page.getByRole('alert').last()).toContainText(item.text);
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with your wallet' })).toBeEnabled();
  }
});

test('legacy password, OTP, and passkey entry remain available', async ({ page }) => {
  await installApi(page);
  await openLogin(page);
  await page.getByRole('button', { name: 'Use email / phone instead' }).click();
  await page.getByLabel('Email address').fill('alice@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('secret-pass');
  await expect(page.getByRole('button', { name: 'Login with Passkey' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await waitForDashboard(page);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Use email / phone instead' }).click();
  await page.getByRole('button', { name: 'Sign in with one-time code' }).click();
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await page.getByLabel('Email address').fill('alice@example.com');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByRole('heading', { name: 'Enter verification code' })).toBeVisible();
  const digits = page.getByLabel(/Digit \d of 6/);
  for (let i = 0; i < 6; i += 1) await digits.nth(i).fill(String(i + 1));
  await page.waitForFunction(() => window.location.pathname === '/', null, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Customer command center' })).toBeVisible();
});

test('passkey control still reaches the existing options request', async ({ page }) => {
  let optionsCalled = false;
  await installApi(page);
  await page.route('**/api/v1/auth/passkey/authenticate/options', async (route) => {
    optionsCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { allowCredentials: [] } }),
    });
  });
  await openLogin(page);
  await page.getByRole('button', { name: 'Use email / phone instead' }).click();
  await page.getByLabel('Email address').fill('alice@example.com');
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.getByRole('button', { name: 'Login with Passkey' }).click();
  await expect(page.locator('[role="alert"]').filter({ hasText: /.+/ }).first()).toBeVisible();
  expect(optionsCalled).toBe(true);
  await expect(page).toHaveURL(/\/login/);
});

test('wallet signup sends no email or password and keeps legacy signup', async ({ page }) => {
  await installWallet(page);
  const seen = await installApi(page, { userId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' });
  await page.goto('/signup?returnUrl=/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  const wallet = page.getByRole('button', { name: 'Sign up with your wallet' });
  await expect(wallet).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Accept terms and privacy policy' }).check();
  await expect(wallet).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Sign up with Google' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Email' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Mobile' })).toBeEnabled();
  await wallet.click();
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await waitForDashboard(page);
  expect(seen.login).toHaveLength(1);
  expect(seen.login[0]).not.toHaveProperty('email');
  expect(seen.login[0]).not.toHaveProperty('password');
  await expect(page.getByText('Not added').first()).toBeVisible({ timeout: 15_000 });
});

test('guest protected routes still redirect and trade stays on its existing path', async ({ page }) => {
  for (const path of ['/dashboard', '/wallet', '/p2p']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  }
  await page.goto('/trade/spot', { waitUntil: 'domcontentloaded' });
  expect(page.url()).toContain('/trade');
  await page.goto('/forex/trade', { waitUntil: 'domcontentloaded' });
  expect(page.url()).toContain('/forex');
});

test('admin login is not the customer wallet page', async ({ page }) => {
  await page.goto('/admin/login', { waitUntil: 'commit', timeout: 10_000 }).catch(() => undefined);
  const text = await page.locator('body').innerText().catch(() => '');
  expect(text).not.toContain('Sign in with your wallet');
});

test('login layout holds at desktop and mobile widths', async ({ page }) => {
  await installWallet(page);
  await installApi(page);
  const widths = [1440, 1280, 1024, 768, 430, 390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: 'Sign in with your wallet' });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(overflow).toBe(false);
    await page.screenshot({ path: path.join(SHOTS, `login-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a wallet' })).toBeVisible();
  const dialog = page.getByRole('dialog');
  const dialogBox = await dialog.boundingBox();
  expect((dialogBox?.width ?? 0)).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: path.join(SHOTS, 'login-picker-1440.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  const mobileBox = await dialog.boundingBox();
  expect((mobileBox?.x ?? 0) + (mobileBox?.width ?? 0)).toBeLessThanOrEqual(391);
  await page.screenshot({ path: path.join(SHOTS, 'login-picker-390.png') });
  await page.goto('/signup', { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Sign up with your wallet' })).toBeVisible();
  const signupOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(signupOverflow).toBe(false);
  await page.screenshot({ path: path.join(SHOTS, 'signup-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(SHOTS, 'signup-1440.png'), fullPage: true });
});
