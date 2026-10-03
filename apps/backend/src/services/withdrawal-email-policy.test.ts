import assert from 'node:assert/strict';
import { initialOnchainWithdrawalStatus, withdrawalCanUseEmailOtp } from './withdrawal-email-policy.js';

assert.equal(initialOnchainWithdrawalStatus(false), 'pending');
assert.equal(initialOnchainWithdrawalStatus(true), 'pending_approval');
assert.equal(withdrawalCanUseEmailOtp('pending', 'person@example.com'), false);
assert.equal(withdrawalCanUseEmailOtp('pending_email_verify', null), false);
assert.equal(withdrawalCanUseEmailOtp('pending_email_verify', ''), false);
assert.equal(withdrawalCanUseEmailOtp('pending_email_verify', 'person@example.com'), true);
console.log('withdrawal email policy: PASS');
