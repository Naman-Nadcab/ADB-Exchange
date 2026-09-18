import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerFingerprint } from '../ledger/service.js';
import type { ForexLedgerPostRequest } from '../ledger/models.js';

describe('finance execute idempotency fingerprint', () => {
  it('stable fingerprint for identical admin finance post', () => {
    const req: ForexLedgerPostRequest = {
      idempotencyKey: 'FOREX_FINANCE_REQ:test',
      type: 'ADJUSTMENT',
      accountId: 'acc-1',
      currency: 'USD',
      entries: [
        { ledgerAccount: 'CLEARING', debit: '10', credit: '0' },
        { ledgerAccount: 'CUSTOMER_CASH', accountId: 'acc-1', debit: '0', credit: '10' },
      ],
    };
    assert.equal(ledgerFingerprint(req), ledgerFingerprint({ ...req }));
  });
});
