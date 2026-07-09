/**
 * Dynamic alert rule definitions — single source of truth for monitoring thresholds.
 */
export type AlertRuleSeverity = 'critical' | 'warning' | 'info';

export interface AlertRuleValue {
  threshold: number;
  enabled: boolean;
  cooldown_sec: number;
  severity: AlertRuleSeverity;
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
  defaultSeverity: AlertRuleSeverity;
  defaultCooldownSec: number;
}

export const ALERT_RULE_DEFINITIONS: AlertRuleDefinition[] = [
  { key: 'api_latency_threshold_ms', label: 'API Latency', unit: 'ms', system: 'API', description: 'API response time threshold', defaultThreshold: 500, min: 50, max: 30000, defaultSeverity: 'critical', defaultCooldownSec: 900 },
  { key: 'api_error_rate_threshold_pct', label: 'API Error Rate', unit: '%', system: 'API', description: 'HTTP 5xx error rate', defaultThreshold: 5, min: 0, max: 100, defaultSeverity: 'warning', defaultCooldownSec: 900 },
  { key: 'queue_size_threshold', label: 'Queue Backlog', unit: 'items', system: 'Queues', description: 'Pending withdrawal + settlement items', defaultThreshold: 100, min: 1, max: 50000, defaultSeverity: 'warning', defaultCooldownSec: 600 },
  { key: 'settlement_lag_threshold_sec', label: 'Settlement Lag', unit: 's', system: 'Settlement', description: 'Oldest pending settlement age', defaultThreshold: 30, min: 5, max: 3600, defaultSeverity: 'warning', defaultCooldownSec: 600 },
  { key: 'rpc_failure_rate_threshold', label: 'RPC Failure Rate', unit: '%', system: 'RPC', description: 'Blockchain RPC error rate', defaultThreshold: 5, min: 0, max: 100, defaultSeverity: 'critical', defaultCooldownSec: 900 },
  { key: 'cpu_percent_threshold', label: 'CPU Usage', unit: '%', system: 'Resources', description: 'Backend container CPU', defaultThreshold: 85, min: 50, max: 100, defaultSeverity: 'warning', defaultCooldownSec: 900 },
  { key: 'memory_percent_threshold', label: 'Memory Usage', unit: '%', system: 'Resources', description: 'Backend container memory', defaultThreshold: 90, min: 50, max: 100, defaultSeverity: 'critical', defaultCooldownSec: 900 },
  { key: 'disk_percent_threshold', label: 'Disk Usage', unit: '%', system: 'Resources', description: 'Host disk utilization', defaultThreshold: 90, min: 50, max: 100, defaultSeverity: 'warning', defaultCooldownSec: 1800 },
  { key: 'db_latency_threshold_ms', label: 'Postgres Latency', unit: 'ms', system: 'Postgres', description: 'Database query latency', defaultThreshold: 200, min: 10, max: 10000, defaultSeverity: 'critical', defaultCooldownSec: 600 },
  { key: 'redis_latency_threshold_ms', label: 'Redis Latency', unit: 'ms', system: 'Redis', description: 'Redis ping latency', defaultThreshold: 50, min: 1, max: 5000, defaultSeverity: 'warning', defaultCooldownSec: 600 },
  { key: 'ws_disconnect_rate_threshold', label: 'WS Disconnect Rate', unit: '/min', system: 'WebSocket', description: 'WebSocket disconnects per minute', defaultThreshold: 50, min: 1, max: 10000, defaultSeverity: 'warning', defaultCooldownSec: 900 },
  { key: 'matching_engine_latency_threshold_ms', label: 'Matching Engine Latency', unit: 'ms', system: 'Matching Engine', description: 'ME health check latency', defaultThreshold: 500, min: 50, max: 30000, defaultSeverity: 'critical', defaultCooldownSec: 900 },
];

export const ALERT_RULE_KEYS = ALERT_RULE_DEFINITIONS.map((d) => d.key);

export function defaultRuleValue(def: AlertRuleDefinition): AlertRuleValue {
  return {
    threshold: def.defaultThreshold,
    enabled: true,
    cooldown_sec: def.defaultCooldownSec,
    severity: def.defaultSeverity,
  };
}

export function parseRuleValue(raw: string | null | undefined, def: AlertRuleDefinition): AlertRuleValue {
  const base = defaultRuleValue(def);
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as number | Partial<AlertRuleValue>;
    if (typeof parsed === 'number') {
      return { ...base, threshold: parsed };
    }
    return {
      threshold: typeof parsed.threshold === 'number' ? parsed.threshold : base.threshold,
      enabled: parsed.enabled !== false,
      cooldown_sec: typeof parsed.cooldown_sec === 'number' ? parsed.cooldown_sec : base.cooldown_sec,
      severity: (parsed.severity as AlertRuleSeverity) ?? base.severity,
    };
  } catch {
    return base;
  }
}

export function rulesRecordFromRows(rows: Array<{ key: string; value_json: string }>): Record<string, AlertRuleValue> {
  const map: Record<string, AlertRuleValue> = {};
  for (const def of ALERT_RULE_DEFINITIONS) {
    const row = rows.find((r) => r.key === def.key);
    map[def.key] = parseRuleValue(row?.value_json, def);
  }
  return map;
}
