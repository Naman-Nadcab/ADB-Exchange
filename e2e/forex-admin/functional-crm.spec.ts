import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'cert_maker@cert.local', password: PASSWORD },
  });
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('CRM lead create and convert', async ({ request }) => {
  const t = await token(request);
  const email = `fn-crm-${Date.now()}@cert.local`;
  const ref = String(Date.now()).slice(-9);
  execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -c "INSERT INTO users (email, password_hash, referral_code, status, email_verified) VALUES ('${email}','x','${ref}','active',true) ON CONFLICT (email) DO NOTHING"`,
  );
  const create = await request.post(`${API}/forex/crm/leads`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { email, full_name: 'Functional CRM', stage_id: 'new' },
  });
  expect(create.ok()).toBeTruthy();
  const cj = (await create.json()) as { data: { lead?: { lead_id: string }; lead_id?: string } };
  const leadId = cj.data.lead?.lead_id ?? cj.data.lead_id!;
  const conv = await request.post(`${API}/forex/crm/leads/${leadId}/convert`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { reason: `Functional CRM convert ${Date.now()}` },
  });
  expect(conv.ok()).toBeTruthy();
  const accountId = ((await conv.json()) as { data: { account_id: string } }).data.account_id;
  expect(accountId.length).toBeGreaterThan(3);
});

test('CRM segments list and VIP detail', async ({ request }) => {
  const t = await token(request);
  const list = await request.get(`${API}/forex/crm/segments`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(list.ok()).toBeTruthy();
  const lj = (await list.json()) as { data: { rows: Array<{ segment_id: string }> } };
  expect(lj.data.rows.length).toBeGreaterThan(0);
  const detail = await request.get(`${API}/forex/crm/segments/vip`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(detail.ok()).toBeTruthy();
});
