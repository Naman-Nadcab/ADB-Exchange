import type { AccountType, TransferableToken } from '@exchange/mobile-types';

export const TRANSFER_ACCOUNT_OPTIONS: { id: AccountType; label: string; subtitle: string }[] = [
  { id: 'funding', label: 'Funding Account', subtitle: 'Available for transfer' },
  { id: 'trading', label: 'Trading Account', subtitle: 'Unified trading balance' },
  { id: 'spot', label: 'Spot Account', subtitle: 'Spot wallet balance' },
];

export function transferAccountLabel(account: string): string {
  const found = TRANSFER_ACCOUNT_OPTIONS.find((a) => a.id === account);
  if (found) return found.label;
  if (account === 'funding') return 'Funding Account';
  if (account === 'trading') return 'Trading Account';
  if (account === 'spot') return 'Spot Account';
  return account;
}

export function validateSameAccount(from: AccountType, to: AccountType): string | null {
  if (from === to) return 'Cannot transfer to the same account';
  return null;
}

export function applyTransferPercent(available: string, pct: number): string {
  const avail = parseFloat(available);
  if (!Number.isFinite(avail) || avail <= 0) return '0';
  const amt = (avail * pct) / 100;
  return amt.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function computeRemainingBalance(available: string, amount: string): string {
  const avail = parseFloat(available);
  const a = parseFloat(amount);
  if (!Number.isFinite(avail)) return '0';
  if (!Number.isFinite(a) || a <= 0) return String(avail);
  const rem = Math.max(0, avail - a);
  return rem.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function filterTransferTokens(
  tokens: TransferableToken[],
  opts: { search?: string; hideZero?: boolean; favorites?: Set<string> },
): TransferableToken[] {
  let list = [...tokens];
  if (opts.hideZero) {
    list = list.filter((t) => parseFloat(t.availableBalance) > 0);
  }
  if (opts.search?.trim()) {
    const s = opts.search.trim().toLowerCase();
    list = list.filter((t) => t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s));
  }
  if (opts.favorites?.size) {
    list.sort((a, b) => {
      const af = opts.favorites!.has(a.symbol);
      const bf = opts.favorites!.has(b.symbol);
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      return parseFloat(b.availableBalance) - parseFloat(a.availableBalance);
    });
  }
  return list;
}

export function transferStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'pending') return 'Pending';
  if (s === 'processing') return 'Processing';
  if (s === 'failed') return 'Failed';
  return status;
}

/** Maps backend transfer error codes to user-facing copy. */
export function mapTransferApiError(code: string | undefined, message: string): string {
  switch (code) {
    case 'SAME_ACCOUNT':
      return 'Cannot transfer to the same account';
    case 'INVALID_ACCOUNT':
      return 'Invalid account type selected';
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient balance';
    case 'INVALID_AMOUNT':
      return 'Please enter a valid amount';
    case 'INVALID_TOKEN':
      return 'Selected coin is not available for transfer';
    case 'NO_BALANCE_FOR_ACCOUNT':
      return 'No balance in this account. Try funding if you have no trading balance.';
    case 'WITHDRAWALS_PAUSED':
    case 'TRANSFERS_PAUSED':
      return 'Transfers are temporarily paused. Try again later.';
    case 'IDEMPOTENCY_KEY_IN_PROGRESS':
      return 'Transfer already in progress. Wait a moment and check history.';
    case 'UNAUTHORIZED':
      return 'Session expired. Please sign in again.';
    default:
      return message || 'Transfer failed. Please try again.';
  }
}
