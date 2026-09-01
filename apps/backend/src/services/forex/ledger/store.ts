import type { ForexAccountingEvent, ForexLedgerEntry, ForexLedgerTransaction } from './models.js';

export class ForexLedgerStore {
  private readonly byId = new Map<string, ForexLedgerTransaction>();
  private readonly byKey = new Map<string, string>();
  readonly entries: ForexLedgerEntry[] = [];
  readonly events: ForexAccountingEvent[] = [];
  private tails = new Map<string, Promise<unknown>>();

  put(tx: ForexLedgerTransaction): void {
    const frozen: ForexLedgerTransaction = {
      ...tx,
      entries: tx.entries.map((e) => Object.freeze({ ...e })),
    };
    Object.freeze(frozen.entries);
    Object.freeze(frozen);
    this.byId.set(frozen.transactionId, frozen);
    this.byKey.set(frozen.idempotencyKey, frozen.transactionId);
    for (const e of frozen.entries) this.entries.push(e);
  }

  get(id: string): ForexLedgerTransaction | undefined {
    return this.byId.get(id);
  }

  getByKey(key: string): ForexLedgerTransaction | undefined {
    const id = this.byKey.get(key);
    return id ? this.byId.get(id) : undefined;
  }

  listByAccount(accountId: string): ForexLedgerTransaction[] {
    return [...this.byId.values()]
      .filter((t) => t.accountId === accountId && t.status === 'POSTED')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  listEntries(accountId?: string): ForexLedgerEntry[] {
    return accountId ? this.entries.filter((e) => e.accountId === accountId) : [...this.entries];
  }

  hydrate(txs: ForexLedgerTransaction[]): void {
    for (const t of txs) this.put(t);
  }

  snapshot(): ForexLedgerTransaction[] {
    return [...this.byId.values()].map((t) => ({
      ...t,
      entries: t.entries.map((e) => ({ ...e })),
    }));
  }

  enqueue<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(accountId) ?? Promise.resolve();
    const curr = prev.catch(() => undefined).then(fn);
    this.tails.set(
      accountId,
      curr.then(
        () => undefined,
        () => undefined
      )
    );
    return curr;
  }
}
