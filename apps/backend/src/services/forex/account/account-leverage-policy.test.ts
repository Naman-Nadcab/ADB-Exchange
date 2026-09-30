import assert from 'node:assert/strict';
import { resetForexAccountPoliciesForTests, getForexAccountPolicy } from '../risk/engine.js';
import { resetForexRiskLimitsForTests, resolveEffectiveLimits } from '../risk/policy.js';
import { fxDecimal } from '../decimal-fx.js';
import {
  applyForexAccountMaxLeverageRuntime,
  resolveStoredAccountMaxLeverage,
} from './account-leverage-policy.js';

resetForexAccountPoliciesForTests();
resetForexRiskLimitsForTests();

const fromGroup = resolveStoredAccountMaxLeverage({
  leverageOverride: null,
  groupLeverageDefault: '50',
});
assert.ok(fxDecimal(fromGroup).lte(50), 'group default should cap account max');

applyForexAccountMaxLeverageRuntime('acc-a', '25');
assert.equal(getForexAccountPolicy('acc-a').maxLeverage, '25');

const limits = resolveEffectiveLimits({ symbol: 'EURUSD', accountId: 'acc-a' });
assert.equal(limits.maxLeverage, '25');

const override = resolveStoredAccountMaxLeverage({
  leverageOverride: '10',
  groupLeverageDefault: '100',
});
assert.equal(override, '10');

console.log('account-leverage-policy.test.ts: OK');
