'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminCrmSegments, getForexAdminCrmSegmentDetail, type ForexCrmSegmentRow } from '@/lib/admin/forex-api';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

export function ForexCrmSegmentsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [selected, setSelected] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'segments', token],
    queryFn: async () => {
      const res = await getForexAdminCrmSegments(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.rows;
    },
    enabled: !!token,
  });

  const detailQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'segment', selected, token],
    queryFn: async () => {
      const res = await getForexAdminCrmSegmentDetail(token, selected!);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && !!selected,
  });

  const columns = useMemo<ColumnDef<ForexCrmSegmentRow>[]>(
    () => [
      { accessorKey: 'name', header: 'Segment' },
      { accessorKey: 'description', header: 'Description' },
      { accessorKey: 'criteria_summary', header: 'Criteria' },
      { accessorKey: 'client_count', header: 'Count' },
      {
        id: 'open',
        header: '',
        cell: ({ row }) => (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(row.original.segment_id)}>
            View
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <ForexPanelShell
      title="CRM segments"
      description="Predefined operational cohorts — membership computed from authoritative DB rules (no custom SQL)."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void listQ.refetch()} disabled={listQ.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${listQ.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      {listQ.isError ? (
        <p className="text-sm text-red-400">{listQ.error instanceof Error ? listQ.error.message : 'Load failed'}</p>
      ) : (
        <DataTable columns={columns} data={listQ.data ?? []} loading={listQ.isLoading} emptyMessage="No segments." />
      )}
      {selected && detailQ.data ? (
        <div className="mt-6 rounded border border-admin-border/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{detailQ.data.segment.name}</h3>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <p className="mb-3 text-xs text-admin-muted">{detailQ.data.segment.criteria_summary}</p>
          <p className="mb-2 text-xs">Members (sample): {detailQ.data.client_count} total</p>
          <ul className="space-y-1 text-sm">
            {detailQ.data.members.map((m) => (
              <li key={m.account_id}>
                <Link href={`/forex/crm/clients/${encodeURIComponent(m.account_id)}`} className="text-admin-accent hover:underline font-mono text-xs">
                  {m.account_id}
                </Link>
              </li>
            ))}
            {!detailQ.data.members.length ? <li className="text-admin-muted text-xs">No account members (lead-only segment may apply).</li> : null}
          </ul>
        </div>
      ) : null}
    </ForexPanelShell>
  );
}
