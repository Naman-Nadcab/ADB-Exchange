import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'cert_maker@cert.local', password: PASSWORD },
  });
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('automation workflow create, enable, dry-run', async ({ request }) => {
  const t = await token(request);
  const code = `FN_AUTO_${Date.now()}`;
  const create = await request.post(`${API}/forex/automation/workflows`, {
    headers: { Authorization: `Bearer ${t}` },
    data: {
      code,
      name: 'Functional automation',
      trigger_type: 'account_status_change',
      actions: [{ type: 'notify', title: 'Fn test', body: 'dry-run', severity: 'info' }],
    },
  });
  expect(create.ok()).toBeTruthy();
  const wfId = ((await create.json()) as { data: { workflow_id: string } }).data.workflow_id;

  const en = await request.patch(`${API}/forex/automation/workflows/${wfId}/enabled`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { enabled: true },
  });
  expect(en.ok()).toBeTruthy();

  const dry = await request.post(`${API}/forex/automation/workflows/${wfId}/dry-run`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { sample_payload: { account_id: 'CERT_ACC_A', previous_status: 'ACTIVE', next_status: 'RESTRICTED' } },
  });
  expect(dry.ok()).toBeTruthy();
});
