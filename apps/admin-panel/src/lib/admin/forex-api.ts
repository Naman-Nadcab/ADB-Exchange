import { adminFetch } from '@/lib/api';

export type ForexAdminConfigResponse = {
  config: Record<string, unknown>;
  readiness: {
    economicReady: boolean;
    reason: string | null;
    holiday?: unknown;
  };
  runtime: {
    realForex: boolean;
    positionMode: string;
    marketData: {
      enabled: boolean;
      running: boolean;
      intervalMs: number;
      symbols: number;
      providers: string[];
      source: string;
    };
    symbolCount: number;
  };
};

export type ForexAdminOverviewResponse = {
  counts: { openOrders: number; openPositions: number; ledgerAccounts: number };
  readiness: ForexAdminConfigResponse['readiness'];
  posture: {
    source: string;
    executionMode: string;
    realForex: boolean;
    killSwitch: boolean;
    demoFundingEnabled: boolean;
  };
};

export type ForexAdminSystemResponse = {
  readiness: ForexAdminConfigResponse['readiness'];
  marketData: ForexAdminConfigResponse['runtime']['marketData'];
  flags: Record<string, boolean>;
};

export function getForexAdminConfig(token: string | null) {
  return adminFetch<ForexAdminConfigResponse>('/forex/config', { token });
}

export function getForexAdminOverview(token: string | null) {
  return adminFetch<ForexAdminOverviewResponse>('/forex/overview', { token });
}

export function getForexAdminSystem(token: string | null) {
  return adminFetch<ForexAdminSystemResponse>('/forex/system', { token });
}

export type ForexAdminPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ForexAdminListParams = {
  page?: number;
  limit?: number;
  symbol?: string;
  status?: string;
  account_id?: string;
  side?: string;
};

export type ForexAdminOrderRow = {
  order_id: string;
  client_order_id: string;
  account_id: string;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  requested_volume: string;
  filled_volume: string;
  remaining_volume: string;
  requested_price: string | null;
  execution_id: string | null;
  failure_reason: string | null;
  execution_mode: string;
  created_at: string;
  updated_at: string;
};

export type ForexAdminExecutionRow = {
  execution_id: string;
  client_exec_id: string;
  account_id: string | null;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  volume: string;
  filled_volume: string;
  remaining_volume: string;
  expected_price: string | null;
  execution_price: string | null;
  selected_provider: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ForexAdminPositionRow = {
  position_id: string;
  account_id: string;
  symbol: string;
  side: string;
  status: string;
  mode: string;
  volume: string;
  entry_price: string;
  current_price: string;
  leverage: string;
  exposure: string;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
};

function listParams(params?: ForexAdminListParams): Record<string, string | number | undefined> | undefined {
  if (!params) return undefined;
  return {
    page: params.page,
    limit: params.limit,
    symbol: params.symbol,
    status: params.status,
    account_id: params.account_id,
    side: params.side,
  };
}

export function getForexAdminOrders(token: string | null, params?: ForexAdminListParams) {
  return adminFetch<{ rows: ForexAdminOrderRow[]; pagination: ForexAdminPagination }>('/forex/orders', {
    token,
    params: listParams(params),
  });
}

export function getForexAdminExecutions(token: string | null, params?: ForexAdminListParams) {
  return adminFetch<{ rows: ForexAdminExecutionRow[]; pagination: ForexAdminPagination }>('/forex/executions', {
    token,
    params: listParams(params),
  });
}

export function getForexAdminPositions(token: string | null, params?: ForexAdminListParams) {
  return adminFetch<{ rows: ForexAdminPositionRow[]; pagination: ForexAdminPagination }>('/forex/positions', {
    token,
    params: listParams(params),
  });
}
