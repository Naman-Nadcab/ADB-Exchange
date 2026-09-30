/**
 * Persist per-account Forex position mode (append-only column on forex_accounts).
 */
import { fxq, type ForexQueryable } from '../durability/tx.js';
import { parseForexPositionMode, setAccountPositionMode } from './account-mode.js';
import type { ForexPositionMode } from './mode.js';

export class ForexPositionModePersistError extends Error {
  constructor(
    readonly code: 'ACCOUNT_ROW_MISSING' | 'COLUMN_UNAVAILABLE' | 'PERSIST_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ForexPositionModePersistError';
  }
}

export async function persistAccountPositionMode(
  accountId: string,
  mode: ForexPositionMode,
  client?: ForexQueryable
): Promise<void> {
  const q = fxq(client);
  const updated = await q.query(
    `UPDATE forex_accounts
     SET position_mode = $2, updated_at = CURRENT_TIMESTAMP
     WHERE account_id = $1`,
    [accountId, mode]
  );
  if ((updated.rowCount ?? 0) > 0) return;

  // Demo convention: account_id often equals platform user_id — upsert only when safe.
  const upsert = await q.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode)
     VALUES ($1, $1, 'USD', 'ACTIVE', $2)
     ON CONFLICT (account_id) DO UPDATE SET
       position_mode = EXCLUDED.position_mode,
       updated_at = CURRENT_TIMESTAMP`,
    [accountId, mode]
  );
  if ((upsert.rowCount ?? 0) === 0) {
    throw new ForexPositionModePersistError('PERSIST_FAILED', `Unable to persist position_mode for ${accountId}`);
  }
}

export async function hydrateAccountPositionModes(client?: ForexQueryable): Promise<number> {
  try {
    const res = await fxq(client).query(`SELECT account_id, position_mode FROM forex_accounts`);
    let n = 0;
    for (const row of res.rows as Array<{ account_id: unknown; position_mode: unknown }>) {
      const mode = parseForexPositionMode(row.position_mode);
      if (!mode) continue;
      setAccountPositionMode(String(row.account_id), mode);
      n += 1;
    }
    return n;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/position_mode/.test(msg) && /does not exist|undefined column/i.test(msg)) {
      throw new ForexPositionModePersistError(
        'COLUMN_UNAVAILABLE',
        'forex_accounts.position_mode column missing — run database migrations'
      );
    }
    return 0;
  }
}
