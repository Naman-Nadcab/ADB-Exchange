import { randomUUID } from 'node:crypto';
import {
  forexLedgerIdempotencyTotal,
  forexLedgerPostedTotal,
  forexLedgerRejectedTotal,
  forexLedgerTransactionTotal,
  forexLedgerUnbalancedTotal,
} from '../../../lib/forex-prometheus-metrics.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { lockForexAccount, withForexTransaction, type ForexQueryable } from '../durability/tx.js';
import type { ForexLedgerAccount } from './accounts.js';
import type { ForexAccountingEvent, ForexLedgerEntry, ForexLedgerPostRequest, ForexLedgerTransaction } from './models.js';
import { ForexLedgerError } from './models.js';
import { ForexLedgerStore } from './store.js';

export function ledgerFingerprint(req: ForexLedgerPostRequest): string {
  const parts = req.entries
    .map((e) => [e.ledgerAccount, e.accountId ?? '', e.debit ?? '0', e.credit ?? '0'].join(':'))
    .sort();
  return [req.type, req.accountId, req.currency, ...parts].join('|');
}

export class ForexLedgerService {
  constructor(
    readonly store: ForexLedgerStore,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  async post(req: ForexLedgerPostRequest, client?: ForexQueryable): Promise<ForexLedgerTransaction> {
    if (client) return this.postLocked(req, client);
    return this.store.enqueue(req.accountId, () => this.postLocked(req));
  }

  customerCashBalance(accountId: string): string {
    let bal = fxDecimal(0);
    for (const e of this.store.listEntries(accountId)) {
      if (e.ledgerAccount !== 'CUSTOMER_CASH') continue;
      bal = bal.plus(e.credit).minus(e.debit);
    }
    return bal.toFixed();
  }

  list(accountId: string): ForexLedgerTransaction[] {
    return this.store.listByAccount(accountId);
  }

  recover(): ForexLedgerTransaction[] {
    return this.store.snapshot();
  }

  private async postLocked(req: ForexLedgerPostRequest, client?: ForexQueryable): Promise<ForexLedgerTransaction> {
    forexLedgerTransactionTotal.inc({ type: req.type });
    const key = req.idempotencyKey.trim();
    if (!key) throw new ForexLedgerError('INVALID_IDEMPOTENCY_KEY', 'idempotencyKey is required');
    let existing = this.store.getByKey(key);
    if (!existing && this.persistEnabled) {
      const { loadLedgerByKey } = await import('./persist.js');
      existing = (await loadLedgerByKey(key, client)) ?? undefined;
      if (existing) this.store.put(existing);
    }
    const fp = ledgerFingerprint(req);
    if (existing) {
      if (existing.fingerprint !== fp) {
        forexLedgerIdempotencyTotal.inc({ result: 'conflict' });
        this.emit({
          eventId: randomUUID(),
          accountId: req.accountId,
          eventType: 'LEDGER_TRANSACTION_REJECTED',
          timestamp: new Date().toISOString(),
          reason: 'IDEMPOTENCY_CONFLICT',
        });
        throw new ForexLedgerError('IDEMPOTENCY_CONFLICT', 'idempotency key reused with different content', 409);
      }
      forexLedgerIdempotencyTotal.inc({ result: 'replay' });
      return existing;
    }

    if (req.currency !== forexConfig.accountingCurrency) {
      throw new ForexLedgerError('CURRENCY_MISMATCH', `Phase 6 accounting currency is ${forexConfig.accountingCurrency}`);
    }

    const now = new Date().toISOString();
    const transactionId = randomUUID();
    const entries: ForexLedgerEntry[] = [];
    let debits = fxDecimal(0);
    let credits = fxDecimal(0);
    for (const raw of req.entries) {
      const debit = fxDecimal(raw.debit ?? '0');
      const credit = fxDecimal(raw.credit ?? '0');
      if (!debit.isFinite() || !credit.isFinite() || debit.lt(0) || credit.lt(0)) {
        throw new ForexLedgerError('INVALID_ENTRY', 'debit/credit must be non-negative decimals');
      }
      if ((debit.gt(0) && credit.gt(0)) || (!debit.gt(0) && !credit.gt(0))) {
        throw new ForexLedgerError('INVALID_ENTRY', 'each entry must be debit XOR credit');
      }
      debits = debits.plus(debit);
      credits = credits.plus(credit);
      entries.push({
        entryId: randomUUID(),
        transactionId,
        ledgerAccount: raw.ledgerAccount,
        accountId: raw.ledgerAccount === 'CUSTOMER_CASH' ? (raw.accountId ?? req.accountId) : (raw.accountId ?? null),
        debit: debit.toFixed(),
        credit: credit.toFixed(),
        currency: req.currency,
        timestamp: now,
        referenceType: raw.referenceType ?? null,
        referenceId: raw.referenceId ?? null,
      });
    }

    if (entries.length === 0 && req.metadata?.zeroAmount !== true) {
      throw new ForexLedgerError('INVALID_ENTRY', 'transaction requires entries');
    }

    if (!debits.eq(credits)) {
      forexLedgerUnbalancedTotal.inc({});
      forexLedgerRejectedTotal.inc({ reason: 'LEDGER_UNBALANCED' });
      this.emit({
        eventId: randomUUID(),
        accountId: req.accountId,
        eventType: 'LEDGER_TRANSACTION_REJECTED',
        timestamp: now,
        reason: 'LEDGER_UNBALANCED',
      });
      throw new ForexLedgerError('LEDGER_UNBALANCED', `debits ${debits.toFixed()} != credits ${credits.toFixed()}`);
    }

    const cashDebit = entries
      .filter((e) => e.ledgerAccount === 'CUSTOMER_CASH' && e.accountId === req.accountId)
      .reduce((a, e) => a.plus(e.debit), fxDecimal(0));

    const assertCash = async (c?: ForexQueryable): Promise<void> => {
      if (!cashDebit.gt(0)) return;
      let bal = fxDecimal(this.customerCashBalance(req.accountId));
      if (this.persistEnabled) {
        const { customerCashBalanceFromDb } = await import('./persist.js');
        bal = fxDecimal(await customerCashBalanceFromDb(req.accountId, c));
      }
      if (bal.minus(cashDebit).lt(0)) {
        forexLedgerRejectedTotal.inc({ reason: 'INSUFFICIENT_FOREX_BALANCE' });
        throw new ForexLedgerError('INSUFFICIENT_FOREX_BALANCE', 'operation would create a negative Forex cash balance', 409);
      }
    };

    if (!this.persistEnabled) await assertCash();

    const tx: ForexLedgerTransaction = {
      transactionId,
      idempotencyKey: key,
      fingerprint: fp,
      type: req.type,
      accountId: req.accountId,
      currency: req.currency,
      status: 'POSTED',
      entries,
      createdAt: now,
      metadata: req.metadata,
      source: 'SIMULATED',
    };
    const postedEvent: ForexAccountingEvent = {
      eventId: randomUUID(),
      accountId: req.accountId,
      eventType: 'LEDGER_TRANSACTION_POSTED',
      timestamp: now,
      transactionId,
    };

    if (this.persistEnabled) {
      const write = async (c: ForexQueryable): Promise<ForexLedgerTransaction> => {
        await assertCash(c);
        const { persistAccountingEvent, persistLedgerTransaction, loadLedgerByKey } = await import('./persist.js');
        const result = await persistLedgerTransaction(tx, c);
        if (result === 'replay') {
          const loaded = await loadLedgerByKey(key, c);
          if (loaded) {
            if (!this.store.getByKey(key)) this.store.put(loaded);
            forexLedgerIdempotencyTotal.inc({ result: 'replay' });
            return loaded;
          }
        }
        await persistAccountingEvent(postedEvent, c);
        if (!client) {
          this.store.put(tx);
          this.store.events.push(postedEvent);
        }
        forexLedgerPostedTotal.inc({ type: req.type });
        return tx;
      };
      if (client) return write(client);
      return withForexTransaction(async (c) => {
        await lockForexAccount(c, req.accountId);
        return write(c);
      });
    }

    this.store.put(tx);
    forexLedgerPostedTotal.inc({ type: req.type });
    this.emit(postedEvent);
    return this.store.get(transactionId) ?? tx;
  }

  private emit(event: ForexAccountingEvent): void {
    this.store.events.push(event);
  }
}

export function pair(account: ForexLedgerAccount, side: 'debit' | 'credit', amount: string, accountId?: string) {
  return {
    ledgerAccount: account,
    accountId: accountId ?? null,
    debit: side === 'debit' ? amount : '0',
    credit: side === 'credit' ? amount : '0',
  };
}
