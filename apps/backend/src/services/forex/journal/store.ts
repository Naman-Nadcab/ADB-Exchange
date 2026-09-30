import type { ForexJournalEvent } from './models.js';

/** Bounded per-account tail so a long-running process cannot grow without limit. */
export const FOREX_JOURNAL_MEMORY_PER_ACCOUNT = 500;

export class ForexJournalStore {
  private readonly byAccount = new Map<string, ForexJournalEvent[]>();

  /** Newest first. Duplicate ids (hydrate replay) are ignored. */
  append(event: ForexJournalEvent): void {
    const list = this.byAccount.get(event.accountId) ?? [];
    if (list.some((e) => e.id === event.id)) return;
    list.unshift(event);
    if (list.length > FOREX_JOURNAL_MEMORY_PER_ACCOUNT) list.length = FOREX_JOURNAL_MEMORY_PER_ACCOUNT;
    this.byAccount.set(event.accountId, list);
  }

  list(accountId: string, limit: number): ForexJournalEvent[] {
    const list = this.byAccount.get(accountId) ?? [];
    return limit >= list.length ? [...list] : list.slice(0, limit);
  }

  count(accountId: string): number {
    return this.byAccount.get(accountId)?.length ?? 0;
  }

  /** Replaces memory with a durable tail. Input order does not matter. */
  hydrate(events: ForexJournalEvent[]): void {
    this.byAccount.clear();
    const sorted = [...events].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    for (const e of sorted) this.append(e);
  }

  clear(): void {
    this.byAccount.clear();
  }
}
