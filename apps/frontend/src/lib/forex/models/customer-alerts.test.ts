/**
 * Run: npx tsx apps/frontend/src/lib/forex/models/customer-alerts.test.ts
 */
import assert from 'node:assert/strict';
import {
  alertFormFromRow,
  buildAlertCreateBody,
  buildAlertPatchBody,
  describeAlertCondition,
  validateAlertFormInput,
} from './customer-alerts.js';

const bid = buildAlertCreateBody({ alertType: 'BID', symbol: 'EURUSD', side: 'above', price: '1.1' });
assert.equal(bid.alertType, 'BID');
assert.equal((bid.condition as { price: string }).price, '1.1');

const dd = buildAlertCreateBody({ alertType: 'DRAWDOWN', symbol: null, threshold: '15', side: 'below' });
assert.equal((dd.condition as { threshold: number }).threshold, 15);

assert.ok(describeAlertCondition('SESSION_OPEN', {}).includes('session'));

const badPrice = validateAlertFormInput({
  alertType: 'BID',
  symbol: 'EURUSD',
  side: 'above',
  price: '',
  threshold: '',
});
assert.equal(badPrice.ok, false);

const badSymbol = validateAlertFormInput({
  alertType: 'PRICE',
  symbol: null,
  side: 'above',
  price: '1.05',
  threshold: '',
});
assert.equal(badSymbol.ok, false);

const hookOk = validateAlertFormInput({
  alertType: 'SESSION_OPEN',
  symbol: null,
  side: 'above',
  price: '',
  threshold: '',
});
assert.equal(hookOk.ok, true);

const row = alertFormFromRow({
  alertId: 'x',
  alertType: 'SPREAD',
  symbol: 'EURUSD',
  condition: { side: 'below', threshold: 0.0003 },
  enabled: true,
  cooldownSeconds: 60,
  lastTriggeredAt: null,
});
assert.equal(row.threshold, '0.0003');

const patch = buildAlertPatchBody({
  alertType: 'SPREAD',
  symbol: 'EURUSD',
  side: 'below',
  price: '',
  threshold: '0.0004',
});
assert.equal((patch.condition as { threshold: number }).threshold, 0.0004);

console.log('customer-alerts.test.ts ok');
