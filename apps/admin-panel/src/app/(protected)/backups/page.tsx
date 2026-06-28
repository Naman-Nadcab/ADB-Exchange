'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Database, RefreshCw, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/auth';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { OperatorSection } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ActionAuthModal, type ActionAuthPayload } from '@/components/ops/ActionAuthModal';
import {
  createOperationalBackup,
  getOperationalBackups,
  requestOperationalBackupRestore,
} from '@/lib/system-api';
import { useState } from 'react';

function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupsPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const backupsQ = useQuery({
    queryKey: ['admin', 'operational-backups', token],
    queryFn: () => getOperationalBackups(token),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (_: ActionAuthPayload) => createOperationalBackup(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'operational-backups'] });
      setCreateOpen(false);
    },
  });

  const restoreMut = useMutation({
    mutationFn: (payload: ActionAuthPayload) =>
      requestOperationalBackupRestore(token, restoreId!),
    onSuccess: () => {
      setRestoreId(null);
    },
  });

  const backups = backupsQ.data?.data?.backups ?? [];
  const message = backupsQ.data?.data?.message;
  const latest = backups[0];

  return (
    <AdminPageFrame
      title="Backups"
      description="Database snapshot history and manual backup triggers for disaster recovery."
      status={backupsQ.isError ? 'warning' : 'active'}
      quickActions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void backupsQ.refetch()}>
            <RefreshCw className={backupsQ.isFetching ? 'animate-spin' : ''} />
            <span className="ml-1">Refresh</span>
          </Button>
          <ProtectedAction permission="control:commands" fallback="disabled">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Database className="mr-1 h-3.5 w-3.5" /> Create backup
            </Button>
          </ProtectedAction>
        </>
      }
      metrics={
        <>
          <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
            <div className="text-lg font-semibold">{backups.length}</div>
            <div className="text-[11px] uppercase text-admin-muted">Total snapshots</div>
          </div>
          <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
            <div className="text-lg font-semibold">{latest?.status ?? '—'}</div>
            <div className="text-[11px] uppercase text-admin-muted">Latest status</div>
          </div>
          <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
            <div className="text-lg font-semibold">{fmtBytes(latest?.sizeBytes)}</div>
            <div className="text-[11px] uppercase text-admin-muted">Latest size</div>
          </div>
        </>
      }
    >
      <OperatorSection
        title="Backup history"
        description="Point-in-time database snapshots. Restore overwrites live data — use only during DR drills or confirmed incidents."
        help="Backups are stored on the application host or configured storage path."
        helpDanger="Restore is destructive. Stop trading and withdrawals before restore."
        auditHref="/audit"
      >
        {backupsQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-admin-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : message ? (
          <p className="text-sm text-amber-400/90">{message}</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-admin-muted">No backups yet. Create a manual snapshot to populate history.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-admin-muted">
                <tr>
                  {['ID', 'Type', 'Status', 'Size', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-t border-admin-border/30">
                    <td className="py-2 pr-3 font-mono">{b.id.slice(0, 8)}…</td>
                    <td className="py-2 pr-3">{b.type}</td>
                    <td className="py-2 pr-3"><Badge size="sm">{b.status}</Badge></td>
                    <td className="py-2 pr-3">{fmtBytes(b.sizeBytes)}</td>
                    <td className="py-2 pr-3">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <ProtectedAction permission="control:commands" fallback="disabled">
                        <button type="button" className="text-amber-400 hover:underline" onClick={() => setRestoreId(b.id)}>
                          <RotateCcw className="inline h-3 w-3 mr-0.5" />Restore
                        </button>
                      </ProtectedAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[10px] text-admin-muted">
          Related: <Link href="/operations" className="text-admin-accent underline">Operations Hub</Link> config snapshots · <Link href="/settings/system" className="text-admin-accent underline">System Config</Link> version history
        </p>
      </OperatorSection>

      <ActionAuthModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create database backup"
        actionLabel="Create backup"
        description="Triggers a manual snapshot. May impact disk I/O briefly."
        confirmationPhrase="CREATE BACKUP"
        onConfirm={(p) => { void createMut.mutateAsync(p); }}
        isPending={createMut.isPending}
        requireReason
        twofaRequired
      />

      <ActionAuthModal
        open={!!restoreId}
        onClose={() => setRestoreId(null)}
        title="Restore from backup"
        actionLabel="Restore backup"
        description="This will replace current database state. All operators must be notified."
        confirmationPhrase="RESTORE BACKUP"
        onConfirm={(p) => { void restoreMut.mutateAsync(p); }}
        isPending={restoreMut.isPending}
        requireReason
        twofaRequired
        confirmVariant="danger"
      />
    </AdminPageFrame>
  );
}
