'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexExposureBar, ForexFilterBar, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

type Hub = {
  exposure_summary?: { gross_volume_lots?: string; net_volume_lots?: string; symbol_rows?: number };
  unrealized_pnl?: { status?: string; value?: string | null; priced_open_positions?: number };
  symbol_exposure?: Array<{ symbol: string; long_vol: string; short_vol: string; accounts: string }>;
  account?: Record<string, unknown> | null;
};

export function ForexRiskHubPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [accountId, setAccountId] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'forex', 'risk-hub', token, accountId],
    queryFn: async () => {
      const qs = accountId.trim() ? `?account_id=${encodeURIComponent(accountId.trim())}` : '';
      const res = await adminFetch<Hub>(`/forex/risk/hub${qs}`, { token });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Hub failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const columns = useMemo<ColumnDef<NonNullable<Hub['symbol_exposure']>[number]>[]>(
    () => [
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'long_vol', header: 'Long lots' },
      { accessorKey: 'short_vol', header: 'Short lots' },
      { accessorKey: 'accounts', header: 'Accounts' },
    ],
    [],
  );

  const hub = q.data;
  const mtm = hub?.unrealized_pnl;

  const exposureRows = hub?.symbol_exposure ?? [];

  return (
    <div className="admin-stack-lg">
      <ForexWorkspaceHeader
        title="Risk cockpit"
        purpose="Global exposure, symbol concentration, and account drill-down — MOCK quote MTM when priced."
        dataSource="PostgreSQL positions + forex_quotes"
        posture="MOCK"
        kpis={[
          { label: 'Gross lots', value: hub?.exposure_summary?.gross_volume_lots ?? '—' },
          { label: 'Net lots', value: hub?.exposure_summary?.net_volume_lots ?? '—' },
          {
            label: 'Unrealized P&L',
            value: mtm?.status === 'VERIFIED' ? (mtm.value ?? '—') : 'N/A',
            tone: mtm?.status === 'VERIFIED' ? 'default' : 'warning',
          },
          { label: 'Symbols', value: String(hub?.exposure_summary?.symbol_rows ?? 0) },
        ]}
      />
      <ForexFilterBar>
        <Input placeholder="Account id (optional drill-down)" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="max-w-sm" />
        <Button type="button" variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Refresh
        </Button>
      </ForexFilterBar>
      <div className="grid gap-3 xl:grid-cols-12">
        <ForexWorkspaceSurface className="xl:col-span-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-admin-muted">Top exposure</p>
          {q.isLoading ? (
            <p className="text-xs text-admin-muted">Loading…</p>
          ) : exposureRows.length === 0 ? (
            <p className="text-xs text-admin-muted">No open exposure.</p>
          ) : (
            <div className="space-y-3">
              {exposureRows.slice(0, 8).map((row) => (
                <ForexExposureBar
                  key={row.symbol}
                  symbol={row.symbol}
                  long={Number.parseFloat(row.long_vol) || 0}
                  short={Number.parseFloat(row.short_vol) || 0}
                />
              ))}
            </div>
          )}
        </ForexWorkspaceSurface>
        <ForexWorkspaceSurface className="xl:col-span-8" noPadding>
          {hub?.account ? (
            <div className="border-b border-admin-border bg-violet-500/5 px-4 py-3 text-sm">
              <p className="font-medium">Account slice · {String(hub.account.account_id)}</p>
              <p className="text-xs text-admin-muted">
                Cash {String(hub.account.customer_cash_balance)} · Open positions {String(hub.account.open_positions)} · {String(hub.account.valuation)}
              </p>
            </div>
          ) : null}
          <div className="p-2">
            <DataTable columns={columns} data={exposureRows} loading={q.isLoading} emptyMessage="No open exposure." compact />
          </div>
        </ForexWorkspaceSurface>
      </div>
      <Badge variant="default">Quote source: MOCK / simulated — NOT live LP risk</Badge>
    </div>
  );
}
