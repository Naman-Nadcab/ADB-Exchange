import { expect, type APIRequestContext, type Page } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const ADMIN_BASE = (process.env.FOREX_ADMIN_UI_BASE ?? 'http://127.0.0.1:3010/admin').replace(/\/$/, '');
const EMAIL = process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local';
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

export async function certAdminApiLogin(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const body = (await login.json()) as {
    data: { accessToken: string; admin: { id: string; email: string; name: string; role: string; permissions?: string[] } };
  };
  return body.data;
}

/** Seed Zustand persist store so protected Forex routes load without flaky form login. */
export async function certAdminUiSession(page: Page, request: APIRequestContext) {
  const { accessToken, admin } = await certAdminApiLogin(request);
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ accessToken, admin }) => {
      localStorage.setItem(
        'admin-auth',
        JSON.stringify({
          state: { accessToken, admin },
          version: 0,
        }),
      );
    },
    { accessToken, admin },
  );
  await page.goto(`${ADMIN_BASE}/forex`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForURL(/\/admin\/forex/, { timeout: 45_000 });
}

export { ADMIN_BASE, API, EMAIL, PASSWORD };
