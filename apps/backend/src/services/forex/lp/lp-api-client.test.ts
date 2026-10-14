/**
 * Run: npx tsx src/services/forex/lp/lp-api-client.test.ts
 */
import assert from 'node:assert/strict';
import {
  lpApiConfigured,
  lpPlugArmed,
  lpWebhookCanonical,
  mapAccount,
  mapFunding,
  mapHealth,
  mapOrderAck,
  mapQuotes,
  signLpWebhook,
  verifyLpWebhook,
} from './lp-api-client.js';

assert.equal(lpApiConfigured(), false);
assert.equal(lpPlugArmed(), false);

const health = mapHealth({ ok: true, accounts: true, funding: true });
assert.equal(health.connected, true);
assert.equal(health.funding, true);

const quotes = mapQuotes({
  quotes: [{ symbol: 'eur/usd', bid: '1.10', ask: '1.11', timestamp: '2026-01-01T00:00:00.000Z', sequence: 4 }],
});
assert.equal(quotes[0]?.symbol, 'EURUSD');
assert.equal(quotes[0]?.sequence, '4');

const ack = mapOrderAck({ status: 'filled', venueOrderId: 'v1', filledVolume: '1', remainingVolume: '0', avgPrice: '1.1' });
assert.equal(ack.status, 'accepted');
assert.equal(ack.venueOrderId, 'v1');

const account = mapAccount({
  brokerTradingLogin: '1001',
  brokerServer: 'lp-1',
  internalAccountId: 'acc-1',
  providerReference: 'ref-1',
});
assert.equal(account.internalAccountId, 'acc-1');

assert.equal(mapFunding({ status: 'accepted' }).status, 'settled');
assert.equal(mapFunding({ status: 'pending' }).status, 'pending');

const event = { eventId: 'e1', type: 'deposit.settled', accountId: 'a1', amount: '10.00', idempotencyKey: 'idem-1234' };
const canonical = lpWebhookCanonical(event);
process.env.FOREX_LP_WEBHOOK_SECRET = 'test-secret';
const signature = signLpWebhook('test-secret', canonical);
assert.equal(verifyLpWebhook(signature, event), true);
assert.equal(verifyLpWebhook('00', event), false);
delete process.env.FOREX_LP_WEBHOOK_SECRET;

console.log('lp-api-client.test ok');
