/**
 * Client-side active Forex account hint. Server validates ownership (cookie + header).
 * Not authoritative — always set from GET /forex/accounts or POST …/select.
 */
let activeForexAccountId: string | null = null;

export function getForexActiveAccountId(): string | null {
  return activeForexAccountId;
}

export function setForexActiveAccountId(accountId: string | null): void {
  activeForexAccountId = accountId?.trim() ? accountId.trim() : null;
}

export function getForexActiveAccountHeaders(): Record<string, string> {
  if (!activeForexAccountId) return {};
  return { 'X-Forex-Account-Id': activeForexAccountId };
}
