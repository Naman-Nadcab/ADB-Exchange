import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeIncomingTradesForSymbol } from './tradeStreamSanitizer';

test('sanitizeIncomingTradesForSymbol keeps only current-symbol valid trades', () => {
  const out = sanitizeIncomingTradesForSymbol(
    [
      {
        id: 'a',
        market: 'BTC_USDT',
        side: 'buy',
        price: '100',
        quantity: '1.2',
        time: '2026-05-29T00:00:00.000Z',
      },
      {
        id: 'a',
        market: 'BTC_USDT',
        side: 'buy',
        price: '100',
        quantity: '1.2',
        time: '2026-05-29T00:00:00.000Z',
      },
      {
        id: 'b',
        market: 'ETH_USDT',
        side: 'sell',
        price: '200',
        quantity: '2',
        time: '2026-05-29T00:00:01.000Z',
      },
      {
        id: 'c',
        market: 'BTC_USDT',
        side: 'invalid',
        price: '200',
        quantity: '2',
        time: '2026-05-29T00:00:01.000Z',
      },
      {
        id: 'd',
        market: 'BTC_USDT',
        side: 'sell',
        price: '0',
        quantity: '2',
        time: '2026-05-29T00:00:01.000Z',
      },
      {
        id: 'e',
        market: 'BTC_USDT',
        side: 'sell',
        price: '200',
        quantity: '2',
        time: '2026-05-29T00:00:02.000Z',
      },
    ],
    'BTC_USDT'
  );

  assert.deepEqual(out.map((t) => t.id), ['a', 'e']);
});
