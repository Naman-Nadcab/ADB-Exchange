import assert from 'node:assert/strict';
import { forexIsoTimestamp, forexStr } from './iso.js';

const iso = '2026-09-02T13:05:51.663Z';
const js = 'Wed Sep 02 2026 13:05:51 GMT+0000 (Coordinated Universal Time)';

assert.equal(forexIsoTimestamp(new Date(iso)), iso);
assert.equal(forexIsoTimestamp(js)?.startsWith('2026-09-02T13:05:51'), true);
assert.equal(forexIsoTimestamp(iso), iso);
assert.equal(forexIsoTimestamp(null, 'fallback'), 'fallback');
assert.equal(forexStr(new Date(iso)), iso);
assert.notEqual(forexStr(new Date(iso)).includes('GMT'), true);

console.log('iso-timestamp: PASS');
