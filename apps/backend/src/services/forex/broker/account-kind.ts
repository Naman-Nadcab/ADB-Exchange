/**
 * Sync LIVE/DEMO mark for margin and liquidation.
 * Unknown ids stay DEMO so mock tests keep the mock book.
 * A LIVE id is recorded only after a database read, an explicit mark, or broker provisioning.
 */
import { db } from '../../../lib/database.js';

const liveIds = new Set<string>();
const demoIds = new Set<string>();

export function rememberForexAccountKind(accountId: string, kind: string): void {
  const id = accountId.trim();
  if (!id) return;
  if (kind.toUpperCase() === 'LIVE') {
    liveIds.add(id);
    demoIds.delete(id);
    return;
  }
  demoIds.add(id);
  liveIds.delete(id);
}

export function isLiveForexAccount(accountId: string): boolean {
  return liveIds.has(accountId.trim());
}

export function resetForexAccountKindsForTests(): void {
  liveIds.clear();
  demoIds.clear();
}

export async function loadForexAccountKind(accountId: string): Promise<'LIVE' | 'DEMO'> {
  const id = accountId.trim();
  if (!id) return 'DEMO';
  if (liveIds.has(id)) return 'LIVE';
  if (demoIds.has(id)) return 'DEMO';
  try {
    const res = await db.query<{ account_kind: string }>(
      `SELECT COALESCE(account_kind, 'DEMO') AS account_kind
       FROM forex_accounts WHERE account_id = $1 LIMIT 1`,
      [id]
    );
    const kind = String(res.rows[0]?.account_kind ?? 'DEMO').toUpperCase() === 'LIVE' ? 'LIVE' : 'DEMO';
    rememberForexAccountKind(id, kind);
    return kind;
  } catch {
    return 'DEMO';
  }
}

/** Startup/worker refresh. Failure leaves the in-memory set unchanged. */
export async function refreshLiveForexAccountIds(): Promise<void> {
  const res = await db.query<{ account_id: string }>(
    `SELECT account_id FROM forex_accounts WHERE UPPER(COALESCE(account_kind, 'DEMO')) = 'LIVE'`
  );
  for (const row of res.rows) rememberForexAccountKind(String(row.account_id), 'LIVE');
}
