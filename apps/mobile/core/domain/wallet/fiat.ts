import type { QueryClient } from '@tanstack/react-query';
import type { FiatWithdrawal, FiatWithdrawalBankSnapshot } from '@exchange/mobile-types';
import type { P2PUserPaymentMethod } from '@exchange/mobile-types';

export const FIAT_BALANCE_QUERY_KEY = ['fiat', 'balance'] as const;
export const FIAT_WITHDRAWALS_QUERY_KEY = ['fiat', 'withdrawals'] as const;

export function formatInr(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0.00';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function bankLabelFromPaymentMethod(m: Pick<P2PUserPaymentMethod, 'display_name' | 'method_name'>): string {
  const name = m.display_name?.trim();
  return name || m.method_name;
}

export function bankLabelFromSnapshot(snapshot?: FiatWithdrawalBankSnapshot | null): string {
  if (!snapshot) return 'Bank account';
  const display = typeof snapshot.display_name === 'string' ? snapshot.display_name.trim() : '';
  if (display) return display;
  if (typeof snapshot.method_name === 'string' && snapshot.method_name.trim()) return snapshot.method_name;
  return 'Bank account';
}

export function fiatWithdrawalTimestamp(w: FiatWithdrawal): string {
  const raw = w.created_at ?? w.requested_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export type FiatStatusTone = 'live' | 'sync' | 'neutral' | 'warn' | 'off';

export function fiatWithdrawalStatusTone(status: string): FiatStatusTone {
  const s = status.toLowerCase();
  if (s === 'completed') return 'live';
  if (s === 'pending' || s === 'approved' || s === 'processing') return 'sync';
  if (s === 'rejected' || s === 'failed') return 'warn';
  return 'neutral';
}

export function canCancelFiatWithdrawal(status: string): boolean {
  return status.toLowerCase() === 'pending';
}

export function mapFiatWithdrawApiError(code: string | undefined, message: string): string {
  switch (code) {
    case 'WITHDRAWALS_PAUSED':
      return 'Withdrawals are temporarily paused.';
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient INR balance.';
    case 'BELOW_MINIMUM':
    case 'AMOUNT_TOO_LOW':
      return message;
    case 'BANK_ACCOUNT_REQUIRED':
    case 'INVALID_BANK_ACCOUNT':
      return message;
    case '2FA_REQUIRED':
    case 'INVALID_2FA':
    case 'FUND_PASSWORD_REQUIRED':
    case 'INVALID_FUND_PASSWORD':
      return message;
    case 'NOT_CANCELLABLE':
    case 'NOT_FOUND':
      return message;
    default:
      return message || 'Operation failed';
  }
}

/** ADR-011: navigation seed → React Query cache → not found */
export function resolveFiatWithdrawal(
  queryClient: QueryClient,
  withdrawalId: string,
  seed?: FiatWithdrawal | null,
): FiatWithdrawal | null {
  if (seed?.id === withdrawalId) return seed;
  const cached = queryClient.getQueryData<FiatWithdrawal[]>(FIAT_WITHDRAWALS_QUERY_KEY);
  const fromCache = cached?.find((w) => w.id === withdrawalId);
  if (fromCache) return fromCache;
  return null;
}
