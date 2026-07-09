import { adminFetch } from './api';

export interface MonitoringHealth {
  api_latency_ms: number;
  db_health: string;
  redis_health: string;
  ws_connections: number;
}

export interface RpcProviderRow {
  id: string;
  provider: string;
  network: string;
  rpc_url: string;
  latency_ms: number | null;
  status: string;
  failover_priority?: number;
  error_rate?: number;
  last_failure?: string | null;
}

export interface MonitoringHistoryPoint {
  timestamp: string;
  value: number;
}

export interface AlertRules {
  api_latency_threshold_ms: number;
  queue_size_threshold: number;
  rpc_failure_rate_threshold: number;
}

export interface AlertRuleValue {
  threshold: number;
  enabled: boolean;
  cooldown_sec: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface AlertRuleDefinition {
  key: string;
  label: string;
  unit: string;
  system: string;
  description: string;
  defaultThreshold: number;
  min: number;
  max: number;
  defaultSeverity: string;
  defaultCooldownSec: number;
}

export interface IncidentRow {
  id: string;
  service: string;
  severity: string;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
}

export interface WorkerRow {
  id: string;
  worker_name: string;
  status: string;
  uptime_seconds: number;
  last_restart_at: string | null;
}

export interface TimelineEventRow {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
}

export interface MonitoringQueues {
  withdrawal_pending: number;
  settlement_pending: number;
  /** Age in seconds of oldest pending settlement_events row (0 if empty). */
  settlement_lag_sec?: number;
  /** True when backlog exists and oldest pending is older than ~30s. */
  settlement_delayed?: boolean;
  matching_engine_pending: number;
}

export interface MonitoringResources {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

export interface InfrastructureAlertRow {
  id: string;
  system: string;
  severity: string;
  message: string;
  status: string;
  created_at: string;
  root_cause?: string | null;
  suggested_action?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  assigned_admin_id?: string | null;
}

export interface MonitoringAlertSummary {
  open: number;
  acknowledged: number;
  resolved: number;
  open_critical: number;
  open_high: number;
  total: number;
}

export interface InfrastructureProviderRow {
  id: string;
  provider_type: string;
  provider_name: string;
  endpoint_url: string;
  api_key: string;
  status: string;
}

export function getMonitoringHealth(token: string | null) {
  return adminFetch<MonitoringHealth>('/monitoring/health', { token });
}

export function getMonitoringRpcProviders(token: string | null) {
  return adminFetch<{ providers: RpcProviderRow[] }>('/monitoring/rpc-providers', { token });
}

export function getMonitoringQueues(token: string | null) {
  return adminFetch<MonitoringQueues>('/monitoring/queues', { token });
}

export function getMonitoringResources(token: string | null) {
  return adminFetch<MonitoringResources>('/monitoring/resources', { token });
}

export function getMonitoringAlerts(
  token: string | null,
  params?: { limit?: number; offset?: number; status?: string; severity?: string }
) {
  return adminFetch<{ alerts: InfrastructureAlertRow[]; total: number }>('/monitoring/alerts', {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export function getMonitoringAlertSummary(token: string | null) {
  return adminFetch<MonitoringAlertSummary>('/monitoring/alerts/summary', { token });
}

export function patchMonitoringAlert(
  token: string | null,
  id: string,
  body: { status: 'acknowledged' | 'resolved' | 'open'; assigned_admin_id?: string }
) {
  return adminFetch<{ id: string; status: string }>(`/monitoring/alerts/${id}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function triggerMonitoringAction(
  token: string | null,
  action: string,
  opts?: { reason?: string; twofa_code?: string }
) {
  return adminFetch<{ action: string; triggered: boolean; executed: boolean; message: string }>('/monitoring/actions', {
    method: 'POST',
    token,
    body: { action, reason: opts?.reason, twofa_code: opts?.twofa_code },
  });
}

export function getMonitoringHistory(
  token: string | null,
  metric: 'api_latency' | 'db_latency' | 'redis_latency' | 'queue_size'
) {
  return adminFetch<{ metric: string; points: MonitoringHistoryPoint[] }>('/monitoring/history', {
    token,
    params: { metric },
  });
}

export function updateRpcProviderPriority(token: string | null, id: string, failover_priority: number) {
  return adminFetch<{ id: string; failover_priority: number }>(`/monitoring/rpc-providers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: { failover_priority },
  });
}

export function getMonitoringAlertRules(token: string | null) {
  return adminFetch<{ rules: Record<string, AlertRuleValue>; definitions: AlertRuleDefinition[] }>('/monitoring/alert-rules', { token });
}

export function patchMonitoringAlertRules(token: string | null, body: Record<string, AlertRuleValue | number>) {
  return adminFetch<{ rules: Record<string, AlertRuleValue> }>('/monitoring/alert-rules', { method: 'PATCH', token, body });
}

export function createMonitoringIncident(
  token: string | null,
  body: { service: string; severity?: string; title?: string; related_alert_id?: string; notes?: string },
) {
  return adminFetch<{ id: string }>('/monitoring/incidents', { method: 'POST', token, body });
}

export function patchMonitoringIncident(
  token: string | null,
  id: string,
  body: { status?: string; assigned_admin_id?: string; notes?: string; severity?: string },
) {
  return adminFetch<{ id: string; status?: string }>(`/monitoring/incidents/${id}`, { method: 'PATCH', token, body });
}

export function getMonitoringContainers(token: string | null) {
  return adminFetch<{ containers: Array<{ name: string; service: string; status: string; state: string; health: string | null; restart_count: number }>; docker_available: boolean }>(
    '/monitoring/containers',
    { token },
  );
}

export function getMonitoringContainerLogs(token: string | null, name: string, tail?: number) {
  return adminFetch<{ logs: string; container: string }>(`/monitoring/containers/${encodeURIComponent(name)}/logs`, {
    token,
    params: tail != null ? { tail } : undefined,
  });
}

export function getMonitoringIncidents(
  token: string | null,
  params?: { limit?: number; offset?: number; status?: string }
) {
  return adminFetch<{ incidents: IncidentRow[]; total: number }>('/monitoring/incidents', {
    token,
    params: params as Record<string, string | number | undefined>,
  });
}

export function getMonitoringWorkers(token: string | null) {
  return adminFetch<{ workers: WorkerRow[] }>('/monitoring/workers', { token });
}

export function getMonitoringTimeline(token: string | null, limit?: number) {
  return adminFetch<{ events: TimelineEventRow[] }>('/monitoring/timeline', {
    token,
    params: limit != null ? { limit } : undefined,
  });
}

export function getInfrastructureProviders(token: string | null) {
  return adminFetch<{ providers: InfrastructureProviderRow[] }>('/settings/infrastructure', { token });
}

export function createInfrastructureProvider(
  token: string | null,
  body: { provider_type: string; provider_name: string; endpoint_url?: string; api_key?: string; status?: string }
) {
  return adminFetch<{ id: string }>('/settings/infrastructure', { method: 'POST', token, body });
}

export function updateInfrastructureProvider(
  token: string | null,
  id: string,
  body: Partial<Pick<InfrastructureProviderRow, 'provider_name' | 'endpoint_url' | 'api_key' | 'status'>>
) {
  return adminFetch<{ id: string }>(`/settings/infrastructure/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body,
  });
}

export function deleteInfrastructureProvider(token: string | null, id: string) {
  return adminFetch<{ id: string }>(`/settings/infrastructure/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}
