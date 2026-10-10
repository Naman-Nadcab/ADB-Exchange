/**
 * Program holds move trading cash without dropping it.
 */
import assert from 'node:assert/strict';
import { fxDecimal } from '../decimal-fx.js';
import { ForexLedgerError } from '../ledger/models.js';
import { resetForexAccountingServiceForTests } from '../accounting/service.js';
import { resetForexPositionServiceForTests } from '../positions/service.js';
import { resetForexPricingServiceForTests } from '../quotes.service.js';

const ACCOUNT = 'FX-PROGRAM-HOLD';

async function main() {
  const pricing = resetForexPricingServiceForTests();
  const positions = resetForexPositionServiceForTests(pricing);
  const accounting = resetForexAccountingServiceForTests(positions, pricing);
  accounting.ensureAccount(ACCOUNT);
  await accounting.credit({
    accountId: ACCOUNT,
    amount: '1000',
    idempotencyKey: 'program-hold-seed',
    type: 'INITIAL_FUNDING',
  });

  await accounting.postProgramHold({
    accountId: ACCOUNT,
    amount: '250.00',
    idempotencyKey: 'follow-in:test',
    hold: 'FOLLOW_RESERVE',
    direction: 'IN',
    referenceId: 'follow-1',
  });
  assert.equal(fxDecimal(accounting.ledgerBalance(ACCOUNT)).eq('750'), true);

  const reserved = accounting.ledger.list(ACCOUNT).reduce((sum, tx) => {
    for (const entry of tx.entries) {
      if (entry.ledgerAccount === 'FOLLOW_RESERVE' && entry.accountId === ACCOUNT) {
        return sum.plus(entry.credit).minus(entry.debit);
      }
    }
    return sum;
  }, fxDecimal(0));
  assert.equal(reserved.toFixed(), '250');

  await assert.rejects(
    () =>
      accounting.postProgramHold({
        accountId: ACCOUNT,
        amount: '800',
        idempotencyKey: 'follow-in:too-much',
        hold: 'FOLLOW_RESERVE',
        direction: 'IN',
        referenceId: 'follow-2',
      }),
    (error: unknown) => error instanceof ForexLedgerError && error.reason === 'INSUFFICIENT_FUNDS'
  );

  await accounting.postProgramHold({
    accountId: ACCOUNT,
    amount: '250.00',
    idempotencyKey: 'follow-out:test',
    hold: 'FOLLOW_RESERVE',
    direction: 'OUT',
    referenceId: 'follow-1',
  });
  assert.equal(fxDecimal(accounting.ledgerBalance(ACCOUNT)).eq('1000'), true);
  console.log('program-hold.test ok');
}

void main();
