/**
 * Admin domain workspace vs capability — run: npx tsx src/lib/admin/admin-domain.test.ts
 */
import assert from 'node:assert/strict';
import {
  canAccessAdminDomain,
  canAccessAdminPath,
  canAccessCryptoWorkspace,
  visibleAdminDomains,
} from './admin-domain.js';

function run(): void {
  const approver = { role: 'withdrawal_approver', perms: undefined as string[] | undefined };

  assert.equal(canAccessCryptoWorkspace(approver.role, approver.perms), false, 'approver must not get Crypto workspace');
  assert.equal(canAccessAdminDomain(approver.role, approver.perms, 'control'), true);
  assert.equal(canAccessAdminDomain(approver.role, approver.perms, 'crypto'), false);
  assert.equal(canAccessAdminPath(approver.role, approver.perms, '/withdrawals'), true, 'approver may reach withdrawals capability route');
  assert.equal(canAccessAdminPath(approver.role, approver.perms, '/trading'), false);
  assert.deepEqual(visibleAdminDomains(approver.role, approver.perms), ['control']);

  const finance = { role: 'finance_ops', perms: undefined };
  assert.equal(canAccessCryptoWorkspace(finance.role, finance.perms), true);
  assert.equal(canAccessAdminPath(finance.role, finance.perms, '/forex/orders'), true, 'finance_ops has forex:view');

  const support = { role: 'support', perms: undefined };
  assert.equal(canAccessAdminDomain(support.role, support.perms, 'crypto'), true);
  assert.equal(canAccessAdminDomain(support.role, support.perms, 'forex'), false);
  assert.equal(canAccessAdminPath(support.role, support.perms, '/forex/orders'), false);

  const compliance = { role: 'compliance', perms: undefined };
  assert.equal(canAccessAdminDomain(compliance.role, compliance.perms, 'forex'), true);
  assert.equal(canAccessAdminDomain(compliance.role, compliance.perms, 'crypto'), true, 'compliance has monitoring:view → Crypto workspace');

  console.log('admin-domain.test.ts: PASS');
}

run();
