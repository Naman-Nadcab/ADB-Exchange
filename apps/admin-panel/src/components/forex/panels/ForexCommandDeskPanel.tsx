'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ForexAdminOverviewResponse, ForexAdminSystemResponse, ForexCommandAttentionItem } from '@/lib/admin/forex-api';
import { getForexAdminCommandAttention } from '@/lib/admin/forex-api';
import { useAdminAuthStore } from '@/store/auth';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { AlertTriangle, Search, Server, SlidersHorizontal } from 'lucide-react';
import { ForexGlobalSearchBar } from '@/components/forex/panels/ForexGlobalSearchBar';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexFilterBar, ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { cn } from '@/lib/cn';

const ATTENTION_FILTERS = ['all', 'dealing', 'risk', 'finance', 'compliance', 'crm', 'system'] as const;

function friendlySource(source: string | undefined): string {
  const s = (source ?? 'SIMULATED').toUpperCase();
  if (s.includes('SIM')) return 'Simulated quotes';
  if (s.includes('LIVE') || s.includes('REAL')) return 'Live quotes';
  return source ?? 'Unknown';
}

function friendlyExecution(mode: string | undefined): string {
  const m = (mode ?? 'MOCK').toUpperCase();
  if (m.includes('MOCK')) return 'Mock venue (no real LP fills)';
  return mode ?? 'Unknown';
}

function severityStripe(sev: ForexCommandAttentionItem['severity']) {
  if (sev === 'critical') return 'border-l-red-500';
  if (sev === 'high') return 'border-l-amber-500';
  if (sev === 'medium') return 'border-l-violet-500';
  return 'border-l-admin-border';
}

export function ForexCommandDeskPanel(props: {
  overview: ForexAdminOverviewResponse | undefined;
  system: ForexAdminSystemResponse | undefined;
  loading?: boolean;
}) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [attentionFilter, setAttentionFilter] = useState<(typeof ATTENTION_FILTERS)[number]>('all');

  const attentionQ = useQuery({
    queryKey: ['admin', 'forex', 'command', 'attention', token],
    queryFn: async () => {
      const res = await getForexAdminCommandAttention(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load attention queue');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const counts = props.overview?.counts;
  const posture = props.overview?.posture;
  const ready = props.overview?.readiness?.economicReady;
  const md = props.system?.marketData;
  const attention = attentionQ.data;

  const filteredAttention = useMemo(() => {
    const items = attention?.items ?? [];
    if (attentionFilter === 'all') return items;
    return items.filter((i) => i.category.toLowerCase().includes(attentionFilter));
  }, [attention?.items, attentionFilter]);

  if (props.loading && !props.overview) {
    return <KpiSkeleton count={4} />;
  }

  return (
    <div className="space-y-4">
      <ForexWorkspaceHeader
        title="Command desk"
        purpose="Live attention queue, venue posture, and operator search — tactical control surface."
        dataSource="PostgreSQL + runtime flags (MOCK/SIMULATED execution)"
        posture="MOCK"
        kpis={[
          { label: 'Open orders', value: String(counts?.openOrders ?? '—') },
          { label: 'Open positions', value: String(counts?.openPositions ?? '—') },
          { label: 'Kill switch', value: posture?.killSwitch ? 'ON' : 'Off', tone: posture?.killSwitch ? 'danger' : 'success' },
          { label: 'Economic ready', value: ready ? 'Yes' : 'No', tone: ready ? 'success' : 'warning' },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <ForexWorkspaceSurface className="xl:col-span-8" noPadding>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-4 py-3">
            <ForexSectionLabel icon={AlertTriangle}>What needs attention now</ForexSectionLabel>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => void attentionQ.refetch()} disabled={attentionQ.isFetching}>
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-admin-border/60 px-4 py-2">
            {ATTENTION_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setAttentionFilter(f)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors',
                  attentionFilter === f ? 'bg-violet-500/20 text-violet-200' : 'text-admin-muted hover:bg-white/5',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="p-3">
            {attentionQ.isError ? (
              <p className="text-xs text-red-400">{attentionQ.error instanceof Error ? attentionQ.error.message : 'Attention queue unavailable'}</p>
            ) : attentionQ.isLoading && !attention ? (
              <KpiSkeleton count={2} />
            ) : filteredAttention.length === 0 ? (
              <p className="rounded-lg border border-dashed border-admin-border/60 bg-admin-bg/20 px-4 py-8 text-center text-xs text-admin-muted">
                No attention items in this filter — venue posture and worker status remain on the right.
              </p>
            ) : (
              <div className="space-y-1.5">
                {filteredAttention.map((item) => (
                  <Link
                    key={`${item.category}-${item.title}-${item.href}`}
                    href={item.href}
                    className={cn(
                      'flex flex-wrap items-center gap-2 rounded-lg border border-admin-border/60 border-l-4 bg-admin-bg/30 px-3 py-2.5 text-xs transition hover:border-violet-500/30 hover:bg-violet-500/5',
                      severityStripe(item.severity),
                    )}
                  >
                    <Badge variant={item.severity === 'critical' ? 'danger' : item.severity === 'high' ? 'warning' : 'info'} className="text-[9px] font-normal capitalize">
                      {item.severity}
                    </Badge>
                    <span className="font-semibold uppercase tracking-wide text-admin-muted">{item.category.replace(/_/g, ' ')}</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{item.title}</span>
                    {item.detail ? <span className="hidden text-admin-muted lg:inline">{item.detail}</span> : null}
                    {item.count != null ? <span className="tabular-nums text-admin-muted">{item.count} open</span> : null}
                    <span className="font-medium text-violet-400">Review →</span>
                  </Link>
                ))}
              </div>
            )}
            {attention && (attention.totals.critical > 0 || attention.totals.high > 0) ? (
              <p className="mt-3 flex items-center gap-2 text-[10px] text-amber-400/90">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {attention.totals.critical} critical · {attention.totals.high} high priority
              </p>
            ) : null}
          </div>
        </ForexWorkspaceSurface>

        <div className="flex flex-col gap-3 xl:col-span-4">
          <ForexWorkspaceSurface>
            <ForexSectionLabel icon={Search}>Global search</ForexSectionLabel>
            <ForexGlobalSearchBar />
          </ForexWorkspaceSurface>

          <ForexWorkspaceSurface>
            <ForexSectionLabel>Venue posture</ForexSectionLabel>
            <div className="space-y-2 text-xs">
              <PostureRow label="Quotes" value={friendlySource(posture?.source)} tone="warn" />
              <PostureRow label="Execution" value={friendlyExecution(posture?.executionMode)} tone="warn" />
              <PostureRow label="Real money" value={posture?.realForex ? 'ARMED' : 'Blocked'} tone={posture?.realForex ? 'danger' : 'ok'} />
              <PostureRow label="Kill switch" value={posture?.killSwitch ? 'ON' : 'Off'} tone={posture?.killSwitch ? 'danger' : 'ok'} />
              <PostureRow label="Demo funding" value={posture?.demoFundingEnabled ? 'Enabled' : 'Disabled'} />
            </div>
          </ForexWorkspaceSurface>

          <ForexWorkspaceSurface>
            <ForexSectionLabel icon={Server}>Market data worker</ForexSectionLabel>
            {md ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-admin-muted">Worker</span>
                  <span className={cn('font-medium', md.running ? 'text-emerald-400' : 'text-amber-400')}>{md.running ? 'Running' : 'Stopped'}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-admin-border">
                  <div className={cn('h-full rounded-full', md.running ? 'w-full bg-emerald-500/70' : 'w-1/4 bg-amber-500/60')} />
                </div>
                <PostureRow label="Source" value={md.source} mono />
                <PostureRow label="Symbols" value={String(md.symbols)} />
                <PostureRow label="Interval" value={`${md.intervalMs} ms`} mono />
              </div>
            ) : (
              <p className="text-xs text-admin-muted">{props.loading ? 'Loading…' : 'No telemetry.'}</p>
            )}
          </ForexWorkspaceSurface>

          <ForexWorkspaceSurface>
            <ForexSectionLabel icon={SlidersHorizontal}>Incident shortcuts</ForexSectionLabel>
            <div className="grid gap-1.5">
              <Shortcut href="/forex/controls" label="Global controls" />
              <Shortcut href="/forex/instruments" label="Halt instruments" />
              <Shortcut href="/forex/lp-execution" label="LP & execution" />
              <Shortcut href="/forex/system" label="System health" />
            </div>
          </ForexWorkspaceSurface>
        </div>
      </div>

      {props.system?.flags ? (
        <ForexWorkspaceSurface>
          <ForexSectionLabel>Platform flags</ForexSectionLabel>
          <div className="flex flex-wrap gap-2">
            {Object.entries(props.system.flags).map(([key, on]) => (
              <Badge key={key} variant={on ? 'success' : 'default'} className="font-normal text-[10px]">
                {key.replace(/([A-Z])/g, ' $1').trim()}: {on ? 'ON' : 'off'}
              </Badge>
            ))}
          </div>
        </ForexWorkspaceSurface>
      ) : null}
    </div>
  );
}

function PostureRow(props: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger'; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-admin-border/40 py-1 last:border-0">
      <span className="text-admin-muted">{props.label}</span>
      <span
        className={cn(
          'font-medium',
          props.mono && 'font-mono text-[10px]',
          props.tone === 'danger' && 'text-red-400',
          props.tone === 'warn' && 'text-amber-300/90',
          props.tone === 'ok' && 'text-emerald-400/90',
        )}
      >
        {props.value}
      </span>
    </div>
  );
}

function Shortcut(props: { href: string; label: string }) {
  return (
    <Link href={props.href} className="rounded-md border border-admin-border/60 bg-admin-bg/30 px-2.5 py-2 text-xs font-medium transition hover:border-violet-500/35 hover:bg-violet-500/5">
      {props.label} →
    </Link>
  );
}
