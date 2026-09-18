import assert from 'node:assert/strict';
import { resolveForexCrmSectionAccess } from './crm-client-scope.js';
import type { ForexAdminCrmClientRow } from './crm-clients.js';

/** List/export row redaction mirrors buildForexAdminCrmClientsSnapshotForAdmin. */
function scopeListRow(row: ForexAdminCrmClientRow, adminRole: string): ForexAdminCrmClientRow {
  const access = resolveForexCrmSectionAccess(adminRole);
  const copy = { ...row };
  if (!access.finance) copy.customer_cash_balance = 'REDACTED';
  if (!access.compliance) {
    copy.kyc_status = null;
    copy.kyc_level = null;
    copy.risk_level = 'low';
    copy.risk_flags = [];
  }
  if (!access.trading) copy.open_positions = 0;
  return copy;
}

const sampleRow: ForexAdminCrmClientRow = {
  account_id: 'a1',
  user_id: 'u1',
  email: 'x@y.com',
  phone: null,
  user_status: 'active',
  account_status: 'ACTIVE',
  currency: 'USD',
  customer_cash_balance: '5000',
  open_positions: 2,
  open_orders: 0,
  account_created_at: new Date().toISOString(),
  kyc_status: 'approved',
  kyc_level: 2,
  risk_level: 'high',
  risk_flags: ['pep'],
};

const supportScoped = scopeListRow(sampleRow, 'support');
assert.equal(supportScoped.customer_cash_balance, 'REDACTED');
assert.equal(supportScoped.kyc_status, null);
assert.equal(supportScoped.open_positions, 0);

console.log('crm-clients-export-scope.test.ts: OK');
