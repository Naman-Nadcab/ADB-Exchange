import assert from 'node:assert/strict';
import { hasForexAdminPermission } from './forex-admin-rbac.js';
import { evaluateAdminRouteRbac, hasAdminRbacPermission } from './admin-rbac-routes.js';

function run(): void {
  assert.equal(hasAdminRbacPermission('risk_manager', 'forex:controls:manage'), true);
  assert.equal(hasAdminRbacPermission('risk_manager', 'forex:control'), true);
  assert.equal(hasAdminRbacPermission('finance_ops', 'forex:controls:manage'), false);

  assert.equal(hasForexAdminPermission('risk_manager', 'forex:crm:view'), true);
  assert.equal(hasForexAdminPermission('compliance', 'forex:compliance:view'), true);
  assert.equal(hasForexAdminPermission('support', 'forex:crm:view'), false);

  const write = evaluateAdminRouteRbac('risk_manager', 'PATCH', '/forex/controls');
  assert.equal(write.allowed, true);
  const deny = evaluateAdminRouteRbac('finance_ops', 'PATCH', '/forex/controls');
  assert.equal(deny.allowed, false);

  console.log('forex-admin-rbac.test.ts PASS');
}

run();
