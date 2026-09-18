'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminJournal, getForexAdminPolicy } from '@/lib/admin/forex-api';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexAdminOpsTable } from '@/components/forex/ForexAdminOpsTable';
import { DataTable } from '@/components/ui/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import type { ForexAdminJournalRow } from '@/lib/admin/forex-api';
import { useMemo } from 'react';
import { AlertTriangle, Flame, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

const LIQ_EVENT = /liquidat|stop.?out|margin.?call/i;

function fmtTime(s: string): string {
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return s;
  }
}

export function ForexLiquidationPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);

  const policyQ = useQuery({
    queryKey: ['admin', 'forex', 'policy', 'liquidation-view', token],
    queryFn: async () => {
      const res = await getForexAdminPolicy(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const journalQ = useQuery({
    queryKey: ['admin', 'forex', 'journal', 'liquidation', token],
    queryFn: async () => {
      const res = await getForexAdminJournal(token, { page: 1, limit: 50 });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      const rows = res.data.rows.filter(
        (r) => LIQ_EVENT.test(r.event_type) || LIQ_EVENT.test(r.category) || LIQ_EVENT.test(r.message),
      );
      return { rows, tableReady: res.data.tableReady };
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const margin = policyQ.data?.margin.effective;

  const journalColumns = useMemo<ColumnDef<ForexAdminJournalRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'Time', cell: ({ getValue }) => fmtTime(String(getValue())) },
      { accessorKey: 'severity', header: 'Severity', cell: ({ getValue }) => <Badge variant="danger">{String(getValue())}</Badge> },
      { accessorKey: 'event_type', header: 'Event' },
      { accessorKey: 'account_id', header: 'Account', cell: ({ getValue }) => String(getValue()).slice(0, 8) + '…' },
      { accessorKey: 'message', header: 'Message' },
    ],
    [],
  );

  return (
    <div className="admin-stack-lg">
      <section className="grid gap-3 sm:grid-cols-3">
        <ForexMetricTile
          label="Margin warning"
          value={margin?.warningLevel ? `${margin.warningLevel}%` : '—'}
          hint="Notify / restrict new risk"
          icon={Gauge}
          tone="warning"
        />
        <ForexMetricTile
          label="Margin call"
          value={margin?.callLevel ? `${margin.callLevel}%` : '—'}
          hint="Additional margin required"
          icon={AlertTriangle}
          tone="warning"
        />
        <ForexMetricTile
          label="Stop-out"
          value={margin?.stopOutLevel ? `${margin.stopOutLevel}%` : '—'}
          hint="Automatic liquidation threshold"
          icon={Flame}
          tone="danger"
        />
      </section>

      <ForexPanelShell title="Configured margin ladder" description="Effective policy — edit under Risk & fees → Margin & risk.">
        <ForexDetailGrid
          items={[
            { label: 'Warning level', value: margin?.warningLevel ? `${margin.warningLevel}%` : '—' },
            { label: 'Call level', value: margin?.callLevel ? `${margin.callLevel}%` : '—', highlight: 'warning' },
            { label: 'Stop-out level', value: margin?.stopOutLevel ? `${margin.stopOutLevel}%` : '—', highlight: 'danger' },
            { label: 'Maintenance ratio', value: margin?.maintenanceRatio ?? '—' },
          ]}
        />
      </ForexPanelShell>

      <ForexPanelShell
        title="Liquidation & margin events"
        description="Stop-out and liquidation events from the customer journal feed (MOCK execution environment)."
      >
        {!journalQ.data?.tableReady ? (
          <p className="text-sm text-admin-muted">Journal table not migrated. Run backend migrate for forex_journal_events.</p>
        ) : journalQ.isLoading ? (
          <p className="text-sm text-admin-muted">Loading events…</p>
        ) : (journalQ.data?.rows.length ?? 0) === 0 ? (
          <p className="text-sm text-admin-muted">No liquidation or margin-call events in the latest journal window.</p>
        ) : (
          <DataTable columns={journalColumns} data={journalQ.data!.rows} compact sortable={false} />
        )}
      </ForexPanelShell>

      <ForexPanelShell title="Open positions at risk" description="Cross-check margin level per account in user profile → Forex tab.">
        <ForexAdminOpsTable kind="positions" />
      </ForexPanelShell>
    </div>
  );
}
