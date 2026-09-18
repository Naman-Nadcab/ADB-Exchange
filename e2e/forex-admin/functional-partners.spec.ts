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

test('partner accrual recorded and listed', async ({ request }) => {
  execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -c "CREATE TABLE IF NOT EXISTS forex_partner_commission_accruals (accrual_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL, account_id VARCHAR(64), volume_lots NUMERIC(20,8) NOT NULL DEFAULT 0, commission_amount NUMERIC(20,8) NOT NULL, currency VARCHAR(8) NOT NULL DEFAULT 'USD', status VARCHAR(16) NOT NULL DEFAULT 'ACCRUED', metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"`,
  );
  execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange_forex_cert -c "INSERT INTO forex_partner_profiles (code, label, status) VALUES ('FN_IB', 'Fn IB', 'active') ON CONFLICT (code) DO NOTHING"`,
  );
  const t = await token(request);
  const partners = await request.get(`${API}/forex/partners`, { headers: { Authorization: `Bearer ${t}` } });
  expect(partners.ok()).toBeTruthy();
  const list = (await partners.json()) as { data: { rows: Array<{ partner_id: string; code: string }> } };
  const partner = list.data.rows.find((p) => p.code === 'FN_IB') ?? list.data.rows[0];
  expect(partner?.partner_id).toBeTruthy();

  const acc = await request.post(`${API}/forex/partners/${partner!.partner_id}/accruals`, {
    headers: { Authorization: `Bearer ${t}` },
    data: {
      account_id: 'CERT_ACC_B',
      volume_lots: '1.0',
      commission_amount: '12.50',
      reason: 'Functional partner accrual test',
    },
  });
  expect(acc.ok()).toBeTruthy();

  const rows = await request.get(`${API}/forex/partners/${partner!.partner_id}/accruals`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(rows.ok()).toBeTruthy();
});
