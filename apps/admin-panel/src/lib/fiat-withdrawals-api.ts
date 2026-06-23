import { adminFetch } from './api';

export interface FiatWithdrawalRow {
  id: string;
  user_id: string;
  username?: string | null;
  email?: string | null;
  currency: string;
  amount: string;
  fee: string;
  net_amount: string;
  bank_account_id: string | null;
  bank_snapshot: {
    method_name?: string;
    method_code?: string;
    display_name?: string;
    details?: Record<string, unknown>;
  } & Record<string, unknown>;
  status: string;
  provider: string;
  provider_reference: string | null;
  admin_notes: string | null;
  failure_reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at?: string;
}

export function getFiatWithdrawals(
  token: string | null,
  params?: { status?: string; limit?: number; offset?: number }
) {
  return adminFetch<FiatWithdrawalRow[]>('/fiat-withdrawals', {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export function approveFiatWithdrawal(token: string | null, id: string, notes?: string) {
  return adminFetch<FiatWithdrawalRow>(`/fiat-withdrawals/${id}/approve`, {
    method: 'POST',
    token,
    body: { notes },
  });
}

export function completeFiatWithdrawal(token: string | null, id: string, providerReference?: string) {
  return adminFetch<FiatWithdrawalRow>(`/fiat-withdrawals/${id}/complete`, {
    method: 'POST',
    token,
    body: { providerReference },
  });
}

export function rejectFiatWithdrawal(token: string | null, id: string, reason: string) {
  return adminFetch<FiatWithdrawalRow>(`/fiat-withdrawals/${id}/reject`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export function creditFiatBalance(token: string | null, body: { userId: string; amount: string; notes?: string }) {
  return adminFetch<{ currency: string; available_balance: string; locked_balance: string }>('/fiat-credit', {
    method: 'POST',
    token,
    body,
  });
}
