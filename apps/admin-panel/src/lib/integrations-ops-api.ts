import { adminFetch } from './api';

export function getIndexerStatus(token: string | null) {
  return adminFetch<{
    chains?: Array<{
      chain: string;
      chainId?: string;
      current_block_height?: number | null;
      last_processed_block?: number | null;
      pending_deposits?: number;
      confirming_deposits?: number;
      sync_status?: string;
    }>;
  }>('/indexer/status', { token });
}

export function getOracleStatus(token: string | null) {
  return adminFetch<{
    provider?: string;
    updateIntervalSec?: number;
    failoverProvider?: string;
    maxDeviationThreshold?: number;
    lastUpdate?: string | null;
    lastError?: string | null;
    lastLatencyMs?: number | null;
    prices?: Array<{ symbol: string; price: string; updated_at: string }>;
  }>('/oracle/status', { token });
}

export function patchOracleSettings(
  token: string | null,
  body: {
    provider?: string;
    updateIntervalSec?: number;
    failoverProvider?: string;
    maxDeviationThreshold?: number;
  },
) {
  return adminFetch('/oracle/settings', { method: 'PATCH', token, body });
}

export function getEngineRecoveryStatus(token: string | null) {
  return adminFetch<{
    open_orders?: number;
    settlement_cursor?: unknown;
    recovery_state?: string;
  }>('/engine/recovery-status', { token });
}

export function getNetworkRisk(token: string | null) {
  return adminFetch<{ signals?: unknown[]; summary?: Record<string, unknown> }>(
    '/security/network-risk',
    { token },
  );
}
