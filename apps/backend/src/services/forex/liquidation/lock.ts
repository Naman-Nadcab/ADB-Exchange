/** Account-scoped liquidation lock. Not a global trading halt. */
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
