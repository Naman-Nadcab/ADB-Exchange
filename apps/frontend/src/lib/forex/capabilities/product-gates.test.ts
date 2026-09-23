import assert from 'node:assert/strict';
import { deriveForexProductGates } from './product-gates';

assert.equal(deriveForexProductGates({ realForex: false }).liveAccountEnabled, false);
assert.equal(deriveForexProductGates({ realForex: true }).realFundingEnabled, true);
console.log('forex product-gates.test.ts: PASS');
