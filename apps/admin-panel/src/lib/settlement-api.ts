import { adminFetch } from './api';

export interface SettlementEventRow {
  id: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export function listSettlementEvents(
  token: string | null,
  params?: { status?: string; limit?: number; offset?: number },
) {
  return adminFetch<{ events: SettlementEventRow[]; total?: number }>('/settlement/events', {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export function getSettlementLedgerDiscrepancy(token: string | null) {
  return adminFetch<{ discrepancies?: unknown[]; summary?: Record<string, unknown> }>(
    '/settlement/ledger-discrepancy',
    { token },
  );
}

export function postSettlementCircuitReset(token: string | null, body: { confirm: boolean; reason?: string }) {
  return adminFetch<{ message?: string }>('/settlement/circuit-reset', {
    method: 'POST',
    token,
    body,
  });
}

export function postSettlementBalanceReconcile(
  token: string | null,
  body: {
    user_id: string;
    asset: string;
    reason: string;
    target_available?: string;
    target_locked?: string;
    confirm: boolean;
  },
) {
  return adminFetch<{ message?: string }>('/settlement/balance-reconcile', {
    method: 'POST',
    token,
    body,
  });
}

export function getDepositSweepEligibility(token: string | null) {
  return adminFetch<{ eligible?: unknown[]; summary?: Record<string, unknown> }>(
    '/deposit-sweeps/eligibility',
    { token },
  );
}

export function listDepositSweeps(token: string | null, params?: { limit?: number; offset?: number }) {
  return adminFetch<{ sweeps?: unknown[]; total?: number }>('/deposit-sweeps', {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export function runDepositSweeps(token: string | null, body?: { reason?: string }) {
  return adminFetch<{ message?: string; run_id?: string }>('/deposit-sweeps/run', {
    method: 'POST',
    token,
    body: body ?? {},
  });
}
