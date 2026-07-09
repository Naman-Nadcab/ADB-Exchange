'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/auth';
import { getMonitoringContainers, getMonitoringContainerLogs } from '@/lib/monitoring-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Server, RefreshCw, FileText, Activity } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function InfrastructureCenterPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'monitoring', 'containers', token],
    queryFn: () => getMonitoringContainers(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const containers = data?.data?.containers ?? [];
  const dockerAvailable = data?.data?.docker_available ?? false;

  const loadLogs = async (name: string) => {
    setSelected(name);
    const res = await getMonitoringContainerLogs(token, name, 80);
    setLogs(res.data?.logs ?? 'No logs');
  };

  return (
    <AdminPageFrame
      title="Infrastructure Center"
      description="Docker container status, restart counts, and log tail — no SSH required."
      status={dockerAvailable ? 'active' : 'warning'}
      error={isError ? (error instanceof Error ? error.message : 'Failed to load containers') : null}
      onRetry={isError ? () => void refetch() : undefined}
      quickActions={
        <>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/monitoring">
            <Button variant="secondary" size="sm">
              <Activity className="mr-1 h-4 w-4" />
              Monitoring
            </Button>
          </Link>
        </>
      }
    >
      {!dockerAvailable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          Docker socket not mounted in backend container. Mount <code className="text-xs">/var/run/docker.sock</code> and set{' '}
          <code className="text-xs">COMPOSE_PROJECT_DIR=/opt/m-live</code> for live container control.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden">
          <div className="border-b border-admin-border px-4 py-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-admin-muted" />
            <h3 className="text-sm font-semibold text-admin-text">Containers ({containers.length})</h3>
          </div>
          {isLoading ? (
            <p className="p-4 text-sm text-admin-muted">Loading…</p>
          ) : containers.length === 0 ? (
            <p className="p-4 text-sm text-admin-muted">No containers reported.</p>
          ) : (
            <div className="divide-y divide-admin-border/50">
              {containers.map((c) => (
                <div
                  key={c.name}
                  className={cn(
                    'flex items-center justify-between gap-2 px-4 py-3 hover:bg-white/[0.02]',
                    selected === c.name && 'bg-white/[0.04]',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-admin-text truncate">{c.name}</p>
                    <p className="text-[11px] text-admin-muted">{c.service} · restarts: {c.restart_count}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={c.state === 'running' ? 'success' : 'warning'}>{c.state}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => void loadLogs(c.name)}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-admin-border bg-admin-card overflow-hidden flex flex-col min-h-[320px]">
          <div className="border-b border-admin-border px-4 py-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-admin-muted" />
            <h3 className="text-sm font-semibold text-admin-text">
              Logs {selected ? `— ${selected}` : ''}
            </h3>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-admin-muted font-mono whitespace-pre-wrap">
            {selected ? logs : 'Select a container to view recent logs.'}
          </pre>
        </div>
      </div>
    </AdminPageFrame>
  );
}
