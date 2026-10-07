'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  applyForexBrokerReconciliation,
  postForexBrokerReconciliation,
  type ForexBrokerReconciliationReport,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

export function ForexBrokerReconciliationPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [accountId, setAccountId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState<ForexBrokerReconciliationReport | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);

  const buildM = useMutation({
    mutationFn: async () => {
      const res = await postForexBrokerReconciliation(token, accountId.trim());
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Reconciliation failed');
      return res.data;
    },
    onSuccess: (data) => {
      setReport(data);
      setConfirm(false);
      setApplyNote(null);
    },
  });

  const applyM = useMutation({
    mutationFn: async () => {
      if (!report) throw new Error('Build a report first');
      const res = await applyForexBrokerReconciliation(token, report.reportId, true);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Apply failed');
      return res.data;
    },
    onSuccess: (data) => {
      setReport((prev) => (prev ? { ...prev, status: 'APPLIED' } : prev));
      setApplyNote(
        data.applied
          ? `Ledger adjustment posted${data.transactionId ? ` (${data.transactionId})` : ''}.`
          : 'No cash was posted. The report is marked reviewed.',
      );
      setConfirm(false);
    },
  });

  const canApply =
    report != null &&
    report.status === 'OPEN' &&
    report.brokerBalance != null &&
    report.cashDelta != null &&
    confirm &&
    !applyM.isPending;

  return (
    <ForexPanelShell
      title="Broker snapshot reconciliation"
      description="Compares the broker cash snapshot to the forex ledger. Positions are reported only. Crypto wallets are not touched. Cash posts only after confirm."
    >
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!accountId.trim() || buildM.isPending) return;
          buildM.mutate();
        }}
      >
        <div className="w-full max-w-sm">
          <Input
            label="Forex account id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Live account id"
          />
        </div>
        <Button type="submit" size="sm" disabled={buildM.isPending || !accountId.trim()}>
          {buildM.isPending ? 'Comparing…' : 'Build report'}
        </Button>
      </form>
      {buildM.isError ? (
        <p className="mt-2 text-sm text-red-400">{buildM.error instanceof Error ? buildM.error.message : 'Build failed'}</p>
      ) : null}

      {report ? (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={report.status === 'APPLIED' ? 'success' : report.status === 'OPEN' ? 'warning' : 'default'}>
              {report.status}
            </Badge>
            <Badge variant="default">Persisted: {report.persisted ? 'yes' : 'memory only'}</Badge>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Row label="Account" value={report.accountId} mono />
            <Row label="Ledger balance" value={report.ledgerBalance} mono />
            <Row label="Broker balance" value={report.brokerBalance ?? 'Unavailable'} mono />
            <Row label="Cash delta (broker − ledger)" value={report.cashDelta ?? '—'} mono />
          </dl>
          {report.brokerBalance == null ? (
            <p className="text-xs text-amber-400">No broker balance. Cash will not be invented.</p>
          ) : null}
          <div>
            <p className="mb-1 text-xs uppercase text-admin-muted">Position drift (not adjusted)</p>
            {report.positionDrift.length === 0 ? (
              <p className="text-xs text-admin-muted">No position drift in this snapshot.</p>
            ) : (
              <ul className="space-y-1">
                {report.positionDrift.map((row) => (
                  <li key={`${row.symbol}-${row.side}`} className="font-mono text-xs">
                    {row.symbol} {row.side} local {row.localVolume} · broker {row.brokerVolume}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {report.status === 'OPEN' && report.brokerBalance != null ? (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              Confirm a forex-ledger adjustment for this cash delta. Positions stay untouched.
            </label>
          ) : null}
          {report.status === 'OPEN' && report.brokerBalance != null ? (
            <Button type="button" size="sm" variant="danger" disabled={!canApply} onClick={() => applyM.mutate()}>
              {applyM.isPending ? 'Posting…' : report.cashDelta === '0' ? 'Mark matched' : 'Post ledger adjustment'}
            </Button>
          ) : null}
          {applyM.isError ? (
            <p className="text-sm text-red-400">{applyM.error instanceof Error ? applyM.error.message : 'Apply failed'}</p>
          ) : null}
          {applyNote ? <p className="text-sm text-emerald-400">{applyNote}</p> : null}
        </div>
      ) : null}
    </ForexPanelShell>
  );
}

function Row(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-admin-border/60 px-3 py-2">
      <dt className="text-[10px] uppercase text-admin-muted">{props.label}</dt>
      <dd className={props.mono ? 'font-mono text-xs' : ''}>{props.value}</dd>
    </div>
  );
}
