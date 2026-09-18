'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { getForexAutomationWorkflowRuns, type ForexAutomationRunRow } from '@/lib/admin/forex-api';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';

type Workflow = { workflow_id: string; code: string; name: string; enabled: boolean; trigger_type: string };

export function ForexAutomationPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin', 'forex', 'automation', token],
    queryFn: async () => {
      const res = await adminFetch<{ workflows: Workflow[] }>('/forex/automation/workflows', { token });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const runsQ = useQuery({
    queryKey: ['admin', 'forex', 'automation', 'runs', token, selectedId],
    queryFn: async () => {
      const res = await getForexAutomationWorkflowRuns(token, selectedId!);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Runs failed');
      return res.data.runs;
    },
    enabled: !!token && !!selectedId,
  });

  const toggleM = useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) => {
      const res = await adminFetch(`/forex/automation/workflows/${input.id}/enabled`, {
        token,
        method: 'PATCH',
        body: { enabled: input.enabled },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Toggle failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'automation'] }),
  });

  const wfColumns = useMemo<ColumnDef<Workflow>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', cell: ({ getValue }) => <span className="font-mono text-xs text-violet-300">{String(getValue())}</span> },
      { accessorKey: 'name', header: 'Workflow' },
      { accessorKey: 'trigger_type', header: 'Trigger' },
      {
        accessorKey: 'enabled',
        header: 'Status',
        cell: ({ row }) => <Badge variant={row.original.enabled ? 'success' : 'default'}>{row.original.enabled ? 'ENABLED' : 'disabled'}</Badge>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant={selectedId === row.original.workflow_id ? 'secondary' : 'ghost'} className="h-7 text-[10px]" onClick={() => setSelectedId(row.original.workflow_id)}>
              Runs
            </Button>
            <ProtectedAction permission="forex:controls:manage" fallback="disabled">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" disabled={toggleM.isPending} onClick={() => toggleM.mutate({ id: row.original.workflow_id, enabled: !row.original.enabled })}>
                {row.original.enabled ? 'Disable' : 'Enable'}
              </Button>
            </ProtectedAction>
            <ProtectedAction permission="forex:controls:manage" fallback="disabled">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[10px]"
                onClick={async () => {
                  await adminFetch(`/forex/automation/workflows/${row.original.workflow_id}/dry-run`, { token, method: 'POST', body: { probe: true } });
                  setSelectedId(row.original.workflow_id);
                  void runsQ.refetch();
                }}
              >
                Dry-run
              </Button>
            </ProtectedAction>
          </div>
        ),
      },
    ],
    [selectedId, toggleM.isPending, token, runsQ],
  );

  const runColumns = useMemo<ColumnDef<ForexAutomationRunRow>[]>(
    () => [
      { accessorKey: 'started_at', header: 'Started' },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant="info">{String(getValue())}</Badge> },
      { accessorKey: 'finished_at', header: 'Finished', cell: ({ getValue }) => getValue() ?? '—' },
      { accessorKey: 'error_message', header: 'Error', cell: ({ getValue }) => (getValue() ? <span className="text-xs text-red-400">{String(getValue())}</span> : '—') },
    ],
    [],
  );

  const workflows = q.data?.workflows ?? [];
  const enabledCount = workflows.filter((w) => w.enabled).length;

  return (
    <div className="admin-stack-lg">
      <ForexWorkspaceHeader
        title="Automation control"
        purpose="Enable/disable workflows, dry-run safely, and inspect execution history."
        dataSource="forex_automation_workflows + forex_automation_runs"
        posture="MOCK"
        kpis={[
          { label: 'Workflows', value: String(workflows.length) },
          { label: 'Enabled', value: String(enabledCount) },
          { label: 'Selected', value: selectedId ? workflows.find((w) => w.workflow_id === selectedId)?.code ?? '—' : '—' },
        ]}
      />

      {selectedId ? (
        <ForexWorkspaceSurface>
          {(() => {
            const w = workflows.find((x) => x.workflow_id === selectedId);
            if (!w) return null;
            return (
              <>
                <ForexSectionLabel>Workflow graph</ForexSectionLabel>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">When</p>
                    <p className="mt-1 font-mono text-sm">{w.trigger_type}</p>
                  </div>
                  <p className="hidden text-center text-xs text-admin-muted sm:block">→</p>
                  <div className="rounded-lg border border-admin-border bg-admin-bg/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-admin-muted">Then</p>
                    <p className="mt-1 text-sm font-medium">{w.name}</p>
                    <p className="font-mono text-[10px] text-admin-muted">{w.code}</p>
                  </div>
                </div>
              </>
            );
          })()}
        </ForexWorkspaceSurface>
      ) : null}

      <ForexPanelShell title="Workflow registry" description="WHEN/THEN automations — disabled by default until explicitly enabled." noPadding>
        {q.isError ? (
          <p className="p-4 text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Failed'}</p>
        ) : (
          <DataTable columns={wfColumns} data={workflows} loading={q.isLoading} compact emptyMessage="No workflows configured." />
        )}
      </ForexPanelShell>

      {selectedId ? (
        <ForexPanelShell title="Execution log" description="Recent runs for selected workflow" noPadding>
          {runsQ.isError ? (
            <p className="p-4 text-sm text-red-400">{runsQ.error instanceof Error ? runsQ.error.message : 'Failed'}</p>
          ) : (
            <DataTable columns={runColumns} data={runsQ.data ?? []} loading={runsQ.isLoading} compact emptyMessage="No runs yet — try dry-run." />
          )}
        </ForexPanelShell>
      ) : null}
    </div>
  );
}
