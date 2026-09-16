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
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

function ChecklistRow(props: { label: string; pass: boolean; detail: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-admin-border/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>{props.label}</span>
        <Badge variant={props.pass ? 'success' : 'danger'} className="font-normal text-[10px]">
          {props.pass ? 'PASS' : 'FAIL'}
        </Badge>
      </div>
      <p className="text-xs text-admin-muted">{props.detail}</p>
    </div>
  );
}

export function ForexExecutionPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

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
    mutationFn: async (args: { providerId: string; enabled: boolean }) => {
      const res = await patchForexAdminRouting(token, args.providerId, {
        reason,
        enabled: args.enabled,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
      return res.data;
    },
    onSuccess: invalidate,
  });

  const armMut = useMutation({
    mutationFn: async (requested: boolean) => {
      const res = await patchForexRealForexArm(token, { requested, reason });
      if (!res.success) throw new Error(res.error?.message ?? 'Arm failed');
      return res.data;
    },
    onSuccess: invalidate,
  });

  const data: ForexAdminExecutionSnapshot | undefined = execQ.data;
  const gate = data?.realForexGate;
  const pending = routingMut.isPending || armMut.isPending;
  const reasonOk = reason.trim().length >= 8;

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            REAL_FOREX gate (F5)
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {execQ.isLoading ? (
            <p className="text-admin-muted">Loading execution posture…</p>
          ) : gate ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Effective REAL_FOREX OFF</Badge>
                <Badge variant={gate.armRequested ? 'warning' : 'default'}>
                  Arm requested: {gate.armRequested ? 'YES' : 'NO'}
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="text-xs text-admin-muted">Audit reason (min 8 chars)</label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Change reason…" className="mt-1" />
                </div>
                <ProtectedAction permission="control:trading" fallback="disabled">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={!reasonOk || pending || !gate.checklistComplete}
                    onClick={() => armMut.mutate(!gate.armRequested)}
                  >
                    {gate.armRequested ? 'Disarm REAL_FOREX intent' : 'Record REAL_FOREX arm intent'}
                  </Button>
                </ProtectedAction>
              </div>
              {!gate.checklistComplete ? (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Complete all checklist items before recording arm intent.
                </p>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <span className="text-sm font-medium">MOCK LP routing & health</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void execQ.refetch()} disabled={execQ.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${execQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
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
              <ProtectedAction permission="control:trading" fallback="disabled">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!reasonOk || pending || !row.rule}
                  onClick={() => routingMut.mutate({ providerId: row.providerId, enabled: !row.rule?.enabled })}
                >
                  {row.rule?.enabled ? 'Disable' : 'Enable'}
                </Button>
              </ProtectedAction>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <span className="text-sm font-medium">Fill reconciliation (24h summary)</span>
        </CardHeader>
        <CardContent className="text-sm">
          {data?.fillRecon ? (
            <>
              <p className="text-xs text-admin-muted mb-2">{data.fillRecon.note}</p>
              <p>
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
            <p className="text-admin-muted">—</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
