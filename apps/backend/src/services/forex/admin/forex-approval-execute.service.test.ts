import assert from 'node:assert/strict';
import { forexApprovalExecuteEligible } from './forex-approval-execute.service.js';

assert.equal(forexApprovalExecuteEligible({ status: 'pending', action_executed: false }), false);
assert.equal(forexApprovalExecuteEligible({ status: 'approved', action_executed: true }), false);
assert.equal(forexApprovalExecuteEligible({ status: 'approved', action_executed: false }), true);

console.log('forex-approval-execute.service.test.ts: OK');
