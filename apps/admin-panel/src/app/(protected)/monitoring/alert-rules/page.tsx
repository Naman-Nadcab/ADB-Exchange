'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  getMonitoringAlertRules, patchMonitoringAlertRules,
  getMonitoringHealth, getMonitoringQueues, getMonitoringAlerts, getMonitoringResources,
  type AlertRuleValue, type AlertRuleDefinition, type InfrastructureAlertRow,
} from '@/lib/monitoring-api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { FormSkeleton } from '@/components/ui';
import {
  ArrowLeft, Activity, Layers, Radio, Bell,
  CheckCircle, AlertTriangle, ShieldAlert, Clock,
  TrendingUp, Save, RotateCcw, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';

/* ─────────────── Rule UI helpers ─────────────── */

const RULE_ICONS: Record<string, React.ElementType> = {
  api_latency_threshold_ms: Activity,
  api_error_rate_threshold_pct: Activity,
  queue_size_threshold: Layers,
  settlement_lag_threshold_sec: Clock,
  rpc_failure_rate_threshold: Radio,
  cpu_percent_threshold: Activity,
  memory_percent_threshold: Activity,
  disk_percent_threshold: Activity,
  db_latency_threshold_ms: Activity,
  redis_latency_threshold_ms: Activity,
  ws_disconnect_rate_threshold: Radio,
  matching_engine_latency_threshold_ms: Activity,
};

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
};

/* ─────────────── Threshold bar component ─────────────── */

function ThresholdBar({ current, threshold, max, unit }: { current: number; threshold: number; max: number; unit: string }) {
  const pct = Math.min(100, (current / max) * 100);
  const threshPct = Math.min(100, (threshold / max) * 100);
  const breached = current > threshold;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-admin-muted">Current: <span className={cn('font-bold tabular-nums', breached ? 'text-red-400' : 'text-emerald-400')}>{current.toLocaleString()}{unit}</span></span>
        <span className="text-admin-muted">Threshold: <span className="font-bold tabular-nums text-admin-text">{threshold.toLocaleString()}{unit}</span></span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', breached ? 'bg-red-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-admin-text/60"
          style={{ left: `${threshPct}%` }}
          title={`Threshold: ${threshold}${unit}`}
        />
      </div>
      {breached && (
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-red-400" />
          <span className="text-[10px] font-semibold text-red-400">BREACHED — current value exceeds threshold</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main page ─────────────── */

export default function MonitoringAlertRulesPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const adminToast = useAdminToast();

  const [form, setForm] = useState<Record<string, AlertRuleValue>>({});
  const [definitions, setDefinitions] = useState<AlertRuleDefinition[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Queries ── */
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['admin', 'monitoring', 'alert-rules', token],
    queryFn: () => getMonitoringAlertRules(token),
    enabled: !!token,
  });

  const { data: healthData } = useQuery({
    queryKey: ['admin', 'monitoring', 'health-live', token],
    queryFn: () => getMonitoringHealth(token),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const { data: queuesData } = useQuery({
    queryKey: ['admin', 'monitoring', 'queues-live', token],
    queryFn: () => getMonitoringQueues(token),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['admin', 'monitoring', 'recent-alerts', token],
    queryFn: () => getMonitoringAlerts(token, { limit: 10, status: 'open' }),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: resourcesData } = useQuery({
    queryKey: ['admin', 'monitoring', 'resources-live', token],
    queryFn: () => getMonitoringResources(token),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  /* ── Sync form from server ── */
  useEffect(() => {
    if (rulesData?.data?.rules) {
      setForm(rulesData.data.rules);
      setDefinitions(rulesData.data.definitions ?? []);
      setHasChanges(false);
    }
  }, [rulesData]);

  /* ── Derived ── */
  const health = healthData?.data;
  const queues = queuesData?.data;
  const resources = resourcesData?.data;
  const alerts = (alertsData?.data?.alerts ?? []) as InfrastructureAlertRow[];

  const liveValues: Record<string, number> = useMemo(() => ({
    api_latency_threshold_ms: health?.api_latency_ms ?? 0,
    api_error_rate_threshold_pct: 0,
    queue_size_threshold: (queues?.withdrawal_pending ?? 0) + (queues?.settlement_pending ?? 0) + (queues?.matching_engine_pending ?? 0),
    settlement_lag_threshold_sec: queues?.settlement_lag_sec ?? 0,
    rpc_failure_rate_threshold: 0,
    cpu_percent_threshold: resources?.cpu_percent ?? 0,
    memory_percent_threshold: resources?.memory_percent ?? 0,
    disk_percent_threshold: resources?.disk_percent ?? 0,
    db_latency_threshold_ms: 0,
    redis_latency_threshold_ms: 0,
    ws_disconnect_rate_threshold: 0,
    matching_engine_latency_threshold_ms: 0,
  }), [health, queues, resources]);

  const ruleList = definitions.length > 0 ? definitions : [];
  const breachedCount = ruleList.filter((r) => (liveValues[r.key] ?? 0) > (form[r.key]?.threshold ?? r.defaultThreshold)).length;

  /* ── Mutations ── */
  const patchMutation = useMutation({
    mutationFn: (body: Record<string, AlertRuleValue>) => patchMonitoringAlertRules(token, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitoring'] });
      const msg = 'Alert rules saved successfully.';
      setToast({ type: 'success', msg });
      adminToast.success(msg);
      setHasChanges(false);
    },
    onError: (e) => {
      const msg = 'Failed to save alert rules.';
      setToast({ type: 'error', msg });
      adminToast.error(formatSaveError(e, msg));
    },
  });

  const updateField = (key: string, patch: Partial<AlertRuleValue>) => {
    setForm((f) => ({
      ...f,
      [key]: { ...(f[key] ?? { threshold: 0, enabled: true, cooldown_sec: 900, severity: 'warning' as const }), ...patch },
    }));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (rulesData?.data?.rules) {
      setForm(rulesData.data.rules);
      setHasChanges(false);
    }
  };

  const handleSave = () => {
    patchMutation.mutate(form);
  };

  return (
    <AdminPageFrame
      title="Alert Escalation Rules"
      description="Configure thresholds that trigger infrastructure alerts. Live values update every 10s."
      quickActions={
        <Link href="/monitoring">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
    >
      {/* Toast */}
      {toast && (
        <div className={cn(
          'rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2',
          toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20',
        )}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-admin-border bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-admin-muted" />
          <span className="text-xs font-medium text-admin-muted">Active rules</span>
          <span className="text-xs font-bold text-admin-text">{ruleList.length}</span>
        </div>
        <div className="h-4 w-px bg-admin-border" />
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-admin-muted" />
          <span className="text-xs text-admin-muted">Breached</span>
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold tabular-nums', breachedCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
            {breachedCount}
          </span>
        </div>
        <div className="h-4 w-px bg-admin-border" />
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-admin-muted" />
          <span className="text-xs text-admin-muted">Open alerts</span>
          <span className={cn('text-xs font-bold tabular-nums', alerts.length > 0 ? 'text-amber-400' : 'text-admin-text')}>
            {alerts.length}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasChanges && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wide">
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Rule cards */}
      {isLoading ? (
        <FormSkeleton fields={6} />
      ) : (
        <div className="space-y-4">
          {ruleList.map((rule) => {
            const Icon = RULE_ICONS[rule.key] ?? Activity;
            const ruleVal = form[rule.key] ?? { threshold: rule.defaultThreshold, enabled: true, cooldown_sec: rule.defaultCooldownSec, severity: rule.defaultSeverity as 'critical' | 'warning' | 'info' };
            const sevKey = (ruleVal.severity ?? rule.defaultSeverity) as keyof typeof SEVERITY_STYLES;
            const sev = SEVERITY_STYLES[sevKey] ?? SEVERITY_STYLES.warning;
            const currentVal = liveValues[rule.key] ?? 0;
            const threshold = ruleVal.threshold;
            const breached = ruleVal.enabled && currentVal > threshold;
            const step = rule.unit === '%' ? 1 : rule.max > 1000 ? 50 : 10;
            const presets = [
              { label: 'Strict', value: Math.round(rule.defaultThreshold * 0.5) },
              { label: 'Normal', value: rule.defaultThreshold },
              { label: 'Relaxed', value: Math.round(rule.defaultThreshold * 2) },
            ];

            return (
              <div
                key={rule.key}
                className={cn(
                  'rounded-xl border overflow-hidden transition-all',
                  breached ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-admin-border bg-admin-card',
                  !ruleVal.enabled && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-admin-border/50 bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', sev.bg)}>
                      <Icon className={cn('h-4 w-4', sev.text)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-admin-text">{rule.label}</h3>
                        <span className="text-[10px] text-admin-muted">{rule.system}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', sev.bg, sev.text)}>
                          {ruleVal.severity}
                        </span>
                        <label className="flex items-center gap-1 text-[10px] text-admin-muted ml-2">
                          <input type="checkbox" checked={ruleVal.enabled} onChange={(e) => updateField(rule.key, { enabled: e.target.checked })} />
                          Enabled
                        </label>
                      </div>
                      <p className="text-[11px] text-admin-muted mt-0.5 max-w-xl leading-relaxed">{rule.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {breached ? (
                      <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-red-400 uppercase">Breached</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">Normal</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  <ThresholdBar current={currentVal} threshold={threshold} max={rule.max} unit={rule.unit === '%' ? '%' : ` ${rule.unit}`} />
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-admin-muted">Threshold ({rule.unit})</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min={rule.min} max={rule.max} step={step} value={threshold}
                          onChange={(e) => updateField(rule.key, { threshold: Number(e.target.value) })}
                          className="flex-1 accent-admin-primary h-1.5 cursor-pointer" />
                        <input type="number" min={rule.min} max={rule.max} step={step} value={threshold}
                          onChange={(e) => updateField(rule.key, { threshold: Number(e.target.value) || rule.min })}
                          className="w-24 rounded-lg border border-admin-border bg-white/[0.02] px-3 py-1.5 text-sm font-mono tabular-nums text-admin-text text-center outline-none focus:border-admin-primary/50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-admin-muted">Cooldown (sec)</label>
                      <input type="number" min={60} max={7200} value={ruleVal.cooldown_sec}
                        onChange={(e) => updateField(rule.key, { cooldown_sec: Number(e.target.value) || 900 })}
                        className="w-full rounded-lg border border-admin-border bg-white/[0.02] px-3 py-1.5 text-sm text-admin-text" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-admin-muted">Presets</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {presets.map((p) => (
                          <button key={p.label} type="button" onClick={() => updateField(rule.key, { threshold: p.value })}
                            className={cn('rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                              threshold === p.value ? 'border-admin-primary bg-admin-primary/10 text-admin-primary' : 'border-admin-border text-admin-muted hover:bg-white/[0.04]')}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Save / Reset buttons */}
          <div className="flex items-center justify-between rounded-lg border border-admin-border bg-white/[0.02] px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-admin-muted">
              <TrendingUp className="h-3.5 w-3.5" />
              Live values refresh every 10 seconds
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleReset} disabled={!hasChanges || patchMutation.isPending}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || patchMutation.isPending}>
                <Save className="h-3.5 w-3.5" />
                {patchMutation.isPending ? 'Saving…' : 'Save rules'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recent alerts table */}
      <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-admin-border bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-admin-muted" />
            <h3 className="text-sm font-bold text-admin-text">Recent open alerts</h3>
            {alerts.length > 0 && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 tabular-nums">{alerts.length}</span>
            )}
          </div>
          <Link href="/monitoring" className="flex items-center gap-1 text-[11px] font-semibold text-admin-primary hover:text-admin-primary-hover">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-admin-muted">System</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-admin-muted">Severity</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-admin-muted">Message</th>
                <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-admin-muted">Time</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center">
                    <CheckCircle className="h-6 w-6 text-emerald-400/40 mx-auto mb-2" />
                    <p className="text-sm text-admin-muted">No open alerts. All systems normal.</p>
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="border-t border-admin-border/50 hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', alert.severity === 'critical' ? 'bg-red-400' : alert.severity === 'high' ? 'bg-orange-400' : 'bg-amber-400')} />
                        <span className="font-medium text-admin-text text-xs">{alert.system}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <StatusBadge
                        status={alert.severity}
                        variant={alert.severity === 'critical' || alert.severity === 'high' ? 'danger' : 'warning'}
                      />
                    </td>
                    <td className="px-5 py-2.5 text-xs text-admin-muted max-w-xs truncate">{alert.message}</td>
                    <td className="px-5 py-2.5 text-[11px] tabular-nums text-admin-muted">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {alert.created_at ? new Date(alert.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageFrame>
  );
}
