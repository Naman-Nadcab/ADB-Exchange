'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminCrmWorkspace, type ForexCrmWorkspaceSnapshot } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

function attentionVariant(kind: ForexCrmWorkspaceSnapshot['attention'][number]['kind']) {
  if (kind === 'task_overdue') return 'danger' as const;
  if (kind === 'kyc_pending') return 'warning' as const;
  return 'default' as const;
}

export function ForexCrmMyClientsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'workspace', token],
    queryFn: async () => {
      const res = await getForexAdminCrmWorkspace(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const snap = qry.data;

  return (
    <ForexPanelShell
      title="My clients"
      description="Account manager workspace — your leads, tasks, assignments, and attention queue."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      {qry.isError ? (
        <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ForexMetricTile label="My open leads" value={snap?.my_leads_open ?? '—'} />
            <ForexMetricTile label="Assigned clients" value={snap?.my_assigned_clients ?? '—'} />
            <ForexMetricTile label="Open tasks" value={snap?.my_tasks_open ?? '—'} />
            <ForexMetricTile label="Due today" value={snap?.my_tasks_due_today ?? '—'} hint={`${snap?.my_tasks_overdue ?? 0} overdue`} />
          </div>

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400/90">Attention required</h3>
          {snap?.attention.length ? (
            <ul className="mb-6 space-y-2">
              {snap.attention.map((a) => (
                <li key={`${a.kind}-${a.resource_id}`} className="flex items-center justify-between gap-2 rounded border border-admin-border/60 bg-admin-surface/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={attentionVariant(a.kind)} className="text-[10px]">
                      {a.kind.replace(/_/g, ' ')}
                    </Badge>
                    {a.title}
                  </span>
                  <Link href={a.href_hint} className="text-xs text-admin-accent hover:underline">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-6 text-sm text-admin-muted">No items require immediate attention.</p>
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-muted">Recent tasks</h3>
          {snap?.recent_tasks.length ? (
            <ul className="space-y-1 text-sm">
              {snap.recent_tasks.map((t) => (
                <li key={t.task_id} className="flex justify-between gap-2 border-b border-admin-border/40 py-1.5">
                  <span>{t.title}</span>
                  <span className="font-mono text-[10px] text-admin-muted">{t.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-admin-muted">No tasks assigned to you yet.</p>
          )}
        </>
      )}
    </ForexPanelShell>
  );
}
