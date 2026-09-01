import type { ForexProtectionEvent, ForexProtectionRecord } from './models.js';

export class ForexProtectionStore {
  private readonly byId = new Map<string, ForexProtectionRecord>();
  private readonly byClient = new Map<string, string>();
  readonly events: ForexProtectionEvent[] = [];
  private tails = new Map<string, Promise<unknown>>();

  put(p: ForexProtectionRecord): void {
    this.byId.set(p.protectionId, p);
    this.byClient.set(`${p.accountId}:${p.clientProtectionId}`, p.protectionId);
  }

  get(id: string): ForexProtectionRecord | undefined {
    return this.byId.get(id);
  }

  getByClient(accountId: string, clientProtectionId: string): ForexProtectionRecord | undefined {
    const id = this.byClient.get(`${accountId}:${clientProtectionId}`);
    return id ? this.byId.get(id) : undefined;
  }

  listByAccount(accountId: string): ForexProtectionRecord[] {
    return [...this.byId.values()].filter((p) => p.accountId === accountId);
  }

  listActiveBySymbol(symbol: string): ForexProtectionRecord[] {
    return [...this.byId.values()].filter((p) => p.symbol === symbol && p.status === 'ACTIVE');
  }

  listActiveByPosition(positionId: string): ForexProtectionRecord[] {
    return [...this.byId.values()].filter((p) => p.positionId === positionId && p.status === 'ACTIVE');
  }

  hydrate(rows: ForexProtectionRecord[]): void {
    for (const p of rows) this.put(p);
  }

  snapshot(): ForexProtectionRecord[] {
    return [...this.byId.values()].map((p) => ({ ...p }));
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
