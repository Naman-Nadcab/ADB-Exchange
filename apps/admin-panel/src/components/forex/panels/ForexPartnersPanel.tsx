'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { getForexAdminPartners, type ForexPartnerProfileRow } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

export function ForexPartnersPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [accrualVol, setAccrualVol] = useState('1.0');
  const [accrualAmt, setAccrualAmt] = useState('10.00');
  const [payoutAmt, setPayoutAmt] = useState('10.00');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [rate, setRate] = useState('0');
  const [signalName, setSignalName] = useState('');

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'partners', token],
    queryFn: async () => {
      const res = await getForexAdminPartners(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const payoutsQ = useQuery({
    queryKey: ['admin', 'forex', 'partner-payouts', token],
    queryFn: async () => {
      const res = await adminFetch<{
        rows: Array<{ payout_id: string; partner_id: string; amount: string; status: string; external_rail_status: string }>;
        external_rail: string;
      }>('/forex/partners/payout-requests', { token });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const accrueM = useMutation({
    mutationFn: async (partnerId: string) => {
      const res = await adminFetch(`/forex/partners/${partnerId}/accruals`, {
        token,
        method: 'POST',
        body: {
          volume_lots: accrualVol,
          commission_amount: accrualAmt,
          reason: `Operator accrual ${Date.now()}`,
        },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Accrual failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'partners'] }),
  });

  const payoutM = useMutation({
    mutationFn: async (partnerId: string) => {
      const res = await adminFetch(`/forex/partners/${partnerId}/payout-requests`, {
        token,
        method: 'POST',
        body: { amount: payoutAmt, reason: `Operator payout request ${Date.now()}` },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Payout failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'partner-payouts'] }),
  });

  const createM = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/forex/partners', {
        token,
        method: 'POST',
        body: { code, label, user_id: ownerId.trim() || null, commission_per_lot: rate },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Create failed');
    },
    onSuccess: () => {
      setCode('');
      setLabel('');
      setOwnerId('');
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'partners'] });
    },
  });

  const volumeM = useMutation({
    mutationFn: async (partnerId: string) => {
      const res = await adminFetch(`/forex/partners/${partnerId}/accrue-volume`, { token, method: 'POST', body: {} });
      if (!res.success) throw new Error(res.error?.message ?? 'Volume accrual failed');
      return res.data as { reason?: string; volumeLots?: string; commissionAmount?: string };
    },
  });

  const signalsQ = useQuery({
    queryKey: ['admin', 'forex', 'signals', token],
    queryFn: async () => {
      const res = await adminFetch<{ rows: Array<{ providerId: string; name: string; status: string }> }>('/forex/signals/providers', { token });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.rows;
    },
    enabled: !!token,
  });

  const signalM = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/forex/signals/providers', { token, method: 'POST', body: { name: signalName } });
      if (!res.success) throw new Error(res.error?.message ?? 'Create failed');
    },
    onSuccess: () => {
      setSignalName('');
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'signals'] });
    },
  });

  const columns = useMemo<ColumnDef<ForexPartnerProfileRow>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
      { accessorKey: 'display_name', header: 'Name' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'success' : 'default'} className="text-[10px] capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'select',
        header: '',
        cell: ({ row }) => (
          <Button size="sm" variant={selectedPartner === row.original.partner_id ? 'secondary' : 'ghost'} onClick={() => setSelectedPartner(row.original.partner_id)}>
            Operate
          </Button>
        ),
      },
    ],
    [selectedPartner],
  );

  const data = qry.data;
  const payoutRows = payoutsQ.data?.rows ?? [];
  const externalRail = payoutsQ.data?.external_rail ?? 'NOT_CONFIGURED';

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Partners / IB"
        description="Internal commission accrual and payout requests. The external rail follows FOREX_PARTNER_PAYOUT_URL."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {data ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Badge variant={data.table_present ? 'success' : 'warning'}>Schema: {data.table_present ? 'present' : 'pending'}</Badge>
            <Badge variant={externalRail === 'CONFIGURED' ? 'success' : 'default'}>External payout: {externalRail}</Badge>
          </div>
        ) : null}
        <div className="mb-3 grid gap-2 md:grid-cols-5">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" />
          <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="Customer user id" />
          <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="USD per lot" />
          <Button size="sm" disabled={createM.isPending || code.trim().length < 2 || label.trim().length < 2} onClick={() => createM.mutate()}>
            Create partner
          </Button>
        </div>
        {createM.isError ? <p className="mb-2 text-xs text-red-400">{createM.error.message}</p> : null}
        <DataTable columns={columns} data={data?.rows ?? []} loading={qry.isLoading} emptyMessage="No partner profiles." />
      </ForexPanelShell>

      {selectedPartner ? (
        <ForexPanelShell title="Partner operations" description="Accrual records commission; payout starts maker-checker (internal ledger).">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-admin-border/60 p-3">
              <p className="mb-2 text-sm font-medium">Commission accrual</p>
              <div className="flex flex-wrap gap-2">
                <Input className="w-24" value={accrualVol} onChange={(e) => setAccrualVol(e.target.value)} placeholder="Lots" />
                <Input className="w-28" value={accrualAmt} onChange={(e) => setAccrualAmt(e.target.value)} placeholder="Amount" />
                <Button size="sm" disabled={accrueM.isPending} onClick={() => accrueM.mutate(selectedPartner)}>
                  Accrue
                </Button>
                <Button size="sm" variant="ghost" disabled={volumeM.isPending} onClick={() => volumeM.mutate(selectedPartner)}>
                  From traded volume
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-admin-border/60 p-3">
              <p className="mb-2 text-sm font-medium">Payout request</p>
              <div className="flex flex-wrap gap-2">
                <Input className="w-28" value={payoutAmt} onChange={(e) => setPayoutAmt(e.target.value)} placeholder="Amount" />
                <Button size="sm" disabled={payoutM.isPending} onClick={() => payoutM.mutate(selectedPartner)}>
                  Request payout
                </Button>
              </div>
            </div>
          </div>
        </ForexPanelShell>
      ) : null}

      <ForexPanelShell title="Signal providers" description="A published name can be subscribed. Copying stays off and no order is placed.">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="w-64" value={signalName} onChange={(e) => setSignalName(e.target.value)} placeholder="Provider name" />
          <Button size="sm" disabled={signalM.isPending || signalName.trim().length < 2} onClick={() => signalM.mutate()}>
            Publish paused
          </Button>
        </div>
        <ul className="admin-stack-sm text-sm">
          {(signalsQ.data ?? []).map((provider) => (
            <li key={provider.providerId} className="rounded border border-admin-border/60 px-3 py-2 text-xs">
              {provider.name} · {provider.status} · copying off
            </li>
          ))}
        </ul>
        {volumeM.data ? <p className="mt-2 text-xs text-muted-foreground">{volumeM.data.reason} · lots {volumeM.data.volumeLots} · {volumeM.data.commissionAmount}</p> : null}
      </ForexPanelShell>

      <ForexPanelShell title="Payout requests" description="Internal lifecycle status">
        <ul className="admin-stack-sm text-sm">
          {payoutRows.slice(0, 20).map((p) => (
            <li key={p.payout_id} className="rounded border border-admin-border/60 px-3 py-2 font-mono text-xs">
              {p.payout_id.slice(0, 8)}… · {p.amount} · {p.status} · rail {p.external_rail_status}
            </li>
          ))}
        </ul>
      </ForexPanelShell>
    </div>
  );
}
