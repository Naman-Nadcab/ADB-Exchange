/**
 * Run: npx tsx apps/backend/src/services/forex/admin/internal-desk.test.ts
 */
import assert from 'node:assert/strict';
import { forexAccountEntryBlock, rememberForexTradeRights, resetForexTradeRightsForTests } from './account-trade-rights.js';
import {
  forexStopGapBlock,
  forexSymbolEntryBlock,
  getForexInstrumentDeskExtra,
  resetForexDeskPolicyForTests,
  setForexDeskOrderPolicy,
  setForexInstrumentDeskExtra,
} from './desk-policy.js';
import { getForexCustomerCapabilityContract } from '../capabilities/customer-contract.js';
import { holidayCoverage, resetForexSessionExceptionsForTests, setForexHolidayCoveragePin, setForexSessionException } from '../sessions/holidays.js';
import { setForexAccountLimits, unsetForexAccountLimitKeys, resolveEffectiveLimits } from '../risk/policy.js';

assert.equal(holidayCoverage(), 'UNCONFIGURED');
setForexHolidayCoveragePin('CONFIGURED');
assert.equal(holidayCoverage(), 'CONFIGURED');
setForexSessionException({ date: '2030-01-01', kind: 'holiday' });
assert.equal(holidayCoverage(), 'CONFIGURED');
resetForexSessionExceptionsForTests();
assert.equal(holidayCoverage(), 'UNCONFIGURED');

setForexInstrumentDeskExtra('EURUSD', { tradeMode: 'CLOSE_ONLY' });
const blocked = forexSymbolEntryBlock({ symbol: 'EURUSD', side: 'buy', orderType: 'market', reduceOnly: false });
assert.equal(blocked?.reason, 'NEW_ORDERS_DISABLED');
const closeOk = forexSymbolEntryBlock({ symbol: 'EURUSD', side: 'sell', orderType: 'market', reduceOnly: true });
assert.equal(closeOk, null);

setForexInstrumentDeskExtra('EURUSD', {
  tradeMode: 'FULL',
  newsWindow: { start: '2020-01-01T00:00:00Z', end: '2099-01-01T00:00:00Z', title: 'test' },
});
const news = forexSymbolEntryBlock({ symbol: 'EURUSD', side: 'buy', orderType: 'market', reduceOnly: false });
assert.equal(news?.detail, 'news filter: test');

setForexInstrumentDeskExtra('EURUSD', {
  newsWindow: null,
  freezeLevelPips: '5',
  pipSize: '0.0001',
});
const frozen = forexSymbolEntryBlock({
  symbol: 'EURUSD',
  side: 'buy',
  orderType: 'limit',
  requestedPrice: '1.10000',
  reduceOnly: false,
  quote: { bid: '1.10000', ask: '1.10020' },
});
assert.equal(frozen?.detail, 'inside freeze level');
const zeroSpread = forexSymbolEntryBlock({
  symbol: 'EURUSD',
  side: 'buy',
  orderType: 'limit',
  requestedPrice: '1.10000',
  reduceOnly: false,
  quote: { bid: '1.10000', ask: '1.10000' },
});
assert.equal(zeroSpread, null);
setForexInstrumentDeskExtra('EURUSD', { freezeLevelPips: '0.0', gapLevelPips: '0.00' });
assert.equal(getForexInstrumentDeskExtra('EURUSD')?.freezeLevelPips, undefined);
assert.equal(getForexInstrumentDeskExtra('EURUSD')?.gapLevelPips, undefined);

setForexInstrumentDeskExtra('EURUSD', { gapLevelPips: '2', pipSize: '0.0001', freezeLevelPips: null });
assert.equal(forexStopGapBlock('EURUSD', 'stop', 'buy', '1.10000', '1.10050'), 'gap level');
assert.equal(forexStopGapBlock('EURUSD', 'limit', 'buy', '1.10000', '1.10050'), null);

resetForexTradeRightsForTests();
rememberForexTradeRights('acct-1', 'CLOSE_ONLY');
assert.equal(forexAccountEntryBlock('acct-1', false)?.reason, 'LIQUIDATION_ONLY');
assert.equal(forexAccountEntryBlock('acct-1', true), null);
rememberForexTradeRights('acct-1', 'DISABLED');
assert.equal(forexAccountEntryBlock('acct-1', false)?.reason, 'ACCOUNT_RESTRICTED');

setForexAccountLimits('acct-1', { maxOrderVolume: '1', maxLeverage: '50' });
unsetForexAccountLimitKeys('acct-1', ['maxOrderVolume']);
const limits = resolveEffectiveLimits({ symbol: 'EURUSD', accountId: 'acct-1' });
assert.notEqual(limits.maxOrderVolume, '1');
assert.equal(limits.maxLeverage, '50');

resetForexDeskPolicyForTests();
setForexDeskOrderPolicy({ market: false });
const contract = getForexCustomerCapabilityContract();
assert.equal(contract.orderTypes.market.customerExposed, false);
assert.equal(contract.customer.orderTypes.includes('market'), false);
assert.equal(contract.orderTypes.market.engine, true);
assert.equal(contract.realForex, false);
resetForexDeskPolicyForTests();

console.log('internal-desk.test.ts PASS');
