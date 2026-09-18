import assert from 'node:assert/strict';
import { hasForexAdminPermission } from '../../../lib/forex-admin-rbac.js';

function run(): void {
  assert.equal(hasForexAdminPermission('support', 'forex:crm:view'), false);
  assert.equal(hasForexAdminPermission('kyc_reviewer', 'forex:finance:view'), false);

  assert.equal(hasForexAdminPermission('compliance', 'forex:compliance:view'), true);
  assert.equal(hasForexAdminPermission('compliance', 'forex:crm:view'), true);

  assert.equal(hasForexAdminPermission('finance_ops', 'forex:finance:view'), true);
  assert.equal(hasForexAdminPermission('finance_ops', 'forex:controls:manage'), false);

  assert.equal(hasForexAdminPermission('risk_manager', 'forex:orders:view'), true);
  assert.equal(hasForexAdminPermission('risk_manager', 'forex:accounts:manage'), false);

  console.log('crm-client-360-scoping.test.ts PASS');
}

run();
