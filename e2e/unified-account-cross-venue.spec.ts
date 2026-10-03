/**
 * Mocked-wallet browser proof of one customer account across Crypto and Forex.
 * The injected ethereum provider is not MetaMask, Trust, Coinbase, WalletConnect, or Phantom.
 * API responses are Playwright stubs. They do not prove a live backend or a real signature.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';

test.describe.configure({ timeout: 180_000 });

const ADDRESS = '0x1111111111111111111111111111111111111111';
const USER_ID = '6f1c0c2e-1111-4111-8111-111111111111';
const DEPOSIT = '0xdepos1t00000000000000000000000000000001';
const SHOTS = '/opt/cursor/artifacts/step18-unified-account';

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
    const state = { accounts: ['0x1111111111111111111111111111111111111111'], chainId: '0x1' };
    const provider = {
      isMetaMask: true,
      async request({ method }: { method: string }) {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return state.accounts;
        if (method === 'eth_chainId') return state.chainId;
        if (method === 'personal_sign') return `0x${'ab'.repeat(65)}`;
        throw new Error(`unsupported ${method}`);
      },
      on() {},
      removeListener() {},
    };
    const browser = window as Window & { ethereum?: typeof provider };
    browser.ethereum = provider;
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: { info: { uuid: 'mock-mm', name: 'MetaMask', rdns: 'io.metamask' }, provider },
      }));
    });
  });
}

async function installApi(page: Page, kycRequired: boolean) {
  const token = fakeJwt();
  const user = {
    id: USER_ID,
    email: null,
    phone: null,
    username: 'wallet-user',
    first_name: 'Ada',
    last_name: 'Broker',
    status: 'active',
    emailVerified: false,
    phoneVerified: false,
    tierLevel: 0,
    kycStatus: 'not_submitted',
    kycLevel: 0,
  };
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/auth/wallet/challenge') && method === 'POST') {
      await json({
        success: true,
        challenge: {
          id: 'challenge-1',
          message: 'server-message-1',
          namespace: 'eip155',
          chainReference: '1',
          address: ADDRESS,
          nonce: 'server-nonce',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      });
      return;
    }
    if (url.includes('/auth/wallet/login') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': `mlive_at=${token}; Path=/; SameSite=Lax` },
        body: JSON.stringify({ success: true, data: { user, accessToken: token, refreshToken: token } }),
      });
      return;
    }
    if (url.includes('/auth/refresh') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': `mlive_at=${token}; Path=/; SameSite=Lax` },
        body: JSON.stringify({ success: true, data: { accessToken: token, refreshToken: token } }),
      });
      return;
    }
    if (url.includes('/auth/logout')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-cookie': 'mlive_at=; Path=/; Max-Age=0' },
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    if (url.includes('/auth/wallets') && method === 'GET' && !url.includes('/link')) {
      await json({
        success: true,
        data: {
          wallets: [{
            id: 'wallet-1',
            namespace: 'eip155',
            chainReference: '1',
            address: ADDRESS,
            provider: 'mock',
            walletType: 'eoa',
            isPrimary: true,
            isVerified: true,
            verifiedAt: '2026-01-01T00:00:00.000Z',
            linkedAt: '2026-01-01T00:00:00.000Z',
            lastUsedAt: '2026-01-01T00:00:00.000Z',
            status: 'active',
          }],
        },
      });
      return;
    }
    if (url.includes('/auth/wallet-cutover')) {
      await json({
        success: true,
        data: { mode: 'WALLET_ONLY', walletPrimary: true, legacyEntryAvailable: false },
      });
      return;
    }
    if (url.includes('/auth/me') || url.includes('/auth/profile')) {
      await json({ success: true, data: url.includes('/profile') ? { user } : { ...user, auth_flags: 1 } });
      return;
    }
    if (url.includes('/wallet/balances/summary')) {
      await json({
        success: true,
        data: {
          fundingBalance: { totalUsd: 12.5, balances: [] },
          tradingBalance: { totalUsd: 3.25, balances: [] },
        },
      });
      return;
    }
    if (url.includes('/forex/accounts/live-opening/eligibility') || url.includes('/forex/live/eligibility')) {
      await json({
        success: true,
        data: {
          source: 'SIMULATED',
          realForex: false,
          liveAccountOpeningAvailable: false,
          applicationAccepted: true,
          kycRequired,
          kycVerified: false,
          kycStatus: 'not_submitted',
          blockers: ['Broker provisioning not configured'],
          reason: 'PROVIDER_OR_RAIL_BLOCKED',
          message: 'Live Forex account opening remains gated until broker rails are configured.',
        },
      });
      return;
    }
    if (url.includes('/forex/accounts') && method === 'GET') {
      await json({
        success: true,
        data: {
          source: 'SIMULATED',
          executionMode: 'MOCK',
          realForex: false,
          activeAccountId: 'fx-demo-1',
          count: 1,
          accounts: [{
            accountId: 'fx-demo-1',
            userId: USER_ID,
            accountKind: 'DEMO',
            currency: 'USD',
            status: 'ACTIVE',
            label: 'Demo USD',
            tradingLogin: 'fx-demo-1',
            createdAt: '2026-01-01T00:00:00.000Z',
          }],
        },
      });
      return;
    }
    if (url.includes('/forex/live/readiness')) {
      await json({
        success: true,
        data: {
          liveForexReady: false,
          blockers: [],
          capabilities: { liveAccountApplication: true, liveAccountProvisioning: false },
        },
      });
      return;
    }
    if (url.includes('/wallet/tokens') && url.includes('/chains')) {
      await json({
        success: true,
        data: [{
          id: 'chain-eth',
          id_text: 'ethereum',
          name: 'Ethereum',
          type: 'evm',
          native_currency: 'ETH',
          confirmations_required: 12,
        }],
      });
      return;
    }
    if (url.includes('/wallet/tokens')) {
      await json({
        success: true,
        data: [{ id: 'token-usdt', symbol: 'USDT', name: 'Tether', decimals: 6, is_native: false }],
      });
      return;
    }
    if (url.includes('/wallet/deposit-address/')) {
      await json({
        success: true,
        data: {
          address: DEPOSIT,
          chain: { id: 'chain-eth', name: 'Ethereum', type: 'evm', confirmationsRequired: 12, explorerUrl: '' },
          qrCodeData: DEPOSIT,
          notice: 'Exchange deposit address',
        },
      });
      return;
    }
    if (url.includes('/wallet/deposit-history') || url.includes('/wallet/deposits')) {
      await json({ success: true, data: [] });
      return;
    }
    if (url.includes('/wallet/kyc-status')) {
      await json({ success: true, data: { verified: false, status: 'not_submitted', level: 0 } });
      return;
    }
    if (url.includes('/wallet/withdrawal-limits')) {
      await json({
        success: true,
        data: {
          vipLevel: 0,
          daily: { limit: 1000, used: 0, remaining: 1000, percentage: 0 },
          monthly: { limit: 10000, used: 0, remaining: 10000, percentage: 0 },
        },
      });
      return;
    }
    if (url.includes('/wallet/withdrawals') || url.includes('/auth/withdrawal-addresses')) {
      await json({ success: true, data: url.includes('withdrawal-addresses') ? { addresses: [] } : [] });
      return;
    }
    await json({ success: true, data: {} });
  });
}

async function signIn(page: Page) {
  await page.goto('/login?returnUrl=/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Sign in with your wallet' })).toBeVisible();
  await expect(page.getByText('This signature only proves control of your wallet. It does not send funds or create a transaction.')).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Password' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in with your wallet' }).click();
  await page.getByRole('button', { name: /MetaMask/ }).click();
  await page.waitForFunction(
    () => window.location.pathname === '/dashboard' || window.location.pathname.startsWith('/dashboard/'),
    null,
    { timeout: 20_000 },
  );
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS, { recursive: true });
});

test('wallet-only customer keeps one account across crypto and forex', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installWallet(page);
  await installApi(page, false);
  await signIn(page);
  await expect(page.getByText('Estimated crypto & fiat').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Crypto funding').first()).toBeVisible();
  await expect(page.getByText(USER_ID.slice(0, 8)).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/desktop-dashboard.png`, fullPage: false });

  await page.getByRole('link', { name: 'Forex', exact: true }).first().click();
  await page.waitForURL(/\/forex/, { timeout: 20_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/forex/account/accounts', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Exchange account').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Same customer as Crypto').first()).toBeVisible();
  await expect(page.getByText(USER_ID).first()).toBeVisible();
  await expect(page.getByText('A password is not a sign-in method')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/desktop-forex-accounts.png`, fullPage: false });

  await page.getByRole('link', { name: 'Profile', exact: true }).first().click();
  await page.waitForURL(/\/dashboard\/account/, { timeout: 20_000 });
  await expect(page.getByText('One exchange account for Crypto and Forex').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/desktop-profile.png`, fullPage: false });

  await page.goto('/dashboard/security', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sign-in wallets' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Wallets you can use to sign in. Linking a wallet does not move funds.')).toBeVisible();
  await expect(page.getByText('Primary').first()).toBeVisible();
  await expect(page.getByText('A password is not a sign-in method. Sign in with your wallet.')).toBeVisible();
  await expect(page.getByText('Used for account login')).toHaveCount(0);
  await expect(page.getByText('Your Deposit Wallet')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/desktop-security.png`, fullPage: false });

  await page.goto('/dashboard/identity', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('This verification belongs to your exchange account').first()).toBeVisible({ timeout: 15_000 });

  await page.goto('/forex/account/accounts/open-live', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Identity verification is optional for Forex').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/desktop-forex-kyc-off.png`, fullPage: false });

  await page.unroute('**/api/v1/**');
  await installApi(page, true);
  await page.goto('/forex/account/accounts/open-live', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Identity verification required').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Complete verification' }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/desktop-forex-kyc-on.png`, fullPage: false });

  await page.goto('/wallet/deposit/crypto', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/not your sign-in wallet/i).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /USDT/ }).click();
  await expect(page.getByText(DEPOSIT).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(ADDRESS)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/desktop-deposit.png`, fullPage: false });

  await page.goto('/wallet/withdraw/crypto', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Send assets to an external wallet/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Wallet Address').first()).toBeVisible();
  await expect(page.getByText(ADDRESS)).toHaveCount(0);
  await expect(page.getByText(DEPOSIT)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/desktop-withdraw.png`, fullPage: false });

  for (const [width, height, name] of [
    [1280, 800, '1280'],
    [1024, 768, '1024'],
    [768, 1024, 'tablet'],
    [390, 844, '390'],
    [375, 812, '375'],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Estimated crypto & fiat').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Spot orders. Not Forex margin.').first()).toBeVisible();
    await expect(page.getByText('USDT USDT')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/login/);
    await page.screenshot({ path: `${SHOTS}/${name}-dashboard.png`, fullPage: false });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(USER_ID.slice(0, 8)).first()).toBeVisible();
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await signIn(page);
  await expect(page.getByText(USER_ID.slice(0, 8)).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/desktop-returning.png`, fullPage: false });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Estimated crypto & fiat').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/tablet-dashboard.png`, fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/forex/account/accounts', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Exchange account').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/mobile-forex-account.png`, fullPage: false });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/login/);
  await page.screenshot({ path: `${SHOTS}/mobile-dashboard.png`, fullPage: false });
});
