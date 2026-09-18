'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminAccountGroups,
  getForexAdminCrmClientActivity,
  getForexAdminCrmClientDetail,
  getForexAdminClient360,
  postForexAdminAccountGroupAssign,
  postForexAdminAccountLeverageOverride,
  postForexAdminCrmNote,
  type ForexAdminCrmActivityItem,
} from '@/lib/admin/forex-api';
import {
  extractForexApprovalPending,
  ForexApprovalPendingNotice,
  type ForexApprovalPendingInfo,
} from '@/components/forex/primitives/ForexApprovalPendingNotice';
import { Input } from '@/components/ui/Input';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { RiskBadge } from '@/components/users/RiskBadge';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';

function kycLabel(status: string | null, level: number | null) {
  if (!status) return 'No KYC application';
  return `${status}${level != null ? ` (level ${level})` : ''}`;
}

function activityKindLabel(kind: ForexAdminCrmActivityItem['kind']) {
  if (kind === 'order') return 'Order';
  if (kind === 'execution') return 'Execution';
  return 'Journal';
}

export function ForexCrmClientDetailPanel({ accountId }: { accountId: string }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [noteDraft, setNoteDraft] = useState('');
  const [approvalNotice, setApprovalNotice] = useState<ForexApprovalPendingInfo | null>(null);
  const [pendingGroupId, setPendingGroupId] = useState('');
  const [groupReason, setGroupReason] = useState('');
  const [pendingLeverage, setPendingLeverage] = useState('');
  const [leverageReason, setLeverageReason] = useState('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trading' | 'crm' | 'communication' | 'finance' | 'compliance' | 'ib' | 'audit'
  >('overview');

  const groupsQ = useQuery({
    queryKey: ['admin', 'forex', 'account-groups', token],
    queryFn: async () => {
      const res = await getForexAdminAccountGroups(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Groups failed');
      return res.data.groups.filter((g) => g.is_active);
    },
    enabled: !!token,
    staleTime: 60_000,
  });
  const q = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'client', accountId, token],
    queryFn: async () => {
      const res = await getForexAdminCrmClientDetail(token, accountId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Not found');
      return res.data;
    },
    enabled: !!token && !!accountId,
    staleTime: 15_000,
  });

  const client360Q = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'client', accountId, '360', token],
    queryFn: async () => {
      const res = await getForexAdminClient360(token, accountId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? '360 failed');
      return res.data;
    },
    enabled: !!token && !!accountId,
    staleTime: 15_000,
  });

  const groupAssignMut = useMutation({
    mutationFn: async () => {
      const res = await postForexAdminAccountGroupAssign(token, accountId, {
        group_id: pendingGroupId.trim(),
        reason: groupReason.trim(),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Submit failed');
      return res;
    },
    onSuccess: (res) => {
      const pending = extractForexApprovalPending(res.data, res.meta?.httpStatus);
      setApprovalNotice(pending);
      if (!pending) {
        void client360Q.refetch();
        setPendingGroupId('');
        setGroupReason('');
      }
    },
  });

  const leverageMut = useMutation({
    mutationFn: async () => {
      const res = await postForexAdminAccountLeverageOverride(token, accountId, {
        leverage: pendingLeverage.trim(),
        reason: leverageReason.trim(),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Submit failed');
      return res;
    },
    onSuccess: (res) => {
      const pending = extractForexApprovalPending(res.data, res.meta?.httpStatus);
      setApprovalNotice(pending);
      if (!pending) {
        void client360Q.refetch();
        setPendingLeverage('');
        setLeverageReason('');
      }
    },
  });

  const noteMut = useMutation({
    mutationFn: async () => {
      const res = await postForexAdminCrmNote(token, accountId, { body: noteDraft.trim(), visibility: 'internal' });
      if (!res.success) throw new Error(res.error?.message ?? 'Note failed');
      return res.data;
    },
    onSuccess: () => {
      setNoteDraft('');
      void client360Q.refetch();
    },
  });

  const activityQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'client', accountId, 'activity', token],
    queryFn: async () => {
      const res = await getForexAdminCrmClientActivity(token, accountId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Activity failed');
      return res.data;
    },
    enabled: !!token && !!accountId,
    staleTime: 15_000,
  });

  const d = q.data;
  const activity = activityQ.data;
  const access = d?.section_access ?? client360Q.data?.section_access;
  const canFinance = access?.finance ?? false;
  const canCompliance = access?.compliance ?? false;
  const canTrading = access?.trading ?? false;

  const effectiveGroup = client360Q.data?.trading && !('restricted' in client360Q.data.trading && client360Q.data.trading.restricted)
    ? client360Q.data.trading.group_code
    : null;
  const effectiveLeverage =
    client360Q.data?.trading && !('restricted' in client360Q.data.trading && client360Q.data.trading.restricted)
      ? client360Q.data.trading.leverage_override
      : null;

  return (
    <div className="admin-stack-lg">
      <ForexApprovalPendingNotice info={approvalNotice} onDismiss={() => setApprovalNotice(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/forex/crm/clients"
          className="inline-flex h-8 items-center rounded-md px-2 text-sm text-admin-muted hover:bg-admin-surface hover:text-admin-fg"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          All clients
        </Link>
        <Button type="button" size="sm" variant="ghost" onClick={() => void q.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {q.isLoading ? (
        <ForexPanelShell title="Client">
          <p className="text-sm text-admin-muted">Loading…</p>
        </ForexPanelShell>
      ) : q.isError ? (
        <ForexPanelShell title="Client">
          <p className="text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>
        </ForexPanelShell>
      ) : d ? (
        <>
          <div className="mb-3 rounded-lg border border-admin-border/70 bg-admin-surface/40 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-admin-fg">{d.email ?? d.phone ?? d.account_id}</h1>
                <p className="font-mono text-xs text-admin-muted">{d.account_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={d.account_status.toUpperCase() === 'ACTIVE' ? 'success' : 'warning'}>{d.account_status}</Badge>
                {canCompliance ? (
                  <Badge variant="default">{kycLabel(d.kyc_status, d.kyc_level)}</Badge>
                ) : null}
                {client360Q.data?.tags.length ? (
                  <Badge variant="info">{client360Q.data.tags.map((t) => t.label).join(', ')}</Badge>
                ) : null}
              </div>
            </div>
            <ForexDetailGrid
              className="mt-3"
              columns={4}
              items={[
                {
                  label: 'Lifecycle',
                  value:
                    typeof client360Q.data?.profile?.lifecycle_stage === 'string'
                      ? client360Q.data.profile.lifecycle_stage
                      : (d.account_status ?? '—'),
                },
                {
                  label: 'Risk',
                  value: d.risk_level ?? '—',
                },
                {
                  label: 'Account manager',
                  value:
                    typeof client360Q.data?.profile?.owner_admin_id === 'string'
                      ? String(client360Q.data.profile.owner_admin_id).slice(0, 8)
                      : '—',
                  mono: true,
                },
                {
                  label: 'IB / Partner',
                  value: client360Q.data?.partner_summary?.partner_label ?? 'None',
                },
                {
                  label: 'Related accounts',
                  value: String(client360Q.data?.related_accounts?.length ?? 1),
                },
                { label: 'Open orders', value: String(d.open_orders) },
                { label: 'Open positions', value: String(d.open_positions) },
                ...(canFinance ? [{ label: 'Cash balance', value: `${d.customer_cash_balance} ${d.currency}` }] : []),
                {
                  label: 'Last activity',
                  value: activity?.items[0]?.occurred_at
                    ? new Date(activity.items[0].occurred_at).toLocaleString()
                    : '—',
                },
              ]}
            />
          </div>
          <Tabs
            className="mb-4"
            active={activeTab}
            onChange={setActiveTab}
            items={[
              { id: 'overview', label: 'Overview' },
              { id: 'trading', label: 'Trading' },
              { id: 'crm', label: 'CRM' },
              { id: 'communication', label: 'Communication' },
              { id: 'finance', label: 'Finance' },
              { id: 'compliance', label: 'Compliance' },
              { id: 'ib', label: 'IB / Partner' },
              { id: 'audit', label: 'Audit' },
            ]}
          />
          {(activeTab === 'overview' || activeTab === 'finance' || activeTab === 'compliance' || activeTab === 'trading') && (
          <ForexPanelShell
            title={d.email ?? d.account_id}
            description={`Client ${d.account_id} · platform user ${d.user_id}`}
            actions={
              <Link
                href={`/users/${d.user_id}`}
                className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
              >
                Platform user
                <ExternalLink className="h-3 w-3" />
              </Link>
            }
          >
            <ForexDetailGrid
              items={[
                { label: 'User', value: d.email ?? d.phone ?? d.user_id, mono: !d.email && !d.phone },
                {
                  label: 'User status',
                  value: d.user_status ?? '—',
                  highlight: d.user_status === 'active' ? 'success' : 'default',
                },
                {
                  label: 'Account status',
                  value: d.account_status,
                  highlight: d.account_status.toUpperCase() === 'ACTIVE' ? 'success' : 'warning',
                },
                ...(canFinance
                  ? [
                      { label: 'Cash balance', value: `${d.customer_cash_balance} ${d.currency}` },
                      {
                        label: 'Finance desk',
                        value: (
                          <Link
                            href={`/forex/crm/finance/${encodeURIComponent(d.account_id)}`}
                            className="text-admin-accent hover:underline"
                          >
                            Ledger & reconciliation
                          </Link>
                        ),
                      },
                    ]
                  : [{ label: 'Finance', value: 'Restricted — forex:finance:view required' }]),
                { label: 'Open orders', value: String(d.open_orders) },
                { label: 'Open positions', value: String(d.open_positions) },
                { label: 'Created', value: new Date(d.account_created_at).toLocaleString() },
                {
                  label: 'Email verified',
                  value: d.email_verified == null ? '—' : d.email_verified ? 'Yes' : 'No',
                },
                ...(canCompliance ? [{ label: 'KYC', value: kycLabel(d.kyc_status, d.kyc_level) }] : []),
              ]}
            />
            {canCompliance ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-admin-muted">Platform risk (read-only)</p>
                <RiskBadge level={d.risk_level} flags={d.risk_flags} />
                <Link href={`/users/${d.user_id}`} className="mt-3 block text-xs text-admin-accent hover:underline">
                  Full user profile · KYC queue · restrictions
                </Link>
              </div>
            ) : activeTab === 'compliance' ? (
              <p className="mt-4 text-xs text-admin-muted">Compliance fields require forex:compliance:view.</p>
            ) : null}
          </ForexPanelShell>
          )}

          {activeTab === 'communication' && client360Q.data ? (
            <ForexPanelShell title="Communication" description="Operator notifications linked to this account">
              {client360Q.data.recent_notifications.length === 0 ? (
                <p className="text-sm text-admin-muted">No recent notifications.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {client360Q.data.recent_notifications.map((n) => (
                    <li key={n.notification_id} className="rounded border border-admin-border/50 px-2 py-1.5">
                      <Badge variant="default" className="mr-2 text-[10px]">
                        {n.severity}
                      </Badge>
                      {n.title}
                      <span className="ml-2 text-[10px] text-admin-muted">{new Date(n.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ForexPanelShell>
          ) : null}

          {activeTab === 'ib' && client360Q.data?.partner_summary?.partner_code ? (
            <ForexPanelShell title="IB / Partner">
              <p className="text-sm">
                {client360Q.data.partner_summary.partner_label} ({client360Q.data.partner_summary.partner_code})
              </p>
              <Link href="/forex/partners" className="mt-2 inline-block text-xs text-admin-accent hover:underline">
                Partner desk
              </Link>
            </ForexPanelShell>
          ) : activeTab === 'ib' ? (
            <ForexPanelShell title="IB / Partner">
              <p className="text-sm text-admin-muted">No IB attribution on this account.</p>
            </ForexPanelShell>
          ) : null}

          {(activeTab === 'trading' || activeTab === 'audit' || activeTab === 'overview') && (
          <ForexPanelShell
            title={activeTab === 'audit' ? 'Audit & activity timeline' : 'Activity timeline'}
            description="Recent orders, executions, and journal events (merged, newest first)"
            actions={
              activity?.shortcuts ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link href={activity.shortcuts.orders_path} className="text-admin-accent hover:underline">
                    All orders
                  </Link>
                  <Link href={activity.shortcuts.executions_path} className="text-admin-accent hover:underline">
                    Executions
                  </Link>
                  <Link href={activity.shortcuts.positions_path} className="text-admin-accent hover:underline">
                    Positions
                  </Link>
                  <Link href={activity.shortcuts.journal_path} className="text-admin-accent hover:underline">
                    Journal
                  </Link>
                </div>
              ) : null
            }
          >
            {activityQ.isLoading ? (
              <p className="text-sm text-admin-muted">Loading activity…</p>
            ) : activityQ.isError ? (
              <p className="text-sm text-red-400">
                {activityQ.error instanceof Error ? activityQ.error.message : 'Activity load failed'}
              </p>
            ) : !activity?.items.length ? (
              <p className="text-sm text-admin-muted">No recent activity for this account.</p>
            ) : (
              <ul className="space-y-2">
                {activity.items.map((item) => (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="rounded-md border border-admin-border/60 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info" className="text-[10px] font-normal">
                        {activityKindLabel(item.kind)}
                      </Badge>
                      <Badge variant="default" className="text-[10px] font-normal">
                        {item.status}
                      </Badge>
                      <span className="font-medium">{item.title}</span>
                      <span className="text-[10px] text-admin-muted">
                        {new Date(item.occurred_at).toLocaleString()}
                      </span>
                    </div>
                    {(item.volume || item.detail) && (
                      <p className="mt-1 text-xs text-admin-muted">
                        {item.volume ? `Vol ${item.volume}` : null}
                        {item.volume && item.detail ? ' · ' : null}
                        {item.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ForexPanelShell>
          )}

          {(activeTab === 'crm' || activeTab === 'overview' || activeTab === 'trading') && (
          <ForexPanelShell
            title={activeTab === 'trading' ? 'Trading accounts & metadata' : 'Client 360 — CRM layer'}
            description={
              activeTab === 'trading'
                ? 'Effective group, leverage, and trading summary'
                : 'Operational notes, tags, and trading metadata'
            }
          >
            {client360Q.isLoading ? (
              <p className="text-sm text-admin-muted">Loading CRM layer…</p>
            ) : client360Q.data ? (
              <div className="space-y-4">
                {canTrading && !('restricted' in client360Q.data.trading && client360Q.data.trading.restricted) ? (
                  <>
                    <ForexDetailGrid
                      columns={3}
                      items={[
                        { label: 'Position mode (effective)', value: client360Q.data.trading.position_mode ?? '—' },
                        { label: 'Account group (effective)', value: effectiveGroup ?? '—' },
                        {
                          label: 'Leverage override (effective)',
                          value: effectiveLeverage ?? '—',
                        },
                        { label: 'Tags', value: client360Q.data.tags.map((t) => t.label).join(', ') || '—' },
                        ...(client360Q.data.trading_summary
                          ? [
                              { label: 'Open orders (360)', value: String(client360Q.data.trading_summary.open_orders) },
                              { label: 'Open positions (360)', value: String(client360Q.data.trading_summary.open_positions) },
                              { label: 'Executions (30d)', value: String(client360Q.data.trading_summary.executions_30d) },
                            ]
                          : []),
                      ]}
                    />
                    {client360Q.data.finance_summary ? (
                      <ForexDetailGrid
                        columns={3}
                        items={[
                          { label: 'Cash (ledger)', value: client360Q.data.finance_summary.customer_cash_balance },
                          { label: 'Pending finance reqs', value: String(client360Q.data.finance_summary.pending_finance_requests) },
                          { label: 'Ledger tx count', value: String(client360Q.data.finance_summary.ledger_transactions) },
                        ]}
                      />
                    ) : null}
                    {client360Q.data.compliance_summary ? (
                      <ForexDetailGrid
                        columns={2}
                        items={[
                          { label: 'Open compliance cases', value: String(client360Q.data.compliance_summary.open_cases) },
                          { label: 'External screening', value: client360Q.data.compliance_summary.provider_status },
                        ]}
                      />
                    ) : null}
                    {client360Q.data.partner_summary?.partner_code ? (
                      <p className="text-xs text-admin-muted">
                        IB: {client360Q.data.partner_summary.partner_label} ({client360Q.data.partner_summary.partner_code})
                      </p>
                    ) : null}
                    {client360Q.data.related_accounts.length > 0 ? (
                      <p className="text-xs text-admin-muted">
                        Related accounts (same user):{' '}
                        {client360Q.data.related_accounts.map((a) => a.account_id).join(', ')}
                      </p>
                    ) : null}
                    <ProtectedAction permission="forex:accounts:manage" fallback="hidden">
                      <div className="mt-4 space-y-4 rounded-md border border-admin-border/60 bg-admin-surface/30 p-3">
                        <p className="text-xs text-admin-muted">
                          Sensitive changes require maker-checker approval. Values below are <strong>requested</strong> until
                          approvers execute — effective fields above refresh after approval.
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="mb-1 block text-[10px] uppercase text-admin-muted">Request group</label>
                            <select
                              className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs"
                              value={pendingGroupId}
                              onChange={(e) => setPendingGroupId(e.target.value)}
                            >
                              <option value="">Select group…</option>
                              {(groupsQ.data ?? []).map((g) => (
                                <option key={g.group_id} value={g.group_id}>
                                  {g.code} ({g.leverage_default}:1)
                                </option>
                              ))}
                            </select>
                          </div>
                          <Input
                            placeholder="Reason (min 8 chars)"
                            value={groupReason}
                            onChange={(e) => setGroupReason(e.target.value)}
                            className="min-w-[220px] text-xs"
                          />
                          <Button
                            size="sm"
                            disabled={
                              groupAssignMut.isPending || !pendingGroupId || groupReason.trim().length < 8
                            }
                            onClick={() => void groupAssignMut.mutate()}
                          >
                            Submit group change
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="mb-1 block text-[10px] uppercase text-admin-muted">Request leverage</label>
                            <Input
                              placeholder="e.g. 50"
                              value={pendingLeverage}
                              onChange={(e) => setPendingLeverage(e.target.value)}
                              className="w-[100px] text-xs"
                            />
                          </div>
                          <Input
                            placeholder="Reason (min 8 chars)"
                            value={leverageReason}
                            onChange={(e) => setLeverageReason(e.target.value)}
                            className="min-w-[220px] text-xs"
                          />
                          <Button
                            size="sm"
                            disabled={
                              leverageMut.isPending || !pendingLeverage.trim() || leverageReason.trim().length < 8
                            }
                            onClick={() => void leverageMut.mutate()}
                          >
                            Submit leverage override
                          </Button>
                        </div>
                        {(groupAssignMut.isError || leverageMut.isError) && (
                          <p className="text-xs text-red-400">
                            {groupAssignMut.error instanceof Error
                              ? groupAssignMut.error.message
                              : leverageMut.error instanceof Error
                                ? leverageMut.error.message
                                : 'Request failed'}
                          </p>
                        )}
                      </div>
                    </ProtectedAction>
                  </>
                ) : (
                  <p className="text-xs text-admin-muted">Trading metadata requires forex:orders:view or forex:positions:view.</p>
                )}
                {activeTab !== 'trading' ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-admin-muted">Internal notes</p>
                    <ul className="mb-3 max-h-48 space-y-2 overflow-auto">
                      {client360Q.data.notes.length === 0 ? (
                        <li className="text-sm text-admin-muted">No notes yet.</li>
                      ) : (
                        client360Q.data.notes.map((n) => (
                          <li key={n.note_id} className="rounded border border-admin-border/50 px-2 py-1.5 text-sm">
                            {n.body}
                            <span className="ml-2 text-[10px] text-admin-muted">{new Date(n.created_at).toLocaleString()}</span>
                          </li>
                        ))
                      )}
                    </ul>
                    <ProtectedAction permission="forex:crm:manage" fallback="disabled">
                      <div className="flex gap-2">
                        <textarea
                          className="min-h-[72px] flex-1 rounded-md border border-admin-border bg-admin-surface px-2 py-1 text-sm"
                          placeholder="Add internal note…"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={noteDraft.trim().length < 2 || noteMut.isPending}
                          onClick={() => noteMut.mutate()}
                        >
                          Save
                        </Button>
                      </div>
                    </ProtectedAction>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-admin-muted">CRM tables may be unavailable until migrations run.</p>
            )}
          </ForexPanelShell>
          )}
        </>
      ) : null}
    </div>
  );
}
