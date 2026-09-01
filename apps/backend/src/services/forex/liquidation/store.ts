import { FOREX_LIQUIDATION_ACTIVE } from './states.js';
import type { ForexLiquidationEvent, ForexLiquidationRecord } from './models.js';

export class ForexLiquidationStore {
  private readonly byId = new Map<string, ForexLiquidationRecord>();
  readonly events: ForexLiquidationEvent[] = [];
  private tails = new Map<string, Promise<unknown>>();

  put(l: ForexLiquidationRecord): void {
    this.byId.set(l.liquidationId, l);
  }

  get(id: string): ForexLiquidationRecord | undefined {
    return this.byId.get(id);
  }

  activeForAccount(accountId: string): ForexLiquidationRecord | undefined {
    return [...this.byId.values()].find((l) => l.accountId === accountId && FOREX_LIQUIDATION_ACTIVE.has(l.status));
  }

  listByAccount(accountId: string): ForexLiquidationRecord[] {
    return [...this.byId.values()]
      .filter((l) => l.accountId === accountId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  hydrate(rows: ForexLiquidationRecord[]): void {
    for (const l of rows) this.put(l);
  }

  snapshot(): ForexLiquidationRecord[] {
    return [...this.byId.values()].map((l) => ({ ...l, orderIds: [...l.orderIds] }));
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
