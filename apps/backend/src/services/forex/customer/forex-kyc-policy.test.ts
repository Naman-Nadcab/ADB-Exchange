/**
 * Forex KYC policy: OFF skips the live-application gate, ON enforces approved platform KYC.
 * Crypto compliance operations and Forex identity fields stay unchanged.
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/customer/forex-kyc-policy.test.ts
 */
import assert from 'node:assert/strict';
import { COMPLIANCE_OPERATIONS, COMPLIANCE_POLICY_DB_KEY } from '../../../types/compliance-policy.js';
import { buildLiveForexReadiness } from './live-funding-readiness.js';
import {
  createLiveAccountApplication,
  resetForexLiveApplicationsForTests,
} from './live-account-applications.service.js';
import {
  evaluateForexKycGate,
  FOREX_KYC_REQUIRED_MESSAGE,
  FOREX_KYC_REQUIRED_SETTING_KEY,
  parseForexKycRequiredValue,
  setForexKycRequiredForTests,
  setForexKycSnapshotReaderForTests,
} from './forex-kyc-policy.service.js';

const userId = 'a0000000-0000-4000-8000-00000000aa01';

assert.equal(parseForexKycRequiredValue(undefined), null);
assert.equal(parseForexKycRequiredValue(true), true);
assert.equal(parseForexKycRequiredValue(false), false);
assert.equal(parseForexKycRequiredValue('true'), true);
assert.equal(parseForexKycRequiredValue('false'), false);
assert.equal(parseForexKycRequiredValue('{"required":false}'), false);
assert.equal(parseForexKycRequiredValue({ required: true }), true);
assert.equal(parseForexKycRequiredValue('not-a-bool'), null);

assert.deepEqual(evaluateForexKycGate(false, false), { ok: true });
assert.deepEqual(evaluateForexKycGate(true, true), { ok: true });
const blocked = evaluateForexKycGate(true, false);
assert.equal(blocked.ok, false);
if (!blocked.ok) {
  assert.equal(blocked.code, 'KYC_REQUIRED');
  assert.equal(blocked.message, FOREX_KYC_REQUIRED_MESSAGE);
}

assert.equal(FOREX_KYC_REQUIRED_SETTING_KEY, 'forex_kyc_required');
assert.notEqual(FOREX_KYC_REQUIRED_SETTING_KEY, COMPLIANCE_POLICY_DB_KEY);
assert.notEqual(FOREX_KYC_REQUIRED_SETTING_KEY, 'kyc_required_for_withdrawal');
assert.notEqual(FOREX_KYC_REQUIRED_SETTING_KEY, 'kyc_required_for_trading');
assert.equal(COMPLIANCE_OPERATIONS.includes('withdrawal'), true);
assert.equal(COMPLIANCE_OPERATIONS.includes('spot_trading'), true);
assert.equal(COMPLIANCE_OPERATIONS.some((op) => op.includes('forex')), false);

const prevNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
assert.equal(setForexKycRequiredForTests(false), false);
assert.equal(setForexKycSnapshotReaderForTests(async () => ({ verified: false })), false);
if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = prevNodeEnv;

resetForexLiveApplicationsForTests();
assert.equal(setForexKycRequiredForTests(false), true);
assert.equal(
  setForexKycSnapshotReaderForTests(async () => {
    throw new Error('platform KYC must not be read when Forex KYC policy is OFF');
  }),
  true,
);
const off = await createLiveAccountApplication({ userId, idempotencyKey: 'forex-kyc-off' });
assert.equal(off.ok, true);
if (off.ok) {
  assert.equal(off.application.userId, userId);
  assert.notEqual(off.application.applicationId, userId);
}

resetForexLiveApplicationsForTests();
assert.equal(setForexKycRequiredForTests(true), true);
assert.equal(setForexKycSnapshotReaderForTests(async () => ({ verified: false })), true);
const onBlocked = await createLiveAccountApplication({ userId, idempotencyKey: 'forex-kyc-on-block' });
assert.equal(onBlocked.ok, false);
if (!onBlocked.ok) assert.equal(onBlocked.code, 'KYC_REQUIRED');

resetForexLiveApplicationsForTests();
assert.equal(
  setForexKycSnapshotReaderForTests(async (id) => {
    assert.equal(id, userId);
    return { verified: true };
  }),
  true,
);
const onAllowed = await createLiveAccountApplication({ userId, idempotencyKey: 'forex-kyc-on-allow' });
assert.equal(onAllowed.ok, true);
if (onAllowed.ok) assert.equal(onAllowed.application.userId, userId);

const readiness = await buildLiveForexReadiness();
assert.equal(readiness.identity.platformCustomerIdField, 'user_id');
assert.equal(readiness.identity.tradingLoginField, 'forex_accounts.account_id');

setForexKycRequiredForTests(null);
setForexKycSnapshotReaderForTests(null);
resetForexLiveApplicationsForTests();

console.log('forex-kyc-policy.test.ts: PASS');
process.exit(0);
