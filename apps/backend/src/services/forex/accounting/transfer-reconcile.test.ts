import assert from 'node:assert/strict';
import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import { fxDecimal } from '../decimal-fx.js';
import { resetForexAccountingServiceForTests } from './service.js';
import { forexAccountingComponents } from './components.js';
import type { ForexLedgerTransaction } from '../ledger/models.js';
import { ForexPositionService, resetForexPositionServiceForTests } from '../positions/service.js';
import { ForexPositionStore } from '../positions/store.js';
import { resetForexPricingServiceForTests } from '../quotes.service.js';
import { resetForexAccountPoliciesForTests } from '../risk/engine.js';
import type { ProviderRawQuote } from '../types.js';

const FROM = 'acct-from';
const TO = 'acct-to';

function raw(
  p: Partial<ProviderRawQuote> & Pick<ProviderRawQuote, 'symbol' | 'bid' | 'ask' | 'providerId' | 'providerCode'>
): ProviderRawQuote {
  return { providerTimestamp: new Date(), providerSequence: 1n, source: 'SIMULATED', ...p };
}

function harness() {
  resetForexAccountPoliciesForTests();
  const pricing = resetForexPricingServiceForTests();
  const now = new Date();
  pricing.ingestRaw(
    raw({
      symbol: 'EURUSD',
      providerId: FOREX_PROVIDER_IDS.MOCK_A,
      providerCode: 'MOCK-A',
      bid: '1.10000',
      ask: '1.10020',
      providerSequence: 1n,
    }),
    now
  );
  const positions = new ForexPositionService(new ForexPositionStore(), pricing, false);
  resetForexPositionServiceForTests(pricing);
  const acc = resetForexAccountingServiceForTests(positions, pricing);
  return acc;
}

function transferTx(): ForexLedgerTransaction {
  return {
    transactionId: 'xfer-1',
    idempotencyKey: 'xfer-1',
    fingerprint: 'xfer-1',
    type: 'TRANSFER',
    accountId: FROM,
    currency: 'USD',
    status: 'POSTED',
    createdAt: '2026-10-19T17:53:08.610Z',
    source: 'SIMULATED',
    metadata: {},
    entries: [
      {
        entryId: 'd',
        transactionId: 'xfer-1',
        ledgerAccount: 'CUSTOMER_CASH',
        accountId: FROM,
        debit: '500',
        credit: '0',
        currency: 'USD',
        timestamp: '2026-10-19T17:53:08.610Z',
        referenceType: 'TRANSFER',
        referenceId: 'xfer-1',
      },
      {
        entryId: 'c',
        transactionId: 'xfer-1',
        ledgerAccount: 'CUSTOMER_CASH',
        accountId: TO,
        debit: '0',
        credit: '500',
        currency: 'USD',
        timestamp: '2026-10-19T17:53:08.610Z',
        referenceType: 'TRANSFER',
        referenceId: 'xfer-1',
      },
    ],
  };
}

{
  const parts = forexAccountingComponents([transferTx()], TO);
  assert.equal(parts.transfers, '500');
  assert.equal(parts.ledgerFromComponents, '500');
  const sender = forexAccountingComponents([transferTx()], FROM);
  assert.equal(sender.transfers, '-500');
  const bothLegs = forexAccountingComponents([transferTx()]);
  assert.equal(bothLegs.transfers, '0');
}

{
  const acc = harness();
  await acc.credit({ accountId: FROM, amount: '10000', idempotencyKey: 'DEMO_INITIAL_FUNDING:from', type: 'INITIAL_FUNDING' });
  await acc.credit({ accountId: TO, amount: '10000', idempotencyKey: 'DEMO_INITIAL_FUNDING:to', type: 'INITIAL_FUNDING' });
  await acc.transferInternal({
    fromAccountId: FROM,
    toAccountId: TO,
    amount: '500',
    idempotencyKey: 'demo-transfer-500',
  });
  assert.equal(acc.ledgerBalance(FROM), '9500');
  assert.equal(acc.ledgerBalance(TO), '10500');

  const fromRec = acc.reconcile(FROM);
  assert.equal(fromRec.ok, true, fromRec.reason ?? fromRec.detail);
  const toRec = acc.reconcile(TO);
  assert.equal(toRec.ok, true, toRec.reason ?? toRec.detail);

  const toView = acc.publicLedgerView(TO);
  assert.equal(toView.reconciliation.status, 'MATCH');
  const incoming = toView.transactions.find((row) => row.type === 'TRANSFER');
  assert.ok(incoming);
  assert.equal(incoming.net, '500');
  assert.equal(fxDecimal(toView.transactions[0]?.balanceAfter).eq('10500'), true);

  const fromView = acc.publicLedgerView(FROM);
  const outgoing = fromView.transactions.find((row) => row.type === 'TRANSFER');
  assert.equal(outgoing?.net, '-500');
  assert.equal(fromView.reconciliation.status, 'MATCH');
}

console.log('transfer-reconcile.test.ts ok');
