import { expect, test, type Page, type Route } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });

const USER_ID = '6f1c0c2e-1111-4111-8111-111111111111';
const PRIMARY = '0x1111111111111111111111111111111111111111';
const SECONDARY = '0x2222222222222222222222222222222222222222';
const ADDED = '0x3333333333333333333333333333333333333333';

function fakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    sub: USER_ID,
  })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function wallet(partial: Record<string, unknown>) {
  return {
    id: 'w1',
    namespace: 'eip155',
    chainReference: '1',
    address: PRIMARY,
    provider: 'MetaMask',
    walletType: 'eoa',
    isPrimary: true,
    isVerified: true,
    verifiedAt: '2026-10-01T00:00:00.000Z',
    linkedAt: '2026-10-01T00:00:00.000Z',
    lastUsedAt: '2026-10-02T00:00:00.000Z',
    status: 'active',
    ...partial,
  };
}

async function installSession(page: Page, account: string) {
  await page.context().addCookies([{
    name: 'mlive_at',
    value: fakeJwt(),
    url: 'http://localhost:3000',
  }]);
  await page.addInitScript((address: string) => {
    const state = { accounts: [address], chainId: '0x1' };
    const provider = {
      isMetaMask: true,
      async request({ method }: { method: string }) {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return state.accounts;
        if (method === 'eth_chainId') return state.chainId;
        if (method === 'personal_sign' || method === 'eth_signTypedData_v4') return `0x${'ab'.repeat(65)}`;
        throw new Error(`unsupported ${method}`);
      },
      on() {},
      removeListener() {},
    };
    const browser = window as Window & { ethereum?: typeof provider };
    browser.ethereum = provider;
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: 'mock-mm', name: 'MetaMask', rdns: 'io.metamask' },
          provider,
        },
      }));
    });
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: {
          id: '6f1c0c2e-1111-4111-8111-111111111111',
          email: 'member@example.com',
          status: 'active',
          username: 'member',
          role: 'user',
        },
        isAuthenticated: true,
      },
      version: 0,
    }));
  }, account);
}

async function installApi(page: Page, mode: { failLink?: boolean } = {}) {
  let linked = false;
  const rows = [
    wallet({ id: 'w1', address: PRIMARY, isPrimary: true, status: 'active', provider: 'MetaMask' }),
    wallet({ id: 'w2', address: SECONDARY, isPrimary: false, status: 'active', provider: null }),
    wallet({ id: 'w3', address: '0x4444444444444444444444444444444444444444', isPrimary: false, status: 'disabled', provider: null }),
  ];
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: USER_ID, email: 'member@example.com', status: 'active', username: 'member', role: 'user', auth_flags: 1 },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallets/link/challenge') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          challenge: {
            id: '11111111-1111-4111-8111-111111111111',
            message: 'link-this-wallet',
            namespace: 'eip155',
            chainReference: '1',
            address: ADDED,
            expiresAt: '2026-10-02T10:10:00Z',
            signing: 'personal',
          },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallets/link/verify') && method === 'POST') {
      if (mode.failLink) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'WALLET_UNAVAILABLE', message: 'This wallet cannot be linked.' } }),
        });
        return;
      }
      linked = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { wallet: wallet({ id: 'w4', address: ADDED, isPrimary: false }), alreadyLinked: false } }),
      });
      return;
    }
    if (url.includes('/step-up') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          challenge: {
            id: '22222222-2222-4222-8222-222222222222',
            message: '{"domain":{"name":"Fintech Digital Market","version":"1","chainId":1,"verifyingContract":"0x0000000000000000000000000000000000000000"},"types":{"WalletAction":[]},"primaryType":"WalletAction","message":{}}',
            signing: 'typed_data',
            address: SECONDARY,
          },
        }),
      });
      return;
    }
    if (url.includes('/primary') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { wallet: wallet({ id: 'w2', address: SECONDARY, isPrimary: true }) } }),
      });
      return;
    }
    if (url.includes('/unlink') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { wallet: wallet({ id: 'w2', address: SECONDARY, isPrimary: false, status: 'disabled' }) } }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallets') && method === 'GET') {
      const list = linked
        ? [...rows, wallet({ id: 'w4', address: ADDED, isPrimary: false, provider: 'MetaMask' })]
        : rows;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { wallets: list } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { notifications: [], verified: false, enabled: false, passkeys: [], hasFundPassword: false, code: '' } }),
    });
  });
}

test('security page lists wallets and adds one', async ({ page }) => {
  await installSession(page, ADDED);
  await installApi(page);
  await page.goto('/dashboard/security');
  await expect(page.getByRole('heading', { name: 'Sign-in wallets' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('0x1111…1111')).toBeVisible();
  await expect(page.getByText('Primary').first()).toBeVisible();
  await expect(page.getByText('Disabled').first()).toBeVisible();
  await expect(page.getByText('Linking a wallet does not move funds.')).toBeVisible();
  await page.getByTestId('add-wallet').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await expect(page.getByText('Wallet added to your sign-in methods.')).toBeVisible();
  await expect(page.getByText('0x3333…3333')).toBeVisible();
});

test('set primary and remove wallet show the action before signing', async ({ page }) => {
  await installSession(page, SECONDARY);
  await installApi(page);
  await page.goto('/dashboard/security');
  await expect(page.getByRole('heading', { name: 'Sign-in wallets' })).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('set-primary').click();
  await expect(page.getByText(/Confirm setting wallet 0x2222…2222 as your primary sign-in wallet/)).toBeVisible();
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await expect(page.getByText('Primary sign-in wallet updated.')).toBeVisible();

  const secondary = page.getByTestId('wallet-row').filter({ hasText: '0x2222…2222' });
  await secondary.getByTestId('unlink-wallet').click();
  await expect(page.getByText(/Confirm removing wallet 0x2222…2222/)).toBeVisible();
  await expect(page.getByText('Removing a login wallet does not remove funds.')).toBeVisible();
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await expect(page.getByText('Wallet removed from sign-in. Your funds are unchanged.')).toBeVisible();
});

test('link error stays on the security page', async ({ page }) => {
  await installSession(page, ADDED);
  await installApi(page, { failLink: true });
  await page.goto('/dashboard/security');
  await expect(page.getByTestId('add-wallet')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-wallet').click();
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This wallet cannot be linked.' })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/security/);
});

test('wallet section stays inside the viewport widths', async ({ page }) => {
  await installSession(page, PRIMARY);
  await installApi(page);
  await page.goto('/dashboard/security');
  await expect(page.getByTestId('wallet-management')).toBeVisible({ timeout: 20_000 });
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const section = page.getByTestId('wallet-management');
    await expect(section).toBeVisible();
    const overflow = await section.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('add-wallet')).toBeVisible();
  }
});
