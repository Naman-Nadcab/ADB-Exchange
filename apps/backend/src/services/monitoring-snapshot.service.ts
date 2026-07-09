/**
 * Monitoring snapshot — feeds admin monitoring UI (history charts, workers, alerts, timeline).
 * Observability only; never mutates trading, settlement, or balances.
 */
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

const LOG = 'monitoring_snapshot';
const HISTORY_MAX_POINTS = 1440; // 24h at 60s sampling
const HISTORY_TTL_SEC = 90_000;
const ALERT_DEDUPE_TTL_SEC = 900; // 15 min

export type HistoryMetric = 'api_latency' | 'db_latency' | 'redis_latency' | 'queue_size';

export type InfrastructureAlertInput = {
  system: string;
  severity: 'critical' | 'high' | 'medium' | 'warning' | 'info';
  message: string;
  dedupeKey: string;
  suggestedAction?: string;
  rootCause?: string;
  /** When true, skip external provider fan-out (caller already delivered). */
  skipExternalDelivery?: boolean;
};

let tablesReady = false;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;
const processStartedAt = Date.now();

async function ensureMonitoringTables(): Promise<void> {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS infrastructure_alerts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      system TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    DO $$ BEGIN
      ALTER TABLE infrastructure_alerts ADD COLUMN IF NOT EXISTS root_cause TEXT;
      ALTER TABLE infrastructure_alerts ADD COLUMN IF NOT EXISTS suggested_action TEXT;
      ALTER TABLE infrastructure_alerts ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
      ALTER TABLE infrastructure_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
      ALTER TABLE infrastructure_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
      ALTER TABLE infrastructure_alerts ADD COLUMN IF NOT EXISTS assigned_admin_id TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_infra_alerts_open_dedupe_key
    ON infrastructure_alerts (dedupe_key)
    WHERE status IN ('open', 'acknowledged') AND dedupe_key IS NOT NULL AND dedupe_key <> ''
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS monitoring_workers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      worker_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'unknown',
      uptime_seconds INTEGER NOT NULL DEFAULT 0,
      last_restart_at TIMESTAMPTZ
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS monitoring_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      event_type TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS monitoring_alert_rules (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  tablesReady = true;
}

export async function appendHistoryPoint(metric: HistoryMetric, value: number): Promise<void> {
  if (!Number.isFinite(value)) return;
  const key = `monitoring:history:${metric}`;
  try {
    const raw = await redis.get(key);
    let points: Array<{ timestamp: string; value: number }> = [];
    if (raw) {
      try {
        points = JSON.parse(raw) as Array<{ timestamp: string; value: number }>;
      } catch {
        points = [];
      }
    }
    points.push({ timestamp: new Date().toISOString(), value: Math.round(value * 100) / 100 });
    if (points.length > HISTORY_MAX_POINTS) {
      points = points.slice(-HISTORY_MAX_POINTS);
    }
    await redis.set(key, JSON.stringify(points), HISTORY_TTL_SEC);
  } catch (e) {
    logger.debug(`${LOG}: appendHistoryPoint failed`, { metric, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function recordMonitoringEvent(eventType: string, message: string): Promise<void> {
  try {
    await ensureMonitoringTables();
    await db.query('INSERT INTO monitoring_events (event_type, message) VALUES ($1, $2)', [
      eventType.slice(0, 120),
      message.slice(0, 2000),
    ]);
  } catch (e) {
    logger.debug(`${LOG}: recordMonitoringEvent failed`, { eventType, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function upsertWorkerHeartbeat(
  workerName: string,
  status: 'running' | 'degraded' | 'stopped' | 'unknown',
  uptimeSeconds?: number
): Promise<void> {
  try {
    await ensureMonitoringTables();
    const uptime = uptimeSeconds ?? Math.floor((Date.now() - processStartedAt) / 1000);
    await db.query(
      `INSERT INTO monitoring_workers (worker_name, status, uptime_seconds, last_restart_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (worker_name) DO UPDATE SET
         status = EXCLUDED.status,
         uptime_seconds = EXCLUDED.uptime_seconds,
         last_restart_at = CASE WHEN monitoring_workers.status = 'stopped' AND EXCLUDED.status = 'running'
           THEN NOW() ELSE monitoring_workers.last_restart_at END`,
      [workerName, status, uptime]
    );
  } catch (e) {
    logger.debug(`${LOG}: upsertWorkerHeartbeat failed`, { workerName, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function upsertInfrastructureAlert(input: InfrastructureAlertInput): Promise<string | null> {
  try {
    await ensureMonitoringTables();
    const dedupeRedisKey = `monitoring:alert:dedupe:${input.dedupeKey}`;
    const seen = await redis.get(dedupeRedisKey).catch(() => null);
    if (seen) return null;

    const existing = await db.query<{ id: string }>(
      `SELECT id::text FROM infrastructure_alerts
       WHERE dedupe_key = $1 AND status IN ('open', 'acknowledged')
       ORDER BY created_at DESC LIMIT 1`,
      [input.dedupeKey]
    );
    if (existing.rows[0]?.id) return existing.rows[0].id;

    const insert = await db.query<{ id: string }>(
      `INSERT INTO infrastructure_alerts (system, severity, message, status, root_cause, suggested_action, dedupe_key)
       VALUES ($1, $2, $3, 'open', $4, $5, $6)
       ON CONFLICT (dedupe_key) WHERE (status IN ('open', 'acknowledged') AND dedupe_key IS NOT NULL AND dedupe_key <> '')
       DO NOTHING
       RETURNING id::text`,
      [
        input.system,
        input.severity,
        input.message.slice(0, 2000),
        input.rootCause?.slice(0, 1000) ?? null,
        input.suggestedAction?.slice(0, 1000) ?? null,
        input.dedupeKey,
      ]
    );
    const alertId = insert.rows[0]?.id ?? null;
    await redis.set(dedupeRedisKey, '1', ALERT_DEDUPE_TTL_SEC).catch(() => {});
    await recordMonitoringEvent('infrastructure_alert', `${input.system}: ${input.message.slice(0, 500)}`);

    if (alertId) {
      try {
        const { publishSystemAlert } = await import('./admin-ws.service.js');
        publishSystemAlert({
          id: alertId,
          system: input.system,
          severity: input.severity,
          message: input.message,
          suggested_action: input.suggestedAction,
          root_cause: input.rootCause,
        });
      } catch {
        /* WS optional */
      }
    }
    return alertId;
  } catch (e) {
    logger.warn(`${LOG}: upsertInfrastructureAlert failed`, { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

async function computeApiErrorRatePct(): Promise<number> {
  try {
    const { httpRequestErrorsTotal, httpRequestDuration } = await import('../lib/prometheus-metrics.js');
    const [errMetric, durMetric] = await Promise.all([httpRequestErrorsTotal.get(), httpRequestDuration.get()]);
    const errors = (errMetric.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
    const total = (durMetric.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
    if (total <= 0) {
      const cached = await redis.get('monitoring:api_error_rate_pct').catch(() => null);
      return cached ? parseFloat(cached) || 0 : 0;
    }
    const pct = Math.round((errors / total) * 1000) / 10;
    await redis.set('monitoring:api_error_rate_pct', String(pct), 300).catch(() => {});
    return pct;
  } catch {
    const cached = await redis.get('monitoring:api_error_rate_pct').catch(() => null);
    return cached ? parseFloat(cached) || 0 : 0;
  }
}

async function loadAlertRules(): Promise<Record<string, import('../lib/monitoring-alert-rules.js').AlertRuleValue>> {
  const { ALERT_RULE_DEFINITIONS, rulesRecordFromRows } = await import('../lib/monitoring-alert-rules.js');
  try {
    await ensureMonitoringTables();
    const keys = ALERT_RULE_DEFINITIONS.map((d) => d.key);
    const rows = await db.query<{ key: string; value_json: string }>(
      `SELECT key, value_json FROM monitoring_alert_rules WHERE key = ANY($1::text[])`,
      [keys],
    );
    return rulesRecordFromRows(rows.rows);
  } catch {
    const { rulesRecordFromRows } = await import('../lib/monitoring-alert-rules.js');
    return rulesRecordFromRows([]);
  }
}

async function ruleCooldownOk(ruleKey: string, cooldownSec: number): Promise<boolean> {
  if (cooldownSec <= 0) return true;
  const k = `monitoring:rule:cooldown:${ruleKey}`;
  const seen = await redis.get(k).catch(() => null);
  return !seen;
}

async function setRuleCooldown(ruleKey: string, cooldownSec: number): Promise<void> {
  if (cooldownSec <= 0) return;
  const k = `monitoring:rule:cooldown:${ruleKey}`;
  await redis.set(k, '1', cooldownSec).catch(() => {});
}

async function evaluateRuleAlert(
  ruleKey: string,
  current: number,
  rule: import('../lib/monitoring-alert-rules.js').AlertRuleValue,
  input: Omit<InfrastructureAlertInput, 'severity' | 'message' | 'dedupeKey'>,
  message: string,
): Promise<void> {
  if (!rule.enabled || current < rule.threshold) return;
  if (!(await ruleCooldownOk(ruleKey, rule.cooldown_sec))) return;
  const alertId = await upsertInfrastructureAlert({
    ...input,
    severity: rule.severity === 'info' ? 'info' : rule.severity === 'warning' ? 'warning' : 'critical',
    message,
    dedupeKey: ruleKey,
  });
  if (alertId) {
    await setRuleCooldown(ruleKey, rule.cooldown_sec);
  }
}

async function evaluateThresholdAlerts(snapshot: {
  apiLatencyMs: number;
  dbLatencyMs: number;
  redisLatencyMs: number;
  queueTotal: number;
  apiErrorRatePct: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  settlementPending: number;
  settlementLagSec: number;
}): Promise<void> {
  const rules = await loadAlertRules();

  await evaluateRuleAlert(
    'api_latency_threshold_ms',
    snapshot.apiLatencyMs,
    rules.api_latency_threshold_ms!,
    { system: 'API', rootCause: 'High request load or downstream dependency latency', suggestedAction: 'Check /monitoring and /system/health' },
    `API latency elevated: ${snapshot.apiLatencyMs}ms (threshold ${rules.api_latency_threshold_ms!.threshold}ms)`,
  );

  await evaluateRuleAlert(
    'api_error_rate_threshold_pct',
    snapshot.apiErrorRatePct,
    rules.api_error_rate_threshold_pct!,
    { system: 'API', rootCause: 'Elevated HTTP 5xx responses', suggestedAction: 'Inspect backend logs and /metrics' },
    `API error rate: ${snapshot.apiErrorRatePct}% (threshold ${rules.api_error_rate_threshold_pct!.threshold}%)`,
  );

  await evaluateRuleAlert(
    'queue_size_threshold',
    snapshot.queueTotal,
    rules.queue_size_threshold!,
    { system: 'Queues', rootCause: 'Withdrawal, settlement, or matching backlog growing', suggestedAction: 'Review Operations Hub queues' },
    `Queue backlog: ${snapshot.queueTotal} items (threshold ${rules.queue_size_threshold!.threshold})`,
  );

  await evaluateRuleAlert(
    'settlement_lag_threshold_sec',
    snapshot.settlementLagSec,
    rules.settlement_lag_threshold_sec!,
    { system: 'Settlement', rootCause: 'Settlement pipeline processing slower than ingest', suggestedAction: 'Check settlement worker and circuit breaker' },
    `Settlement lag: ${snapshot.settlementLagSec}s (${snapshot.settlementPending} pending)`,
  );

  await evaluateRuleAlert(
    'cpu_percent_threshold',
    snapshot.cpuPercent,
    rules.cpu_percent_threshold!,
    { system: 'Resources', suggestedAction: 'Review container resources; scale backend if sustained' },
    `CPU utilization high: ${snapshot.cpuPercent}% (threshold ${rules.cpu_percent_threshold!.threshold}%)`,
  );

  await evaluateRuleAlert(
    'memory_percent_threshold',
    snapshot.memoryPercent,
    rules.memory_percent_threshold!,
    { system: 'Resources', suggestedAction: 'Check for memory leaks; restart backend after investigation' },
    `Memory utilization high: ${snapshot.memoryPercent}% (threshold ${rules.memory_percent_threshold!.threshold}%)`,
  );

  await evaluateRuleAlert(
    'disk_percent_threshold',
    snapshot.diskPercent,
    rules.disk_percent_threshold!,
    { system: 'Resources', suggestedAction: 'Free disk space or expand volume' },
    `Disk utilization high: ${snapshot.diskPercent}% (threshold ${rules.disk_percent_threshold!.threshold}%)`,
  );

  await evaluateRuleAlert(
    'db_latency_threshold_ms',
    snapshot.dbLatencyMs,
    rules.db_latency_threshold_ms!,
    { system: 'Postgres', suggestedAction: 'Check Postgres slow queries and connection pool' },
    `Postgres latency: ${snapshot.dbLatencyMs}ms (threshold ${rules.db_latency_threshold_ms!.threshold}ms)`,
  );

  await evaluateRuleAlert(
    'redis_latency_threshold_ms',
    snapshot.redisLatencyMs,
    rules.redis_latency_threshold_ms!,
    { system: 'Redis', suggestedAction: 'Check Redis memory and network' },
    `Redis latency: ${snapshot.redisLatencyMs}ms (threshold ${rules.redis_latency_threshold_ms!.threshold}ms)`,
  );
}

async function probeComponentWorkers(): Promise<void> {
  const uptimeSec = Math.floor(process.uptime());
  const runMode = config.runMode ?? 'all';
  if (runMode !== 'workers') {
    await upsertWorkerHeartbeat(`backend-${config.nodeId}`, 'running', uptimeSec);
  }
  if (runMode !== 'api') {
    await upsertWorkerHeartbeat(`workers-${config.nodeId}`, 'running', uptimeSec);
  }

  let dbOk = false;
  const dbStart = Date.now();
  try {
    await db.query('SELECT 1');
    dbOk = true;
    await upsertWorkerHeartbeat('postgres', 'running', uptimeSec);
    await redis.set('monitoring:db_latency_ms', String(Date.now() - dbStart), 120).catch(() => {});
  } catch {
    await upsertWorkerHeartbeat('postgres', 'stopped', 0);
  }

  const redisStart = Date.now();
  try {
    await redis.ping();
    await upsertWorkerHeartbeat('redis', 'running', uptimeSec);
    await redis.set('monitoring:redis_latency_ms', String(Date.now() - redisStart), 120).catch(() => {});
  } catch {
    await upsertWorkerHeartbeat('redis', 'stopped', 0);
  }

  if (config.rustMatchingEngine.enabled && config.rustMatchingEngine.url?.trim()) {
    try {
      const base = config.rustMatchingEngine.url.split(',')[0]!.trim();
      const u = new URL('/health', base.endsWith('/') ? base : `${base}/`);
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(u.toString(), { signal: ctrl.signal }).catch(() => null);
      clearTimeout(to);
      await upsertWorkerHeartbeat(
        'matching-engine',
        res?.ok ? 'running' : 'degraded',
        res?.ok ? uptimeSec : 0
      );
    } catch {
      await upsertWorkerHeartbeat('matching-engine', 'stopped', 0);
    }
  }

  try {
    const { getStats } = await import('./spot-ws.service.js');
    const ws = getStats();
    await upsertWorkerHeartbeat('websocket', ws.connections >= 0 ? 'running' : 'degraded', uptimeSec);
    await redis.set('admin:ws:connections', String(ws.connections), 120).catch(() => {});
  } catch {
    await upsertWorkerHeartbeat('websocket', 'unknown', uptimeSec);
  }

  try {
    const { getLastSettlementBacklogSnapshot } = await import('./settlement-pipeline-health.service.js');
    const snap = getLastSettlementBacklogSnapshot();
    const status =
      snap.pendingCount === 0 ? 'running' : snap.oldestPendingAgeSeconds >= 120 ? 'degraded' : 'running';
    await upsertWorkerHeartbeat('settlement-pipeline', status, uptimeSec);
  } catch {
    await upsertWorkerHeartbeat('settlement-pipeline', 'unknown', uptimeSec);
  }

  if (!dbOk) {
    await upsertInfrastructureAlert({
      system: 'Postgres',
      severity: 'critical',
      message: 'Database health check failed',
      dedupeKey: 'postgres_down',
      suggestedAction: 'Verify Postgres connectivity and connection pool',
    });
  }
}

/**
 * Single monitoring snapshot tick — samples metrics, updates Redis keys, history, workers, alerts.
 */
export async function runMonitoringSnapshot(): Promise<void> {
  const tickStart = Date.now();
  let dbLatencyMs = 0;
  let redisLatencyMs = 0;
  let settlementPending = 0;
  let settlementLagSec = 0;
  let withdrawalPending = 0;
  let matchingPending = 0;

  try {
    const dbStart = Date.now();
    await db.query('SELECT 1');
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbLatencyMs = 9999;
  }

  try {
    const redisStart = Date.now();
    await redis.ping();
    redisLatencyMs = Date.now() - redisStart;
  } catch {
    redisLatencyMs = 9999;
  }

  try {
    const { refreshSettlementBacklogSnapshot } = await import('./settlement-pipeline-health.service.js');
    const snap = await refreshSettlementBacklogSnapshot();
    settlementPending = snap.pendingCount;
    settlementLagSec = snap.oldestPendingAgeSeconds;
    await redis.set('monitoring:queue:settlement', String(settlementPending), 120).catch(() => {});
  } catch {
    /* optional */
  }

  try {
    const wd = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM withdrawals
       WHERE status IN ('pending_approval','pending_email_verify','pending_2fa','processing','pending_blockchain')`
    );
    withdrawalPending = parseInt(wd.rows[0]?.n ?? '0', 10) || 0;
    await redis.set('monitoring:queue:withdrawal', String(withdrawalPending), 120).catch(() => {});
  } catch {
    /* optional */
  }

  try {
    const { settlementMatchStreamPending } = await import('../lib/prometheus-metrics.js');
    const metric = await settlementMatchStreamPending.get();
    matchingPending = Math.round((metric.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0));
    await redis.set('monitoring:queue:matching', String(matchingPending), 120).catch(() => {});
  } catch {
    /* optional */
  }

  const apiLatencyMs = Date.now() - tickStart;
  await redis.set('monitoring:api_latency_ms', String(apiLatencyMs), 120).catch(() => {});

  const apiErrorRatePct = await computeApiErrorRatePct();
  const queueTotal = withdrawalPending + settlementPending + matchingPending;

  const os = await import('os');
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memoryPercent = totalMem > 0 ? Math.round((1 - freeMem / totalMem) * 100) : 0;
  const load = os.loadavg();
  const cpuPercent = load[0] != null && Number.isFinite(load[0]) ? Math.min(100, Math.round(load[0] * 25)) : 0;
  let diskPercent = 0;
  try {
    const { execSync } = await import('child_process');
    const out = execSync("df -h . 2>/dev/null | tail -1 | awk '{print $5}'").toString().trim();
    const pct = parseInt(out.replace('%', ''), 10);
    if (Number.isFinite(pct)) diskPercent = pct;
  } catch {
    diskPercent = 0;
  }

  await Promise.all([
    appendHistoryPoint('api_latency', apiLatencyMs),
    appendHistoryPoint('db_latency', dbLatencyMs),
    appendHistoryPoint('redis_latency', redisLatencyMs),
    appendHistoryPoint('queue_size', queueTotal),
  ]);

  await probeComponentWorkers();

  await evaluateThresholdAlerts({
    apiLatencyMs,
    dbLatencyMs,
    redisLatencyMs,
    queueTotal,
    apiErrorRatePct,
    cpuPercent,
    memoryPercent,
    diskPercent,
    settlementPending,
    settlementLagSec,
  });

  try {
    const { broadcastAdminMetrics } = await import('./admin-ws.service.js');
    broadcastAdminMetrics('metrics_snapshot', {
      api_latency_ms: apiLatencyMs,
      db_latency_ms: dbLatencyMs,
      redis_latency_ms: redisLatencyMs,
      queue_total: queueTotal,
      api_error_rate_pct: apiErrorRatePct,
      cpu_percent: cpuPercent,
      memory_percent: memoryPercent,
      disk_percent: diskPercent,
      settlement_pending: settlementPending,
      settlement_lag_sec: settlementLagSec,
    });
  } catch { /* optional */ }
}

export function startMonitoringSnapshotLoop(intervalMs = 60_000): ReturnType<typeof setInterval> {
  if (snapshotTimer) return snapshotTimer;
  void runMonitoringSnapshot().catch((e) =>
    logger.warn(`${LOG}: initial snapshot failed`, { error: e instanceof Error ? e.message : String(e) })
  );
  snapshotTimer = setInterval(() => {
    void runMonitoringSnapshot().catch((e) =>
      logger.warn(`${LOG}: snapshot tick failed`, { error: e instanceof Error ? e.message : String(e) })
    );
  }, intervalMs);
  logger.info(`${LOG}: snapshot loop started`, { intervalMs });
  return snapshotTimer;
}

export function stopMonitoringSnapshotLoop(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
}
