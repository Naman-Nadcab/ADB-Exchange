/**
 * Position identity.
 *
 * Default / legacy: NETTING (one open position per account+symbol).
 * HEDGING: independent positions per fill; keyed by positionId.
 * Per-account mode lives in account-mode.ts — not a process-wide toggle.
 */
export const FOREX_ACTIVE_POSITION_MODE = 'NETTING' as const;
export type ForexPositionMode = 'NETTING' | 'HEDGING';

export function nettingKey(accountId: string, symbol: string): string {
  return `${accountId}\0${symbol}`;
}

export function hedgingKey(accountId: string, symbol: string, side: 'long' | 'short', openId: string): string {
  return `${accountId}\0${symbol}\0${side}\0${openId}`;
}
