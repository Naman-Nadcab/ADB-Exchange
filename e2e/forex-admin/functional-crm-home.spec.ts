import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'cert_maker@cert.local', password: PASSWORD },
  });
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('CRM home and workspace snapshots', async ({ request }) => {
  const t = await token(request);
  const home = await request.get(`${API}/forex/crm/home`, { headers: { Authorization: `Bearer ${t}` } });
  expect(home.ok()).toBeTruthy();
  const hj = (await home.json()) as { data: { funnel: { by_stage: unknown[] } } };
  expect(Array.isArray(hj.data.funnel.by_stage)).toBeTruthy();

  const ws = await request.get(`${API}/forex/crm/workspace`, { headers: { Authorization: `Bearer ${t}` } });
  expect(ws.ok()).toBeTruthy();
});
