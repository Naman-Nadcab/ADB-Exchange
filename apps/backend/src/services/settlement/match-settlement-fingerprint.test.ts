import assert from 'node:assert/strict';
import {
  computeMatchSettlementFingerprint,
  fingerprintFromPayload,
} from './match-settlement-fingerprint.js';

{
  const base = {
    match_engine_id: 'default',
    symbol: 'BTC_USDT',
    taker_order_id: '7744fa32-c852-4e44-b410-33674f70e0f8',
    maker_order_id: 'c34fdc14-e4a0-462d-8aec-e430eb11607e',
    taker_user_id: 'dc606f80-223e-41e5-b68f-2a39e328f526',
    maker_user_id: 'a0000000-0000-4000-8000-00000000aa01',
    taker_side: 'buy',
    price: '63842.71959919',
    qty: '0.0001',
    timestamp: 1785492748690,
  };

  const fp1 = computeMatchSettlementFingerprint(base);
  const fp2 = computeMatchSettlementFingerprint({ ...base, match_engine_id: 'default' });
  assert.equal(fp1, fp2);
  assert.equal(fp1.length, 64);

  const fpFromPayload = fingerprintFromPayload('default', {
    symbol: base.symbol,
    taker_order_id: base.taker_order_id,
    maker_order_id: base.maker_order_id,
    taker_user_id: base.taker_user_id,
    maker_user_id: base.maker_user_id,
    taker_side: base.taker_side,
    price: base.price,
    qty: base.qty,
    timestamp: base.timestamp,
  });
  assert.equal(fpFromPayload, fp1);

  const fpDifferentTs = computeMatchSettlementFingerprint({ ...base, timestamp: 1785492748691 });
  assert.notEqual(fpDifferentTs, fp1);

  const fpDifferentQty = computeMatchSettlementFingerprint({ ...base, qty: '0.0002' });
  assert.notEqual(fpDifferentQty, fp1);
}

console.log('match-settlement-fingerprint.test: ok');
