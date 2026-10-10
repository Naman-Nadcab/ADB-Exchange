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
    featureFlags?: {
      routingV2Enabled: boolean;
      adapterLayerHookEnabled: boolean;
    };
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

export type ForexCommandAttentionItem = {
  severity: 'critical' | 'high' | 'medium' | 'info';
  category: string;
  title: string;
  detail: string | null;
  count: number | null;
  href: string;
  resource_type: string | null;
  resource_id: string | null;
};

export type ForexCommandAttentionSnapshot = {
  items: ForexCommandAttentionItem[];
  totals: { critical: number; high: number; medium: number; info: number };
  calculated_at: string;
};

export type ForexAdminSystemResponse = {
  readiness: ForexAdminConfigResponse['readiness'];
  marketData: ForexAdminConfigResponse['runtime']['marketData'];
  flags: Record<string, boolean>;
};

export type ForexAdminDealingQueueRow = {
  order_id: string;
  account_id: string;
  user_id: string | null;
  symbol: string;
  side: string;
  requested_volume: string;
  requested_price: string | null;
  current_price: string | null;
  status: string;
  execution_mode: string;
  failure_reason: string | null;
  execution_id: string | null;
  age_sec: number;
  price_source: string;
};

export function postForexDealerAccept(token: string | null, orderId: string, reason: string) {
  return adminFetch<{ action_id: string; order_id: string; status: string; note: string }>(
    `/forex/dealing/orders/${encodeURIComponent(orderId)}/accept`,
    { token, method: 'POST', body: { reason } },
  );
}

export function postForexDealerReject(token: string | null, orderId: string, reason: string) {
  return adminFetch<{ action_id: string; order_id: string; previous_status: string; next_status: string }>(
    `/forex/dealing/orders/${encodeURIComponent(orderId)}/reject`,
    { token, method: 'POST', body: { reason } },
  );
}

export function postForexDealerAssign(
  token: string | null,
  orderId: string,
  assigneeAdminId: string,
  reason: string,
) {
  return adminFetch<{ action_id: string }>(`/forex/dealing/orders/${encodeURIComponent(orderId)}/assign`, {
    token,
    method: 'POST',
    body: { assignee_admin_id: assigneeAdminId, reason },
  });
}

export function postForexDealerEscalate(
  token: string | null,
  orderId: string,
  escalationAdminId: string,
  reason: string,
) {
  return adminFetch<{ action_id: string }>(`/forex/dealing/orders/${encodeURIComponent(orderId)}/escalate`, {
    token,
    method: 'POST',
    body: { escalation_admin_id: escalationAdminId, reason },
  });
}

export function getForexAdminSearch(token: string | null, q: string) {
  return adminFetch<{ query: string; hits: Array<{ domain: string; id: string; label: string; sublabel: string | null; href_hint: string }> }>(
    '/forex/search',
    { token, params: { q } },
  );
}

export type ForexAdminNotificationRow = {
  notification_id: string;
  category: string;
  severity: string;
  title: string;
  body: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

export function getForexAdminNotifications(token: string | null, params?: { page?: number; unresolved_only?: boolean }) {
  const p: Record<string, string> = {};
  if (params?.page) p.page = String(params.page);
  if (params?.unresolved_only) p.unresolved_only = '1';
  return adminFetch<{ rows: ForexAdminNotificationRow[]; pagination: ForexAdminPagination }>('/forex/notifications', {
    token,
    params: p,
  });
}

export function postForexNotificationAcknowledge(token: string | null, notificationId: string) {
  return adminFetch<{ notification_id: string }>(`/forex/notifications/${encodeURIComponent(notificationId)}/acknowledge`, {
    token,
    method: 'POST',
    body: {},
  });
}

export function postForexNotificationResolve(token: string | null, notificationId: string, _reason?: string) {
  return adminFetch<{ resolved: boolean }>(`/forex/notifications/${encodeURIComponent(notificationId)}/resolve`, {
    token,
    method: 'POST',
    body: {},
  });
}

export type ForexAdminMarketDataQuoteRow = {
  symbol: string;
  asset_class: string;
  bid: string;
  ask: string;
  spread: string;
  spread_pips: string;
  quality: string;
  status: string;
  source: string;
  freshness: string;
  received_at: string;
  age_sec: number;
  stale: boolean;
};

export function getForexAdminMarketDataQuotes(
  token: string | null,
  params?: { symbol?: string; stale_only?: boolean },
) {
  const p: Record<string, string> = {};
  if (params?.symbol) p.symbol = params.symbol;
  if (params?.stale_only) p.stale_only = '1';
  return adminFetch<{
    rows: ForexAdminMarketDataQuoteRow[];
    coverage: { total_instruments: number; quoted: number; stale: number; missing: number };
    worker_note: string;
    calculated_at: string;
  }>('/forex/market-data/quotes', { token, params: p });
}

export type ForexAdminTradingAccountRow = {
  account_id: string;
  user_id: string | null;
  currency: string;
  status: string;
  group_code: string | null;
  leverage_default: string | null;
  customer_cash_balance: string;
  open_positions: number;
  open_orders: number;
  last_activity_at: string | null;
  created_at: string | null;
};

export type ForexAutomationRunRow = {
  run_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
};

export function getForexAutomationWorkflowRuns(token: string | null, workflowId: string) {
  return adminFetch<{ runs: ForexAutomationRunRow[] }>(
    `/forex/automation/workflows/${encodeURIComponent(workflowId)}/runs`,
    { token },
  );
}

export function getForexAdminTradingAccounts(
  token: string | null,
  params?: { page?: number; limit?: number; q?: string; status?: string },
) {
  const p: Record<string, string> = {};
  if (params?.page) p.page = String(params.page);
  if (params?.limit) p.limit = String(params.limit);
  if (params?.q) p.q = params.q;
  if (params?.status) p.status = params.status;
  return adminFetch<{
    rows: ForexAdminTradingAccountRow[];
    pagination: ForexAdminPagination;
    note: string;
  }>('/forex/accounts/list', { token, params: p });
}

export function getForexAdminDealingQueue(
  token: string | null,
  params?: { page?: number; symbol?: string; account_id?: string },
) {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.symbol) query.symbol = params.symbol;
  if (params?.account_id) query.account_id = params.account_id;
  return adminFetch<{
    rows: ForexAdminDealingQueueRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    note: string;
  }>('/forex/dealing/queue', { token, params: query });
}

export function getForexAdminConfig(token: string | null) {
  return adminFetch<ForexAdminConfigResponse>('/forex/config', { token });
}

export function getForexAdminOverview(token: string | null) {
  return adminFetch<ForexAdminOverviewResponse>('/forex/overview', { token });
}

export function getForexAdminCommandAttention(token: string | null) {
  return adminFetch<ForexCommandAttentionSnapshot>('/forex/command/attention', { token });
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

export type ForexAdminProviderCatalogRow = {
  providerId: string;
  adapterId: string;
  type: string;
  displayName: string;
  protocol: string;
  status: string;
  isDefault: boolean;
  enabled: boolean;
  priority: number | null;
  capabilities: string[];
  notes: string;
};

export type ForexAdminIntegrationsSnapshot = {
  defaultAdapterId: string;
  adapterLayerVersion: string;
  posture: ForexAdminExecutionSnapshot['posture'];
  providers: ForexAdminProviderCatalogRow[];
  mockLpRouting: ForexAdminExecutionSnapshot['routing'];
  executionProviders: ForexAdminExecutionSnapshot['providers'];
  realForexGate: ForexAdminExecutionSnapshot['realForexGate'];
  notes: string[];
};

export function getForexAdminIntegrations(token: string | null) {
  return adminFetch<ForexAdminIntegrationsSnapshot>('/forex/integrations', { token });
}

export type ForexCrmUserRiskLevel = 'low' | 'medium' | 'high';

export type ForexAdminCrmClientRow = {
  account_id: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  user_status: string | null;
  account_status: string;
  currency: string;
  customer_cash_balance: string;
  open_positions: number;
  account_created_at: string;
  kyc_status: string | null;
  kyc_level: number | null;
  risk_level: ForexCrmUserRiskLevel;
  risk_flags: string[];
};

export type ForexAdminCrmClientsSnapshot = {
  rows: ForexAdminCrmClientRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  note: string;
};

export function getForexAdminCrmClients(
  token: string | null,
  params?: {
    page?: number;
    limit?: number;
    q?: string;
    account_status?: string;
    user_status?: string;
    has_open_positions?: string;
    kyc_status?: string;
    risk_level?: string;
  },
) {
  return adminFetch<ForexAdminCrmClientsSnapshot>('/forex/crm/clients', { token, params });
}

export type ForexAdminCrmClientDetail = {
  account_id: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  user_status: string | null;
  email_verified: boolean | null;
  account_status: string;
  currency: string;
  customer_cash_balance: string;
  open_orders: number;
  open_positions: number;
  account_created_at: string;
  kyc_status: string | null;
  kyc_level: number | null;
  risk_level: ForexCrmUserRiskLevel;
  risk_flags: string[];
  recent_journal: Array<{
    id: string;
    severity: string;
    event_type: string;
    message: string;
    created_at: string;
  }>;
  section_access?: { compliance: boolean; finance: boolean; trading: boolean };
};

export function getForexAdminCrmClientDetail(token: string | null, accountId: string) {
  return adminFetch<ForexAdminCrmClientDetail>(`/forex/crm/clients/${encodeURIComponent(accountId)}`, { token });
}

export type ForexAdminCrmActivityKind = 'order' | 'execution' | 'journal';

export type ForexAdminCrmActivityItem = {
  kind: ForexAdminCrmActivityKind;
  id: string;
  occurred_at: string;
  title: string;
  status: string;
  symbol: string | null;
  side: string | null;
  volume: string | null;
  detail: string | null;
  reference_id: string | null;
};

export type ForexAdminCrmClientActivitySnapshot = {
  account_id: string;
  items: ForexAdminCrmActivityItem[];
  limits: { orders: number; executions: number; journal: number };
  shortcuts: {
    orders_path: string;
    executions_path: string;
    journal_path: string;
    positions_path: string;
  };
};

export function getForexAdminCrmClientActivity(token: string | null, accountId: string, limit?: number) {
  return adminFetch<ForexAdminCrmClientActivitySnapshot>(
    `/forex/crm/clients/${encodeURIComponent(accountId)}/activity`,
    { token, params: limit != null ? { limit } : undefined },
  );
}

export type ForexAdminFinanceAccountRow = {
  account_id: string;
  user_id: string | null;
  email: string | null;
  currency: string;
  account_status: string;
  customer_cash_balance: string;
  ledger_transaction_count: number;
  last_reconciliation_ok: boolean | null;
  last_reconciliation_at: string | null;
};

export type ForexAdminFinanceAccountsSnapshot = {
  rows: ForexAdminFinanceAccountRow[];
  pagination: ForexAdminPagination;
  note: string;
};

export function getForexAdminFinanceAccounts(
  token: string | null,
  params?: { page?: number; limit?: number; q?: string; account_status?: string },
) {
  return adminFetch<ForexAdminFinanceAccountsSnapshot>('/forex/crm/finance/accounts', { token, params });
}

export type ForexAdminFinanceReconciliationRow = {
  event_id: string;
  account_id: string;
  kind: string;
  ok: boolean;
  reason: string | null;
  detail: string | null;
  created_at: string;
};

export function getForexAdminFinanceReconciliation(
  token: string | null,
  params?: { page?: number; limit?: number; account_id?: string; kind?: string; ok?: string },
) {
  return adminFetch<{
    rows: ForexAdminFinanceReconciliationRow[];
    pagination: ForexAdminPagination;
    tableReady: boolean;
  }>('/forex/crm/finance/reconciliation', { token, params });
}

export type ForexAdminFinanceAccountDetail = {
  account_id: string;
  user_id: string | null;
  email: string | null;
  currency: string;
  account_status: string;
  customer_cash_balance: string;
  recent_transactions: Array<{
    transaction_id: string;
    type: string;
    status: string;
    currency: string;
    customer_cash_delta: string;
    created_at: string;
    idempotency_key: string;
  }>;
  recent_reconciliation: ForexAdminFinanceReconciliationRow[];
  shortcuts: { crm_client_path: string; ledger_path: string; journal_path: string };
};

export function getForexAdminFinanceAccountDetail(token: string | null, accountId: string, txLimit?: number) {
  return adminFetch<ForexAdminFinanceAccountDetail>(
    `/forex/crm/finance/accounts/${encodeURIComponent(accountId)}`,
    { token, params: txLimit != null ? { tx_limit: txLimit } : undefined },
  );
}

export type ForexAdminSymbolRouteRow = {
  symbol: string;
  status: string;
  selectedProvider: string | null;
  selectedReason: string;
  providerCount: number;
  healthyProviderCount: number;
  eligibleProviderCount: number;
  bestBidProvider: string | null;
  bestAskProvider: string | null;
};

export type ForexAdminRoutingDeskSnapshot = {
  featureFlags: { routingV2Enabled: boolean; adapterLayerHookEnabled: boolean };
  defaultBrokerAdapterId: string;
  brokerAdapterHealth: { status: string; message: string; checkedAt: string } | null;
  mockLpRules: ForexAdminExecutionSnapshot['routing']['rules'];
  symbolRoutes: ForexAdminSymbolRouteRow[];
  stagingChecklist: Array<{ id: string; label: string; pass: boolean; detail: string }>;
  notes: string[];
};

export function getForexAdminRoutingDesk(token: string | null) {
  return adminFetch<ForexAdminRoutingDeskSnapshot>('/forex/routing/desk', { token });
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
    savings_balance: string;
    follow_reserve_balance: string;
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

export type ForexAdminClient360Response = {
  core: ForexAdminCrmClientDetail;
  profile: Record<string, unknown> | null;
  tags: Array<{ tag_id: string; slug: string; label: string }>;
  notes: Array<{
    note_id: string;
    body: string;
    visibility: string;
    created_by_admin_id: string;
    created_at: string;
  }>;
  tasks: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  trading_summary: null | { open_orders: number; open_positions: number; executions_30d: number; source: string };
  finance_summary: null | {
    customer_cash_balance: string;
    pending_finance_requests: number;
    ledger_transactions: number;
    source: string;
  };
  compliance_summary: null | { open_cases: number; provider_status: 'NOT_CONNECTED'; source: string };
  partner_summary: null | { partner_code: string | null; partner_label: string | null; source: string };
  related_accounts: Array<{ account_id: string; status: string; currency: string }>;
  recent_notifications: Array<{ notification_id: string; title: string; severity: string; created_at: string }>;
  trading:
    | { position_mode: string | null; group_code: string | null; leverage_override: string | null; restricted?: false }
    | { position_mode: null; group_code: null; leverage_override: null; restricted: true };
  section_access?: { compliance: boolean; finance: boolean; trading: boolean };
};

export function getForexAdminClient360(token: string | null, accountId: string) {
  return adminFetch<ForexAdminClient360Response>(
    `/forex/crm/clients/${encodeURIComponent(accountId)}/360`,
    { token },
  );
}

export function getForexAdminCrmNotes(token: string | null, accountId: string) {
  return adminFetch<{ notes: ForexAdminClient360Response['notes'] }>(
    `/forex/crm/clients/${encodeURIComponent(accountId)}/notes`,
    { token },
  );
}

export function postForexAdminCrmNote(
  token: string | null,
  accountId: string,
  body: { body: string; visibility?: 'internal' | 'compliance' | 'sales'; user_id?: string },
) {
  return adminFetch<{ note: ForexAdminClient360Response['notes'][0] }>(
    `/forex/crm/clients/${encodeURIComponent(accountId)}/notes`,
    { token, method: 'POST', body },
  );
}

export type ForexAdminCrmLeadRow = {
  lead_id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  stage_id: string;
  status: string;
  priority: string;
  owner_admin_id: string | null;
  campaign_code: string | null;
  follow_up_at: string | null;
  created_at: string;
  source_id: string | null;
  converted_account_id: string | null;
  last_activity_at: string | null;
  next_task_at?: string | null;
};

export type ForexAdminCrmLeadSummary = {
  total: number;
  open: number;
  converted: number;
  lost: number;
  by_stage: Array<{ stage_id: string; count: number }>;
  kyc_started: number;
  scope: 'filtered';
};

export function getForexAdminCrmLeadsSummary(
  token: string | null,
  params?: Parameters<typeof getForexAdminCrmLeads>[1],
) {
  const query: Record<string, string> = {};
  if (params?.stage_id) query.stage_id = params.stage_id;
  if (params?.owner_admin_id) query.owner_admin_id = params.owner_admin_id;
  if (params?.status) query.status = params.status;
  if (params?.priority) query.priority = params.priority;
  if (params?.campaign_code) query.campaign_code = params.campaign_code;
  if (params?.q) query.q = params.q;
  if (params?.created_from) query.created_from = params.created_from;
  if (params?.created_to) query.created_to = params.created_to;
  return adminFetch<ForexAdminCrmLeadSummary>('/forex/crm/leads/summary', { token, params: query });
}

export function getForexAdminCrmLeads(
  token: string | null,
  params?: {
    page?: number;
    limit?: number;
    stage_id?: string;
    owner_admin_id?: string;
    status?: string;
    priority?: string;
    campaign_code?: string;
    q?: string;
    created_from?: string;
    created_to?: string;
  },
) {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.limit) query.limit = String(params.limit);
  if (params?.stage_id) query.stage_id = params.stage_id;
  if (params?.owner_admin_id) query.owner_admin_id = params.owner_admin_id;
  if (params?.status) query.status = params.status;
  if (params?.priority) query.priority = params.priority;
  if (params?.campaign_code) query.campaign_code = params.campaign_code;
  if (params?.q) query.q = params.q;
  if (params?.created_from) query.created_from = params.created_from;
  if (params?.created_to) query.created_to = params.created_to;
  return adminFetch<{ rows: ForexAdminCrmLeadRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    '/forex/crm/leads',
    { token, params: query },
  );
}

export function getForexAdminCrmLeadStages(token: string | null) {
  return adminFetch<{ stages: Array<{ stage_id: string; label: string; sort_order: number }> }>(
    '/forex/crm/leads/stages',
    { token },
  );
}

export function getForexAdminCrmLeadDetail(token: string | null, leadId: string) {
  return adminFetch<Record<string, unknown>>(`/forex/crm/leads/${encodeURIComponent(leadId)}`, { token });
}

export function patchForexAdminCrmLeadStage(
  token: string | null,
  leadId: string,
  body: { stage_id: string; reason: string },
) {
  return adminFetch<{ updated: boolean }>(`/forex/crm/leads/${encodeURIComponent(leadId)}/stage`, {
    token,
    method: 'PATCH',
    body,
  });
}

export function postForexAdminCrmLead(
  token: string | null,
  body: {
    email?: string;
    phone?: string;
    full_name?: string;
    stage_id?: string;
    campaign_code?: string;
    owner_admin_id?: string;
  },
) {
  return adminFetch<{ lead: ForexAdminCrmLeadRow }>('/forex/crm/leads', { token, method: 'POST', body });
}

export function assignForexAdminCrmLead(
  token: string | null,
  leadId: string,
  body: { owner_admin_id: string; reason: string },
) {
  return adminFetch<{ assigned: boolean }>(`/forex/crm/leads/${encodeURIComponent(leadId)}/assign`, {
    token,
    method: 'PATCH',
    body,
  });
}

export function convertForexAdminCrmLead(
  token: string | null,
  leadId: string,
  body: { reason: string; user_id?: string },
) {
  return adminFetch<{ lead_id: string; user_id: string; account_id: string; idempotent: boolean }>(
    `/forex/crm/leads/${encodeURIComponent(leadId)}/convert`,
    { token, method: 'POST', body },
  );
}

export type ForexAdminAccountGroupRow = {
  group_id: string;
  code: string;
  label: string;
  leverage_default: string;
  position_mode_default: string;
  is_active: boolean;
  book?: 'A' | 'B' | null;
  account_count: number;
  created_at: string;
  updated_at: string;
};

export function getForexAdminPrograms(token: string | null) {
  return adminFetch<Record<string, unknown>>('/forex/programs', { token });
}

export function postForexAdminProgram(token: string | null, path: string, body: Record<string, unknown>) {
  return adminFetch<Record<string, unknown>>(path, { token, method: 'POST', body });
}

export function getForexAdminAccountGroups(token: string | null) {
  return adminFetch<{ groups: ForexAdminAccountGroupRow[] }>('/forex/account-groups', { token });
}

export function createForexAdminAccountGroup(
  token: string | null,
  body: { code: string; label: string; leverage_default?: string; position_mode_default?: string },
) {
  return adminFetch<{ group: ForexAdminAccountGroupRow }>('/forex/account-groups', { token, method: 'POST', body });
}

export type ForexAdminCrmTaskRow = {
  task_id: string;
  account_id: string | null;
  lead_id: string | null;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  due_at: string | null;
  owner_admin_id: string | null;
  created_at: string;
};

export function getForexAdminCrmTasks(
  token: string | null,
  params?: {
    page?: number;
    status?: string;
    q?: string;
    lead_id?: string;
    account_id?: string;
    overdue?: boolean;
  },
) {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.status) query.status = params.status;
  if (params?.q) query.q = params.q;
  if (params?.lead_id) query.lead_id = params.lead_id;
  if (params?.account_id) query.account_id = params.account_id;
  if (params?.overdue) query.overdue = 'true';
  return adminFetch<{ rows: ForexAdminCrmTaskRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
    '/forex/crm/tasks',
    { token, params: query },
  );
}

export function postForexAdminCrmTask(
  token: string | null,
  body: {
    title: string;
    task_type?: string;
    lead_id?: string;
    account_id?: string;
    owner_admin_id?: string;
    due_at?: string;
  },
) {
  return adminFetch<{ task: ForexAdminCrmTaskRow }>('/forex/crm/tasks', { token, method: 'POST', body });
}

export function completeForexAdminCrmTask(token: string | null, taskId: string) {
  return adminFetch<{ completed: boolean }>(`/forex/crm/tasks/${encodeURIComponent(taskId)}/complete`, {
    token,
    method: 'POST',
  });
}

export function updateForexAdminAccountGroup(
  token: string | null,
  groupId: string,
  body: { label?: string; leverage_default?: string; is_active?: boolean },
) {
  return adminFetch<{ group: ForexAdminAccountGroupRow }>(`/forex/account-groups/${encodeURIComponent(groupId)}`, {
    token,
    method: 'PATCH',
    body,
  });
}

export type ForexCrmPipelineSnapshot = {
  stages: {
    stage_id: string;
    label: string;
    sort_order: number;
    lead_count: number;
    open_count: number;
    converted_count: number;
  }[];
  totals: { leads: number; open: number; converted: number };
  source: string;
  calculated_at: string;
};

export function getForexAdminCrmPipeline(token: string | null) {
  return adminFetch<ForexCrmPipelineSnapshot>('/forex/crm/pipeline', { token });
}

export type ForexCrmHomeSnapshot = {
  funnel: {
    total_leads: number;
    open_leads: number;
    converted_leads: number;
    by_stage: Array<{ stage_id: string; label: string; open_count: number }>;
  };
  clients: { forex_accounts: number; crm_profiles: number; with_open_positions: number };
  tasks: { open: number; overdue: number; due_today: number };
  activities_last_7d: number;
  onboarding_bottlenecks: Array<{ stage_id: string; label: string; open_count: number }>;
  source: string;
  calculated_at: string;
};

export function getForexAdminCrmHome(token: string | null) {
  return adminFetch<ForexCrmHomeSnapshot>('/forex/crm/home', { token });
}

export type ForexCrmWorkspaceSnapshot = {
  admin_id: string;
  my_leads_open: number;
  my_tasks_open: number;
  my_tasks_overdue: number;
  my_tasks_due_today: number;
  my_assigned_clients: number;
  attention: Array<{
    kind: 'task_overdue' | 'task_due_today' | 'lead_stale' | 'kyc_pending';
    title: string;
    resource_type: string;
    resource_id: string;
    href_hint: string;
  }>;
  recent_tasks: Array<{
    task_id: string;
    title: string;
    status: string;
    due_at: string | null;
    account_id: string | null;
    lead_id: string | null;
  }>;
  calculated_at: string;
};

export function getForexAdminCrmWorkspace(token: string | null) {
  return adminFetch<ForexCrmWorkspaceSnapshot>('/forex/crm/workspace', { token });
}

export type ForexCrmSegmentRow = {
  segment_id: string;
  name: string;
  description: string;
  criteria_summary: string;
  client_count: number;
  status: string;
  calculated_at: string;
};

export function getForexAdminCrmSegments(token: string | null) {
  return adminFetch<{ rows: ForexCrmSegmentRow[]; note: string }>('/forex/crm/segments', { token });
}

export function getForexAdminCrmSegmentDetail(token: string | null, segmentId: string) {
  return adminFetch<{
    segment: Omit<ForexCrmSegmentRow, 'client_count' | 'status' | 'calculated_at'>;
    client_count: number;
    members: Array<{ account_id: string; label: string }>;
    calculated_at: string;
  }>(`/forex/crm/segments/${encodeURIComponent(segmentId)}`, { token });
}

export type ForexCrmRecentActivity = {
  activity_id: string;
  account_id: string | null;
  lead_id: string | null;
  kind: string;
  summary: string;
  created_at: string;
};

export function getForexAdminCrmRecentActivities(token: string | null, limit = 20) {
  return adminFetch<{ rows: ForexCrmRecentActivity[] }>('/forex/crm/activities/recent', { token, params: { limit } });
}

export type ForexAdminReportCategory =
  | 'executive'
  | 'trading'
  | 'clients'
  | 'risk'
  | 'finance'
  | 'partners'
  | 'compliance'
  | 'audit';

export type ForexAdminReportMetric = {
  id: string;
  label: string;
  category: ForexAdminReportCategory;
  value: string | number | null;
  source: string;
  status: 'VERIFIED' | 'NOT_AVAILABLE';
  freshness: string;
};

export type ForexAdminReportingSnapshot = {
  time_range: { label: string; from: string; to: string };
  metrics: ForexAdminReportMetric[];
  note: string;
};

export function getForexAdminReportingSnapshot(
  token: string | null,
  params?: { from?: string; to?: string },
) {
  return adminFetch<ForexAdminReportingSnapshot>('/forex/reporting/snapshot', { token, params });
}

export type ForexRiskControlSnapshot = {
  posture: { real_forex: boolean; kill_switch: boolean; economic_ready: boolean };
  fields: {
    key: string;
    label: string;
    current_value: unknown;
    source: string;
    engine_applied: boolean;
    last_changed: string;
  }[];
  note: string;
};

export function getForexAdminRiskControlSnapshot(token: string | null) {
  return adminFetch<ForexRiskControlSnapshot>('/forex/risk/control-plane', { token });
}

export type ForexPartnerProfileRow = {
  partner_id: string;
  code: string;
  display_name: string;
  status: string;
  parent_partner_id: string | null;
  commission_plan_id: string | null;
  created_at: string;
};

export function getForexAdminPartners(token: string | null) {
  return adminFetch<{
    rows: ForexPartnerProfileRow[];
    table_present: boolean;
    payouts_connected: boolean;
    note?: string;
  }>('/forex/partners', { token });
}

export function postForexAdminAccountGroupAssign(
  token: string | null,
  accountId: string,
  body: { group_id: string; reason: string },
) {
  return adminFetch<{
    approval_required?: boolean;
    approval_id?: string;
    status?: string;
    correlationId?: string;
    note?: string;
  }>(`/forex/accounts/${encodeURIComponent(accountId)}/group`, { token, method: 'POST', body });
}

export function postForexAdminAccountLeverageOverride(
  token: string | null,
  accountId: string,
  body: { leverage: string; reason: string },
) {
  return adminFetch<{
    approval_required?: boolean;
    approval_id?: string;
    status?: string;
    correlationId?: string;
    note?: string;
  }>(`/forex/accounts/${encodeURIComponent(accountId)}/leverage-override`, { token, method: 'POST', body });
}

export async function downloadForexAdminCsv(
  token: string | null,
  path:
    | '/forex/orders/export'
    | '/forex/executions/export'
    | '/forex/journal/export'
    | '/forex/crm/clients/export'
    | '/forex/crm/finance/accounts/export'
    | '/forex/crm/finance/reconciliation/export',
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
