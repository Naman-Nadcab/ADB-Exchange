import assert from 'node:assert/strict';
import { applyExecutedTrades, getTickerSnapshot, hydrateTickerFromDb } from './spot-live-market-state.service.js';

const symbol = 'ALIGN_TEST_USDT';
hydrateTickerFromDb(symbol, {
  last_price: '85000',
  bid: null,
  ask: null,
  high_24h: '86000',
  low_24h: '84000',
  open_24h: '84500',
  volume_24h: '0',
  base_volume_24h: '0',
});

const fill = {
  buyerId: 'buyer',
  sellerId: 'seller',
  baseAsset: 'ALIGN',
  quoteAsset: 'USDT',
  quantity: '1',
  price: '100',
  quoteValue: '100',
};

applyExecutedTrades(symbol, [fill], 'buy');
const far = getTickerSnapshot(symbol);
assert.equal(far?.last_price, '85000');
assert.equal(far?.high_24h, '86000');
assert.equal(far?.low_24h, '84000');
assert.equal(far?.base_volume_24h, '1');
assert.equal(getTickerSnapshot(symbol) && true, true);

applyExecutedTrades(symbol, [{ ...fill, price: '87000', quantity: '2', quoteValue: '174000' }], 'sell');
const near = getTickerSnapshot(symbol);
assert.equal(near?.last_price, '85000');
assert.equal(near?.high_24h, '87000');
assert.equal(near?.base_volume_24h, '3');
assert.equal((getTickerSnapshot(symbol)?.volume_24h), '174100');

const cold = 'ALIGN_COLD_USDT';
applyExecutedTrades(cold, [{ ...fill, price: '10', quantity: '4', quoteValue: '40' }], 'buy');
assert.equal(getTickerSnapshot(cold)?.last_price, '10');
assert.equal(getTickerSnapshot(cold)?.high_24h, '10');

console.log('spot-live-market-state tests passed');
