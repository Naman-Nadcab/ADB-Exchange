import assert from 'node:assert/strict';
import { referenceStatNearLast } from './spot-ticker-price-resolve.js';

assert.equal(referenceStatNearLast('86000', '85000'), '86000');
assert.equal(referenceStatNearLast('100', '85000'), null);
assert.equal(referenceStatNearLast('0', '85000'), null);
assert.equal(referenceStatNearLast('', '85000'), null);
assert.equal(referenceStatNearLast('85100', null), '85100');

console.log('spot-ticker-price-resolve tests passed');
