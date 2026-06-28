'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, RefreshCw, Terminal, Activity } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { OperatorSection } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type Tab = 'infrastructure' | 'admin';

interface TimelineRow {
  id?: string;
  service?: string;
  event?: string;
  severity?: string;
  timestamp?: string;
  created_at?: string;
  message?: string;
}

interface ActivityRow {
  id?: string;
  adminName?: string;
  action?: string;
  createdAt?: string;
  ipAddress?: string;
}

export default function SystemLogsPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<Tab>('infrastructure');

  const timelineQ = useQuery({
    queryKey: ['admin', 'logs', 'timeline', token],
    queryFn: () => adminFetch<{ timeline?: TimelineRow[]; events?: TimelineRow[] }>('/monitoring/timeline', { token }),
    enabled: !!token && tab === 'infrastructure',
    refetchInterval: 30_000,
  });

  const activityQ = useQuery({
    queryKey: ['admin', 'logs', 'activity', token],
    queryFn: () =>
      adminFetch<{ logs?: ActivityRow[] }>('/audit/activity', {
        token,
        params: { limit: 50 },
      }),
    enabled: !!token && tab === 'admin',
    refetchInterval: 30_000,
  });

  const timeline = timelineQ.data?.data?.timeline ?? timelineQ.data?.data?.events ?? [];
  const activity = activityQ.data?.data?.logs ?? [];

  const refresh = () => {
    if (tab === 'infrastructure') void timelineQ.refetch();
    else void activityQ.refetch();
  };

  return (
    <AdminPageFrame
      title="System Logs"
      description="Infrastructure timeline and administrator activity across the platform."
      quickActions={
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          <span className="ml-1">Refresh</span>
        </Button>
      }
    >
      <div className="mb-4 flex gap-1 rounded-lg border border-admin-border/50 bg-white/[0.02] p-1 w-fit">
        {([
          { id: 'infrastructure' as Tab, label: 'Infrastructure', icon: Activity },
          { id: 'admin' as Tab, label: 'Admin Activity', icon: Terminal },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${tab === id ? 'bg-admin-accent/10 text-admin-text' : 'text-admin-muted hover:text-admin-text'}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <OperatorSection
        title={tab === 'infrastructure' ? 'Infrastructure timeline' : 'Administrator activity'}
        description={
          tab === 'infrastructure'
            ? 'Control events, monitoring incidents, and service-level signals.'
            : 'Recent admin actions with audit trail links.'
        }
        help={tab === 'infrastructure' ? 'Sourced from /monitoring/timeline.' : 'Sourced from /audit/activity. Full immutable trail on Audit Logs.'}
        auditHref="/audit"
        lastUpdated={
          tab === 'infrastructure' && timelineQ.dataUpdatedAt
            ? new Date(timelineQ.dataUpdatedAt).toLocaleString()
            : activityQ.dataUpdatedAt
              ? new Date(activityQ.dataUpdatedAt).toLocaleString()
              : null
        }
      >
        {(tab === 'infrastructure' ? timelineQ.isLoading : activityQ.isLoading) ? (
          <div className="flex items-center gap-2 text-sm text-admin-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : tab === 'infrastructure' ? (
          timeline.length === 0 ? (
            <p className="text-sm text-admin-muted">No infrastructure events recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {timeline.slice(0, 40).map((row, i) => (
                <li key={row.id ?? i} className="flex flex-wrap items-center gap-2 rounded-lg border border-admin-border/40 px-3 py-2 text-xs">
                  <Badge variant={row.severity === 'critical' ? 'danger' : 'default'} size="sm">{row.severity ?? 'info'}</Badge>
                  <span className="font-medium">{row.service ?? row.event ?? 'event'}</span>
                  <span className="text-admin-muted">{row.message ?? ''}</span>
                  <span className="ml-auto text-admin-muted">{row.timestamp ?? row.created_at ?? ''}</span>
                </li>
              ))}
            </ul>
          )
        ) : activity.length === 0 ? (
          <p className="text-sm text-admin-muted">No admin activity in this window. <Link href="/audit" className="text-admin-accent underline">Open full audit log</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-admin-muted">
                <tr>
                  {['Admin', 'Action', 'IP', 'Time'].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr key={row.id ?? i} className="border-t border-admin-border/30">
                    <td className="py-2 pr-3">{row.adminName ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono">{row.action ?? '—'}</td>
                    <td className="py-2 pr-3">{row.ipAddress ?? '—'}</td>
                    <td className="py-2 pr-3 text-admin-muted">{row.createdAt ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[10px] text-admin-muted">
          Diagnostics: <Link href="/system/health" className="text-admin-accent underline">System Health</Link> · Monitoring: <Link href="/monitoring" className="text-admin-accent underline">Monitoring</Link>
        </p>
      </OperatorSection>
    </AdminPageFrame>
  );
}
