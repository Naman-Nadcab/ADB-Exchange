'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminCrmLeads,
  getForexAdminCrmLeadsSummary,
  getForexAdminCrmLeadStages,
  getForexAdminCrmPipeline,
  patchForexAdminCrmLeadStage,
  type ForexAdminCrmLeadRow,
  type ForexCrmPipelineSnapshot,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexCrmLeadDrawer } from '@/components/forex/panels/ForexCrmLeadDrawer';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { cn } from '@/lib/cn';
import { ForexIdentityBlock } from '@/components/forex/primitives/forex-visual-kit';

type StageRow = ForexCrmPipelineSnapshot['stages'][number];
type PendingStageMove = { lead: ForexAdminCrmLeadRow; stageId: string; stageLabel: string };

function leadAgeDays(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function stageCount(byStage: Array<{ stage_id: string; count: number }>, id: string) {
  return byStage.find((s) => s.stage_id === id)?.count ?? 0;
}

function LeadCard(props: {
  lead: ForexAdminCrmLeadRow;
  stages: Array<{ stage_id: string; label: string }>;
  onOpen: () => void;
  onStageSelect: (stageId: string, label: string) => void;
}) {
  const { lead, stages, onOpen, onStageSelect } = props;
  const age = leadAgeDays(lead.created_at);
  const displayName = lead.full_name ?? lead.email ?? lead.phone ?? 'Lead';
  return (
    <div className="rounded-lg border border-admin-border/70 bg-admin-bg/50 p-2 shadow-sm transition-colors hover:border-violet-500/30">
      <ForexIdentityBlock
        name={displayName}
        subtitle={lead.email ?? lead.phone ?? lead.lead_id.slice(0, 8)}
        avatarSeed={lead.lead_id}
        onClick={onOpen}
        chips={[
          { label: lead.priority, variant: 'info' },
          { label: `${age}d`, variant: age > 14 ? 'warning' : 'default' },
          ...(lead.campaign_code ? [{ label: lead.campaign_code, variant: 'default' as const }] : []),
        ]}
      />
      <p className="mt-1 px-1 text-[10px] text-admin-muted">
        Owner {lead.owner_admin_id ? lead.owner_admin_id.slice(0, 8) : '—'} · Last{' '}
        {lead.last_activity_at ? new Date(lead.last_activity_at).toLocaleDateString() : '—'} · Next{' '}
        {lead.next_task_at ? new Date(lead.next_task_at).toLocaleDateString() : '—'}
      </p>
      <select
        className="mt-2 w-full rounded border border-admin-border bg-admin-surface px-1 py-0.5 text-[10px]"
        value={lead.stage_id}
        onChange={(e) => {
          const stageId = e.target.value;
          if (stageId === lead.stage_id) return;
          const label = stages.find((s) => s.stage_id === stageId)?.label ?? stageId;
          onStageSelect(stageId, label);
        }}
      >
        {stages.map((s) => (
          <option key={s.stage_id} value={s.stage_id}>
            → {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ForexCrmPipelinePanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingStageMove | null>(null);
  const [ownerId, setOwnerId] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const filterParams = useMemo(
    () => ({
      status: 'open' as const,
      owner_admin_id: ownerId.trim() || undefined,
      campaign_code: source.trim() || undefined,
      priority: priority || undefined,
      created_from: createdFrom ? `${createdFrom}T00:00:00.000Z` : undefined,
      created_to: createdTo ? `${createdTo}T23:59:59.999Z` : undefined,
    }),
    [ownerId, source, priority, createdFrom, createdTo],
  );

  const pipelineQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'pipeline', token],
    queryFn: async () => {
      const res = await getForexAdminCrmPipeline(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const summaryQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'leads', 'summary', 'pipeline', token, filterParams],
    queryFn: async () => {
      const res = await getForexAdminCrmLeadsSummary(token, filterParams);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Summary failed');
      return res.data;
    },
    enabled: !!token,
  });

  const stagesQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'lead-stages', token],
    queryFn: async () => {
      const res = await getForexAdminCrmLeadStages(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Stages failed');
      return res.data.stages;
    },
    enabled: !!token,
  });

  const leadsQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'leads', 'pipeline-board', token, filterParams],
    queryFn: async () => {
      const res = await getForexAdminCrmLeads(token, { limit: 100, page: 1, ...filterParams });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Leads failed');
      return res.data.rows;
    },
    enabled: !!token,
  });

  const stageMut = useMutation({
    mutationFn: async (args: { leadId: string; stageId: string; reason: string }) => {
      const res = await patchForexAdminCrmLeadStage(token, args.leadId, {
        stage_id: args.stageId,
        reason: args.reason,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Stage update failed');
    },
    onSuccess: () => {
      setPendingMove(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm'] });
    },
  });

  const snap = pipelineQ.data;
  const stages = snap?.stages ?? [];
  const leadsByStage = useMemo(() => {
    const map = new Map<string, ForexAdminCrmLeadRow[]>();
    for (const s of stages) map.set(s.stage_id, []);
    for (const lead of leadsQ.data ?? []) {
      const list = map.get(lead.stage_id) ?? [];
      list.push(lead);
      map.set(lead.stage_id, list);
    }
    return map;
  }, [leadsQ.data, stages]);

  const summary = summaryQ.data;
  const byStage = summary?.by_stage ?? [];
  const conversionPct =
    summary && summary.total > 0 ? Math.round((summary.converted / summary.total) * 100) : 0;

  return (
    <div className="admin-stack-lg">
      <ForexConfirmModal
        open={!!pendingMove}
        onClose={() => setPendingMove(null)}
        title={pendingMove ? `Move lead → ${pendingMove.stageLabel}` : 'Pipeline stage'}
        description={
          pendingMove
            ? `${pendingMove.lead.full_name ?? pendingMove.lead.email ?? pendingMove.lead.lead_id} · audited stage change`
            : undefined
        }
        confirmLabel="Update stage"
        loading={stageMut.isPending}
        onConfirm={async (reason) => {
          if (!pendingMove) return;
          await stageMut.mutateAsync({
            leadId: pendingMove.lead.lead_id,
            stageId: pendingMove.stageId,
            reason,
          });
        }}
      />

      <ForexPanelShell
        title="CRM — Pipeline"
        description="Kanban funnel from live CRM stages — drag-free stage changes are audited via confirmation."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void pipelineQ.refetch();
              void leadsQ.refetch();
              void summaryQ.refetch();
            }}
            disabled={pipelineQ.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pipelineQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {pipelineQ.isError ? (
          <p className="text-sm text-red-400">{pipelineQ.error instanceof Error ? pipelineQ.error.message : 'Load failed'}</p>
        ) : (
          <>
            <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <ForexMetricTile label="Total leads" value={summaryQ.isLoading ? '…' : (summary?.total ?? snap?.totals.leads ?? 0)} />
              <ForexMetricTile label="Open" value={summary?.open ?? snap?.totals.open ?? 0} />
              <ForexMetricTile label="New" value={stageCount(byStage, 'new')} />
              <ForexMetricTile label="Qualified" value={stageCount(byStage, 'qualified')} />
              <ForexMetricTile label="KYC" value={summary?.kyc_started ?? stageCount(byStage, 'kyc_started')} />
              <ForexMetricTile label="Converted" value={summary?.converted ?? snap?.totals.converted ?? 0} tone="success" />
            </section>
            <p className="mb-3 text-xs text-admin-muted">
              Conversion (filtered scope): {conversionPct}% · DB source: {snap?.source ?? 'forex_crm_leads'}
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <Input placeholder="Owner UUID" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="max-w-[140px] font-mono text-xs" />
              <Input placeholder="Source / campaign" value={source} onChange={(e) => setSource(e.target.value)} className="max-w-[140px] text-xs" />
              <select
                className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">All priorities</option>
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
              <Input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="max-w-[130px] text-xs" />
              <Input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="max-w-[130px] text-xs" />
            </div>
          </>
        )}
      </ForexPanelShell>

      <ForexPanelShell title="Stage board" description="Open leads by stage (max 100 per filter scope)">
        {leadsQ.isLoading ? (
          <p className="text-sm text-admin-muted">Loading board…</p>
        ) : leadsQ.isError ? (
          <p className="text-sm text-red-400">{leadsQ.error instanceof Error ? leadsQ.error.message : 'Leads failed'}</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((col: StageRow) => (
              <div key={col.stage_id} data-stage={col.stage_id} className="forex-kanban-column flex w-[240px] shrink-0 flex-col rounded-lg border border-admin-border/60 bg-admin-surface/30">
                <div className="border-b border-admin-border/50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-admin-muted">{col.label}</p>
                  <p className="text-lg font-bold tabular-nums">{col.open_count}</p>
                  <p className="text-[10px] text-admin-muted">
                    {col.lead_count} total · {col.converted_count} converted
                  </p>
                </div>
                <div className={cn('flex max-h-[520px] flex-col gap-2 overflow-y-auto p-2')}>
                  {(leadsByStage.get(col.stage_id) ?? []).map((lead) => (
                    <LeadCard
                      key={lead.lead_id}
                      lead={lead}
                      stages={stagesQ.data ?? []}
                      onOpen={() => setDrawerLeadId(lead.lead_id)}
                      onStageSelect={(stageId, label) =>
                        setPendingMove({ lead, stageId, stageLabel: label })
                      }
                    />
                  ))}
                  {(leadsByStage.get(col.stage_id) ?? []).length === 0 ? (
                    <p className="py-4 text-center text-[10px] text-admin-muted">No open leads</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {stageMut.isError ? (
          <p className="mt-2 text-xs text-red-400">{stageMut.error instanceof Error ? stageMut.error.message : 'Update failed'}</p>
        ) : null}
      </ForexPanelShell>

      <ForexCrmLeadDrawer leadId={drawerLeadId} onClose={() => setDrawerLeadId(null)} />
    </div>
  );
}
