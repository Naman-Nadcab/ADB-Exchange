import { randomUUID } from 'node:crypto';
import {
  FOREX_JOURNAL_MAX_MESSAGE_CHARS,
  sanitizeJournalMetadata,
  type ForexJournalEvent,
  type ForexJournalInput,
} from './models.js';
import { ForexJournalStore } from './store.js';

export const FOREX_JOURNAL_DEFAULT_LIMIT = 100;
export const FOREX_JOURNAL_MAX_LIMIT = 200;

export function clampForexJournalLimit(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return FOREX_JOURNAL_DEFAULT_LIMIT;
  return Math.min(Math.trunc(n), FOREX_JOURNAL_MAX_LIMIT);
}

/**
 * Append-only journal. Writes are best-effort by design: a failed durable
 * append is logged by the caller's persist layer and never blocks or rolls back
 * an order, protection or fill.
 */
export class ForexJournalService {
  constructor(
    readonly store: ForexJournalStore,
    private persistEnabled = false
  ) {}

  setPersistEnabled(on: boolean): void {
    this.persistEnabled = on;
  }

  record(input: ForexJournalInput): ForexJournalEvent | null {
    const accountId = input.accountId?.trim();
    if (!accountId) return null;
    const event: ForexJournalEvent = {
      id: randomUUID(),
      accountId,
      severity: input.severity,
      category: input.category,
      eventType: input.eventType,
      orderId: input.orderId ?? null,
      positionId: input.positionId ?? null,
      referenceId: input.referenceId ?? null,
      message: String(input.message ?? '').slice(0, FOREX_JOURNAL_MAX_MESSAGE_CHARS),
      metadata: sanitizeJournalMetadata(input.metadata),
      createdAt: new Date().toISOString(),
    };
    this.store.append(event);
    if (this.persistEnabled) {
      void import('./persist.js')
        .then((m) => m.persistForexJournalEvent(event))
        .catch(() => undefined);
    }
    return event;
  }

  list(accountId: string, limit = FOREX_JOURNAL_DEFAULT_LIMIT): ForexJournalEvent[] {
    if (!accountId) return [];
    return this.store.list(accountId, clampForexJournalLimit(limit));
  }

  /** Memory is a tail cache, so a durable read backfills anything trimmed away. */
  async listDurable(accountId: string, limit = FOREX_JOURNAL_DEFAULT_LIMIT): Promise<ForexJournalEvent[]> {
    const capped = clampForexJournalLimit(limit);
    if (!this.persistEnabled) return this.list(accountId, capped);
    try {
      const { loadForexJournalEventsForAccount } = await import('./persist.js');
      const rows = await loadForexJournalEventsForAccount(accountId, capped);
      for (const row of rows) this.store.append(row);
      return this.store.list(accountId, capped);
    } catch {
      return this.list(accountId, capped);
    }
  }

  async hydrateFromDb(limit = 1000): Promise<number> {
    if (!this.persistEnabled) return 0;
    const { loadRecentForexJournalEvents } = await import('./persist.js');
    const rows = await loadRecentForexJournalEvents(limit);
    this.store.hydrate(rows);
    return rows.length;
  }
}

let journalSingleton: ForexJournalService | null = null;

export function getForexJournalService(): ForexJournalService {
  if (!journalSingleton) journalSingleton = new ForexJournalService(new ForexJournalStore(), false);
  return journalSingleton;
}

export function resetForexJournalServiceForTests(): ForexJournalService {
  journalSingleton = new ForexJournalService(new ForexJournalStore(), false);
  return journalSingleton;
}

/** Fire-and-forget helper for lifecycle emitters. Never throws. */
export function recordForexJournalEvent(input: ForexJournalInput): void {
  try {
    getForexJournalService().record(input);
  } catch {
    /* journal is observability-class: never break the trading path */
  }
}
