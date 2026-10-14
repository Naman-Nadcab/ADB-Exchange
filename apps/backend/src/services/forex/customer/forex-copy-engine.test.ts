import assert from 'node:assert/strict';
import { forexCopyEngineStatus } from './forex-copy-engine.js';

const status = forexCopyEngineStatus();
assert.equal(status.armed, false);
assert.equal(status.reason, 'ENGINE_OFF');
assert.equal(Object.keys(status).includes('armed'), true);
console.log('forex-copy-engine.test.ts: PASS');
