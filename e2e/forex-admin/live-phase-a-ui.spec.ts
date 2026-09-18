/**
 * Phase A/B live UI verification — cert admin :3010 → API :4100.
 * Requires rebuilt admin (forex-cert-admin-ui-e2e.sh or next start -p 3010).
 */
import { test, expect } from '@playwright/test';
import { ADMIN_BASE, API, certAdminApiLogin, certAdminUiSession } from './admin-cert-auth';

test.describe('Phase A live UI (browser)', () => {
  test.skip(process.env.FOREX_ADMIN_UI_E2E !== '1', 'Set FOREX_ADMIN_UI_E2E=1');

  test('CRM Home metrics match API and activity timeline visible', async ({ page, request }) => {
    const { accessToken: token } = await certAdminApiLogin(request);
    const homeRes = await request.get(`${API}/forex/crm/home`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(homeRes.ok()).toBeTruthy();
    const home = (await homeRes.json()) as { data: { funnel: { open_leads: number } } };
    const openLeads = home.data.funnel.open_leads;

    const actRes = await request.get(`${API}/forex/crm/activities/recent?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(actRes.ok()).toBeTruthy();
    const actCount = ((await actRes.json()) as { data: { rows: unknown[] } }).data.rows.length;

    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await certAdminUiSession(page, request);
    await page.goto(`${ADMIN_BASE}/forex/crm/home`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByText('CRM home', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Open leads', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(String(openLeads), { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Recent operator activity', { exact: false }).first()).toBeVisible();
    if (actCount > 0) {
      await expect(page.locator('ul li').filter({ hasText: /.+/ }).first()).toBeVisible({ timeout: 10_000 });
    }
    expect(errors.filter((m) => !/hydration/i.test(m))).toEqual([]);
  });

  test('My Clients workspace loads assigned snapshot', async ({ page, request }) => {
    const { accessToken: token } = await certAdminApiLogin(request);
    const ws = await request.get(`${API}/forex/crm/workspace`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ws.ok()).toBeTruthy();

    await certAdminUiSession(page, request);
    await page.goto(`${ADMIN_BASE}/forex/crm/my-clients`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByText('My clients', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/open tasks|assigned|attention/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('CRM Segments and Client 360 tabs render after login', async ({ page, request }) => {
    await certAdminUiSession(page, request);
    await page.goto(`${ADMIN_BASE}/forex/crm/segments`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByText('CRM segments', { exact: false }).first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`${ADMIN_BASE}/forex/crm/clients/CERT_ACC_B`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: 'Trading' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Audit' })).toBeVisible();
  });
});
