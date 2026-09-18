/**
 * Forex Admin API smoke — cert backend ONLY (default :4100).
 * FOREX_CERT_API_BASE=http://127.0.0.1:4100/api/v1/admin
 */
import { test, expect } from '@playwright/test';

const API_ADMIN =
  (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const EMAIL = process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local';
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function adminToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const login = await request.post(`${API_ADMIN}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const body = (await login.json()) as { data?: { accessToken?: string } };
  const token = body.data?.accessToken;
  expect(token && token.length > 20).toBeTruthy();
  return token!;
}

test.describe('Forex Admin cert API smoke', () => {
  test('login + REAL_FOREX off', async ({ request }) => {
    const token = await adminToken(request);
    const cfg = await request.get(`${API_ADMIN}/forex/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cfg.ok()).toBeTruthy();
    const j = (await cfg.json()) as { data?: { runtime?: { realForex?: boolean } } };
    expect(j.data?.runtime?.realForex).toBe(false);
  });

  const readPaths = [
    '/forex/overview',
    '/forex/crm/clients',
    '/forex/crm/clients/CERT_ACC_B',
    '/forex/crm/clients/CERT_ACC_B/360',
    '/forex/crm/leads',
    '/forex/crm/tasks',
    '/forex/crm/pipeline',
    '/forex/account-groups',
    '/forex/orders?limit=5',
    '/forex/positions?limit=5',
    '/forex/executions?limit=5',
    '/forex/dealing/queue',
    '/forex/reporting/snapshot',
    '/forex/risk/control-plane',
    '/forex/partners',
    '/forex/ledger',
    '/forex/controls',
    '/forex/integrations',
    '/forex/journal?limit=5',
    '/forex/audit?limit=5',
    '/forex/search?q=cert',
    '/forex/notifications',
    '/forex/risk/hub',
    '/forex/compliance/cases',
    '/forex/automation/workflows',
    '/forex/finance/requests',
  ];

  for (const p of readPaths) {
    test(`GET ${p}`, async ({ request }) => {
      const token = await adminToken(request);
      const res = await request.get(`${API_ADMIN}${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status(), await res.text()).toBeLessThan(500);
      expect([200, 404]).toContain(res.status());
    });
  }

  test('support denied CRM clients', async ({ request }) => {
    const login = await request.post(`${API_ADMIN}/auth/login`, {
      data: { email: process.env.FOREX_CERT_SUPPORT_EMAIL ?? 'cert_support@cert.local', password: PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const token = ((await login.json()) as { data?: { accessToken?: string } }).data?.accessToken!;
    const res = await request.get(`${API_ADMIN}/forex/crm/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });
});
