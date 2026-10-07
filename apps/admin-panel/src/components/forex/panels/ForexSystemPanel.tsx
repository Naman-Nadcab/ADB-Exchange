'use client';

import Link from 'next/link';
import type { ForexAdminConfigResponse, ForexAdminSystemResponse } from '@/lib/admin/forex-api';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { cn } from '@/lib/cn';
import { Cpu, Database, Radio, Server, SlidersHorizontal } from 'lucide-react';

export function ForexSystemPanel(props: {
  system: ForexAdminSystemResponse | undefined;
  config: ForexAdminConfigResponse | undefined;
  loading?: boolean;
}) {
  const md = props.system?.marketData ?? props.config?.runtime.marketData;
  const ready = props.system?.readiness ?? props.config?.readiness;
  const realForex = props.config?.runtime.liveReleaseOpen === true;

  return (
    <div className="space-y-4">
      <ForexWorkspaceHeader
        title="System runtime"
        purpose="Market readiness, quote worker, hydration, and platform diagnostics."
        dataSource="GET /forex/system · GET /forex/config"
        posture={realForex ? 'LIVE' : 'MOCK'}
        kpis={[
          { label: 'Economic ready', value: ready?.economicReady ? 'Yes' : 'No', tone: ready?.economicReady ? 'success' : 'warning' },
          { label: 'Symbols', value: String(props.config?.runtime.symbolCount ?? md?.symbols ?? '—') },
          { label: 'Quote worker', value: md?.running ? 'Running' : 'Stopped', tone: md?.running ? 'success' : 'warning' },
          { label: 'Position mode', value: props.config?.runtime.positionMode ?? '—' },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <RuntimeGauge
          icon={Database}
          label="Economic hydration"
          value={ready?.economicReady ? 'Ready' : 'Blocked'}
          ok={!!ready?.economicReady}
          hint={ready?.reason ?? undefined}
        />
        <RuntimeGauge icon={Cpu} label="Symbols loaded" value={String(props.config?.runtime.symbolCount ?? md?.symbols ?? '—')} ok />
        <RuntimeGauge icon={Radio} label="Quote worker" value={md?.running ? 'Running' : 'Stopped'} ok={!!md?.running} />
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ForexWorkspaceSurface className="xl:col-span-6">
          <ForexSectionLabel icon={Server}>Readiness cockpit</ForexSectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoCell label="Economic ready" value={ready?.economicReady ? 'Yes' : 'No'} ok={!!ready?.economicReady} />
            <InfoCell label="Reason" value={ready?.reason ?? '—'} />
            <InfoCell label="Position mode" value={props.config?.runtime.positionMode ?? '—'} mono />
            <InfoCell
              label="Live money path"
              value={realForex ? 'Release open' : 'Release closed — simulated money path'}
              ok={!realForex}
              danger={!!realForex}
            />
          </div>
        </ForexWorkspaceSurface>

        <ForexWorkspaceSurface className="xl:col-span-6">
          <ForexSectionLabel icon={Radio}>Market data runtime</ForexSectionLabel>
          {md ? (
            <>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-admin-muted">Worker pulse</span>
                <span className={cn('font-medium', md.running ? 'text-emerald-400' : 'text-amber-400')}>{md.running ? 'Active' : 'Stopped'}</span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-admin-border">
                <div className={cn('h-full rounded-full transition-all', md.running ? 'w-full bg-emerald-500/75' : 'w-[15%] bg-amber-500/60')} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoCell label="Enabled" value={md.enabled ? 'Yes' : 'No'} ok={md.enabled} />
                <InfoCell label="Interval" value={`${md.intervalMs} ms`} mono />
                <InfoCell label="Source" value={md.source?.toUpperCase().includes('MOCK') ? `Mock (${md.source})` : md.source} />
                <InfoCell label="Providers" value={md.providers?.join(', ') ?? '—'} mono />
              </div>
            </>
          ) : (
            <p className="text-xs text-admin-muted">{props.loading ? 'Loading telemetry…' : 'No market data runtime.'}</p>
          )}
        </ForexWorkspaceSurface>
      </div>

      {props.system?.flags ? (
        <ForexWorkspaceSurface>
          <ForexSectionLabel>Platform flags</ForexSectionLabel>
          <div className="flex flex-wrap gap-2">
            {Object.entries(props.system.flags).map(([key, on]) => (
              <span
                key={key}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10px] font-medium',
                  on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-admin-border text-admin-muted',
                )}
              >
                {key.replace(/([A-Z])/g, ' $1').trim()}: {on ? 'ON' : 'off'}
              </span>
            ))}
          </div>
        </ForexWorkspaceSurface>
      ) : null}

      <ForexWorkspaceSurface>
        <ForexSectionLabel icon={SlidersHorizontal}>Operator shortcuts</ForexSectionLabel>
        <div className="flex flex-wrap gap-2">
          <Link href="/forex/controls" className="rounded-md border border-admin-border/60 px-3 py-2 text-xs font-medium hover:border-violet-500/35 hover:bg-violet-500/5">
            Global controls →
          </Link>
          <Link href="/forex/market-data" className="rounded-md border border-admin-border/60 px-3 py-2 text-xs font-medium hover:border-violet-500/35 hover:bg-violet-500/5">
            Market data center →
          </Link>
          <Link href="/forex/command" className="rounded-md border border-admin-border/60 px-3 py-2 text-xs font-medium hover:border-violet-500/35 hover:bg-violet-500/5">
            Command desk →
          </Link>
        </div>
      </ForexWorkspaceSurface>
    </div>
  );
}

function RuntimeGauge(props: { icon: typeof Database; label: string; value: string; ok?: boolean; hint?: string }) {
  const Icon = props.icon;
  return (
    <div className="rounded-lg border border-admin-border/70 bg-[var(--admin-card)] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <Icon className="h-4 w-4 text-violet-400" />
        </div>
        <p className="text-[10px] uppercase tracking-wide text-admin-muted">{props.label}</p>
      </div>
      <p className={cn('text-xl font-semibold tabular-nums', props.ok === false && 'text-amber-400', props.ok && 'text-foreground')}>{props.value}</p>
      {props.hint ? <p className="mt-1 text-[10px] text-admin-muted">{props.hint}</p> : null}
    </div>
  );
}

function InfoCell(props: { label: string; value: string; ok?: boolean; danger?: boolean; mono?: boolean }) {
  return (
    <div className="rounded-md border border-admin-border/50 bg-admin-bg/25 px-3 py-2">
      <p className="text-[9px] uppercase text-admin-muted">{props.label}</p>
      <p
        className={cn(
          'text-sm font-medium',
          props.mono && 'font-mono text-xs',
          props.danger && 'text-red-400',
          props.ok && !props.danger && 'text-emerald-400/95',
        )}
      >
        {props.value}
      </p>
    </div>
  );
}
