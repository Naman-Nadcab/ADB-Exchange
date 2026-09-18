'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminCrmLeadStages,
  getForexAdminCrmLeads,
  getForexAdminCrmLeadsSummary,
  postForexAdminCrmLead,
  type ForexAdminCrmLeadRow,
} from '@/lib/admin/forex-api';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexCrmLeadDrawer } from '@/components/forex/panels/ForexCrmLeadDrawer';
import { RefreshCw, Search, UserPlus } from 'lucide-react';

function stageLabel(stageId: string, stages: Map<string, string>) {
  return stages.get(stageId) ?? stageId;
}

function stageCount(byStage: Array<{ stage_id: string; count: number }>, id: string) {
  return byStage.find((s) => s.stage_id === id)?.count ?? 0;
}

export function ForexCrmLeadsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [stageId, setStageId] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [source, setSource] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const filterParams = useMemo(
    () => ({
      q: q || undefined,
      stage_id: stageId || undefined,
      status: status || undefined,
      priority: priority || undefined,
      owner_admin_id: ownerId.trim() || undefined,
      campaign_code: source.trim() || undefined,
      created_from: createdFrom ? `${createdFrom}T00:00:00.000Z` : undefined,
      created_to: createdTo ? `${createdTo}T23:59:59.999Z` : undefined,
    }),
    [q, stageId, status, priority, ownerId, source, createdFrom, createdTo],
  );

  const stagesQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'lead-stages', token],
    queryFn: async () => {
      const res = await getForexAdminCrmLeadStages(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.stages;
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const stageMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stagesQ.data ?? []) m.set(s.stage_id, s.label);
    return m;
  }, [stagesQ.data]);

  const summaryQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'leads', 'summary', token, filterParams],
    queryFn: async () => {
      const res = await getForexAdminCrmLeadsSummary(token, filterParams);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await postForexAdminCrmLead(token, {
        email: createEmail.trim() || undefined,
        full_name: createName.trim() || undefined,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Create failed');
    },
    onSuccess: () => {
      setCreateEmail('');
      setCreateName('');
      setCreateError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'leads'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'leads', 'summary'] });
    },
    onError: (e) => setCreateError(e instanceof Error ? e.message : 'Failed'),
  });

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'leads', token, page, filterParams],
    queryFn: async () => {
      const res = await getForexAdminCrmLeads(token, { page, limit: 25, ...filterParams });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const columns = useMemo<ColumnDef<ForexAdminCrmLeadRow>[]>(
    () => [
      {
        accessorKey: 'lead_id',
        header: 'Lead',
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-xs text-admin-accent hover:underline"
            onClick={() => setDrawerLeadId(row.original.lead_id)}
          >
            {row.original.lead_id.slice(0, 8)}…
          </button>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => (
          <div className="text-sm">
            <div className="font-medium text-admin-fg">{row.original.full_name ?? '—'}</div>
            <div className="text-xs text-admin-muted">{row.original.email ?? row.original.phone ?? '—'}</div>
          </div>
        ),
      },
      {
        accessorKey: 'stage_id',
        header: 'Stage',
        cell: ({ row }) => (
          <Badge variant="info" className="text-[10px] font-normal capitalize">
            {stageLabel(row.original.stage_id, stageMap)}
          </Badge>
        ),
      },
      {
        accessorKey: 'owner_admin_id',
        header: 'Owner',
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-admin-muted">
            {row.original.owner_admin_id ? row.original.owner_admin_id.slice(0, 8) : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'campaign_code',
        header: 'Source',
        cell: ({ row }) => <span className="text-xs">{row.original.campaign_code ?? '—'}</span>,
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => <span className="text-xs capitalize">{row.original.priority}</span>,
      },
      {
        accessorKey: 'last_activity_at',
        header: 'Last activity',
        cell: ({ row }) => (
          <span className="text-xs text-admin-muted">
            {row.original.last_activity_at ? new Date(row.original.last_activity_at).toLocaleString() : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'next_task_at',
        header: 'Next task',
        cell: ({ row }) => (
          <span className="text-xs text-admin-muted">
            {row.original.next_task_at ? new Date(row.original.next_task_at).toLocaleString() : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-admin-muted">{new Date(row.original.created_at).toLocaleDateString()}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button type="button" size="sm" variant="ghost" onClick={() => setDrawerLeadId(row.original.lead_id)}>
            Open
          </Button>
        ),
      },
    ],
    [stageMap],
  );

  const pagination = qry.data?.pagination;
  const summary = summaryQ.data;
  const byStage = summary?.by_stage ?? [];

  return (
    <>
      <ForexPanelShell
        title="CRM — Leads"
        description="Lead pipeline and client acquisition — filters apply to KPIs and the table."
        actions={
          <div className="flex flex-wrap gap-2">
            <ProtectedAction permission="forex:crm:manage" fallback="hidden">
              <Button
                size="sm"
                disabled={createMut.isPending || (!createEmail.trim() && !createName.trim())}
                onClick={() => createMut.mutate()}
              >
                Create lead
              </Button>
            </ProtectedAction>
            <Button variant="ghost" size="sm" onClick={() => { void qry.refetch(); void summaryQ.refetch(); }} disabled={qry.isFetching}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      >
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <ForexMetricTile label="Total" value={summaryQ.isLoading ? '…' : (summary?.total ?? 0)} icon={UserPlus} />
          <ForexMetricTile label="New" value={summaryQ.isLoading ? '…' : stageCount(byStage, 'new')} />
          <ForexMetricTile label="Contacted" value={summaryQ.isLoading ? '…' : stageCount(byStage, 'contacted')} />
          <ForexMetricTile label="Qualified" value={summaryQ.isLoading ? '…' : stageCount(byStage, 'qualified')} />
          <ForexMetricTile label="KYC" value={summaryQ.isLoading ? '…' : (summary?.kyc_started ?? 0)} />
          <ForexMetricTile
            label="Converted"
            value={summaryQ.isLoading ? '…' : (summary?.converted ?? 0)}
            tone={(summary?.converted ?? 0) > 0 ? 'success' : 'default'}
          />
        </section>
        {summaryQ.isError ? (
          <p className="mb-3 text-xs text-red-400">{summaryQ.error instanceof Error ? summaryQ.error.message : 'Summary failed'}</p>
        ) : null}

        <ProtectedAction permission="forex:crm:manage" fallback="hidden">
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-admin-border/50 p-3">
            <Input placeholder="Full name" value={createName} onChange={(e) => setCreateName(e.target.value)} className="max-w-[160px]" />
            <Input placeholder="Email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className="max-w-[200px]" />
            {createError ? <span className="text-xs text-red-400">{createError}</span> : null}
          </div>
        </ProtectedAction>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-admin-muted" />
            <Input
              placeholder="Search ID, name, email, phone…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setQ(qInput.trim());
                }
              }}
            />
            <Button size="sm" onClick={() => { setPage(1); setQ(qInput.trim()); }}>
              Search
            </Button>
          </div>
          <select className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs" value={stageId} onChange={(e) => { setStageId(e.target.value); setPage(1); }}>
            <option value="">All stages</option>
            {(stagesQ.data ?? []).map((s) => (
              <option key={s.stage_id} value={s.stage_id}>{s.label}</option>
            ))}
          </select>
          <select className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="open">open</option>
            <option value="converted">converted</option>
            <option value="lost">lost</option>
          </select>
          <select className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All priorities</option>
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
          <Input placeholder="Owner admin UUID" value={ownerId} onChange={(e) => { setOwnerId(e.target.value); setPage(1); }} className="max-w-[140px] text-xs font-mono" />
          <Input placeholder="Source / campaign" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="max-w-[120px] text-xs" />
          <Input type="date" value={createdFrom} onChange={(e) => { setCreatedFrom(e.target.value); setPage(1); }} className="max-w-[130px] text-xs" />
          <Input type="date" value={createdTo} onChange={(e) => { setCreatedTo(e.target.value); setPage(1); }} className="max-w-[130px] text-xs" />
        </div>

        {qry.isError ? (
          <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
        ) : (
          <>
            <DataTable columns={columns} data={qry.data?.rows ?? []} loading={qry.isLoading} emptyMessage="No leads match filters." />
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-admin-border/60 px-4 py-3 text-xs text-admin-muted">
                <span>
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} leads (filtered)
                </span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </ForexPanelShell>

      <ForexCrmLeadDrawer leadId={drawerLeadId} onClose={() => setDrawerLeadId(null)} />
    </>
  );
}
