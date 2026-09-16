import { adminFetch, getAdminApiBaseUrl } from '@/lib/api';

const ADMIN_PREFIX = '/api/v1/admin';

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

export type ForexAdminControlsSnapshot = {
  effective: {
    killSwitch: boolean;
    demoFundingEnabled: boolean;
    fundingTestApiEnabled: boolean;
    executionTestApiEnabled: boolean;
    marketDataEnabled: boolean;
    realForex: false;
    executionMode: string;
    source: string;
  };
  envBaseline: {
    killSwitch: boolean;
    demoFundingEnabled: boolean;
    fundingTestApiEnabled: boolean;
    executionTestApiEnabled: boolean;
    marketDataEnabled: boolean;
  };
  runtimeOverrides: Record<string, boolean>;
  instruments: Array<{
    symbol: string;
    displaySymbol: string;
    tradingStatus: string;
    catalogDefault: string;
    overridden: boolean;
  }>;
  readiness: ForexAdminConfigResponse['readiness'];
  dealing: Record<string, unknown>;
};

export function getForexAdminControls(token: string | null) {
  return adminFetch<ForexAdminControlsSnapshot>('/forex/controls', { token });
}

export function patchForexAdminControls(
  token: string | null,
  body: {
    reason?: string;
    kill_switch?: boolean;
    demo_funding?: boolean;
    funding_test_api?: boolean;
    execution_test_api?: boolean;
  },
) {
  return adminFetch<{ changes: unknown[]; snapshot: ForexAdminControlsSnapshot }>('/forex/controls', {
    method: 'PATCH',
    token,
    body,
  });
}

export type ForexAdminPolicySnapshot = {
  leverage: {
    effective: { globalMax: string; defaultAccount: string };
    envBaseline: { globalMaxLeverage: string; defaultAccountLeverage: string };
    runtimeOverrides: Record<string, string>;
  };
  margin: {
    effective: { warningLevel: string; callLevel: string; stopOutLevel: string; maintenanceRatio: string };
    envBaseline: Record<string, string>;
    runtimeOverrides: Record<string, string>;
  };
  commission: { global: { model: string; rate: string; minimum?: string }; instruments: unknown[]; accounts: unknown[] };
  swaps: {
    global: {
      longSwap: string;
      shortSwap: string;
      rolloverTime: string;
      timezone: string;
      tripleSwapDay: number;
      model: string;
    };
    instruments: unknown[];
  };
  instruments: Array<{
    symbol: string;
    displaySymbol: string;
    catalog: { maxLeverage: string; minVolume: string; maxVolume: string };
    effective: { maxLeverage: string; minVolume: string; maxVolume: string };
    overridden: boolean;
  }>;
  riskLimits: Record<string, unknown>;
};

export function getForexAdminPolicy(token: string | null) {
  return adminFetch<ForexAdminPolicySnapshot>('/forex/policy', { token });
}

export function patchForexAdminPolicy(
  token: string | null,
  body: {
    reason: string;
    leverage?: { global_max?: string; default_account?: string };
    margin?: { warning_level?: string; call_level?: string; stop_out_level?: string; maintenance_ratio?: string };
    commission?: { model?: string; rate?: string; minimum?: string };
    swap?: { long_swap?: string; short_swap?: string; rollover_time?: string; timezone?: string; triple_swap_day?: number };
  },
) {
  return adminFetch<{ changes: unknown[]; snapshot: ForexAdminPolicySnapshot }>('/forex/policy', {
    method: 'PATCH',
    token,
    body,
  });
}

export function patchForexInstrumentPolicy(
  token: string | null,
  symbol: string,
  body: { reason: string; max_leverage?: string; min_volume?: string; max_volume?: string },
) {
  return adminFetch<{ snapshot: ForexAdminPolicySnapshot }>(`/forex/policy/instruments/${encodeURIComponent(symbol)}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function patchForexInstrumentTradingStatus(
  token: string | null,
  symbol: string,
  body: { trading_status: string; reason: string },
) {
  return adminFetch<{ symbol: string; previous: string | null; next: string; snapshot: ForexAdminControlsSnapshot }>(
    `/forex/instruments/${encodeURIComponent(symbol)}/trading-status`,
    { method: 'PATCH', token, body },
  );
}

export type ForexAdminExecutionSnapshot = {
  posture: {
    source: string;
    executionMode: string;
    realForex: false;
    killSwitch: boolean;
  };
  routing: { rules: Array<Record<string, unknown>>; mockProvidersOnly: boolean };
  providers: Array<{
    providerId: string;
    providerCode: string;
    health: {
      status: string;
      quoteCount: number;
      rejectRate: number;
    } | null;
    rule: { enabled: boolean; priority: number } | null;
  }>;
  marketData: ForexAdminConfigResponse['runtime']['marketData'];
  realForexGate: {
    effectiveRealForex: false;
    armRequested: boolean;
    envRealForexAllowed: boolean;
    releaseBlocked: boolean;
    releaseBlockReason: string;
    checklistComplete: boolean;
    checklist: Array<{ id: string; label: string; pass: boolean; detail: string }>;
  };
  fillRecon: {
    windowHours: number;
    totals: { executions: number; filled: number; failed: number; partial: number };
    byProvider: Array<{ provider: string; count: number }>;
    note: string;
  };
};

export function getForexAdminExecution(token: string | null) {
  return adminFetch<ForexAdminExecutionSnapshot>('/forex/execution', { token });
}

export function patchForexAdminRouting(
  token: string | null,
  providerId: string,
  body: { reason: string; enabled?: boolean; priority?: number; failover_enabled?: boolean },
) {
  return adminFetch<{ snapshot: ForexAdminExecutionSnapshot }>(
    `/forex/execution/routing/${encodeURIComponent(providerId)}`,
    { method: 'PATCH', token, body },
  );
}

export function patchForexRealForexArm(token: string | null, body: { requested: boolean; reason: string }) {
  return adminFetch<{ previous: boolean; next: boolean; gate: ForexAdminExecutionSnapshot['realForexGate']; snapshot: ForexAdminExecutionSnapshot }>(
    '/forex/execution/real-forex',
    { method: 'PATCH', token, body },
  );
}

export type ForexAdminJournalRow = {
  id: string;
  account_id: string;
  severity: string;
  category: string;
  event_type: string;
  order_id: string | null;
  position_id: string | null;
  reference_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ForexAdminAuditRow = {
  created_at: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_value: string | null;
  new_value: string | null;
  request_id: string | null;
};

export function getForexAdminJournal(
  token: string | null,
  params?: { page?: number; limit?: number; account_id?: string },
) {
  return adminFetch<{
    rows: ForexAdminJournalRow[];
    pagination: ForexAdminPagination;
    tableReady: boolean;
  }>('/forex/journal', { token, params });
}

export function getForexAdminAudit(token: string | null, params?: { page?: number; limit?: number; action?: string }) {
  return adminFetch<{ rows: ForexAdminAuditRow[]; pagination: ForexAdminPagination }>('/forex/audit', { token, params });
}

export type ForexAdminUserForexSummary = {
  userId: string;
  accounts: Array<{
    account_id: string;
    currency: string;
    status: string;
    open_orders: number;
    open_positions: number;
  }>;
  journalTableReady: boolean;
  recentJournal: ForexAdminJournalRow[];
};

export function getForexAdminUserSummary(token: string | null, userId: string) {
  return adminFetch<ForexAdminUserForexSummary>(`/forex/users/${encodeURIComponent(userId)}/summary`, { token });
}

export type ForexAdminLedgerSnapshot = {
  accounts: Array<{
    account_id: string;
    user_id: string | null;
    currency: string;
    status: string;
    customer_cash_balance: string;
  }>;
  reconciliation: Array<{
    event_id: string;
    account_id: string;
    kind: string;
    ok: boolean;
    reason: string | null;
    detail: string | null;
    created_at: string;
  }>;
  totals: { accounts: number; reconciliationEvents: number };
  note: string;
};

export function getForexAdminLedger(token: string | null) {
  return adminFetch<ForexAdminLedgerSnapshot>('/forex/ledger', { token });
}

export function forceCancelForexAdminOrder(token: string | null, orderId: string, body: { reason: string }) {
  return adminFetch<{
    order_id: string;
    account_id: string;
    previous_status: string;
    next_status: string;
  }>(`/forex/orders/${encodeURIComponent(orderId)}/force-cancel`, { method: 'POST', token, body });
}

export async function downloadForexAdminCsv(
  token: string | null,
  path: '/forex/orders/export' | '/forex/executions/export' | '/forex/journal/export',
  filename: string,
  params?: Record<string, string | undefined>,
): Promise<void> {
  if (!token) throw new Error('Not authenticated');
  let url = `${getAdminApiBaseUrl()}${ADMIN_PREFIX}${path}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) search.set(k, v);
    }
    const q = search.toString();
    if (q) url += `?${q}`;
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
