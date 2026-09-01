import type { ForexOrderRecord } from './models.js';
import { ForexOrderError } from './models.js';
import { orderFingerprint, type ForexOrderRequest } from './request.js';
import { FOREX_ORDER_TERMINAL } from './states.js';

function scopeKey(accountId: string, clientOrderId: string): string {
  return `${accountId}\0${clientOrderId}`;
}

/**
 * Working-set store. Persistence hydrates it. Uniqueness is also enforced in DB.
 */
export class ForexOrderStore {
  private readonly byOrder = new Map<string, ForexOrderRecord>();
  private readonly byScope = new Map<string, string>();
  private readonly byExec = new Map<string, string>();
  private tails = new Map<string, Promise<unknown>>();

  put(record: ForexOrderRecord): void {
    this.byOrder.set(record.orderId, record);
    this.byScope.set(scopeKey(record.accountId, record.clientOrderId), record.orderId);
    this.byExec.set(record.clientExecId, record.orderId);
  }

  get(orderId: string): ForexOrderRecord | undefined {
    return this.byOrder.get(orderId);
  }

  getByScope(accountId: string, clientOrderId: string): ForexOrderRecord | undefined {
    const id = this.byScope.get(scopeKey(accountId, clientOrderId));
    return id ? this.byOrder.get(id) : undefined;
  }

  getByClientExec(clientExecId: string): ForexOrderRecord | undefined {
    const id = this.byExec.get(clientExecId);
    return id ? this.byOrder.get(id) : undefined;
  }

  listByAccount(accountId: string): ForexOrderRecord[] {
    return [...this.byOrder.values()]
      .filter((o) => o.accountId === accountId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  listOpen(): ForexOrderRecord[] {
    return [...this.byOrder.values()].filter((o) => !FOREX_ORDER_TERMINAL.has(o.status));
  }

  claim(accountId: string, req: ForexOrderRequest): ForexOrderRecord | 'conflict' | undefined {
    const existing = this.getByScope(accountId, req.clientOrderId.trim());
    if (!existing) return undefined;
    if (existing.fingerprint === orderFingerprint(req)) return existing;
    return 'conflict';
  }

  requireOwned(orderId: string, accountId: string): ForexOrderRecord {
    const order = this.get(orderId);
    if (!order) throw new ForexOrderError('ORDER_NOT_FOUND', 'Forex order not found', 404);
    if (order.accountId !== accountId) throw new ForexOrderError('FORBIDDEN', 'Forex order not found', 404);
    return order;
  }

  hydrate(records: ForexOrderRecord[]): void {
    for (const r of records) this.put(r);
  }

  snapshot(): ForexOrderRecord[] {
    return [...this.byOrder.values()].map((r) => ({
      ...r,
      fillIds: [...r.fillIds],
      events: r.events.map((e) => ({ ...e })),
    }));
  }

  enqueue<T>(accountId: string, clientOrderId: string, fn: () => Promise<T>): Promise<T> {
    const key = scopeKey(accountId, clientOrderId);
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
