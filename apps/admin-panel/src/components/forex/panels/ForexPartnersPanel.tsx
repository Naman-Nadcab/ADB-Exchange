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
      const res = await adminFetch<{ rows: Array<{ payout_id: string; partner_id: string; amount: string; status: string; external_rail_status: string }> }>(
        '/forex/partners/payout-requests',
        { token },
      );
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.rows;
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

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Partners / IB"
        description="Internal commission accrual and payout requests · external rail NOT_CONFIGURED"
        actions={
          <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {data ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Badge variant={data.table_present ? 'success' : 'warning'}>Schema: {data.table_present ? 'present' : 'pending'}</Badge>
            <Badge variant="default">External payout: NOT_CONFIGURED</Badge>
          </div>
        ) : null}
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

      <ForexPanelShell title="Payout requests" description="Internal lifecycle status">
        <ul className="admin-stack-sm text-sm">
          {(payoutsQ.data ?? []).slice(0, 20).map((p) => (
            <li key={p.payout_id} className="rounded border border-admin-border/60 px-3 py-2 font-mono text-xs">
              {p.payout_id.slice(0, 8)}… · {p.amount} · {p.status} · rail {p.external_rail_status}
            </li>
          ))}
        </ul>
      </ForexPanelShell>
    </div>
  );
}
