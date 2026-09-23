import assert from 'node:assert/strict';
import { deriveForexProductGates } from './product-gates';

assert.equal(deriveForexProductGates({ realForex: false }).liveAccountEnabled, false);
assert.equal(
  deriveForexProductGates({ readiness: { capabilities: { deposit: true } } }).realFundingEnabled,
  true
);
assert.equal(
  deriveForexProductGates({ readiness: { capabilities: { internalTransfer: true } } }).internalTransferEnabled,
  true
);
console.log('forex product-gates.test.ts: PASS');
