/**
 * Append-only Forex account journal.
 *
 * Audit / observability class (see durability/write-classes.ts): losing a row
 * can never change financial or order truth. The journal is derived from the
 * same lifecycle events that already drive forex_order_events and
 * forex_protection_events — it never invents activity.
 *
 * The journal is customer-visible, so it MUST NOT carry credentials, tokens,
 * headers, provider keys or raw request bodies. `sanitizeJournalMetadata`
 * enforces that by allowing only scalar values on a fixed key allowlist.
 */

export type ForexJournalSeverity = 'info' | 'warn' | 'error';
export type ForexJournalCategory = 'order' | 'protection' | 'position' | 'system';

export interface ForexJournalEvent {
  id: string;
  accountId: string;
  severity: ForexJournalSeverity;
  category: ForexJournalCategory;
  eventType: string;
  orderId: string | null;
  positionId: string | null;
  referenceId: string | null;
  message: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface ForexJournalInput {
  accountId: string;
  severity: ForexJournalSeverity;
  category: ForexJournalCategory;
  eventType: string;
  message: string;
  orderId?: string | null;
  positionId?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Non-sensitive, non-identifying trading fields only. */
export const FOREX_JOURNAL_METADATA_KEYS = [
  'symbol',
  'side',
  'orderType',
  'status',
  'reason',
  'requestedVolume',
  'filledVolume',
  'remainingVolume',
  'requestedPrice',
  'limitPrice',
  'triggerPrice',
  'trailingDistance',
  'timeInForce',
  'protectionType',
  'positionSide',
  'volume',
  'version',
  'executionId',
  'quoteKey',
  'detail',
] as const;

const ALLOWED = new Set<string>(FOREX_JOURNAL_METADATA_KEYS);
const MAX_VALUE_CHARS = 120;
export const FOREX_JOURNAL_MAX_MESSAGE_CHARS = 400;

export function sanitizeJournalMetadata(raw: unknown): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) continue;
    if (value == null) {
      out[key] = null;
      continue;
    }
    if (typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (typeof value === 'number') {
      out[key] = Number.isFinite(value) ? value : null;
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_VALUE_CHARS);
      continue;
    }
    // Objects / arrays / functions are dropped rather than stringified.
  }
  return out;
}

export function publicForexJournalEvent(e: ForexJournalEvent) {
  return {
    id: e.id,
    severity: e.severity,
    category: e.category,
    eventType: e.eventType,
    orderId: e.orderId,
    positionId: e.positionId,
    referenceId: e.referenceId,
    message: e.message,
    metadata: e.metadata,
    timestamp: e.createdAt,
    source: 'SIMULATED' as const,
    executionMode: 'MOCK' as const,
    origin: 'SERVER' as const,
  };
}
