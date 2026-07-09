'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { cn } from '@/lib/cn';
import {
  getFiatWithdrawals,
  approveFiatWithdrawal,
  completeFiatWithdrawal,
  rejectFiatWithdrawal,
  creditFiatBalance,
  type FiatWithdrawalRow,
} from '@/lib/fiat-withdrawals-api';
import { Banknote, CheckCircle2, XCircle, Send, Plus, RefreshCw, X } from 'lucide-react';

const STATUSES = ['all', 'pending', 'approved', 'processing', 'completed', 'rejected', 'cancelled', 'failed'] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelled: 'bg-admin-border/30 text-admin-muted border-admin-border/40',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function inr(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0.00';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bankSummary(row: FiatWithdrawalRow): string {
  const s = row.bank_snapshot ?? {};
  const name = (s.display_name as string) || (s.method_name as string) || 'Bank account';
  const d = (s.details as Record<string, unknown>) ?? {};
  const acct = (d.account_number as string) || (d.upi_id as string) || '';
  const masked = acct ? ` ····${String(acct).slice(-4)}` : '';
  return `${name}${masked}`;
}

export default function FiatWithdrawalsPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useAdminToast();
  const [status, setStatus] = useState<string>('pending');
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditUserId, setCreditUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'fiat-withdrawals', status],
    queryFn: () => getFiatWithdrawals(token, { status, limit: 100 }),
    enabled: !!token,
  });

  const rows = query.data?.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'fiat-withdrawals'] });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveFiatWithdrawal(token, id),
    onSuccess: () => { invalidate(); toast.success('Fiat withdrawal approved.'); },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to approve fiat withdrawal.')),
  });
  const completeMut = useMutation({
    mutationFn: (id: string) => {
      const ref = window.prompt('Bank/UTR reference number (optional):') ?? undefined;
      return completeFiatWithdrawal(token, id, ref || undefined);
    },
    onSuccess: () => { invalidate(); toast.success('Fiat withdrawal marked complete.'); },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to complete fiat withdrawal.')),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => {
      const reason = window.prompt('Rejection reason:');
      if (!reason || !reason.trim()) throw new Error('Reason required');
      return rejectFiatWithdrawal(token, id, reason.trim());
    },
    onSuccess: () => { invalidate(); toast.success('Fiat withdrawal rejected.'); },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to reject fiat withdrawal.')),
  });
  const creditMut = useMutation({
    mutationFn: () => creditFiatBalance(token, { userId: creditUserId.trim(), amount: creditAmount.trim(), notes: creditNotes.trim() || undefined }),
    onSuccess: () => {
      setCreditOpen(false);
      setCreditUserId('');
      setCreditAmount('');
      setCreditNotes('');
      invalidate();
      toast.success('Fiat balance credited.');
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to credit fiat balance.')),
  });

  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const busy = approveMut.isPending || completeMut.isPending || rejectMut.isPending;

  return (
    <AdminPageFrame
      title="Fiat (INR) Withdrawals"
      description="Review and settle INR withdrawal requests. Payouts are settled manually (admin-settled mode)."
      status={pendingCount > 20 ? 'warning' : 'active'}
      error={query.isError ? ((query.error as { message?: string })?.message ?? 'Failed to load fiat withdrawals') : null}
      onRetry={() => void query.refetch()}
      quickActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border/60 bg-admin-card px-3 py-1.5 text-xs font-semibold text-admin-fg transition hover:border-primary/40"
          >
            <Plus className="h-3.5 w-3.5" /> Credit INR
          </button>
          <button
            onClick={() => void query.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border/60 bg-admin-card px-3 py-1.5 text-xs font-semibold text-admin-fg transition hover:border-primary/40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')} /> Refresh
          </button>
        </div>
      }
    >
      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition',
              status === s
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-admin-border/50 text-admin-muted hover:text-admin-fg'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-admin-border/50 bg-admin-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-admin-border/50 text-left text-xs text-admin-muted">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Requested</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-admin-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-admin-muted">No withdrawals in this status.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-admin-border/30 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-admin-fg">{r.username || '—'}</div>
                    <div className="text-xs text-admin-muted">{r.email || r.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-admin-fg">{inr(r.amount)}</div>
                    {Number(r.fee) > 0 && <div className="text-xs text-admin-muted">net {inr(r.net_amount)}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-admin-fg">{bankSummary(r)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium capitalize', STATUS_BADGE[r.status] ?? 'bg-admin-border/30 text-admin-muted border-admin-border/40')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-admin-muted">
                    {new Date(r.created_at ?? r.requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === 'pending' && (
                        <button onClick={() => approveMut.mutate(r.id)} disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20 disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {['approved', 'processing'].includes(r.status) && (
                        <button onClick={() => completeMut.mutate(r.id)} disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50">
                          <Send className="h-3.5 w-3.5" /> Mark paid
                        </button>
                      )}
                      {['pending', 'approved', 'processing'].includes(r.status) && (
                        <button onClick={() => rejectMut.mutate(r.id)} disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50">
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                      {!['pending', 'approved', 'processing'].includes(r.status) && (
                        <span className="text-xs text-admin-muted">{r.provider_reference || r.failure_reason || '—'}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Credit INR modal */}
      {creditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreditOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-admin-border/60 bg-admin-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-admin-fg">Credit INR balance</h3>
              </div>
              <button onClick={() => setCreditOpen(false)} className="text-admin-muted hover:text-admin-fg"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-1 block text-xs font-medium text-admin-muted">User ID (UUID)</label>
            <input value={creditUserId} onChange={(e) => setCreditUserId(e.target.value)} placeholder="user uuid"
              className="mb-3 w-full rounded-lg border border-admin-border/60 bg-admin-bg px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary/50" />
            <label className="mb-1 block text-xs font-medium text-admin-muted">Amount (INR)</label>
            <input type="number" min="0" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="0.00"
              className="mb-3 w-full rounded-lg border border-admin-border/60 bg-admin-bg px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary/50" />
            <label className="mb-1 block text-xs font-medium text-admin-muted">Notes (optional)</label>
            <input value={creditNotes} onChange={(e) => setCreditNotes(e.target.value)} placeholder="e.g. P2P settlement / manual deposit"
              className="mb-4 w-full rounded-lg border border-admin-border/60 bg-admin-bg px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary/50" />
            {creditMut.isError && <p className="mb-3 text-xs text-red-400">{(creditMut.error as { message?: string })?.message ?? 'Credit failed'}</p>}
            <button
              onClick={() => creditMut.mutate()}
              disabled={creditMut.isPending || !creditUserId.trim() || !creditAmount.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {creditMut.isPending ? 'Crediting…' : 'Credit balance'}
            </button>
          </div>
        </div>
      )}
    </AdminPageFrame>
  );
}
