/**
 * Public platform metrics for homepage — uptime, latency, security posture.
 * Aggregates /health probes, SLO, and platform security signals (no user PII).
 */
import { db } from '../lib/database.js';
import { getSloStatus } from './slo.service.js';
import { logger } from '../lib/logger.js';

export type PlatformPublicMetrics = {
  uptime_percent: number | null;
  matching_latency_p99_ms: number | null;
  ws_connected: boolean;
  security_metrics: {
    wallet_risk_score: number;
    withdrawal_risk_score: number;
    behavioral_anomaly: number;
    infrastructure_integrity: number;
  };
  service_latencies: Record<string, number | null>;
};

async function queryPlatformUptimePercent(): Promise<number | null> {
  try {
    const result = await db.queryRead<{ min_uptime: string | null; count: string }>(`
      SELECT MIN(uptime_seconds)::text AS min_uptime, COUNT(*)::text AS count
      FROM monitoring_workers
      WHERE status = 'running'
    `);
    const count = parseInt(result.rows[0]?.count ?? '0', 10);
    const minUptime = parseInt(result.rows[0]?.min_uptime ?? '0', 10);
    if (count > 0 && minUptime > 0) {
      const thirtyDays = 30 * 86400;
      const pct = Math.min(99.99, (minUptime / thirtyDays) * 100);
      return Math.round(pct * 100) / 100;
    }
  } catch { /* table may not exist */ }
  return null;
}

async function querySecurityAggregates(): Promise<{
  login_fail_24h: number;
  withdrawal_blocks_24h: number;
  risk_blocks_24h: number;
}> {
  let login_fail_24h = 0;
  let withdrawal_blocks_24h = 0;
  let risk_blocks_24h = 0;
  try {
    const loginRes = await db.queryRead<{ n: string }>(`
      SELECT COUNT(*)::text AS n FROM user_activity_logs
      WHERE activity_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours'
    `);
    login_fail_24h = parseInt(loginRes.rows[0]?.n ?? '0', 10) || 0;
  } catch { /* ignore */ }
  try {
    const wRes = await db.queryRead<{ n: string }>(`
      SELECT COUNT(*)::text AS n FROM withdrawals
      WHERE status = 'rejected' AND created_at > NOW() - INTERVAL '24 hours'
    `);
    withdrawal_blocks_24h = parseInt(wRes.rows[0]?.n ?? '0', 10) || 0;
  } catch { /* ignore */ }
  try {
    const rRes = await db.queryRead<{ n: string }>(`
      SELECT COUNT(*)::text AS n FROM user_activity_logs
      WHERE activity_type IN ('risk_block', 'withdrawal_blocked') AND created_at > NOW() - INTERVAL '24 hours'
    `);
    risk_blocks_24h = parseInt(rRes.rows[0]?.n ?? '0', 10) || 0;
  } catch { /* ignore */ }
  return { login_fail_24h, withdrawal_blocks_24h, risk_blocks_24h };
}

function clampScore(base: number, penalty: number): number {
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

export async function getPlatformPublicMetrics(healthPayload?: {
  status?: string;
  services?: Record<string, string>;
  checks?: Record<string, { latency_ms?: number }>;
  probe?: { dependency_latency_ms?: Record<string, number | null> };
}): Promise<PlatformPublicMetrics> {
  const [slo, uptimePct, secAgg] = await Promise.all([
    getSloStatus().catch(() => null),
    queryPlatformUptimePercent(),
    querySecurityAggregates(),
  ]);

  const depLatency = healthPayload?.probe?.dependency_latency_ms ?? {};
  const checks = healthPayload?.checks ?? {};
  const services = healthPayload?.services ?? {};
  const serviceNames = Object.keys(services);
  const healthyCount = serviceNames.filter((k) => services[k] === 'healthy' || services[k] === 'ok' || services[k] === 'up').length;
  const infrastructure_integrity =
    serviceNames.length > 0 ? Math.round((healthyCount / serviceNames.length) * 100) : 100;

  const loginPenalty = Math.min(40, secAgg.login_fail_24h / 10);
  const withdrawalPenalty = Math.min(35, secAgg.withdrawal_blocks_24h * 5);
  const anomalyPenalty = Math.min(30, secAgg.risk_blocks_24h * 3);

  const service_latencies: Record<string, number | null> = {
    database: depLatency.database ?? checks.database?.latency_ms ?? null,
    redis: depLatency.redis ?? checks.redis?.latency_ms ?? null,
    matching_engine: depLatency.matching_engine ?? checks.matching_engine?.latency_ms ?? null,
    nats: depLatency.nats ?? checks.nats?.latency_ms ?? null,
    indexer: depLatency.indexer ?? checks.indexer?.latency_ms ?? null,
  };

  return {
    uptime_percent: uptimePct,
    matching_latency_p99_ms: slo?.slo.order_latency_p99_ms.value ?? null,
    ws_connected: healthPayload?.status === 'healthy' || healthPayload?.status === 'degraded',
    security_metrics: {
      wallet_risk_score: clampScore(85, loginPenalty),
      withdrawal_risk_score: clampScore(80, withdrawalPenalty),
      behavioral_anomaly: clampScore(90, anomalyPenalty),
      infrastructure_integrity,
    },
    service_latencies,
  };
}
