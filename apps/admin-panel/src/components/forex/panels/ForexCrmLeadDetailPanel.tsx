'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  convertForexAdminCrmLead,
  getForexAdminCrmLeadDetail,
  getForexAdminCrmLeadStages,
  patchForexAdminCrmLeadStage,
  assignForexAdminCrmLead,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ArrowLeft } from 'lucide-react';

function str(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function ForexCrmLeadDetailPanel({ leadId }: { leadId: string }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [stageReason, setStageReason] = useState('');
  const [nextStage, setNextStage] = useState('');
  const [convertReason, setConvertReason] = useState('');
  const [assignOwner, setAssignOwner] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'lead', leadId, token],
    queryFn: async () => {
      const res = await getForexAdminCrmLeadDetail(token, leadId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && !!leadId,
  });

  const stagesQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'lead-stages', token],
    queryFn: async () => {
      const res = await getForexAdminCrmLeadStages(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.stages;
    },
    enabled: !!token,
  });

  const stageMutation = useMutation({
    mutationFn: async () => {
      if (!nextStage || stageReason.trim().length < 8) throw new Error('Stage and reason (8+ chars) required');
      const res = await patchForexAdminCrmLeadStage(token, leadId, { stage_id: nextStage, reason: stageReason.trim() });
      if (!res.success) throw new Error(res.error?.message ?? 'Stage update failed');
    },
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'lead', leadId] });
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'Failed'),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignOwner.trim() || assignReason.trim().length < 8) throw new Error('Owner UUID and reason (8+ chars) required');
      const res = await assignForexAdminCrmLead(token, leadId, {
        owner_admin_id: assignOwner.trim(),
        reason: assignReason.trim(),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Assign failed');
    },
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'lead', leadId] });
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'Failed'),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (convertReason.trim().length < 8) throw new Error('Conversion reason min 8 chars');
      const res = await convertForexAdminCrmLead(token, leadId, { reason: convertReason.trim() });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Conversion failed');
      return res.data;
    },
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'lead', leadId] });
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'Failed'),
  });

  const d = detailQ.data;
  const activities = useMemo(() => (Array.isArray(d?.activities) ? d.activities : []) as Array<Record<string, unknown>>, [d]);
  const tasks = useMemo(() => (Array.isArray(d?.tasks) ? d.tasks : []) as Array<Record<string, unknown>>, [d]);
  const convertedAccountId = d?.converted_account_id != null ? str(d.converted_account_id) : null;

  if (detailQ.isLoading) {
    return <p className="text-sm text-admin-muted">Loading lead…</p>;
  }
  if (detailQ.isError || !d) {
    return <p className="text-sm text-red-400">{detailQ.error instanceof Error ? detailQ.error.message : 'Not found'}</p>;
  }

  return (
    <ForexPanelShell
      title={str(d.full_name) !== '—' ? str(d.full_name) : 'Lead detail'}
      description={`Lead ${leadId}`}
      actions={
        <Link href="/forex/crm/leads" className="inline-flex items-center text-xs text-admin-accent hover:underline">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to leads
        </Link>
      }
    >
      {actionError ? <p className="mb-3 text-sm text-red-400">{actionError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-admin-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-admin-muted">Email:</span> {str(d.email)}
            </div>
            <div>
              <span className="text-admin-muted">Phone:</span> {str(d.phone)}
            </div>
            <div>
              <span className="text-admin-muted">Campaign:</span> {str(d.campaign_code)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-admin-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info" className="capitalize">
                {str(d.stage_id)}
              </Badge>
              <Badge variant={str(d.status) === 'converted' ? 'success' : 'default'} className="capitalize">
                {str(d.status)}
              </Badge>
              <Badge variant="default" className="capitalize">
                {str(d.priority)}
              </Badge>
            </div>
            <div>
              <span className="text-admin-muted">Owner:</span>{' '}
              <span className="font-mono text-xs">{str(d.owner_admin_id)}</span>
            </div>
            <div>
              <span className="text-admin-muted">Follow-up:</span> {str(d.follow_up_at)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-admin-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {convertedAccountId && convertedAccountId !== '—' ? (
              <Link href={`/forex/crm/clients/${encodeURIComponent(convertedAccountId)}`} className="text-admin-accent hover:underline">
                Forex client {convertedAccountId}
              </Link>
            ) : (
              <ProtectedAction permission="forex:crm:manage" fallback="hidden">
                <div className="flex max-w-md flex-col gap-2">
                  <Input placeholder="Conversion reason (min 8 chars)" value={convertReason} onChange={(e) => setConvertReason(e.target.value)} />
                  <Button size="sm" disabled={convertMutation.isPending} onClick={() => void convertMutation.mutate()}>
                    Convert to Forex account
                  </Button>
                </div>
              </ProtectedAction>
            )}
          </CardContent>
        </Card>

        <ProtectedAction permission="forex:crm:manage" fallback="hidden">
          <Card className="border-admin-border/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assign / reassign</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <Input className="max-w-xs font-mono text-xs" placeholder="Owner admin UUID" value={assignOwner} onChange={(e) => setAssignOwner(e.target.value)} />
              <Input className="max-w-xs" placeholder="Reason (min 8 chars)" value={assignReason} onChange={(e) => setAssignReason(e.target.value)} />
              <Button size="sm" disabled={assignMutation.isPending} onClick={() => void assignMutation.mutate()}>
                Assign
              </Button>
            </CardContent>
          </Card>
          <Card className="border-admin-border/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stage change</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <select
                className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs"
                value={nextStage}
                onChange={(e) => setNextStage(e.target.value)}
              >
                <option value="">Select stage</option>
                {(stagesQ.data ?? []).map((s) => (
                  <option key={s.stage_id} value={s.stage_id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Input
                className="max-w-xs"
                placeholder="Reason (min 8 chars)"
                value={stageReason}
                onChange={(e) => setStageReason(e.target.value)}
              />
              <Button size="sm" disabled={stageMutation.isPending} onClick={() => void stageMutation.mutate()}>
                Update stage
              </Button>
            </CardContent>
          </Card>
        </ProtectedAction>

        <Card className="border-admin-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-xs text-admin-muted">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li key={str(a.activity_id)} className="border-b border-admin-border/40 pb-2 text-xs last:border-0">
                    <div className="font-medium capitalize">{str(a.kind)}</div>
                    <div className="text-admin-muted">{str(a.summary)}</div>
                    <div className="text-[10px] text-admin-muted">{str(a.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-admin-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-xs text-admin-muted">No tasks linked.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {tasks.map((t) => (
                  <li key={str(t.task_id)} className="flex justify-between gap-2 border-b border-admin-border/40 pb-2">
                    <span>{str(t.title)}</span>
                    <Badge variant="default">{str(t.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ForexPanelShell>
  );
}
