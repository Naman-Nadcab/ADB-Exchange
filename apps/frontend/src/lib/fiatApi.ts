/**
 * Fiat (INR) withdrawal API client. Uses shared api (auth + base URL).
 * Backed by the isolated fiat ledger; payouts are admin-settled.
 */

import { api } from './api';

const FIAT_PREFIX = '/api/v1/fiat';

export const FIAT_BALANCE_QUERY_KEY = ['fiat', 'balance'] as const;
export const FIAT_WITHDRAWALS_QUERY_KEY = ['fiat', 'withdrawals'] as const;

export interface FiatBalance {
  currency: string;
  available_balance: string;
  locked_balance: string;
}

export interface FiatWithdrawal {
  id: string;
  currency: string;
  amount: string;
  fee: string;
  net_amount: string;
  bank_account_id: string | null;
  bank_snapshot: Record<string, unknown> & {
    method_name?: string;
    method_code?: string;
    display_name?: string;
    details?: Record<string, unknown>;
  };
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'cancelled' | 'failed' | string;
  provider: string;
  provider_reference: string | null;
  admin_notes: string | null;
  failure_reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at?: string;
}

export async function fetchFiatBalance(): Promise<FiatBalance> {
  const res = await api.get<FiatBalance>(`${FIAT_PREFIX}/balance`);
  if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load INR balance');
  return res.data;
}

export async function fetchFiatWithdrawals(): Promise<FiatWithdrawal[]> {
  const res = await api.get<FiatWithdrawal[]>(`${FIAT_PREFIX}/withdrawals`);
  if (!res.success || !Array.isArray(res.data)) throw new Error(res.error?.message ?? 'Failed to load withdrawals');
  return res.data;
}

export interface CreateFiatWithdrawalInput {
  amount: string;
  bankAccountId: string;
  twoFactorCode?: string;
  fund_password?: string;
}

export async function createFiatWithdrawal(input: CreateFiatWithdrawalInput): Promise<FiatWithdrawal> {
  const res = await api.post<FiatWithdrawal>(
    `${FIAT_PREFIX}/withdrawals`,
    { ...input, idempotencyKey: crypto.randomUUID() },
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Withdrawal request failed');
  return res.data;
}

export async function cancelFiatWithdrawal(id: string): Promise<FiatWithdrawal> {
  const res = await api.post<FiatWithdrawal>(`${FIAT_PREFIX}/withdrawals/${encodeURIComponent(id)}/cancel`, {});
  if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Cancel failed');
  return res.data;
}
