import assert from 'node:assert/strict';
import type { ForexLedgerTransaction } from '../ledger/models.js';
import { publicLedgerReconciliation, publicLedgerTrail } from './ledger-public.js';

function tx(
  partial: Pick<ForexLedgerTransaction, 'transactionId' | 'type' | 'createdAt'> & {
    cashCredit?: string;
    cashDebit?: string;
    fillId?: string;
  }
): ForexLedgerTransaction {
  const credit = partial.cashCredit ?? '0';
  const debit = partial.cashDebit ?? '0';
  return {
    transactionId: partial.transactionId,
    idempotencyKey: partial.transactionId,
    fingerprint: partial.transactionId,
    type: partial.type,
    accountId: 'qa',
    currency: 'USD',
    status: 'POSTED',
    createdAt: partial.createdAt,
    source: 'SIMULATED',
    metadata: partial.fillId ? { fillId: partial.fillId } : {},
    entries: [
      {
        entryId: `${partial.transactionId}-c`,
        transactionId: partial.transactionId,
        ledgerAccount: 'CUSTOMER_CASH',
        accountId: 'qa',
        debit,
        credit,
        currency: 'USD',
        timestamp: partial.createdAt,
        referenceType: partial.fillId ? 'FILL' : null,
        referenceId: partial.fillId ?? null,
      },
    ],
  };
}

function testTrail(): void {
  const rows = publicLedgerTrail([
    tx({ transactionId: 't2', type: 'FEE', createdAt: '2026-01-02T00:00:00.000Z', cashDebit: '2' }),
    tx({ transactionId: 't1', type: 'DEPOSIT', createdAt: '2026-01-01T00:00:00.000Z', cashCredit: '100' }),
    tx({
      transactionId: 't3',
      type: 'REALIZED_PNL',
      createdAt: '2026-01-03T00:00:00.000Z',
      cashCredit: '5',
      fillId: 'fill-1',
    }),
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.transactionId, 't3');
  assert.equal(rows[2]?.balanceBefore, '0');
  assert.equal(rows[2]?.balanceAfter, '100');
  assert.equal(rows[1]?.balanceBefore, '100');
  assert.equal(rows[1]?.balanceAfter, '98');
  assert.equal(rows[0]?.balanceBefore, '98');
  assert.equal(rows[0]?.balanceAfter, '103');
  assert.equal(rows[0]?.net, '5');
  assert.equal((rows[0]?.reference as { fillId?: string }).fillId, 'fill-1');
}

function testReconciliation(): void {
  const txs = [
    tx({ transactionId: 'd', type: 'DEPOSIT', createdAt: '2026-01-01T00:00:00.000Z', cashCredit: '100' }),
    tx({ transactionId: 'f', type: 'FEE', createdAt: '2026-01-02T00:00:00.000Z', cashDebit: '2' }),
  ];
  const rec = publicLedgerReconciliation(txs, '98', 'USD');
  assert.equal(rec.status, 'MATCH');
  assert.equal(rec.deposits, '100');
  assert.equal(rec.fees, '-2');
  assert.equal(rec.ledgerFromComponents, '98');
  assert.equal(rec.openingBalance, '0');
  const mismatch = publicLedgerReconciliation(txs, '99', 'USD');
  assert.equal(mismatch.status, 'MISMATCH');
}

testTrail();
testReconciliation();
console.log('ledger-public.test.ts ok');
