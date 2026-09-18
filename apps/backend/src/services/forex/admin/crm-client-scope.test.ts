import assert from 'node:assert/strict';
import { resolveForexCrmSectionAccess, scopeForexCrmClientDetail } from './crm-client-scope.js';
import type { ForexAdminCrmClientDetail } from './crm-clients.js';

const sample: ForexAdminCrmClientDetail = {
  account_id: 'u1',
  user_id: 'u1',
  email: 'a@b.com',
  phone: null,
  user_status: 'active',
  email_verified: true,
  account_status: 'ACTIVE',
  currency: 'USD',
  customer_cash_balance: '1000.00',
  open_orders: 2,
  open_positions: 1,
  account_created_at: new Date().toISOString(),
  kyc_status: 'approved',
  kyc_level: 2,
  risk_level: 'high',
  risk_flags: ['AML'],
  recent_journal: [{ id: '1', severity: 'info', event_type: 'x', message: 'm', created_at: new Date().toISOString() }],
};

function run(): void {
  const supportAccess = resolveForexCrmSectionAccess('support');
  assert.equal(supportAccess.finance, false);
  assert.equal(supportAccess.compliance, false);

  const scoped = scopeForexCrmClientDetail(sample, supportAccess);
  assert.equal(scoped.customer_cash_balance, 'REDACTED');
  assert.equal(scoped.kyc_status, null);
  assert.equal(scoped.open_orders, 0);

  const complianceAccess = resolveForexCrmSectionAccess('compliance');
  assert.equal(complianceAccess.compliance, true);
  const scopedC = scopeForexCrmClientDetail(sample, complianceAccess);
  assert.equal(scopedC.kyc_status, 'approved');
  assert.equal(scopedC.customer_cash_balance, 'REDACTED');

  console.log('crm-client-scope.test.ts PASS');
}

run();
