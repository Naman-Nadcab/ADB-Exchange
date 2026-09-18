'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminExecution,
  patchForexAdminRouting,
  patchForexRealForexArm,
  type ForexAdminExecutionSnapshot,
} from '@/lib/admin/forex-api';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SafeActionModal } from '@/components/ui/SafeActionModal';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  extractForexApprovalPending,
  ForexApprovalPendingNotice,
  type ForexApprovalPendingInfo,
} from '@/components/forex/primitives/ForexApprovalPendingNotice';

function ChecklistRow(props: { label: string; pass: boolean; detail: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-admin-border/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>{props.label}</span>
        <Badge variant={props.pass ? 'success' : 'danger'} className="font-normal text-[10px]">
          {props.pass ? 'Pass' : 'Fail'}
        </Badge>
      </div>
      <p className="text-xs text-admin-muted">{props.detail}</p>
    </div>
  );
}

export function ForexExecutionPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [armOpen, setArmOpen] = useState(false);
  const [disarmOpen, setDisarmOpen] = useState(false);
  const [routingPending, setRoutingPending] = useState<{ providerId: string; code: string; enabled: boolean } | null>(
    null,
  );
  const [approvalNotice, setApprovalNotice] = useState<ForexApprovalPendingInfo | null>(null);

  const execQ = useQuery({
    queryKey: ['admin', 'forex', 'execution', token],
    queryFn: async () => {
      const res = await getForexAdminExecution(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'execution'] });

  const routingMut = useMutation({
    mutationFn: async (args: { providerId: string; enabled: boolean; reason: string }) => {
      const res = await patchForexAdminRouting(token, args.providerId, {
        reason: args.reason,
        enabled: args.enabled,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
      return res;
    },
    onSuccess: (res) => {
      const pending = extractForexApprovalPending(res.data, res.meta?.httpStatus);
      setApprovalNotice(pending);
      if (!pending) invalidate();
      setRoutingPending(null);
    },
  });

  const armMut = useMutation({
    mutationFn: async (args: { requested: boolean; reason: string }) => {
      const res = await patchForexRealForexArm(token, { requested: args.requested, reason: args.reason });
      if (!res.success) throw new Error(res.error?.message ?? 'Arm failed');
      return res.data;
    },
    onSuccess: () => {
      invalidate();
      setArmOpen(false);
      setDisarmOpen(false);
    },
  });

  const data: ForexAdminExecutionSnapshot | undefined = execQ.data;
  const gate = data?.realForexGate;
  const pending = routingMut.isPending || armMut.isPending;

  return (
    <div className="space-y-4">
      <ForexApprovalPendingNotice info={approvalNotice} onDismiss={() => setApprovalNotice(null)} />
      <ForexPanelShell
        title="Live money path gate"
        description="REAL_FOREX remains blocked in production until certification completes"
        className="border-amber-500/30 bg-amber-500/[0.03]"
      >
        <div className="mb-2 flex items-center gap-2 text-amber-500">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">High impact</span>
        </div>
        {execQ.isLoading ? (
          <p className="text-sm text-admin-muted">Loading execution posture…</p>
        ) : gate ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Effective path OFF</Badge>
              <Badge variant={gate.armRequested ? 'warning' : 'default'}>
                Arm requested: {gate.armRequested ? 'Yes' : 'No'}
              </Badge>
              <Badge variant={gate.checklistComplete ? 'success' : 'danger'}>
                Checklist {gate.checklistComplete ? 'complete' : 'incomplete'}
              </Badge>
            </div>
            <p className="text-xs text-admin-muted">{gate.releaseBlockReason}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {gate.checklist.map((item) => (
                <ChecklistRow key={item.id} label={item.label} pass={item.pass} detail={item.detail} />
              ))}
            </div>
            <ProtectedAction permission="forex:control" fallback="disabled">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={pending || !gate.checklistComplete || gate.armRequested}
                  onClick={() => setArmOpen(true)}
                >
                  Record arm intent
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending || !gate.armRequested}
                  onClick={() => setDisarmOpen(true)}
                >
                  Disarm intent
                </Button>
              </div>
            </ProtectedAction>
            {!gate.checklistComplete ? (
              <p className="flex items-center gap-1 text-xs text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Complete all checklist items before recording arm intent.
              </p>
            ) : null}
          </div>
        ) : null}
        {armMut.isError ? (
          <p className="mt-2 text-sm text-red-400">{armMut.error instanceof Error ? armMut.error.message : 'Update failed'}</p>
        ) : null}
      </ForexPanelShell>

      <ForexPanelShell
        title="MOCK LP routing & health"
        actions={
          <Button type="button" size="sm" variant="ghost" onClick={() => void execQ.refetch()} disabled={execQ.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${execQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        <div className="space-y-2">
          {data?.providers.map((row) => (
            <div
              key={row.providerId}
              className="flex flex-col gap-2 rounded-lg border border-admin-border/80 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.providerCode}</span>
                  <Badge variant={row.rule?.enabled ? 'success' : 'default'} className="font-normal">
                    {row.rule?.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  {row.health ? (
                    <Badge variant={row.health.status === 'HEALTHY' ? 'success' : 'warning'} className="font-normal text-[10px]">
                      {row.health.status}
                    </Badge>
                  ) : (
                    <Badge variant="default" className="font-normal text-[10px]">
                      No health
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-admin-muted">
                  Priority {row.rule?.priority ?? '—'} · quotes {row.health?.quoteCount ?? 0} · reject{' '}
                  {row.health ? `${(row.health.rejectRate * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
              <ProtectedAction permission="forex:control" fallback="disabled">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending || !row.rule}
                  onClick={() =>
                    setRoutingPending({
                      providerId: row.providerId,
                      code: row.providerCode,
                      enabled: !row.rule?.enabled,
                    })
                  }
                >
                  {row.rule?.enabled ? 'Disable' : 'Enable'}
                </Button>
              </ProtectedAction>
            </div>
          ))}
        </div>
        {routingMut.isError ? (
          <p className="mt-2 text-sm text-red-400">
            {routingMut.error instanceof Error ? routingMut.error.message : 'Routing update failed'}
          </p>
        ) : null}
      </ForexPanelShell>

      <ForexPanelShell title="Fill reconciliation (24h)">
        {data?.fillRecon ? (
          <>
            <p className="mb-2 text-xs text-admin-muted">{data.fillRecon.note}</p>
            <p className="text-sm">
              Executions: <strong>{data.fillRecon.totals.executions}</strong> · filled {data.fillRecon.totals.filled} · failed{' '}
              {data.fillRecon.totals.failed} · partial {data.fillRecon.totals.partial}
            </p>
            {data.fillRecon.byProvider.length ? (
              <ul className="mt-2 space-y-1 text-xs text-admin-muted">
                {data.fillRecon.byProvider.map((r) => (
                  <li key={r.provider}>
                    {r.provider}: {r.count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-admin-muted">No executions in window.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-admin-muted">—</p>
        )}
      </ForexPanelShell>

      <SafeActionModal
        open={armOpen}
        onClose={() => setArmOpen(false)}
        title="Record REAL_FOREX arm intent"
        description="This records administrative intent only — effective live money path stays OFF until certified release."
        impactWarning="Do not use unless compliance and engineering have signed off on REAL_FOREX readiness."
        severity="critical"
        confirmWord="ARM"
        confirmLabel="Record intent"
        requiredPermission="forex:control"
        onConfirm={async () => {
          await armMut.mutateAsync({ requested: true, reason: 'REAL_FOREX arm intent via admin safe action' });
        }}
      />

      <ForexConfirmModal
        open={disarmOpen}
        onClose={() => setDisarmOpen(false)}
        title="Disarm REAL_FOREX intent"
        description="Clears the recorded arm intent flag."
        loading={armMut.isPending}
        onConfirm={async (reason) => {
          await armMut.mutateAsync({ requested: false, reason });
        }}
      />

      <ForexConfirmModal
        open={!!routingPending}
        onClose={() => setRoutingPending(null)}
        title={routingPending ? `${routingPending.enabled ? 'Enable' : 'Disable'} ${routingPending.code}` : 'Routing'}
        loading={routingMut.isPending}
        onConfirm={async (reason) => {
          if (!routingPending) return;
          await routingMut.mutateAsync({
            providerId: routingPending.providerId,
            enabled: routingPending.enabled,
            reason,
          });
        }}
      />
    </div>
  );
}
