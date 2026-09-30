/**
 * Run: npx tsx apps/backend/src/services/forex/capabilities/order-paths.test.ts
 */
import assert from 'node:assert/strict';
import { listForexCustomerOrderPaths, forexOrderPathLabel } from './order-paths.js';

const paths = listForexCustomerOrderPaths();
assert.equal(paths.length, 8);
assert.equal(forexOrderPathLabel('buy', 'stop_limit'), 'Buy Stop Limit');
assert.ok(paths.some((p) => p.side === 'sell' && p.kind === 'stop'));
console.log('order-paths.test.ts ok');
