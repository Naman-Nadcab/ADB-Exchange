'use client';

import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users, TrendingUp, DollarSign, BarChart3, ArrowUpFromLine,
  AlertTriangle, Repeat, PauseCircle, Loader2, Play,
  Wallet, Zap, Timer, ChevronDown, RefreshCw,
  ArrowLeftRight, ArrowDownToLine, BadgeCheck, ListOrdered, Percent, Info,
  Activity, Shield, Database, Cpu, Globe, Server,
  Clock, ArrowRight, ChevronRight, CircleDot, Flame, Radio, Banknote,
} from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { useAdminAlertStore } from '@/store/adminAlerts';
import {
  getDashboardSummary, getSystemHealth, getControlOverview,
  getExchangeHealthTier1, adminFetch,
} from '@/lib/api';
import { ExchangeHealthTier1Banner, TIER1_QUERY_KEY } from '@/components/admin-shell/ExchangeHealthTier1Banner';
import { getFiatWithdrawals } from '@/lib/fiat-withdrawals-api';
import {
  evaluateAlerts, computeHealthScore, trendPredictionsToAlerts, type ExchangeMetrics,
} from '@/components/admin-v2/alert-engine';
import { useAnomalyDetector, type AnomalyResult } from '@/components/admin-v2/useAnomalyDetector';
import { useIncidentDetector, type IncidentSuggestion } from '@/components/admin-v2/useIncidentDetector';
import { useTrendAnalyzer, type TrendPrediction } from '@/components/admin-v2/useTrendAnalyzer';
import { useSuggestionEngine } from '@/components/admin-v2/useSuggestionEngine';
import { useAuditIntegration } from '@/components/admin-v2/useAuditIntegration';
import { HeatmapIndicator } from '@/components/admin-v2/HeatmapIndicator';
import { SmartTooltip } from '@/components/admin-v2/SmartTooltip';
import { IncidentBanner } from '@/components/admin-v2/IncidentBanner';
import { IncidentPrompt } from '@/components/admin-v2/IncidentPrompt';
import { Button, SafeActionModal } from '@/components/ui';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ADMIN_FEATURE_FLAGS } from '@/lib/admin/featureFlags';
import { cn } from '@/lib/cn';
import { getControlHealthScore } from '@/lib/control-api';
import { displayMetric, metricOrNull } from '@/lib/format-metric';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';

/* ────────────────────── constants ────────────────────── */

type RefreshRate = 10000 | 15000 | 30000 | 60000;
const REFRESH_OPTIONS: { label: string; value: RefreshRate }[] = [
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
];

const PANEL_TIPS = {
  healthScore: { tip: 'Composite score (0–100) from latency, errors, queue depth, and risk signals.', danger: 'Below 70 = degraded. Below 50 = critical.' },
  volume: { tip: '24h aggregate trading volume across all spot pairs.', danger: 'Sudden 2x spike may indicate wash trading.' },
  users: { tip: 'Total registered users on the platform.' },
  pendingWithdrawals: { tip: 'Withdrawals awaiting approval or chain confirmation.', danger: '>100 = processing bottleneck.' },
} as const;

const CIRCUMFERENCE = 2 * Math.PI * 40;

type Tier1Overall = 'GREEN' | 'YELLOW' | 'RED';

function tier1ScoreCap(overall?: Tier1Overall): number {
  if (overall === 'RED') return 58;
  if (overall === 'YELLOW') return 78;
  return 100;
}

function tier1EngineBarScore(reasons: string[]): number | null {
  const hit = reasons.find((r) => r.startsWith('matching_engine'));
  if (!hit) return null;
  if (hit.includes('unreachable') || hit.includes('http_')) return 18;
  return 35;
}

function formatTier1Reason(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/^matching engine:/i, 'Matching engine:')
    .replace(/^database:/i, 'Database:')
    .replace(/^redis:/i, 'Redis:');
}

function issueNavTarget(reason: string): string {
  if (reason.startsWith('matching_engine')) return '/monitoring';
  if (reason.startsWith('database') || reason.startsWith('redis')) return '/monitoring';
  if (reason.includes('trading_halt')) return '/admin-control';
  if (reason.includes('settlement')) return '/control-center';
  if (reason.includes('treasury')) return '/treasury';
  if (reason.startsWith('mm_')) return '/admin/mm-control';
  return '/monitoring';
}

/* ────────────────────── hooks ────────────────────── */

function useResilientQuery<T>(options: Parameters<typeof useQuery<T>>[0]) {
  const lastGoodRef = useRef<T | undefined>(undefined);
  const result = useQuery<T>(options);
  if (result.data !== undefined) lastGoodRef.current = result.data;
  return { ...result, data: result.data ?? lastGoodRef.current, isStale: result.isError && lastGoodRef.current !== undefined };
}

function useSparklineHistory(value: number, maxLen = 20): number[] {
  const histRef = useRef<number[]>([]);
  useEffect(() => {
    if (value === 0 && histRef.current.length === 0) return;
    histRef.current = [...histRef.current.slice(-(maxLen - 1)), value];
  }, [value, maxLen]);
  return histRef.current;
}

/** Smooth numeric transitions when live metrics refresh. */
function useAnimatedNumber(target: number, duration = 480): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

/* ────────────────────── main page ────────────────────── */

export default function DashboardPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const admin = useAdminAuthStore((s) => s.admin);
  const queryClient = useQueryClient();
  const addAlerts = useAdminAlertStore((s) => s.addAlerts);
  const addPredictiveAlerts = useAdminAlertStore((s) => s.addPredictiveAlerts);
  const storeAlertCount = useAdminAlertStore((s) => s.unreadCount);
  const detectAnomaly = useAnomalyDetector();
  const detectIncident = useIncidentDetector();
  const trendAnalyzer = useTrendAnalyzer();
  useAuditIntegration();

  const addAlertsRef = useRef(addAlerts);
  addAlertsRef.current = addAlerts;
  const addPredictiveAlertsRef = useRef(addPredictiveAlerts);
  addPredictiveAlertsRef.current = addPredictiveAlerts;
  const detectIncidentRef = useRef(detectIncident);
  detectIncidentRef.current = detectIncident;

  const [globalRefresh, setGlobalRefresh] = useState<RefreshRate>(15000);
  const [refreshDropdownOpen, setRefreshDropdownOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [incidentSuggestion, setIncidentSuggestion] = useState<IncidentSuggestion | null>(null);
  const [trendPredictions, setTrendPredictions] = useState<TrendPrediction[]>([]);
  useSuggestionEngine(trendPredictions);

  const refetchWhenVisible = useCallback(
    (ms: number) => () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible' ? ms : false,
    []
  );

  /**
   * NOTE: queryKeys intentionally DO NOT include `token`. The three shell-shared
   * queries (`dashboard-summary`, `system-health`, `control`) are also fetched
   * by `UnifiedTopbar` / `ExchangeHealthTier1Banner`; sharing the key lets
   * React Query dedup the request and serve the topbar's cache instantly on
   * dashboard mount (and vice versa). Token is injected via queryFn only.
   */
  const { data: summaryRes, isLoading: statsLoading, isError: summaryIsError, error: summaryError, refetch: refetchSummary, dataUpdatedAt: summaryUpdatedAt, isFetching: summaryFetching } = useResilientQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn: ({ signal }) => getDashboardSummary(token, signal),
    enabled: !!token,
    refetchInterval: refetchWhenVisible(globalRefresh),
    staleTime: 60_000,
  });

  const { data: healthRes, isError: healthIsError, error: healthError, refetch: refetchHealth, dataUpdatedAt: healthUpdatedAt, isFetching: healthFetching } = useResilientQuery({
    queryKey: ['admin', 'system-health'],
    queryFn: ({ signal }) => getSystemHealth(token, signal),
    enabled: !!token,
    refetchInterval: refetchWhenVisible(Math.min(globalRefresh, 30_000)),
    staleTime: 60_000,
  });

  const { data: controlRes, isError: controlIsError, error: controlError, refetch: refetchControl, dataUpdatedAt: controlUpdatedAt, isFetching: controlFetching } = useResilientQuery({
    queryKey: ['admin', 'control'],
    queryFn: ({ signal }) => getControlOverview(token, signal),
    enabled: !!token,
    refetchInterval: refetchWhenVisible(Math.min(globalRefresh, 30_000)),
    staleTime: 60_000,
  });

  const { data: revenueRes, isError: revenueIsError, error: revenueError, refetch: refetchRevenue } = useResilientQuery({
    queryKey: ['admin', 'analytics-revenue-7d'],
    queryFn: ({ signal }) => adminFetch<{ buckets: unknown[]; total_revenue_24h: number; trading_fee_revenue: number; withdrawal_fee_revenue: number; other_fees: number }>('/analytics/revenue?period=7d', { token, signal }),
    enabled: !!token,
    refetchInterval: refetchWhenVisible(60_000),
    staleTime: 120_000,
  });

  const { data: tier1Res, dataUpdatedAt: tier1UpdatedAt, isFetching: tier1Fetching } = useResilientQuery({
    queryKey: ['admin', TIER1_QUERY_KEY],
    queryFn: ({ signal }) => getExchangeHealthTier1(token, signal),
    enabled: !!token,
    refetchInterval: refetchWhenVisible(Math.min(globalRefresh, 30_000)),
    staleTime: 15_000,
  });

  const { data: fiatPendingRes } = useResilientQuery({
    queryKey: ['admin', 'fiat-withdrawals', 'pending-count'],
    queryFn: ({ signal }) => getFiatWithdrawals(token, { status: 'pending', limit: 100 }),
    enabled: !!token,
    staleTime: 60_000,
    refetchInterval: refetchWhenVisible(60_000),
  });

  const { data: smartAlertsRes } = useResilientQuery({
    queryKey: ['admin', 'dashboard-smart-alerts'],
    queryFn: ({ signal }) => adminFetch<{ summary?: { amlOpen?: number } }>('/operations/smart-alerts', { token, signal }),
    enabled: !!token,
    staleTime: 60_000,
    refetchInterval: refetchWhenVisible(60_000),
  });

  const { data: securityDashRes } = useResilientQuery({
    queryKey: ['admin', 'security-dashboard'],
    queryFn: ({ signal }) => adminFetch<{ accounts?: { loginFailedLast24h?: number; usersCurrentlyLocked?: number } }>('/security/dashboard', { token, signal }),
    enabled: !!token,
    staleTime: 60_000,
    refetchInterval: refetchWhenVisible(60_000),
  });

  const { data: backendHealthScoreRes } = useResilientQuery({
    queryKey: ['admin', 'control', 'health-score'],
    queryFn: () => getControlHealthScore(token),
    enabled: !!token && ADMIN_FEATURE_FLAGS.ADMIN_PRODUCTION_HARDENING,
    refetchInterval: refetchWhenVisible(Math.min(globalRefresh, 30_000)),
    staleTime: 15_000,
  });

  const summary = summaryRes?.data;
  const users = summary?.stats?.users;
  const p2p = summary?.stats?.p2p;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const health = healthRes?.data as Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const control = controlRes?.data as Record<string, any> | undefined;
  const halted = summary?.halted ?? false;
  const tier1 = tier1Res?.data;
  const tier1Overall = tier1?.overall as Tier1Overall | undefined;
  const tier1Reasons = tier1?.reasons ?? [];
  const tier1Components = tier1?.components as Record<string, { ok?: boolean; detail?: string; latency_ms?: number }> | undefined;
  const pendingKyc = (summary?.stats?.kyc?.pending ?? 0) + (summary?.stats?.kyc?.underReview ?? 0);
  const pendingFiatInr = fiatPendingRes?.data?.length ?? 0;

  const totalUsers = users?.total ?? 0;
  const pendingWithdrawals = summary?.pendingWithdrawals ?? 0;
  const openDisputes = p2p?.openDisputes ?? 0;
  const activeMarkets = (control?.markets as { active?: number })?.active ?? 0;
  const volume24h = summary?.tradingVolume24h ?? 0;
  const revenue7dData = revenueRes?.data;
  const revenue7dTotal = useMemo(() => {
    if (!revenue7dData?.buckets) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (revenue7dData.buckets as any[]).reduce((sum: number, b: any) => sum + (parseFloat(b.revenue ?? '0') || 0), 0);
  }, [revenue7dData]);

  const dbLatency = metricOrNull(
    health?.database?.latency_ms ?? health?.database?.latencyMs,
    !!healthRes?.data,
  );
  const redisLatency = metricOrNull(
    health?.redis?.latency_ms ?? health?.redis?.latencyMs,
    !!healthRes?.data,
  );
  const wsConnections = metricOrNull(health?.websocket?.connections, !!healthRes?.data);
  const apiLatency = metricOrNull(health?.api_latency_ms, !!healthRes?.data);
  const apiErrorRate = metricOrNull(health?.api_error_rate_pct, !!healthRes?.data);
  const memoryMb = metricOrNull(health?.node?.memory_heap_mb, !!healthRes?.data);
  const uptime = metricOrNull(health?.node?.uptime_sec, !!healthRes?.data);
  const settlementPending = metricOrNull(health?.queue?.settlement_pending, !!healthRes?.data);
  const withdrawalQueueTotal = metricOrNull(
    health?.queue?.total_withdrawal_queue ?? pendingWithdrawals,
    !!healthRes?.data || !!summary,
  );

  const p50Latency = metricOrNull(control?.spotMetrics?.orderLatencyP50Ms, !!controlRes?.data);
  const p99Latency = metricOrNull(control?.spotMetrics?.orderLatencyP99Ms, !!controlRes?.data);
  const ordersPerSec = metricOrNull(control?.spotMetrics?.ordersPerSecond, !!controlRes?.data);

  const exchangeMetrics = useMemo<ExchangeMetrics>(() => ({
    engineLatencyMs: p50Latency ?? 0, p99LatencyMs: p99Latency ?? 0, apiLatencyMs: apiLatency ?? 0,
    apiErrorRate: apiErrorRate ?? 0, withdrawalQueue: withdrawalQueueTotal ?? 0, settlementPending: settlementPending ?? 0,
    amlAlertsOpen: smartAlertsRes?.data?.summary?.amlOpen ?? 0,
    amlHighSeverity: 0,
    failedLogins24h: securityDashRes?.data?.accounts?.loginFailedLast24h ?? 0,
    lockedAccounts: securityDashRes?.data?.accounts?.usersCurrentlyLocked ?? 0,
    tradingHalted: halted, dbLatencyMs: dbLatency ?? 0, redisLatencyMs: redisLatency ?? 0,
    memoryMb: memoryMb ?? 0, wsConnections: wsConnections ?? 0,
  }), [p50Latency, p99Latency, apiLatency, apiErrorRate, withdrawalQueueTotal, settlementPending, smartAlertsRes, securityDashRes, halted, dbLatency, redisLatency, memoryMb, wsConnections]);

  const backendHealthScore = backendHealthScoreRes?.data?.score;
  const computedHealthScore = useMemo(() => computeHealthScore(exchangeMetrics), [exchangeMetrics]);
  const healthScore = useMemo(() => {
    if (ADMIN_FEATURE_FLAGS.ADMIN_PRODUCTION_HARDENING) {
      if (backendHealthScore == null || !Number.isFinite(backendHealthScore)) return null;
      return Math.min(backendHealthScore, tier1ScoreCap(tier1Overall));
    }
    return Math.min(computedHealthScore, tier1ScoreCap(tier1Overall));
  }, [backendHealthScore, computedHealthScore, tier1Overall]);
  const orderAnomaly = useMemo(() => detectAnomaly('orders-sec', ordersPerSec ?? 0), [detectAnomaly, ordersPerSec]);
  const latencyAnomaly = useMemo(() => detectAnomaly('latency-p50', p50Latency ?? 0), [detectAnomaly, p50Latency]);
  const volumeAnomaly = useMemo(() => detectAnomaly('volume-24h', volume24h), [detectAnomaly, volume24h]);

  /* sparkline histories */
  const volumeHist = useSparklineHistory(volume24h);
  const ordersHist = useSparklineHistory(ordersPerSec ?? 0);
  const latencyHist = useSparklineHistory(apiLatency ?? 0);

  const lastMetricsKeyRef = useRef('');

  useEffect(() => {
    if (!ADMIN_FEATURE_FLAGS.ADMIN_PRODUCTION_HARDENING) return;
    if (!health && !control) return;
    // Backend infrastructure_alerts are synced via useAlertCenterSync — no client-side alert generation.
  }, [health, control]);

  /* legacy client alert path disabled under production hardening */
  useEffect(() => {
    if (ADMIN_FEATURE_FLAGS.ADMIN_PRODUCTION_HARDENING || ADMIN_FEATURE_FLAGS.ADMIN_AI_OPS) return;
    const timeout = setTimeout(() => {
      const metricsKey = `${exchangeMetrics.engineLatencyMs}:${exchangeMetrics.p99LatencyMs}:${exchangeMetrics.apiErrorRate}:${exchangeMetrics.withdrawalQueue}:${exchangeMetrics.memoryMb}:${volume24h}`;
      if (metricsKey === lastMetricsKeyRef.current) return;
      lastMetricsKeyRef.current = metricsKey;

      const alerts = ADMIN_FEATURE_FLAGS.ADMIN_PRODUCTION_HARDENING ? [] : evaluateAlerts(exchangeMetrics);
      if (alerts.length > 0) {
        addAlertsRef.current(alerts);
        if (ADMIN_FEATURE_FLAGS.ADMIN_INCIDENT_MANAGEMENT) {
          const suggestion = detectIncidentRef.current(alerts);
          if (suggestion.shouldTriggerIncident) setIncidentSuggestion(suggestion);
        }
      }

      if (ADMIN_FEATURE_FLAGS.ADMIN_AI_OPS) {
        trendAnalyzer.record('latency', exchangeMetrics.engineLatencyMs);
        trendAnalyzer.record('volume', volume24h);
        trendAnalyzer.record('errorRate', exchangeMetrics.apiErrorRate);
        trendAnalyzer.record('withdrawalQueue', exchangeMetrics.withdrawalQueue);
        trendAnalyzer.record('memory', exchangeMetrics.memoryMb);
        const predictions = trendAnalyzer.analyze();
        setTrendPredictions(predictions);
        if (predictions.length > 0) {
          addPredictiveAlertsRef.current(trendPredictionsToAlerts(predictions));
        }
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeMetrics, health, control, trendAnalyzer, volume24h]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string) === 'admin' });
  }, [queryClient]);

  const handlePauseTrading = useCallback(async () => {
    await adminFetch('/control/emergency-mode', { method: 'POST', body: { enabled: !halted }, token });
    queryClient.invalidateQueries({ predicate: (q) => {
      const key = q.queryKey as string[];
      return key[0] === 'admin' && (
        key[1] === 'trading-halt' || key[1] === 'dashboard-summary' || key[1] === 'control'
      );
    }});
  }, [halted, token, queryClient]);

  const heatmapData = useMemo(() => ({
    trades: ordersPerSec ?? 0, withdrawals: withdrawalQueueTotal ?? 0, alerts: storeAlertCount,
  }), [ordersPerSec, withdrawalQueueTotal, storeAlertCount]);

  const statsBootstrapping = statsLoading && !summary;

  /* health sub-scores for breakdown */
  const infraScores = useMemo(() => {
    if (p50Latency == null || dbLatency == null || redisLatency == null || apiLatency == null || memoryMb == null) {
      return null;
    }
    const latencyEngine = p50Latency < 50 ? 100 : p50Latency < 150 ? 70 : 40;
    const tier1Engine = tier1EngineBarScore(tier1Reasons);
    const engineFromTier1 = tier1Components?.matching_engine?.ok === false ? 18 : tier1Engine;
    return {
      db: tier1Components?.database?.ok === false ? 15 : dbLatency < 100 ? 100 : dbLatency < 300 ? 70 : 40,
      redis: tier1Components?.redis?.ok === false ? 15 : redisLatency === 0 && !health?.redis?.status ? 0 : redisLatency < 10 ? 100 : redisLatency < 50 ? 75 : 40,
      engine: engineFromTier1 != null ? Math.min(latencyEngine, engineFromTier1) : latencyEngine,
      api: apiLatency < 200 ? 100 : apiLatency < 500 ? 65 : 35,
      memory: memoryMb < 400 ? 100 : memoryMb < 800 ? 70 : 40,
    };
  }, [dbLatency, redisLatency, p50Latency, apiLatency, memoryMb, health?.redis?.status, tier1Reasons, tier1Components]);

  const healthLevel = useMemo(() => {
    if (tier1Overall === 'RED') return 'critical' as const;
    if (tier1Overall === 'YELLOW') return 'degraded' as const;
    if (healthScore == null) return 'degraded' as const;
    if (healthScore >= 90) return 'healthy' as const;
    if (healthScore >= 70) return 'degraded' as const;
    return 'critical' as const;
  }, [tier1Overall, healthScore]);

  const animatedHealthScore = useAnimatedNumber(healthScore ?? 0);
  const healthScoreLabel = healthScore == null ? 'NO DATA' : String(Math.round(healthScore));

  const lastUpdatedLabel = useMemo(() => {
    const ts = Math.max(
      summaryUpdatedAt ?? 0,
      healthUpdatedAt ?? 0,
      controlUpdatedAt ?? 0,
      tier1UpdatedAt ?? 0,
    );
    if (!ts) return null;
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  }, [summaryUpdatedAt, healthUpdatedAt, controlUpdatedAt, tier1UpdatedAt]);

  const pageStatus = tier1Overall === 'RED' ? 'risk' : tier1Overall === 'YELLOW' ? 'warning' : 'active';
  const isRefreshing = Boolean(summaryFetching || healthFetching || controlFetching || tier1Fetching);
  const animatedPendingWithdrawals = useAnimatedNumber(pendingWithdrawals);
  const animatedOrdersPerSec = useAnimatedNumber(ordersPerSec ?? 0);
  const animatedTotalUsers = useAnimatedNumber(totalUsers);
  const pageError =
    (summaryIsError && (summaryError instanceof Error ? summaryError.message : 'Failed to load dashboard summary.')) ||
    (healthIsError && (healthError instanceof Error ? healthError.message : 'Failed to load system health.')) ||
    (controlIsError && (controlError instanceof Error ? controlError.message : 'Failed to load control overview.')) ||
    (revenueIsError && (revenueError instanceof Error ? revenueError.message : 'Failed to load revenue metrics.')) ||
    null;

  return (
    <AdminPageFrame
      title="Dashboard"
      status={pageStatus}
      error={pageError}
      onRetry={pageError ? () => {
        void refetchSummary();
        void refetchHealth();
        void refetchControl();
        void refetchRevenue();
        void queryClient.invalidateQueries({ queryKey: ['admin', TIER1_QUERY_KEY] });
      } : undefined}
    >
    <div className="space-y-6">
      {statsBootstrapping && (
        <div className="flex items-center gap-2 rounded-lg border border-admin-border bg-admin-card/80 px-3 py-2 text-sm text-admin-muted animate-fade-in">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-admin-primary" />
          <span>Loading live dashboard…</span>
        </div>
      )}
      <SafeActionModal
        open={pauseModalOpen} onClose={() => setPauseModalOpen(false)} onConfirm={handlePauseTrading}
        title={halted ? 'Resume Trading' : 'Pause Trading'}
        description={halted ? 'Resume all spot trading. Users can place orders again.' : 'Halt all spot trading immediately.'}
        impactWarning={halted ? undefined : 'Pausing trading affects ALL markets and ALL users. Revenue stops.'}
        severity={halted ? 'warning' : 'critical'} requiredPermission="control:trading"
        confirmLabel={halted ? 'Resume Trading' : 'Pause All Trading'}
      />

      {ADMIN_FEATURE_FLAGS.ADMIN_INCIDENT_MANAGEMENT && (
        <IncidentPrompt suggestion={incidentSuggestion} onDismiss={() => setIncidentSuggestion(null)} />
      )}

      {/* ── Trading Halted Banner ── */}
      {halted && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-900/5 px-5 py-3.5 shadow-glow-danger">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 subtle-pulse">
              <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-300">Trading is HALTED</p>
              <p className="text-xs text-red-400/80">All spot markets paused — no new orders can be placed.</p>
            </div>
          </div>
          <ProtectedAction permission="control:trading" fallback="disabled">
            <Button size="sm" variant="danger" icon={<Play className="h-3.5 w-3.5" />} onClick={() => setPauseModalOpen(true)}>
              Resume Trading
            </Button>
          </ProtectedAction>
        </div>
      )}

      {/* ── Header Row ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between dash-rise-in">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-bold text-admin-text tracking-tight">
              Welcome back, {admin?.name ?? 'Admin'}
            </h1>
            <span className={cn(
              'hidden sm:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border',
              pageStatus === 'risk' ? 't1-tier-red' : pageStatus === 'warning' ? 't1-tier-amber' : 't1-tier-green'
            )}>
              {pageStatus === 'risk' ? 'Critical' : pageStatus === 'warning' ? 'Warning' : 'Operational'}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs text-admin-muted/70">
              {pendingWithdrawals > 0 && <span className="text-amber-400 font-semibold">{pendingWithdrawals} pending</span>}
              {pendingWithdrawals > 0 && ' withdrawals · '}
              {pendingFiatInr > 0 && <span className="text-amber-400 font-semibold">{pendingFiatInr} INR fiat</span>}
              {pendingFiatInr > 0 && ' · '}
              {openDisputes > 0 && <span className="text-red-400 font-semibold">{openDisputes} disputes</span>}
              {openDisputes > 0 && ' · '}
              <span className="text-admin-muted/60">{activeMarkets} active markets</span>
            </p>
            <HeatmapIndicator {...heatmapData} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastUpdatedLabel && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card/80 px-2.5 py-1.5 text-[10px] text-admin-muted tabular-nums">
              <span className={cn('h-1.5 w-1.5 rounded-full dash-live-dot', tier1Overall === 'GREEN' ? 'bg-emerald-400' : tier1Overall === 'YELLOW' ? 'bg-amber-400' : 'bg-red-400')} />
              Updated {lastUpdatedLabel}
            </span>
          )}
          {!halted && (
            <ProtectedAction permission="control:trading" fallback="disabled">
              <Button variant="outline" size="sm" icon={<PauseCircle className="h-3.5 w-3.5" />} onClick={() => setPauseModalOpen(true)}>
                Pause Trading
              </Button>
            </ProtectedAction>
          )}
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setRefreshDropdownOpen((s) => !s)}>
              <Timer className="h-3.5 w-3.5 mr-1" />
              {REFRESH_OPTIONS.find((o) => o.value === globalRefresh)?.label}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
            {refreshDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRefreshDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 bg-admin-card border border-admin-border rounded-lg shadow-dropdown py-1 min-w-[80px]">
                  {REFRESH_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => { setGlobalRefresh(opt.value); setRefreshDropdownOpen(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors', globalRefresh === opt.value ? 'text-admin-primary bg-admin-primary/5' : 'text-admin-text hover:bg-white/[0.02]')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Syncing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {ADMIN_FEATURE_FLAGS.ADMIN_INCIDENT_MANAGEMENT && <IncidentBanner />}

      {tier1Reasons.length > 0 && (
        <div className="dash-rise-in" style={{ animationDelay: '40ms' }}>
          <ActiveIssuesRail reasons={tier1Reasons} overall={tier1Overall} />
        </div>
      )}

      {/* ── HERO ROW: Health Ring + Tier-1 Banner ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 dash-rise-in" style={{ animationDelay: '60ms' }}>
        {/* Health Score Card */}
        <div className={cn(
          'lg:col-span-4 rounded-xl border p-5 flex flex-col items-center gap-4 relative overflow-hidden dash-card-lift',
          healthLevel === 'healthy' ? 'border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.07] via-admin-card to-admin-card' :
          healthLevel === 'degraded' ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/[0.08] via-admin-card to-admin-card' :
          'border-red-500/35 bg-gradient-to-b from-red-500/[0.10] via-admin-card to-admin-card',
        )}>
          {/* subtle corner grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          {/* top status stripe */}
          <div className={cn('absolute top-0 left-0 right-0 h-0.5 rounded-t-xl',
            healthLevel === 'healthy' ? 'bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent' :
            healthLevel === 'degraded' ? 'bg-gradient-to-r from-transparent via-amber-500/70 to-transparent' :
            'bg-gradient-to-r from-transparent via-red-500/70 to-transparent'
          )} />
          <div className="relative group/ring cursor-default z-10">
            <HealthRing score={animatedHealthScore} size={128} />
            <p className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-admin-muted/0 transition-all duration-200 group-hover/ring:text-admin-muted/70">
              Live composite score
            </p>
          </div>
          <div className="text-center relative z-10 space-y-1.5">
            {/* Tier Badge */}
            {tier1Overall && (
              <div className="flex justify-center">
                <span className={cn('text-[9px] font-bold uppercase tracking-[0.14em] rounded-full px-2.5 py-0.5',
                  tier1Overall === 'GREEN' ? 't1-tier-green' : tier1Overall === 'YELLOW' ? 't1-tier-amber' : 't1-tier-red'
                )}>
                  Tier-1 · {tier1Overall}
                </span>
              </div>
            )}
            <p className={cn('text-sm font-bold',
              healthLevel === 'healthy' ? 'text-emerald-400' : healthLevel === 'degraded' ? 'text-amber-400' : 'text-red-400'
            )}>
              {healthLevel === 'healthy'
                ? 'All Systems Operational'
                : healthLevel === 'degraded'
                  ? tier1Reasons.length > 0 ? `${tier1Reasons.length} issue${tier1Reasons.length === 1 ? '' : 's'} detected` : 'Performance Degraded'
                  : 'Critical — Action Required'}
            </p>
            <p className="text-[10px] text-admin-muted/70">
              Score: {healthScoreLabel}
              {ADMIN_FEATURE_FLAGS.ADMIN_PRODUCTION_HARDENING ? ' · backend /control/health-score' : ' · client composite'}
            </p>
            <p className="text-[10px] text-admin-muted/70">
              Uptime: {uptime == null ? 'NO DATA' : formatUptime(uptime)}
            </p>
          </div>
          {/* Component breakdown */}
          <div className="w-full space-y-2.5 relative z-10 border-t border-admin-border/50 pt-3">
            {infraScores ? (
              <>
                <HealthBreakdownRow label="Database" score={infraScores.db} />
                <HealthBreakdownRow label="Redis" score={infraScores.redis} />
                <HealthBreakdownRow label="Engine" score={infraScores.engine} />
                <HealthBreakdownRow label="API" score={infraScores.api} />
                <HealthBreakdownRow label="Memory" score={infraScores.memory} />
              </>
            ) : (
              <p className="text-[10px] text-admin-muted text-center py-2">Component breakdown: NO DATA</p>
            )}
          </div>
        </div>

        {/* Tier-1 Banner + KPI Grid */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <ExchangeHealthTier1Banner token={token} />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              href="/analytics"
              label="Trading Volume"
              sublabel="24h"
              value={volume24h > 0 ? `$${volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0'}
              icon={<TrendingUp className="h-4 w-4" />}
              iconColor="text-blue-400"
              iconBg="bg-blue-500/10"
              sparkline={volumeHist}
              sparkColor="blue"
              anomaly={volumeAnomaly}
              tip={PANEL_TIPS.volume}
              accentColor="blue"
            />
            <KpiCard
              href="/users"
              label="Total Users"
              value={animatedTotalUsers.toLocaleString()}
              sub={`${users?.newToday ?? 0} new today`}
              icon={<Users className="h-4 w-4" />}
              iconColor="text-cyan-400"
              iconBg="bg-cyan-500/10"
              tip={PANEL_TIPS.users}
              sparkColor="green"
              accentColor="cyan"
            />
            <KpiCard
              href="/withdrawals"
              label="Pending withdrawals"
              value={String(animatedPendingWithdrawals)}
              sub="awaiting approval"
              icon={<Wallet className="h-4 w-4" />}
              iconColor={pendingWithdrawals > 10 ? 'text-amber-400' : 'text-admin-muted'}
              iconBg={pendingWithdrawals > 10 ? 'bg-amber-500/10' : 'bg-white/5'}
              warn={pendingWithdrawals > 10}
              tip={PANEL_TIPS.pendingWithdrawals}
              accentColor={pendingWithdrawals > 10 ? 'amber' : undefined}
            />
            <KpiCard
              href="/orders"
              label="Orders / sec"
              value={String(animatedOrdersPerSec)}
              icon={<Flame className="h-4 w-4" />}
              iconColor="text-orange-400"
              iconBg="bg-orange-500/10"
              sparkline={ordersHist}
              sparkColor="amber"
              anomaly={orderAnomaly}
              accentColor="orange"
            />
          </div>
        </div>
      </section>

      {/* ── ENGINE PERFORMANCE ── */}
      <section className="dash-rise-in" style={{ animationDelay: '120ms' }}>
        <SectionHeader label="Engine Performance" icon={<Cpu className="h-3.5 w-3.5" />} live />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <EngineMetric label="Orders / sec" value={ordersPerSec == null ? 'NO DATA' : animatedOrdersPerSec} sparkline={ordersHist} sparkColor="green" anomaly={orderAnomaly} />
          <EngineMetric label="Latency P50" value={p50Latency == null ? 'NO DATA' : p50Latency} unit="ms" threshold={{ warn: 50, crit: 100 }} anomaly={latencyAnomaly} />
          <EngineMetric label="Latency P99" value={p99Latency == null ? 'NO DATA' : p99Latency} unit="ms" threshold={{ warn: 200, crit: 1000 }} />
          <EngineMetric label="API Latency" value={apiLatency == null ? 'NO DATA' : apiLatency} unit="ms" threshold={{ warn: 100, crit: 500 }} sparkline={latencyHist} sparkColor="amber" />
          <EngineMetric label="Heap Memory" value={memoryMb == null ? 'NO DATA' : Math.round(memoryMb)} unit="MB" threshold={{ warn: 512, crit: 1024 }} />
        </div>
      </section>

      {/* ── INFRASTRUCTURE + MARKETS ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 dash-rise-in" style={{ animationDelay: '160ms' }}>
        {/* Infrastructure */}
        <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden dash-card-lift">
          <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border/70 bg-white/[0.015]">
            <h3 className="text-sm font-bold text-admin-text flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-admin-primary/10">
                <Server className="h-3.5 w-3.5 text-admin-primary" />
              </span>
              Infrastructure
              <span className="t1-live-badge ml-1">Live</span>
            </h3>
            <Link href="/monitoring" className="group/link inline-flex items-center gap-0.5 text-[11px] font-semibold text-admin-primary hover:text-admin-primary-hover transition-colors">
              View Details
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/link:translate-x-0.5" />
            </Link>
          </div>
          <div className="p-4 space-y-0.5">
            <InfraRow icon={Database} label="Database" latency={dbLatency == null ? 'NO DATA' : `${dbLatency}ms`} status={tier1Components?.database?.ok === false ? 'down' : health?.database?.status} maxLatency={500} currentLatency={dbLatency ?? undefined} />
            <InfraRow icon={Zap} label="Redis" latency={redisLatency == null ? 'NO DATA' : `${redisLatency}ms`} status={tier1Components?.redis?.ok === false ? 'down' : health?.redis?.status} maxLatency={50} currentLatency={redisLatency ?? undefined} />
            <InfraRow
              icon={Cpu}
              label="Matching Engine"
              latency={tier1Components?.matching_engine?.detail ?? (tier1Reasons.find((r) => r.startsWith('matching_engine'))?.split(': ')[1] ?? '—')}
              status={tier1Components?.matching_engine?.ok === false || tier1Reasons.some((r) => r.startsWith('matching_engine')) ? 'down' : 'healthy'}
              href="/monitoring"
            />
            <InfraRow icon={Globe} label="WebSocket" latency={wsConnections == null ? 'NO DATA' : `${wsConnections} conn`} status={health?.websocket?.status} />
            <InfraRow icon={Clock} label="Uptime" latency={uptime == null ? 'NO DATA' : formatUptime(uptime)} status="healthy" />
            <InfraRow icon={Activity} label="Settlement" latency={settlementPending == null ? 'NO DATA' : `${settlementPending} pending`} status={settlementPending != null && settlementPending > 50 ? 'degraded' : 'healthy'} />
          </div>
        </div>

        {/* Markets & P2P */}
        <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden dash-card-lift">
          <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border/70 bg-white/[0.015]">
            <h3 className="text-sm font-bold text-admin-text flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-admin-primary/10">
                <BarChart3 className="h-3.5 w-3.5 text-admin-primary" />
              </span>
              Markets & P2P
            </h3>
            <Link href="/trading" className="group/link inline-flex items-center gap-0.5 text-[11px] font-semibold text-admin-primary hover:text-admin-primary-hover transition-colors">
              View Details
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/link:translate-x-0.5" />
            </Link>
          </div>
          <div className="p-4">
            <div className="space-y-0.5">
              <MarketStat label="Active Markets" value={activeMarkets} icon={<BarChart3 className="h-3.5 w-3.5 text-admin-primary" />} />
              <MarketStat label="Trading" value={halted ? 'HALTED' : 'Active'} icon={<Radio className={cn('h-3.5 w-3.5', halted ? 'text-red-400' : 'text-emerald-400')} />} warn={halted} />
              <MarketStat label="P2P Ads" value={p2p?.activeAds ?? 0} icon={<CircleDot className="h-3.5 w-3.5 text-indigo-400" />} />
              <MarketStat label="P2P Orders" value={p2p?.activeOrders ?? 0} icon={<ArrowLeftRight className="h-3.5 w-3.5 text-cyan-400" />} />
              <MarketStat label="Open Disputes" value={openDisputes} icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />} warn={openDisputes > 0} />
              <Link href="/analytics" className="group">
                <MarketStat label="Revenue (7d)" value={revenue7dTotal !== null ? `$${revenue7dTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'} icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── OPERATOR SHORTCUTS ── */}
      <section className="dash-rise-in" style={{ animationDelay: '200ms' }}>
        <SectionHeader label="Quick Actions" icon={<Zap className="h-3.5 w-3.5" />} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          <QuickNav href="/withdrawals" icon={ArrowUpFromLine} label="Withdrawals" count={pendingWithdrawals} accent="amber" actionLabel={pendingWithdrawals > 0 ? 'Review queue' : undefined} />
          <QuickNav href="/fiat-withdrawals" icon={Banknote} label="INR Fiat" count={pendingFiatInr} accent="emerald" warn={pendingFiatInr > 0} actionLabel={pendingFiatInr > 0 ? 'Approve payout' : undefined} />
          <QuickNav href="/risk" icon={Shield} label="AML & Risk" accent="red" />
          <QuickNav href="/users" icon={Users} label="Users" count={totalUsers} accent="blue" />
          <QuickNav href="/kyc" icon={BadgeCheck} label="KYC" count={pendingKyc} accent="indigo" warn={pendingKyc > 0} actionLabel={pendingKyc > 0 ? 'Review KYC' : undefined} />
          <QuickNav href="/orders" icon={ListOrdered} label="Orders" accent="sky" />
          <QuickNav href="/trades" icon={Repeat} label="Trades" accent="teal" />
          <QuickNav href="/deposits" icon={ArrowDownToLine} label="Deposits" accent="emerald" />
          <QuickNav href="/fees" icon={Percent} label="Fees" accent="violet" />
          <QuickNav href="/p2p" icon={ArrowLeftRight} label="P2P" count={(p2p?.activeOrders ?? 0) + (p2p?.activeAds ?? 0)} accent="cyan" />
          <QuickNav href="/markets" icon={BarChart3} label="Markets" count={activeMarkets} accent="purple" />
        </div>
      </section>
    </div>
    </AdminPageFrame>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Sub-components                                        */
/* ────────────────────────────────────────────────────── */

/* ── Tip popover ── */
function Tip({ tip, danger }: { tip: string; danger?: string }) {
  return (
    <SmartTooltip content={tip} danger={danger}>
      <Info className="h-3 w-3 text-admin-muted/50 cursor-help hover:text-admin-muted transition-colors" />
    </SmartTooltip>
  );
}

/* ── Section header ── */
function SectionHeader({ label, icon, live }: { label: string; icon: React.ReactNode; live?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <span className="t1-section-bar" />
      <span className="text-admin-primary/70">{icon}</span>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-admin-text/80">{label}</p>
      {live && <span className="t1-live-badge">Live</span>}
      <div className="flex-1 h-px bg-admin-border/40 ml-1" />
    </div>
  );
}

/* ── Animated SVG Health Ring ── */
const HealthRing = memo(function HealthRing({ score, size = 128 }: { score: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const color = pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444';
  const glowClass = pct < 70 ? 'health-glow' : '';
  const shadowColor = pct >= 90 ? 'rgba(16,185,129,0.15)' : pct >= 70 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.2)';
  return (
    <div className="relative" style={{ width: size, height: size, filter: `drop-shadow(0 0 16px ${shadowColor})` }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* outer ghost ring */}
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="2" />
        <circle cx="50" cy="50" r="40" className="health-ring-track" />
        <circle
          cx="50" cy="50" r="40"
          className={cn('health-ring-value transition-[stroke-dashoffset,stroke] duration-700 ease-out', glowClass)}
          style={{ stroke: color, strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tabular-nums text-admin-text leading-none">{score}</span>
        <span className="text-[9px] font-bold text-admin-muted mt-1 uppercase tracking-[0.15em]">Health</span>
      </div>
    </div>
  );
});

/* ── Health breakdown bar row ── */
const HealthBreakdownRow = memo(function HealthBreakdownRow({ label, score }: { label: string; score: number }) {
  const barClass = score >= 90 ? 't1-bar-green' : score >= 60 ? 't1-bar-amber' : 't1-bar-red';
  const textColor = score >= 90 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-admin-muted/80 w-14 shrink-0 font-medium">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-admin-border/60 overflow-hidden">
        <div className={cn('h-full rounded-full metric-bar-fill', barClass)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('text-[11px] font-bold tabular-nums w-8 text-right', textColor)}>{score}</span>
    </div>
  );
});

/* ── Mini Sparkline SVG ── */
const Sparkline = memo(function Sparkline({
  values, color = 'green', width = 64, height = 24,
}: {
  values: number[]; color?: 'green' | 'blue' | 'amber' | 'red'; width?: number; height?: number;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;

  const pad = 2;
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const span = vmax - vmin || 1;
  const n = values.length;
  const step = (width - pad * 2) / (n - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - vmin) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeMap = { green: '#10B981', blue: '#6366F1', amber: '#F59E0B', red: '#EF4444' };
  const fillMap = { green: 'rgba(16,185,129,0.1)', blue: 'rgba(99,102,241,0.1)', amber: 'rgba(245,158,11,0.1)', red: 'rgba(239,68,68,0.1)' };
  const areaPath = `M${pts[0]} ${pts.join(' L')} L${(pad + (n - 1) * step).toFixed(1)},${height} L${pad},${height} Z`;

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <path d={areaPath} fill={fillMap[color]} />
      <polyline fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke={strokeMap[color]} points={pts.join(' ')} className="dash-spark-line" />
    </svg>
  );
});

/* ── KPI Card ── */
const KPI_ACCENT_MAP: Record<string, string> = {
  blue: 't1-kpi-accent-blue', cyan: 't1-kpi-accent-cyan',
  amber: 't1-kpi-accent-amber', orange: 't1-kpi-accent-orange',
  green: 't1-kpi-accent-green', red: 't1-kpi-accent-red',
};

const KpiCard = memo(function KpiCard({
  href, label, sublabel, value, sub, icon, iconColor, iconBg, sparkline, sparkColor, anomaly, warn, tip, accentColor,
}: {
  href: string;
  label: string;
  sublabel?: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  sparkline?: number[];
  sparkColor?: 'green' | 'blue' | 'amber' | 'red';
  anomaly?: AnomalyResult;
  warn?: boolean;
  tip?: { tip: string; danger?: string };
  accentColor?: string;
}) {
  const accentClass = accentColor ? (KPI_ACCENT_MAP[accentColor] ?? '') : '';
  return (
    <Link href={href} className="group block h-full">
      <div className={cn(
        'rounded-xl border bg-admin-card h-full flex flex-col justify-between overflow-hidden dash-card-lift',
        'hover:border-admin-primary/30 hover:shadow-lg hover:shadow-admin-primary/5',
        warn ? 'border-amber-500/30' : 'border-admin-border',
        accentClass,
      )}>
        <div className="p-4 flex-1">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-admin-muted/80 truncate">
                {label}{sublabel && <span className="text-admin-muted/50 ml-1 normal-case font-medium">{sublabel}</span>}
              </p>
              {tip && <Tip tip={tip.tip} danger={tip.danger} />}
            </div>
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ml-2 transition-transform duration-200 group-hover:scale-110', iconBg)}>
              <span className={iconColor}>{icon}</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className={cn('text-3xl font-black tabular-nums leading-none tracking-tight',
                warn ? 'text-amber-400' : 'text-admin-text'
              )}>{value}</p>
              {sub && <p className="text-[10px] text-admin-muted/70 mt-1.5 font-medium">{sub}</p>}
              {anomaly && anomaly.deltaPercent !== 0 && (
                <p className={cn('text-[10px] font-bold mt-1',
                  anomaly.type === 'spike' ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {anomaly.type === 'spike' ? '↑' : '↓'} {Math.abs(anomaly.deltaPercent).toFixed(1)}% vs prev
                </p>
              )}
            </div>
            {sparkline && sparkline.length > 1 && (
              <Sparkline values={sparkline} color={sparkColor} width={52} height={24} />
            )}
          </div>
        </div>
        {/* bottom accent row */}
        <div className="px-4 py-2 border-t border-admin-border/40 flex items-center justify-between bg-white/[0.01]">
          <span className="text-[9px] text-admin-muted/50 uppercase tracking-[0.1em]">View details</span>
          <ChevronRight className="h-3 w-3 text-admin-muted/30 transition-all duration-200 group-hover:text-admin-primary/70 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
});

/* ── Engine Metric Card ── */
function anomalyDirection(a: AnomalyResult): 'up' | 'down' | 'stable' {
  if (a.type === 'spike') return 'up';
  if (a.type === 'drop') return 'down';
  return 'stable';
}

const EngineMetric = memo(function EngineMetric({ label, value, unit, threshold, anomaly, sparkline, sparkColor }: {
  label: string; value: string | number; unit?: string;
  threshold?: { warn: number; crit: number };
  anomaly?: AnomalyResult;
  sparkline?: number[];
  sparkColor?: 'green' | 'blue' | 'amber' | 'red';
}) {
  const numVal = typeof value === 'number' ? value : 0;
  const noData = value === 'NO DATA';
  const status = noData ? 'normal' : threshold
    ? numVal >= threshold.crit ? 'critical' : numVal >= threshold.warn ? 'warning' : 'normal'
    : 'normal';
  const dir = anomaly ? anomalyDirection(anomaly) : 'stable';
  const statusLabel = noData ? 'N/A' : status === 'critical' ? 'CRIT' : status === 'warning' ? 'WARN' : 'OK';
  const statusClass = status === 'critical' ? 'text-red-400 bg-red-500/10' : status === 'warning' ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10';

  return (
    <div className={cn(
      'rounded-xl border bg-admin-card px-4 py-3.5 dash-card-lift group hover:shadow-md flex flex-col gap-2',
      status === 'critical' ? 'border-red-500/30 hover:shadow-red-500/5' :
      status === 'warning' ? 'border-amber-500/20 hover:shadow-amber-500/5' :
      'border-admin-border hover:border-admin-primary/20 hover:shadow-admin-primary/5',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold text-admin-muted/70 uppercase tracking-[0.12em]">{label}</p>
        <span className={cn('text-[8px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded', statusClass)}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-end justify-between gap-1">
        <div>
          <div className="flex items-baseline gap-1">
            <span className={cn('text-2xl font-black tabular-nums leading-none',
              status === 'critical' ? 'text-red-400' : status === 'warning' ? 'text-amber-400' : 'text-admin-text'
            )}>{value}</span>
            {unit && <span className="text-[9px] text-admin-muted/70 font-semibold">{unit}</span>}
          </div>
          {anomaly && anomaly.deltaPercent !== 0 && (
            <p className={cn('text-[9px] font-bold mt-1',
              dir === 'up' ? 'text-emerald-400' : dir === 'down' ? 'text-red-400' : 'text-admin-muted'
            )}>
              {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'} {Math.abs(anomaly.deltaPercent).toFixed(1)}%
            </p>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline values={sparkline} color={sparkColor ?? (status === 'critical' ? 'red' : status === 'warning' ? 'amber' : 'green')} width={48} height={20} />
        )}
      </div>
      {threshold && typeof value === 'number' && (
        <div className="h-1.5 rounded-full bg-admin-border/40 overflow-hidden mt-0.5">
          <div
            className={cn('h-full rounded-full transition-all duration-700 metric-bar-fill',
              status === 'critical' ? 't1-bar-red' : status === 'warning' ? 't1-bar-amber' : 't1-bar-green'
            )}
            style={{ width: `${Math.min(100, (numVal / threshold.crit) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
});

/* ── Active issues rail (Tier-1 aligned) ── */
const ActiveIssuesRail = memo(function ActiveIssuesRail({
  reasons,
  overall,
}: {
  reasons: string[];
  overall?: Tier1Overall;
}) {
  const isYellow = overall === 'YELLOW';
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        isYellow
          ? 'border-amber-500/25 bg-gradient-to-r from-amber-500/8 via-admin-card to-admin-card'
          : 'border-red-500/25 bg-gradient-to-r from-red-500/8 via-admin-card to-admin-card',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('h-4 w-4 shrink-0', isYellow ? 'text-amber-400' : 'text-red-400')} />
          <p className={cn('text-sm font-bold', isYellow ? 'text-amber-300' : 'text-red-300')}>
            {reasons.length} active issue{reasons.length === 1 ? '' : 's'} — review required
          </p>
        </div>
        <ul className="mt-2 space-y-1">
          {reasons.slice(0, 4).map((reason) => (
            <li key={reason} className="flex items-center gap-2 text-xs text-admin-muted">
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', isYellow ? 'bg-amber-400' : 'bg-red-400')} />
              <span className="truncate">{formatTier1Reason(reason)}</span>
              <Link href={issueNavTarget(reason)} className="shrink-0 text-[10px] font-medium text-admin-primary hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/monitoring"
        className="group/rail inline-flex shrink-0 items-center gap-1 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-xs font-medium text-admin-text hover:border-admin-primary/30 transition-all hover:shadow-md"
      >
        Monitoring
        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/rail:translate-x-0.5" />
      </Link>
    </div>
  );
});

/* ── Infrastructure Row ── */
const InfraRow = memo(function InfraRow({ icon: Icon, label, latency, status, maxLatency, currentLatency, href }: {
  icon: React.ElementType; label: string; latency: string; status?: string;
  maxLatency?: number; currentLatency?: number; href?: string;
}) {
  const s = status?.toLowerCase();
  const isOk = s === 'healthy' || s === 'ok' || s === 'up' || s === 'connected';
  const isWarn = s === 'degraded' || s === 'slow';
  const isDown = s === 'down' || s === 'error';

  const dotClass = isOk ? 't1-dot-green' : isWarn ? 't1-dot-amber' : isDown ? 't1-dot-red' : 't1-dot-grey';
  const pct = maxLatency && currentLatency != null ? Math.min(100, (currentLatency / maxLatency) * 100) : null;
  const barClass = isOk ? 't1-bar-green' : isWarn ? 't1-bar-amber' : isDown ? 't1-bar-red' : 'bg-zinc-600';
  const statusText = isOk ? 'Healthy' : isWarn ? 'Degraded' : isDown ? 'Down' : 'Unknown';
  const statusTextColor = isOk ? 'text-emerald-400' : isWarn ? 'text-amber-400' : isDown ? 'text-red-400' : 'text-zinc-500';

  const inner = (
    <>
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors',
        isOk ? 'bg-emerald-500/[0.06] group-hover/infra:bg-emerald-500/10' :
        isWarn ? 'bg-amber-500/[0.06] group-hover/infra:bg-amber-500/10' :
        isDown ? 'bg-red-500/[0.06] group-hover/infra:bg-red-500/10' :
        'bg-white/[0.03] group-hover/infra:bg-white/[0.06]',
      )}>
        <Icon className={cn('h-3.5 w-3.5', isOk ? 'text-emerald-400/70' : isWarn ? 'text-amber-400/70' : isDown ? 'text-red-400/70' : 'text-admin-muted/60')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-admin-text">{label}</span>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className={cn('text-[11px] font-bold tabular-nums', statusTextColor)}>{statusText}</span>
            <span className="text-[10px] font-mono text-admin-muted/60">{latency}</span>
            {href && <ChevronRight className="h-3 w-3 text-admin-muted/0 transition-all duration-200 group-hover/infra:text-admin-primary/60 group-hover/infra:translate-x-0.5" />}
            <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotClass)} />
          </div>
        </div>
        {pct !== null && (
          <div className="h-1.5 rounded-full bg-admin-border/50 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500 metric-bar-fill', barClass)} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </>
  );

  const rowClass = 'group/infra flex items-center gap-3 -mx-2 px-2 py-2.5 rounded-lg dash-row-hover';
  if (href) {
    return <Link href={href} className={cn(rowClass, 'cursor-pointer')}>{inner}</Link>;
  }
  return <div className={rowClass}>{inner}</div>;
});

/* ── Market Stat Row ── */
function MarketStat({ label, value, icon, warn }: { label: string; value: string | number; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-center gap-3 -mx-1 px-2 py-2 rounded-lg dash-row-hover">
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors',
        warn ? 'bg-red-500/10' : 'bg-white/[0.03] hover:bg-white/[0.05]'
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className="text-xs text-admin-muted/80 font-medium">{label}</span>
        <span className={cn('text-sm font-bold tabular-nums', warn ? 'text-red-400' : 'text-admin-text')}>{value}</span>
      </div>
    </div>
  );
}

/* ── Quick Nav Card ── */
const ACCENT_MAP: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'hover:border-amber-500/30',   bar: 'bg-amber-500' },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'hover:border-red-500/30',     bar: 'bg-red-500' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'hover:border-blue-500/30',    bar: 'bg-blue-500' },
  indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'hover:border-indigo-500/30',  bar: 'bg-indigo-500' },
  sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-400',     border: 'hover:border-sky-500/30',     bar: 'bg-sky-500' },
  teal:    { bg: 'bg-teal-500/10',    text: 'text-teal-400',    border: 'hover:border-teal-500/30',    bar: 'bg-teal-500' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'hover:border-emerald-500/30', bar: 'bg-emerald-500' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'hover:border-violet-500/30',  bar: 'bg-violet-500' },
  cyan:    { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'hover:border-cyan-500/30',    bar: 'bg-cyan-500' },
  purple:  { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'hover:border-purple-500/30',  bar: 'bg-purple-500' },
};

const QuickNav = memo(function QuickNav({ href, icon: Icon, label, count, accent, warn, actionLabel }: {
  href: string;
  icon: React.ElementType;
  label: string;
  count?: number | string;
  accent: string;
  warn?: boolean;
  actionLabel?: string;
}) {
  const c = ACCENT_MAP[accent] ?? ACCENT_MAP.blue!;
  return (
    <Link href={href} className="group block">
      <div className={cn(
        'rounded-xl border bg-admin-card overflow-hidden dash-card-lift hover:shadow-md',
        warn ? 'border-amber-500/30' : 'border-admin-border',
        c.border,
      )}>
        {/* colored top accent bar on hover */}
        <div className={cn('h-0.5 w-full opacity-0 transition-opacity duration-200 group-hover:opacity-100', c.bar)} />
        <div className="px-3.5 py-3 flex items-center gap-3">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-110', c.bg)}>
            <Icon className={cn('h-4 w-4', c.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-admin-muted/70 uppercase font-bold tracking-wide truncate">{label}</p>
            {count !== undefined && (
              <p className={cn('text-base font-black tabular-nums leading-tight mt-0.5', warn ? 'text-amber-400' : 'text-admin-text')}>{count}</p>
            )}
            {actionLabel && (
              <p className="text-[9px] font-semibold text-admin-primary mt-0.5 group-hover:underline truncate">{actionLabel}</p>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-admin-muted/20 transition-all duration-200 group-hover:text-admin-primary/60 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
});

/* ── Helpers ── */
function formatUptime(seconds: number): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
