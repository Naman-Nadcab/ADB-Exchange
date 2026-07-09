'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Activity, Database, Wifi, Cpu, Layers, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Plug, ArrowRight, Radio, Droplets, ShieldCheck,
} from 'lucide-react';
import { adminFetch } from '@/lib/api';
import { useAdminAuthStore } from '@/store/auth';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { InfrastructureOpsPanel } from '@/components/ops/InfrastructureOpsPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type HealthPayload = {
  timestamp: string;
  database: { status: string; latency_ms: number };
  redis: { status: string; latency_ms: number };
  websocket: { connections: number; authenticated: number; status: string };
  node: { uptime_sec: number; memory_heap_mb: number; status: string };
  queue: {
    settlement_pending: number;
    settlement_lag_sec: number;
    settlement_delayed: boolean;
    withdrawal_pending: number;
    total_withdrawal_queue: number;
  };
};

type ProviderRow = {
  id: string;
  category: string;
  provider: string;
  name: string;
  is_active: boolean;
  health_status: string;
  last_error: string | null;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
  );
}

function ServiceCard({
  title,
  status,
  detail,
  icon: Icon,
}: {
  title: string;
  status: 'up' | 'down' | 'warn';
  detail: string;
  icon: typeof Activity;
}) {
  const tone = status === 'up' ? 'border-emerald-500/20 bg-emerald-500/5' : status === 'warn' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5';
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-admin-text">
          <Icon className="h-4 w-4 text-admin-muted" /> {title}
        </div>
        <Badge variant={status === 'up' ? 'success' : status === 'warn' ? 'warning' : 'danger'}>{status}</Badge>
      </div>
      <p className="text-xs text-admin-muted">{detail}</p>
    </div>
  );
}

export default function SystemHealthCenterPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const toast = useAdminToast();

  const health = useQuery({
    queryKey: ['admin', 'system-health-center', token],
    queryFn: () => adminFetch<HealthPayload>('/system-health', { token }),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const integrations = useQuery({
    queryKey: ['admin', 'system-health-integrations', token],
    queryFn: () => adminFetch<{ total: number; active: number; unhealthy: number; providers: ProviderRow[] }>(
      '/system-health/integrations', { token },
    ),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const diagnostics = useMutation({
    mutationFn: () => adminFetch('/system/diagnostics/run', { method: 'POST', token }),
    onSuccess: () => {
      void integrations.refetch();
      toast.success('Diagnostics run completed.');
    },
    onError: (e) => toast.error(formatSaveError(e, 'Diagnostics run failed.')),
  });

  const h = health.data?.data;
  const ig = integrations.data?.data;
  const loading = health.isLoading;

  return (
    <AdminPageFrame
      title="System Health Center"
      description="Unified operational view — infrastructure, queues, integrations, and diagnostics."
      metrics={
        <>
          <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
            <div className="text-lg font-semibold text-admin-text">{ig?.active ?? '—'}</div>
            <div className="text-[11px] uppercase tracking-wide text-admin-muted">Active providers</div>
          </div>
          <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
            <div className={`text-lg font-semibold ${(ig?.unhealthy ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {ig?.unhealthy ?? '—'}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-admin-muted">Unhealthy providers</div>
          </div>
          <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
            <div className="text-lg font-semibold text-admin-text">{h?.queue.settlement_pending ?? '—'}</div>
            <div className="text-[11px] uppercase tracking-wide text-admin-muted">Settlement pending</div>
          </div>
        </>
      }
      quickActions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { void health.refetch(); void integrations.refetch(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => diagnostics.mutate()} disabled={diagnostics.isPending}>
            {diagnostics.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-1">Run all diagnostics</span>
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-admin-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-admin-text">Core infrastructure</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ServiceCard
                title="Database"
                icon={Database}
                status={h?.database.status === 'up' ? 'up' : 'down'}
                detail={`Latency ${h?.database.latency_ms ?? '—'}ms`}
              />
              <ServiceCard
                title="Redis"
                icon={Layers}
                status={h?.redis.status === 'up' ? 'up' : 'down'}
                detail={`Latency ${h?.redis.latency_ms ?? '—'}ms`}
              />
              <ServiceCard
                title="WebSocket"
                icon={Wifi}
                status={h?.websocket.status === 'up' ? 'up' : 'down'}
                detail={`${h?.websocket.connections ?? 0} connections · ${h?.websocket.authenticated ?? 0} authenticated`}
              />
              <ServiceCard
                title="Node"
                icon={Cpu}
                status={h?.node.status === 'up' ? 'up' : 'down'}
                detail={`Uptime ${Math.floor((h?.node.uptime_sec ?? 0) / 60)}m · Heap ${h?.node.memory_heap_mb ?? '—'}MB`}
              />
              <ServiceCard
                title="Settlement"
                icon={Activity}
                status={h?.queue.settlement_delayed ? 'warn' : 'up'}
                detail={`Pending ${h?.queue.settlement_pending ?? 0} · Lag ${h?.queue.settlement_lag_sec ?? 0}s`}
              />
              <ServiceCard
                title="Withdrawal queue"
                icon={Radio}
                status={(h?.queue.total_withdrawal_queue ?? 0) > 50 ? 'warn' : 'up'}
                detail={`Total queued ${h?.queue.total_withdrawal_queue ?? 0}`}
              />
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-admin-text">Integration providers</h2>
              <Link href="/system/integrations" className="flex items-center gap-1 text-xs text-admin-accent hover:underline">
                Integrations Center <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto rounded-lg border border-admin-border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-admin-border bg-admin-surface/50 text-admin-muted">
                  <tr>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Active</th>
                    <th className="px-3 py-2">Health</th>
                    <th className="px-3 py-2">Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {(ig?.providers ?? []).filter((p) => p.is_active).map((p) => (
                    <tr key={p.id} className="border-b border-admin-border/50">
                      <td className="px-3 py-2 font-medium text-admin-text">{p.name}</td>
                      <td className="px-3 py-2 text-admin-muted">{p.category}</td>
                      <td className="px-3 py-2"><StatusDot ok={p.is_active} /></td>
                      <td className="px-3 py-2">
                        <Badge variant={p.health_status === 'healthy' ? 'success' : p.health_status === 'down' ? 'danger' : 'default'}>
                          {p.health_status || 'untested'}
                        </Badge>
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-red-400/80" title={p.last_error ?? ''}>
                        {p.last_error ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {(ig?.providers ?? []).filter((p) => p.is_active).length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-admin-muted">No active providers — configure in Integrations Center.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <InfrastructureOpsPanel />

          <section>
            <h2 className="mb-3 text-sm font-semibold text-admin-text">Quick links</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: '/monitoring', label: 'Monitoring', icon: Activity },
                { href: '/liquidity', label: 'Liquidity & Hedge', icon: Droplets },
                { href: '/compliance', label: 'Compliance', icon: ShieldCheck },
                { href: '/system/integrations', label: 'Integrations', icon: Plug },
              ].map((l) => (
                <Link key={l.href} href={l.href}
                  className="flex items-center gap-2 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-text hover:border-admin-accent/40">
                  <l.icon className="h-4 w-4 text-admin-muted" /> {l.label}
                </Link>
              ))}
            </div>
          </section>

          {diagnostics.isSuccess && (
            <p className="mt-4 flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Diagnostics completed — refresh provider health above.
            </p>
          )}
          {diagnostics.isError && (
            <p className="mt-4 flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Diagnostics run failed.
            </p>
          )}
        </>
      )}
    </AdminPageFrame>
  );
}
