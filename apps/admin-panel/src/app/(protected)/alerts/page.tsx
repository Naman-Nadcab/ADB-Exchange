'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  getMonitoringAlerts,
  getMonitoringAlertSummary,
  patchMonitoringAlert,
  createMonitoringIncident,
  type InfrastructureAlertRow,
} from '@/lib/monitoring-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { TableSkeleton } from '@/components/ui';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { useAdminWs } from '@/hooks/useAdminWs';
import { cn } from '@/lib/cn';
import {
  BellRing, AlertOctagon, AlertTriangle, CheckCircle2, Eye, RefreshCw,
  ChevronLeft, ChevronRight, X, Clock, Shield, RotateCcw, Activity, Siren,
} from 'lucide-react';

type StatusFilter = 'all' | 'open' | 'acknowledged' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'info';

const PAGE_SIZE = 20;

function formatTimeAgo(ts: string): string {
  const ms = new Date(ts).getTime();
  const diff = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTs(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function ConfirmModal({
  open,
  title,
  message,
  danger,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-admin-border bg-admin-card p-6 shadow-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          {danger ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
          ) : null}
          <div>
            <h3 className={cn('text-base font-bold', danger ? 'text-red-400' : 'text-admin-text')}>{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-admin-muted">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-admin-border pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color, pulse }: {
  label: string; value: number; icon: React.ReactNode; color: string; pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-admin-border bg-admin-card p-3.5">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]', color)}>
        {icon}
      </div>
      <div>
        <p className={cn('text-2xl font-bold tabular-nums text-admin-text', pulse && 'animate-pulse')}>{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-admin-muted">{label}</p>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
  tone,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  tone?: 'red' | 'amber' | 'green' | 'default';
}) {
  const toneClass =
    tone === 'red' ? 'border-red-500/40 text-red-400' :
    tone === 'amber' ? 'border-amber-500/40 text-amber-400' :
    tone === 'green' ? 'border-emerald-500/40 text-emerald-400' :
    'border-admin-border text-admin-muted';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-white/10 text-admin-text border-admin-border' : `${toneClass} hover:bg-white/[0.04]`,
      )}
    >
      {label}
      {count != null && count > 0 ? ` (${count})` : ''}
    </button>
  );
}

function AlertDetailPanel({
  alert,
  onClose,
  onAction,
  onCreateIncident,
  pending,
}: {
  alert: InfrastructureAlertRow;
  onClose: () => void;
  onAction: (status: 'acknowledged' | 'resolved' | 'open') => void;
  onCreateIncident: () => void;
  pending: boolean;
}) {
  const isOpen = alert.status === 'open' || alert.status === 'Open';
  const isResolved = alert.status === 'resolved' || alert.status === 'Resolved';

  return (
    <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden">
      <div className="flex items-start justify-between border-b border-admin-border px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge
              status={alert.severity}
              variant={
                ['critical', 'high'].includes(alert.severity.toLowerCase()) ? 'danger' :
                ['medium', 'warning'].includes(alert.severity.toLowerCase()) ? 'warning' : 'default'
              }
            />
            <StatusBadge status={alert.status} />
            <span className="text-xs text-admin-muted">{alert.system}</span>
          </div>
          <h3 className="text-sm font-semibold text-admin-text">{alert.message}</h3>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 text-admin-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <DetailField label="Created" value={formatTs(alert.created_at)} icon={<Clock className="h-3.5 w-3.5" />} />
        <DetailField label="Acknowledged" value={formatTs(alert.acknowledged_at)} icon={<Eye className="h-3.5 w-3.5" />} />
        <DetailField label="Resolved" value={formatTs(alert.resolved_at)} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <DetailField label="Assigned admin" value={alert.assigned_admin_id ?? 'Unassigned'} icon={<Shield className="h-3.5 w-3.5" />} />
      </div>

      {alert.root_cause ? (
        <div className="border-t border-admin-border px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-admin-muted mb-1">Root cause</p>
          <p className="text-sm text-admin-text leading-relaxed">{alert.root_cause}</p>
        </div>
      ) : null}

      {alert.suggested_action ? (
        <div className="border-t border-admin-border px-4 py-3 bg-emerald-500/[0.04]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Suggested action</p>
          <p className="text-sm text-emerald-300/90 leading-relaxed">{alert.suggested_action}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-admin-border px-4 py-3">
        {isOpen && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => onAction('acknowledged')}>
            Acknowledge
          </Button>
        )}
        {!isResolved && (
          <Button variant="primary" size="sm" disabled={pending} onClick={() => onAction('resolved')}>
            Resolve
          </Button>
        )}
        {isResolved && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => onAction('open')}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reopen
          </Button>
        )}
        <Link href="/monitoring">
          <Button variant="secondary" size="sm">
            <Activity className="mr-1 h-3.5 w-3.5" />
            Monitoring
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={onCreateIncident}>
          <Siren className="mr-1 h-3.5 w-3.5" />
          Create incident
        </Button>
      </div>
    </div>
  );
}

function DetailField({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-admin-muted mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-sm text-admin-text">{value}</p>
    </div>
  );
}

export default function AlertCenterPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useAdminToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; status: 'acknowledged' | 'resolved' | 'open'; system: string } | null>(null);
  const [incidentConfirm, setIncidentConfirm] = useState<InfrastructureAlertRow | null>(null);

  const statusParam = statusFilter === 'all' ? undefined : statusFilter;
  const severityParam = severityFilter === 'all' ? undefined : severityFilter;

  const { data: summaryRes, refetch: refetchSummary } = useQuery({
    queryKey: ['admin', 'alert-center', 'summary', token],
    queryFn: () => getMonitoringAlertSummary(token),
    enabled: !!token,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: alertsRes, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'alert-center', 'list', token, page, statusFilter, severityFilter],
    queryFn: () =>
      getMonitoringAlerts(token, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        status: statusParam,
        severity: severityParam,
      }),
    enabled: !!token,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useAdminWs({
    onEvent: (ev) => {
      const t = (ev?.type as string) ?? '';
      if (['system_alert', 'infrastructure_action', 'timeline_event'].includes(t)) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'alert-center'] });
      }
    },
  });

  const incidentMutation = useMutation({
    mutationFn: (alert: InfrastructureAlertRow) =>
      createMonitoringIncident(token, {
        service: alert.system,
        severity: alert.severity,
        title: alert.message,
        related_alert_id: alert.id,
      }),
    onSuccess: () => {
      setIncidentConfirm(null);
      toast.success('Incident created from alert.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitoring'] });
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to create incident.')),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' | 'open' }) =>
      patchMonitoringAlert(token, id, { status }),
    onMutate: async ({ id, status }) => {
      const key = ['admin', 'alert-center', 'list', token, page, statusFilter, severityFilter] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: { data?: { alerts?: InfrastructureAlertRow[]; total?: number } } | undefined) => {
        if (!old?.data?.alerts) return old;
        return {
          ...old,
          data: {
            ...old.data,
            alerts: old.data.alerts.map((a) => (a.id === id ? { ...a, status } : a)),
          },
        };
      });
      return { prev, key };
    },
    onSuccess: (_d, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'alert-center'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitoring'] });
      setConfirm(null);
      toast.success(
        status === 'resolved' ? 'Alert resolved.' :
        status === 'acknowledged' ? 'Alert acknowledged.' :
        'Alert reopened.',
      );
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      toast.error(formatSaveError(e, 'Failed to update alert.'));
    },
  });

  const summary = summaryRes?.data;
  const alerts = (alertsRes?.data?.alerts ?? []) as InfrastructureAlertRow[];
  const total = alertsRes?.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const selectedAlert = useMemo(
    () => (selectedId ? alerts.find((a) => a.id === selectedId) ?? null : null),
    [alerts, selectedId],
  );

  const pageStatus =
    (summary?.open_critical ?? 0) > 0 ? 'risk' as const :
    (summary?.open ?? 0) > 0 ? 'warning' as const :
    'active' as const;

  const pageError = isError ? (error instanceof Error ? error.message : 'Failed to load alerts.') : null;

  const handleFilterStatus = useCallback((f: StatusFilter) => {
    setStatusFilter(f);
    setPage(1);
    setSelectedId(null);
  }, []);

  const handleFilterSeverity = useCallback((f: SeverityFilter) => {
    setSeverityFilter(f);
    setPage(1);
    setSelectedId(null);
  }, []);

  const retryAll = () => {
    void refetch();
    void refetchSummary();
  };

  return (
    <AdminPageFrame
      title="Alert Center"
      description="Global infrastructure alert lifecycle — acknowledge, resolve, and track root cause across all systems."
      status={pageStatus}
      error={pageError}
      onRetry={pageError ? retryAll : undefined}
      quickActions={
        <Button variant="secondary" size="sm" onClick={retryAll}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      }
      metrics={
        <>
          <KpiCard label="Open" value={summary?.open ?? 0} icon={<BellRing className="h-3.5 w-3.5" />}
            color={(summary?.open ?? 0) > 0 ? 'text-red-400' : 'text-admin-muted'} pulse={(summary?.open ?? 0) > 0} />
          <KpiCard label="Critical / High" value={summary?.open_critical ?? 0} icon={<AlertOctagon className="h-3.5 w-3.5" />}
            color={(summary?.open_critical ?? 0) > 0 ? 'text-red-400' : 'text-admin-muted'} pulse={(summary?.open_critical ?? 0) > 0} />
          <KpiCard label="Acknowledged" value={summary?.acknowledged ?? 0} icon={<Eye className="h-3.5 w-3.5" />}
            color={(summary?.acknowledged ?? 0) > 0 ? 'text-amber-400' : 'text-admin-muted'} />
          <KpiCard label="Resolved" value={summary?.resolved ?? 0} icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            color="text-emerald-400" />
        </>
      }
    >
      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={statusFilter === 'all'} label="All" onClick={() => handleFilterStatus('all')} />
        <FilterChip active={statusFilter === 'open'} label="Open" count={summary?.open} onClick={() => handleFilterStatus('open')} tone="red" />
        <FilterChip active={statusFilter === 'acknowledged'} label="Acknowledged" count={summary?.acknowledged} onClick={() => handleFilterStatus('acknowledged')} tone="amber" />
        <FilterChip active={statusFilter === 'resolved'} label="Resolved" count={summary?.resolved} onClick={() => handleFilterStatus('resolved')} tone="green" />
      </div>

      {/* Severity filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-admin-muted self-center mr-1">Severity</span>
        {(['all', 'critical', 'high', 'medium', 'info'] as SeverityFilter[]).map((s) => (
          <FilterChip
            key={s}
            active={severityFilter === s}
            label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            onClick={() => handleFilterSeverity(s)}
            tone={s === 'critical' || s === 'high' ? 'red' : s === 'medium' ? 'amber' : undefined}
          />
        ))}
      </div>

      {selectedAlert && (
        <AlertDetailPanel
          alert={selectedAlert}
          onClose={() => setSelectedId(null)}
          pending={patchMutation.isPending}
          onAction={(status) =>
            setConfirm({ id: selectedAlert.id, status, system: selectedAlert.system })
          }
          onCreateIncident={() => setIncidentConfirm(selectedAlert)}
        />
      )}

      {/* Alerts table */}
      <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-admin-border bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-admin-muted">
                <th className="px-4 py-2.5">System</th>
                <th className="px-3 py-2.5">Severity</th>
                <th className="px-3 py-2.5">Message</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <TableSkeleton rows={5} cols={6} />
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-admin-muted">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600/50" />
                    No alerts match the current filters.
                  </td>
                </tr>
              ) : (
                alerts.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-admin-border/40 transition-colors last:border-0 hover:bg-white/[0.02] cursor-pointer',
                      selectedId === row.id && 'bg-white/[0.04]',
                    )}
                    onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                  >
                    <td className="px-4 py-2.5 font-semibold text-admin-text">{row.system}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        status={row.severity}
                        variant={
                          ['critical', 'high'].includes(row.severity.toLowerCase()) ? 'danger' :
                          ['medium', 'warning'].includes(row.severity.toLowerCase()) ? 'warning' : 'default'
                        }
                      />
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2.5 text-admin-muted" title={row.message}>
                      {row.message}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-admin-muted whitespace-nowrap">
                      {row.created_at ? formatTimeAgo(row.created_at) : '—'}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        {(row.status === 'open' || row.status === 'Open') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={patchMutation.isPending}
                            onClick={() => setConfirm({ id: row.id, status: 'acknowledged', system: row.system })}
                          >
                            Ack
                          </Button>
                        )}
                        {row.status !== 'resolved' && row.status !== 'Resolved' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={patchMutation.isPending}
                            onClick={() => setConfirm({ id: row.id, status: 'resolved', system: row.system })}
                          >
                            Resolve
                          </Button>
                        )}
                        {(row.status === 'resolved' || row.status === 'Resolved') && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={patchMutation.isPending}
                            onClick={() => setConfirm({ id: row.id, status: 'open', system: row.system })}
                          >
                            Reopen
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={incidentMutation.isPending}
                          onClick={() => setIncidentConfirm(row)}
                          title="Create incident"
                        >
                          <Siren className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-admin-border px-4 py-2.5 text-[11px] text-admin-muted">
            <span>
              Page {page} / {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        title={
          confirm?.status === 'resolved' ? 'Resolve alert' :
          confirm?.status === 'acknowledged' ? 'Acknowledge alert' :
          'Reopen alert'
        }
        message={
          confirm
            ? `${confirm.status === 'resolved' ? 'Mark as resolved' : confirm.status === 'acknowledged' ? 'Acknowledge' : 'Reopen'} infrastructure alert for ${confirm.system}? This is audited and broadcast live.`
            : ''
        }
        danger={confirm?.status === 'resolved'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && patchMutation.mutate({ id: confirm.id, status: confirm.status })}
        loading={patchMutation.isPending}
      />

      <ConfirmModal
        open={!!incidentConfirm}
        title="Create incident from alert"
        message={incidentConfirm ? `Open incident for ${incidentConfirm.system}: ${incidentConfirm.message.slice(0, 120)}?` : ''}
        onClose={() => setIncidentConfirm(null)}
        onConfirm={() => incidentConfirm && incidentMutation.mutate(incidentConfirm)}
        loading={incidentMutation.isPending}
      />
    </AdminPageFrame>
  );
}
