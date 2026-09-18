import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'cert_maker@cert.local', password: PASSWORD },
  });
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('holiday calendar upsert configures coverage', async ({ request }) => {
  const t = await token(request);
  const date = '2030-12-25';
  const up = await request.post(`${API}/forex/holidays`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { date, kind: 'holiday', notes: 'Functional test holiday' },
  });
  expect(up.ok()).toBeTruthy();
  const list = await request.get(`${API}/forex/holidays`, { headers: { Authorization: `Bearer ${t}` } });
  const body = (await list.json()) as { data: { state: { coverage: string }; rows: Array<{ calendar_date: string }> } };
  expect(body.data.state.coverage).toBe('CONFIGURED');
  expect(body.data.rows.some((r) => r.calendar_date.startsWith(date))).toBeTruthy();
  await request.delete(`${API}/forex/holidays/${date}`, { headers: { Authorization: `Bearer ${t}` } });
});
