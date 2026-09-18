import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'cert_maker@cert.local', password: PASSWORD },
  });
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('reporting snapshot honors from/to query range', async ({ request }) => {
  const t = await token(request);
  const from = '2026-01-01T00:00:00.000Z';
  const to = '2026-01-31T23:59:59.999Z';
  const res = await request.get(`${API}/forex/reporting/snapshot?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: { time_range: { from: string; to: string }; metrics: unknown[] } };
  expect(new Date(body.data.time_range.from).getTime()).toBeLessThanOrEqual(new Date(from).getTime() + 86400000);
  expect(Array.isArray(body.data.metrics)).toBeTruthy();
});
