'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminConfig, getForexAdminExecution, getForexAdminMarketDataQuotes, type ForexAdminMarketDataQuoteRow } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { RefreshCw } from 'lucide-react';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexFilterBar, ForexSpreadBar, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';

function fmtAge(sec: number): string {
  if (sec < 0) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function ForexMarketDataPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [symbolDraft, setSymbolDraft] = useState('');
  const [symbol, setSymbol] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);

  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', 'market-data', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const execQ = useQuery({
    queryKey: ['admin', 'forex', 'execution', 'market-data', token],
    queryFn: async () => {
      const res = await getForexAdminExecution(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  const quotesQ = useQuery({
    queryKey: ['admin', 'forex', 'market-data', 'quotes', token, symbol, staleOnly],
    queryFn: async () => {
      const res = await getForexAdminMarketDataQuotes(token, { symbol: symbol || undefined, stale_only: staleOnly });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Quotes failed');
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const md = configQ.data?.runtime.marketData;
  const cov = quotesQ.data?.coverage;

  const columns = useMemo<ColumnDef<ForexAdminMarketDataQuoteRow>[]>(
    () => [
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'asset_class', header: 'Class' },
      { accessorKey: 'bid', header: 'Bid', cell: ({ getValue }) => <span className="tabular-nums font-mono text-xs">{String(getValue())}</span> },
      { accessorKey: 'ask', header: 'Ask', cell: ({ getValue }) => <span className="tabular-nums font-mono text-xs">{String(getValue())}</span> },
      {
        accessorKey: 'spread_pips',
        header: 'Spread',
        cell: ({ row }) => <ForexSpreadBar spreadPips={String(row.original.spread_pips)} stale={row.original.stale} />,
      },
      {
        accessorKey: 'freshness',
        header: 'Freshness',
        cell: ({ row }) => (
          <Badge variant={row.original.stale ? 'warning' : 'success'} className="font-normal">
            {row.original.stale ? 'Stale' : row.original.freshness}
          </Badge>
        ),
      },
      { accessorKey: 'quality', header: 'Quality' },
      { accessorKey: 'source', header: 'Source' },
      { accessorKey: 'age_sec', header: 'Age', cell: ({ row }) => fmtAge(row.original.age_sec) },
      {
        accessorKey: 'status',
        header: 'Tradeable',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'TRADEABLE' ? 'success' : 'default'} className="font-normal">
            {row.original.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="admin-stack-lg">
      <ForexWorkspaceHeader
        title="Market data control center"
        purpose="Monitor quote coverage, freshness, spreads, and MOCK LP health — drill stale symbols."
        dataSource="forex_quotes + execution provider health"
        posture={md?.source?.includes('LIVE') ? 'LIVE' : 'SIMULATED'}
        kpis={[
          { label: 'Worker', value: md?.running ? 'Running' : 'Stopped', tone: md?.running ? 'success' : 'warning' },
          { label: 'Quoted', value: cov ? `${cov.quoted}/${cov.total_instruments}` : '—' },
          { label: 'Stale', value: cov ? String(cov.stale) : '—', tone: cov && cov.stale > 0 ? 'warning' : undefined },
          { label: 'Missing', value: cov ? String(cov.missing) : '—' },
        ]}
      />
      <ForexPanelShell title="Feed control" description="Worker posture and symbol coverage — quotes from forex_quotes (SIMULATED unless LIVE armed)">
        {configQ.isError ? (
          <p className="text-sm text-red-400">{configQ.error instanceof Error ? configQ.error.message : 'Config failed'}</p>
        ) : md ? (
          <ForexDetailGrid
            columns={4}
            items={[
              { label: 'Worker', value: md.running ? 'Running' : 'Stopped', highlight: md.running ? 'success' : 'danger' },
              { label: 'Enabled', value: md.enabled ? 'Yes' : 'No' },
              { label: 'Source', value: md.source, mono: true },
              { label: 'Interval', value: `${md.intervalMs} ms` },
              { label: 'Configured symbols', value: String(md.symbols) },
              { label: 'Quoted', value: cov ? String(cov.quoted) : '—' },
              { label: 'Stale', value: cov ? String(cov.stale) : '—', highlight: cov && cov.stale > 0 ? 'warning' : undefined },
              { label: 'Missing quotes', value: cov ? String(cov.missing) : '—' },
            ]}
          />
        ) : (
          <p className="text-sm text-admin-muted">Loading worker…</p>
        )}
      </ForexPanelShell>

      <ForexPanelShell
        title="Symbol quote monitor"
        description={quotesQ.data?.worker_note ?? 'Bid/ask, spread, age, and stale detection'}
        actions={
          <Button type="button" size="sm" variant="ghost" onClick={() => void quotesQ.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${quotesQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
        noPadding
      >
        <div className="border-b border-admin-border p-3">
          <ForexFilterBar>
            <Input className="h-9 w-32" placeholder="EURUSD" value={symbolDraft} onChange={(e) => setSymbolDraft(e.target.value.toUpperCase())} />
            <label className="flex h-9 items-center gap-2 text-xs text-admin-muted">
              <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} />
              Stale only
            </label>
            <Button type="button" variant="secondary" className="h-9" onClick={() => setSymbol(symbolDraft.trim())}>
              Apply
            </Button>
          </ForexFilterBar>
        </div>
        {quotesQ.isError ? (
          <p className="p-4 text-sm text-red-400">{quotesQ.error instanceof Error ? quotesQ.error.message : 'Load failed'}</p>
        ) : (
          <DataTable columns={columns} data={quotesQ.data?.rows ?? []} loading={quotesQ.isLoading} compact emptyMessage="No quote rows — worker may be stopped or instruments disabled." />
        )}
      </ForexPanelShell>

      <ForexPanelShell title="MOCK LP health" description="Provider quote health from execution plane — not live LP connectivity">
        <div className="space-y-2">
          {execQ.data?.providers.map((p) => (
            <div key={p.providerId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-admin-border/70 bg-admin-bg/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{p.providerCode}</p>
                <p className="text-xs text-admin-muted">
                  Priority {p.rule?.priority ?? '—'} · quotes {p.health?.quoteCount ?? 0}
                </p>
              </div>
              {p.health ? (
                <Badge variant={p.health.status === 'HEALTHY' ? 'success' : 'warning'} className="font-normal">
                  {p.health.status}
                </Badge>
              ) : (
                <Badge variant="default">NOT_CONFIGURED</Badge>
              )}
            </div>
          ))}
          {!execQ.data?.providers.length ? (
            <p className="text-sm text-admin-muted">{execQ.isLoading ? 'Loading…' : 'No provider adapters configured.'}</p>
          ) : null}
        </div>
      </ForexPanelShell>
    </div>
  );
}
