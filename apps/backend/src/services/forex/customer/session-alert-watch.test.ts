/**
 * Run: npx tsx apps/backend/src/services/forex/customer/session-alert-watch.test.ts
 */
import assert from 'node:assert/strict';
import { evaluateForexSessionTransitionForSymbol, resetForexSessionAlertWatchForTests } from './session-alert-watch.js';

resetForexSessionAlertWatchForTests();
await evaluateForexSessionTransitionForSymbol('EURUSD', new Date('2026-01-05T12:00:00Z'));
await evaluateForexSessionTransitionForSymbol('EURUSD', new Date('2026-01-05T12:01:00Z'));
resetForexSessionAlertWatchForTests();
assert.ok(true, 'session watch smoke');
console.log('session-alert-watch.test.ts ok');
