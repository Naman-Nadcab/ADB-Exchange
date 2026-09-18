/**
 * Functional API — compliance case lifecycle (cert :4100).
 */
import { test, expect } from '@playwright/test';

const API = (process.env.FOREX_CERT_API_BASE ?? 'http://127.0.0.1:4100/api/v1/admin').replace(/\/$/, '');
const PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD ?? 'CertAdmin1!';

async function token(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: process.env.FOREX_CERT_MAKER_EMAIL ?? 'cert_maker@cert.local', password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  return ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
}

test('compliance case open → in_review → closed', async ({ request }) => {
  const t = await token(request);
  const summary = `Functional compliance case ${Date.now()}`;
  const create = await request.post(`${API}/forex/compliance/cases`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { subject_type: 'ACCOUNT', subject_id: 'CERT_ACC_B', case_type: 'MANUAL_REVIEW', summary },
  });
  expect(create.status()).toBe(200);
  const caseId = ((await create.json()) as { data: { case_id: string } }).data.case_id;

  const review = await request.patch(`${API}/forex/compliance/cases/${caseId}/status`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { status: 'IN_REVIEW', note: `Review started ${Date.now()}` },
  });
  expect(review.ok()).toBeTruthy();

  const close = await request.patch(`${API}/forex/compliance/cases/${caseId}/status`, {
    headers: { Authorization: `Bearer ${t}` },
    data: { status: 'CLOSED', note: `Closed functional test ${Date.now()}` },
  });
  expect(close.ok()).toBeTruthy();
});
