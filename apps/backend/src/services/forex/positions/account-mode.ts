/**
 * Per-account Forex position mode.
 *
 * Default: NETTING (existing accounts unchanged).
 * HEDGING is opt-in and server-authoritative — never inferred from the browser.
 */
import type { ForexPositionMode } from './mode.js';

const accountModes = new Map<string, ForexPositionMode>();

export function parseForexPositionMode(raw: unknown): ForexPositionMode | null {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (v === 'NETTING' || v === 'HEDGING') return v;
  return null;
}

/** Resolve mode for an account. Missing → NETTING (safe default). */
export function getAccountPositionMode(accountId: string): ForexPositionMode {
  return accountModes.get(accountId) ?? 'NETTING';
}

/**
 * Set mode. Caller must enforce: DEMO gates, no open positions, ownership.
 * Does not rewrite historical positions.
 */
export function setAccountPositionMode(accountId: string, mode: ForexPositionMode): ForexPositionMode {
  if (mode !== 'NETTING' && mode !== 'HEDGING') {
    throw new Error('INVALID_POSITION_MODE');
  }
  accountModes.set(accountId, mode);
  return mode;
}

/** Async persist wrapper — memory is authoritative immediately; DB is durability. */
export async function setAccountPositionModeDurable(accountId: string, mode: ForexPositionMode): Promise<ForexPositionMode> {
  const next = setAccountPositionMode(accountId, mode);
  const { persistAccountPositionMode, ForexPositionModePersistError } = await import('./account-mode-persist.js');
  try {
    await persistAccountPositionMode(accountId, next);
  } catch (e) {
    if (e instanceof ForexPositionModePersistError && e.code === 'COLUMN_UNAVAILABLE') {
      throw e;
    }
    // In-memory mode remains authoritative for the running worker; operator must fix DB drift.
    throw e instanceof Error ? e : new Error('POSITION_MODE_PERSIST_FAILED');
  }
  return next;
}

export function resetAccountPositionModesForTests(): void {
  accountModes.clear();
}

export function listAccountPositionModesForTests(): Record<string, ForexPositionMode> {
  return Object.fromEntries(accountModes.entries());
}
