import { expect, test, type Page, type Route } from '@playwright/test';

test.describe.configure({ timeout: 60_000 });

const USER_ID = '6f1c0c2e-1111-4111-8111-111111111111';

function fakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    sub: USER_ID,
  })).toString('base64url');
  return `${header}.${payload}.sig`;
}

const factors = {
  activeWalletCount: 1,
  passkeyCount: 1,
  totpEnabled: true,
  hasPassword: false,
  hasEmail: false,
  hasPhone: false,
};

async function installSession(page: Page) {
  await page.context().addCookies([{
    name: 'mlive_at',
    value: fakeJwt(),
    url: 'http://localhost:3000',
  }]);
  await page.addInitScript((userId: string) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: {
          id: userId,
          email: null,
          status: 'active',
          username: 'member',
          role: 'user',
        },
        isAuthenticated: true,
      },
      version: 0,
    }));
  }, USER_ID);
}

async function installApi(page: Page, state: { status: string | null; frozen?: boolean }) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: USER_ID, email: null, status: 'active', username: 'member', role: 'user', auth_flags: 1 },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallets/recovery') && method === 'POST') {
      state.status = 'REQUESTED';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            recovery: {
              id: 'case-1',
              status: 'REQUESTED',
              factor: null,
              replacementMode: 'review',
              lostWalletId: null,
              proposedCaip10: null,
              replacementWalletId: null,
              cooldownUntil: null,
              withdrawalFrozen: false,
              kycStatus: 'approved',
              factors,
              createdAt: '2026-10-02T00:00:00.000Z',
              updatedAt: '2026-10-02T00:00:00.000Z',
            },
          },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallets/recovery') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            recovery: state.status
              ? {
                id: 'case-1',
                status: state.status,
                factor: state.status === 'COOLING_OFF' ? 'second_wallet' : null,
                replacementMode: 'strong',
                lostWalletId: null,
                proposedCaip10: null,
                replacementWalletId: null,
                cooldownUntil: state.status === 'COOLING_OFF' ? '2026-10-03T00:00:00.000Z' : null,
                withdrawalFrozen: Boolean(state.frozen),
                kycStatus: null,
                factors,
                createdAt: '2026-10-02T00:00:00.000Z',
                updatedAt: '2026-10-02T00:00:00.000Z',
              }
              : null,
          },
        }),
      });
      return;
    }
    if (url.includes('/api/v1/auth/wallets') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            wallets: [{
              id: 'w1',
              namespace: 'eip155',
              chainReference: '1',
              address: '0x1111111111111111111111111111111111111111',
              provider: 'MetaMask',
              walletType: 'eoa',
              isPrimary: true,
              isVerified: true,
              verifiedAt: '2026-10-01T00:00:00.000Z',
              linkedAt: '2026-10-01T00:00:00.000Z',
              lastUsedAt: null,
              status: 'active',
            }],
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

test('security center shows recovery factors and opens a request', async ({ page }) => {
  const state: { status: string | null } = { status: null };
  await installSession(page);
  await installApi(page, state);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/security');
  const section = page.getByTestId('wallet-recovery');
  await expect(page.getByRole('heading', { name: 'Account recovery' })).toBeVisible({ timeout: 20_000 });
  await expect(section.getByText('Passkey:')).toBeVisible();
  await expect(section.getByText('Authenticator:')).toBeVisible();
  await expect(page.getByText('Email is a contact channel. It cannot replace a sign-in wallet.')).toBeVisible();
  await expect(page.getByTestId('recovery-status')).toContainText('None');
  await page.getByTestId('lost-wallet').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('It does not replace your wallet immediately')).toBeVisible();
  await page.getByTestId('confirm-recovery').click();
  await expect(page.getByText('Recovery request opened.')).toBeVisible();
  await expect(page.getByTestId('recovery-status')).toContainText('REQUESTED');
});

test('recovery section stays readable across widths', async ({ page }) => {
  await installSession(page);
  await installApi(page, { status: 'COOLING_OFF', frozen: true });
  await page.goto('/dashboard/security');
  await expect(page.getByTestId('wallet-recovery')).toBeVisible({ timeout: 20_000 });
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Account recovery' })).toBeVisible();
    await expect(page.getByText('Withdrawals are paused during recovery protection.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lost wallet?' })).toBeVisible();
  }
});
