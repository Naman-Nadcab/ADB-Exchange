/** Account-scoped liquidation lock. Database-backed when persist is available. */
import { fxq, type ForexQueryable } from '../durability/tx.js';

const locked = new Set<string>();

export function setForexAccountLiquidationLock(accountId: string, on: boolean): void {
  if (on) locked.add(accountId);
  else locked.delete(accountId);
}

export function isForexAccountLiquidationLocked(accountId: string): boolean {
  return locked.has(accountId);
}

export function resetForexLiquidationLocksForTests(): void {
  locked.clear();
}

export async function acquireForexLiquidationLock(
  accountId: string,
  liquidationId: string,
  client?: ForexQueryable
): Promise<boolean> {
  const res = await fxq(client).query(
    `INSERT INTO forex_liquidation_locks (account_id, liquidation_id)
     VALUES ($1,$2)
     ON CONFLICT (account_id) DO NOTHING
     RETURNING account_id`,
    [accountId, liquidationId]
  );
  if ((res.rowCount ?? 0) > 0) {
    locked.add(accountId);
    return true;
  }
  return false;
}

export async function releaseForexLiquidationLock(accountId: string, client?: ForexQueryable): Promise<void> {
  await fxq(client).query(`DELETE FROM forex_liquidation_locks WHERE account_id = $1`, [accountId]);
  locked.delete(accountId);
}

export async function hydrateForexLiquidationLocksFromDb(client?: ForexQueryable): Promise<void> {
  const res = await fxq(client).query(`SELECT account_id FROM forex_liquidation_locks`);
  locked.clear();
  for (const row of res.rows as { account_id?: unknown }[]) {
    locked.add(String(row.account_id));
  }
}
