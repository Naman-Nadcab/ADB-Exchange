import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'cert_maker@cert.local', password: PASSWORD },
  });
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('dealer accept records MOCK dealing action', async ({ request }) => {
  const orderId = randomUUID();
  const clientId = `fn-deal-${Date.now()}`;
  execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -c "INSERT INTO forex_orders (order_id, client_order_id, client_exec_id, account_id, fingerprint, symbol, side, order_type, requested_volume, remaining_volume, status, execution_mode) VALUES ('${orderId}', '${clientId}', '${clientId}-exec', 'CERT_ACC_B', 'fp-${clientId}', 'EURUSD', 'buy', 'market', 0.01, 0.01, 'PENDING', 'MOCK')"`,
  );

  const t = await token(request);
  const accept = await request.post(`${API}/forex/dealing/orders/${orderId}/accept`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { reason: 'Functional dealer accept MOCK' },
  });
  expect(accept.ok()).toBeTruthy();

  const actions = await request.get(`${API}/forex/dealing/orders/${orderId}/actions`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(actions.ok()).toBeTruthy();
  const body = (await actions.json()) as { data: { actions: Array<{ action: string }> } };
  expect(body.data.actions.some((a) => a.action === 'ACCEPT')).toBeTruthy();
});
