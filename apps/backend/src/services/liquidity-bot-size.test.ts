import test from 'node:test';
import assert from 'node:assert/strict';
import { liftQtyToMarketMinimum } from './liquidity-bot-size.js';

test('a size that already clears the minimum is left alone', () => {
  assert.equal(
    liftQtyToMarketMinimum({
      quantity: '0.001',
      price: '85000',
      minQty: '0.0001',
      minNotional: '1',
      qtyPrecision: 6,
    }),
    '0.001000'
  );
});

test('a cheap market is lifted to the minimum notional', () => {
  const qty = liftQtyToMarketMinimum({
    quantity: '0.001',
    price: '150',
    minQty: '0.001',
    minNotional: '1',
    qtyPrecision: 4,
  });
  assert.ok(Number(qty) * 150 >= 1);
  assert.ok(Number(qty) > 0.001);
});
