import type { ForexAccountRiskRecord, ForexRiskEvent } from './models.js';

export class ForexRiskStore {
  readonly byAccount = new Map<string, ForexAccountRiskRecord>();
  readonly events: ForexRiskEvent[] = [];

  put(row: ForexAccountRiskRecord): void {
    this.byAccount.set(row.accountId, row);
  }

  get(accountId: string): ForexAccountRiskRecord | undefined {
    return this.byAccount.get(accountId);
  }

  hydrate(rows: ForexAccountRiskRecord[]): void {
    for (const r of rows) this.put(r);
  }

  snapshot(): ForexAccountRiskRecord[] {
    return [...this.byAccount.values()].map((r) => ({ ...r }));
  }
}
