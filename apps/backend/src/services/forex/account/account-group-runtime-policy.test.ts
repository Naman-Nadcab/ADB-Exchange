import assert from 'node:assert/strict';
import { fxDecimal } from '../decimal-fx.js';
import { resetForexFeePolicyForTests, resolveForexCommission } from '../fees/policy.js';
import { resetForexRiskLimitsForTests, resolveEffectiveLimits } from '../risk/policy.js';
import { resetForexSwapPolicyForTests, resolveForexSwap } from '../swap/policy.js';
import { calculateForexCommission } from '../fees/engine.js';
import { calculateForexSwap } from '../swap/engine.js';
import { applyForexAccountGroupProfilesRuntime } from './account-group-runtime-policy.js';

resetForexFeePolicyForTests();
resetForexSwapPolicyForTests();
resetForexRiskLimitsForTests();

applyForexAccountGroupProfilesRuntime('acc-g1', {
  commission_profile: { model: 'per_lot', rate: '7.5' },
  swap_profile: { longSwap: '2.5', shortSwap: '-1.25' },
  spread_profile: { maxSpread: '0.02000' },
});

const comm = resolveForexCommission('acc-g1', 'EURUSD');
assert.equal(comm.rate, '7.5');

const fee = calculateForexCommission({ accountId: 'acc-g1', symbol: 'EURUSD', side: 'buy', volume: '1' });
assert.equal(fee.amount, '7.5');

const swapRule = resolveForexSwap('EURUSD', 'acc-g1');
assert.equal(swapRule.longSwap, '2.5');

const swapCalc = calculateForexSwap({
  symbol: 'EURUSD',
  side: 'long',
  volume: '1',
  at: new Date('2026-09-01T21:00:00.000Z'),
  accountId: 'acc-g1',
});
assert.equal(swapCalc.rate, '2.5');

const limits = resolveEffectiveLimits({ symbol: 'EURUSD', accountId: 'acc-g1' });
assert.ok(fxDecimal(limits.maxSpread).eq(fxDecimal('0.02000')), `maxSpread ${limits.maxSpread}`);

console.log('account-group-runtime-policy.test.ts: OK');
