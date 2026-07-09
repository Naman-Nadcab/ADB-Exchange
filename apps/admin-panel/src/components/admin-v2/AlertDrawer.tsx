'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, AlertTriangle, AlertOctagon, Clock, Trash2, CheckCheck, BrainCircuit,
  Gauge, ExternalLink, CheckCircle, Shield,
} from 'lucide-react';
import { useAdminAlertStore } from '@/store/adminAlerts';
import { useAdminAuthStore } from '@/store/auth';
import { ADMIN_FEATURE_FLAGS } from '@/lib/admin/featureFlags';
import { patchMonitoringAlert, type InfrastructureAlertRow } from '@/lib/monitoring-api';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import type { SystemAlert } from './alert-engine';

function timeAgo(ts: number | string): string {
  const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diff = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function useTick(intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function severityTone(severity: string) {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') return { label: 'text-red-400', bg: 'bg-red-500/[0.04]', icon: AlertOctagon };
  if (s === 'medium' || s === 'warning') return { label: 'text-amber-400', bg: '', icon: AlertTriangle };
  return { label: 'text-zinc-400', bg: '', icon: AlertTriangle };
}

function InfraAlertItem({
  alert,
  onAck,
  onResolve,
  pending,
}: {
  alert: InfrastructureAlertRow;
  onAck: (id: string) => void;
  onResolve: (id: string) => void;
  pending: boolean;
}) {
  const tone = severityTone(alert.severity);
  const Icon = tone.icon;

  return (
    <div className={`group relative px-4 py-3 border-b border-[#1F2937]/60 last:border-0 ${tone.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone.label}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${tone.label}`}>
              {alert.severity}
            </span>
            <span className="text-[10px] text-zinc-600">•</span>
            <span className="text-[10px] text-zinc-500">{alert.system}</span>
            <span className="text-[10px] text-zinc-600">•</span>
            <span className="text-[10px] text-zinc-500 capitalize">{alert.status}</span>
          </div>
          <p className="text-xs text-[#E5E7EB] leading-relaxed">{alert.message}</p>
          {alert.root_cause ? (
            <p className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{alert.root_cause}</p>
          ) : null}
          {alert.suggested_action ? (
            <p className="mt-0.5 text-[10px] text-emerald-400/80 line-clamp-2">→ {alert.suggested_action}</p>
          ) : null}
          <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-600">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo(alert.created_at)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(alert.status === 'open' || alert.status === 'Open') && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onAck(alert.id)}
                className="rounded-md border border-[#1F2937] px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            {alert.status !== 'resolved' && alert.status !== 'Resolved' && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onResolve(alert.id)}
                className="rounded-md border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvisoryAlertItem({ alert, onNavigate }: { alert: SystemAlert; onNavigate: (path: string) => void }) {
  const dismiss = useAdminAlertStore((s) => s.dismissAlert);
  const isCritical = alert.severity === 'critical';
  const isPredictive = alert.severity === 'predictive';

  const iconEl = isPredictive
    ? <BrainCircuit className="w-4 h-4 mt-0.5 text-violet-400 shrink-0" />
    : isCritical
      ? <AlertOctagon className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
      : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />;

  const labelColor = isPredictive ? 'text-violet-400' : isCritical ? 'text-red-400' : 'text-amber-400';

  return (
    <div
      className="group relative flex items-start gap-3 px-4 py-3 border-b border-[#1F2937]/60 last:border-0 hover:bg-white/[0.03] cursor-pointer"
      onClick={() => alert.navTarget && onNavigate(alert.navTarget)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && alert.navTarget && onNavigate(alert.navTarget)}
    >
      {iconEl}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${labelColor}`}>
            {isPredictive ? 'Prediction' : alert.severity}
          </span>
          <span className="text-[10px] text-zinc-600">•</span>
          <span className="text-[10px] text-zinc-500">{alert.source}</span>
        </div>
        <p className="text-xs text-[#E5E7EB] leading-relaxed">{alert.message}</p>
        <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-600">
          <Clock className="w-2.5 h-2.5" />
          {timeAgo(alert.timestamp)}
        </div>
      </div>
      {!isPredictive && (
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3 text-zinc-500" />
        </button>
      )}
    </div>
  );
}

export function AlertDrawer() {
  const {
    alerts: advisoryAlerts,
    predictiveAlerts,
    infrastructureAlerts,
    alertSummary,
    drawerOpen,
    setDrawerOpen,
    markAllRead,
    clearAlerts,
    unreadCount,
  } = useAdminAlertStore();
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const router = useRouter();

  useTick(10_000);

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' }) =>
      patchMonitoringAlert(token, id, { status }),
    onSuccess: (_d, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'alert-center'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'monitoring'] });
      toast.success(status === 'resolved' ? 'Alert resolved.' : 'Alert acknowledged.');
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to update alert.')),
  });

  const handleNavigate = useCallback((path: string) => {
    setDrawerOpen(false);
    router.push(path);
  }, [setDrawerOpen, router]);

  const openCount = alertSummary?.open ?? infrastructureAlerts.length;
  const criticalOpen = alertSummary?.open_critical ?? 0;
  const showPredictive = ADMIN_FEATURE_FLAGS.ADMIN_AI_OPS && predictiveAlerts.length > 0;
  const hasInfra = infrastructureAlerts.length > 0;
  const hasAdvisory = advisoryAlerts.length > 0;

  return (
    <>
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-[2px]"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      <div
        className={`fixed top-0 right-0 z-[61] h-full w-[400px] max-w-[90vw] bg-[#0F1117] border-l border-[#1F2937] shadow-2xl transform transition-transform duration-300 ease-out ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F2937]">
          <div>
            <h2 className="text-sm font-semibold text-[#E5E7EB]">Alert Center</h2>
            <p className="text-[9px] text-zinc-600 mt-0.5">Live infrastructure alerts from monitoring + metric advisories</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {openCount > 0 && (
                <span className="text-[10px] font-medium text-red-400">{openCount} open</span>
              )}
              {criticalOpen > 0 && (
                <span className="text-[10px] font-medium text-red-400">{criticalOpen} critical/high</span>
              )}
              {alertSummary && alertSummary.acknowledged > 0 && (
                <span className="text-[10px] font-medium text-amber-400">{alertSummary.acknowledged} ack</span>
              )}
              {!hasInfra && !hasAdvisory && !showPredictive && (
                <span className="text-[10px] text-zinc-500">All clear</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Mark badge read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            {advisoryAlerts.length > 0 && (
              <button
                onClick={clearAlerts}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Clear advisories"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-120px)]">
          {hasInfra && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/[0.06] border-b border-red-500/10">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Infrastructure</span>
              </div>
              {infrastructureAlerts.map((alert) => (
                <InfraAlertItem
                  key={alert.id}
                  alert={alert}
                  pending={patchMutation.isPending}
                  onAck={(id) => patchMutation.mutate({ id, status: 'acknowledged' })}
                  onResolve={(id) => patchMutation.mutate({ id, status: 'resolved' })}
                />
              ))}
            </div>
          )}

          {showPredictive && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/[0.06] border-b border-violet-500/10">
                <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">Predictive</span>
              </div>
              {predictiveAlerts.slice(0, 5).map((alert) => (
                <AdvisoryAlertItem key={alert.id} alert={alert} onNavigate={handleNavigate} />
              ))}
            </div>
          )}

          {hasAdvisory && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0F1117] border-b border-[#1F2937]">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Metric advisories</span>
              </div>
              {advisoryAlerts.map((alert) => (
                <AdvisoryAlertItem key={alert.id} alert={alert} onNavigate={handleNavigate} />
              ))}
            </div>
          )}

          {!hasInfra && !hasAdvisory && !showPredictive && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
              <CheckCircle className="w-8 h-8 mb-3 text-emerald-600/60" />
              <p className="text-sm">All clear — no open alerts</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-[#1F2937] bg-[#0F1117] px-4 py-2.5">
          <Link
            href="/alerts"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Open full Alert Center
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}
