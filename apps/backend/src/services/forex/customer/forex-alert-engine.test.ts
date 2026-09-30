/**
 * Run: npx tsx apps/backend/src/services/forex/customer/forex-alert-engine.test.ts
 */
import assert from 'node:assert/strict';
import { forexOrderEventToAlertType, forexProtectionEventToAlertType } from './alert-engine.js';

assert.equal(forexOrderEventToAlertType('ORDER_FILLED'), 'ORDER_FILLED');
assert.equal(forexOrderEventToAlertType('ORDER_TRIGGERED'), 'PENDING_TRIGGERED');
assert.equal(forexProtectionEventToAlertType('PROTECTION_TRIGGERED', 'STOP_LOSS'), 'SL_TRIGGERED');
assert.equal(forexProtectionEventToAlertType('TRAILING_UPDATED', 'STOP_LOSS'), 'TRAILING_TRIGGERED');
console.log('forex-alert-engine.test.ts ok');
