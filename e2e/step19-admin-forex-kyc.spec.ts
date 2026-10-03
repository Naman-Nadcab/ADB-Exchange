/**
 * Real admin-panel UI against the isolated API. No route stubs.
 * STEP19_ADMIN_PHASE=off | persisted-off | on | persisted-on
 */
import { expect, test } from '@playwright/test';

const phase = process.env.STEP19_ADMIN_PHASE ?? 'off';
const email = process.env.STEP19_ADMIN_EMAIL ?? 'step19-admin@isolated.test';
const password = process.env.STEP19_ADMIN_PASSWORD ?? 'Step19-admin-pass';

test('admin forex kyc browser ' + phase, async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#__next-route-announcer__');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await expect(page.locator('#email')).toHaveValue(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const err = page.locator('p[role="alert"]');
  await Promise.race([
    page.waitForURL(/\/(control-center|dashboard|forex)/, { timeout: 25_000 }),
    err.waitFor({ state: 'visible', timeout: 25_000 }).then(async () => {
      throw new Error('admin login failed: ' + (await err.innerText()));
    }),
  ]);
  await page.goto('/admin/forex/controls', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Forex KYC policy')).toBeVisible({ timeout: 45_000 });
  const row = page
    .locator('div')
    .filter({ has: page.getByText('Forex KYC required', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: /^Turn (ON|OFF)$/ }) })
    .last();
  if (phase === 'compliance') {
    const turn = row.getByRole('button', { name: /^Turn (ON|OFF)$/ });
    await expect(turn).toBeVisible();
    await expect(turn).toBeDisabled();
    expect(await page.getByText('Requires forex:control permission (current role: Compliance)').count()).toBeGreaterThan(0);
    return;
  }

  if (phase === 'persisted-off') {
    await expect(page.getByText('OFF', { exact: true }).first()).toBeVisible();
    return;
  }
  if (phase === 'persisted-on') {
    await expect(page.getByText('ON', { exact: true }).first()).toBeVisible();
    return;
  }

  async function setRequired(requiredOn: boolean): Promise<void> {
    const button = row.getByRole('button', { name: /^Turn (ON|OFF)$/ });
    const label = (await button.innerText()).trim();
    const want = requiredOn ? 'Turn ON' : 'Turn OFF';
    if (label !== want) {
      await expect(row.getByText(requiredOn ? 'ON' : 'OFF', { exact: true })).toBeVisible();
      return;
    }
    await button.click();
    await page.getByPlaceholder('Ops ticket or incident reference').fill(
      requiredOn ? 'step19 isolated forex kyc on' : 'step19 isolated forex kyc off'
    );
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(row.getByText(requiredOn ? 'ON' : 'OFF', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(row.getByRole('button', { name: requiredOn ? 'Turn OFF' : 'Turn ON' })).toBeVisible();
  }

  if (phase === 'off') {
    const label = (await row.getByRole('button', { name: /^Turn (ON|OFF)$/ }).innerText()).trim();
    if (label === 'Turn ON') await setRequired(true);
    await setRequired(false);
  } else {
    await setRequired(true);
  }
});
