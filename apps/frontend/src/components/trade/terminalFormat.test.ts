import test from 'node:test';
import assert from 'node:assert/strict';
import { visualPriceDecimals } from './terminalFormat';

test('visualPriceDecimals keeps BTC-sized prices at 2 digits inside an 8-digit tick', () => {
  assert.equal(visualPriceDecimals(8, 85250.32), 2);
  assert.equal(visualPriceDecimals(8, '85250.32000000'), 2);
});

test('visualPriceDecimals keeps sub-dollar and micro prices readable', () => {
  assert.equal(visualPriceDecimals(8, 178.8251), 4);
  assert.equal(visualPriceDecimals(8, 0.24576), 5);
  assert.equal(visualPriceDecimals(8, 0.000004), 6);
});

test('visualPriceDecimals never exceeds the instrument tick', () => {
  assert.equal(visualPriceDecimals(2, 0.24576), 2);
  assert.equal(visualPriceDecimals(8, null), 2);
});
