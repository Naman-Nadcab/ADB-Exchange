import { FOREX_ACTIVE_POSITION_MODE, nettingKey } from './mode.js';
import type { ForexPositionRecord } from './models.js';

export class ForexPositionStore {
  private readonly byId = new Map<string, ForexPositionRecord>();
  private readonly openByKey = new Map<string, string>();
  private readonly fills = new Set<string>();
  private tails = new Map<string, Promise<unknown>>();

  put(record: ForexPositionRecord): void {
    this.byId.set(record.positionId, record);
    const key = nettingKey(record.accountId, record.symbol);
    if (record.status === 'OPEN' && FOREX_ACTIVE_POSITION_MODE === 'NETTING') {
      this.openByKey.set(key, record.positionId);
    } else if (this.openByKey.get(key) === record.positionId) {
      this.openByKey.delete(key);
    }
    for (const f of record.appliedFills) this.fills.add(f.fillId);
  }

  get(positionId: string): ForexPositionRecord | undefined {
    return this.byId.get(positionId);
  }

  getOpen(accountId: string, symbol: string): ForexPositionRecord | undefined {
    const id = this.openByKey.get(nettingKey(accountId, symbol));
    return id ? this.byId.get(id) : undefined;
  }

  hasFill(fillId: string): boolean {
    return this.fills.has(fillId);
  }

  markFill(fillId: string): void {
    this.fills.add(fillId);
  }

  listByAccount(accountId: string, openOnly = false): ForexPositionRecord[] {
    return [...this.byId.values()]
      .filter((p) => p.accountId === accountId && (!openOnly || p.status === 'OPEN'))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  listOpen(): ForexPositionRecord[] {
    return [...this.byId.values()].filter((p) => p.status === 'OPEN');
  }

  hydrate(records: ForexPositionRecord[]): void {
    for (const r of records) this.put(r);
  }

  snapshot(): ForexPositionRecord[] {
    return [...this.byId.values()].map((r) => ({
      ...r,
      appliedFills: r.appliedFills.map((f) => ({ ...f })),
    }));
  }

  enqueue<T>(accountId: string, symbol: string, fn: () => Promise<T>): Promise<T> {
    const key = nettingKey(accountId, symbol);
    const prev = this.tails.get(key) ?? Promise.resolve();
    const curr = prev.catch(() => undefined).then(fn);
    this.tails.set(
      key,
      curr.then(
        () => undefined,
        () => undefined
      )
    );
    return curr;
  }

  enqueueAccount<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const key = `${accountId}\0*`;
    const prev = this.tails.get(key) ?? Promise.resolve();
    const curr = prev.catch(() => undefined).then(fn);
    this.tails.set(
      key,
      curr.then(
        () => undefined,
        () => undefined
      )
    );
    return curr;
  }
}
