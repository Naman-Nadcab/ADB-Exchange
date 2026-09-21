'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, Plus, Loader2, Info, X, Building2 } from 'lucide-react';
import { WalletOperationsShell } from '@/components/wallet/WalletOperationsShell';
import { WalletWithdrawNav } from '@/components/wallet/WalletWithdrawNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toaster';
import { walletPath } from '@/lib/routes';
import { fetchMyPaymentMethods, P2P_PAYMENT_METHODS_QUERY_KEY, type P2PPaymentMethodRow } from '@/lib/p2pApi';
import {
  fetchFiatBalance,
  fetchFiatWithdrawals,
  createFiatWithdrawal,
  cancelFiatWithdrawal,
  FIAT_BALANCE_QUERY_KEY,
  FIAT_WITHDRAWALS_QUERY_KEY,
  type FiatWithdrawal,
} from '@/lib/fiatApi';
import { walletTransactionStatusLabel } from '@/lib/i18n/wallet-transaction-status';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-500',
  approved: 'bg-blue-500/15 text-blue-500',
  processing: 'bg-blue-500/15 text-blue-500',
  completed: 'bg-emerald-500/15 text-emerald-500',
  rejected: 'bg-red-500/15 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'bg-red-500/15 text-red-500',
};

function inr(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0.00';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function bankLabel(m: P2PPaymentMethodRow): string {
  const name = m.display_name?.trim() || m.method_name;
  return name;
}

export default function WithdrawFiatPage() {
  const tw = useTranslations('wallet');
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [fundPassword, setFundPassword] = useState('');

  const balanceQuery = useQuery({ queryKey: FIAT_BALANCE_QUERY_KEY, queryFn: fetchFiatBalance });
  const banksQuery = useQuery({ queryKey: P2P_PAYMENT_METHODS_QUERY_KEY, queryFn: () => fetchMyPaymentMethods() });
  const historyQuery = useQuery({ queryKey: FIAT_WITHDRAWALS_QUERY_KEY, queryFn: fetchFiatWithdrawals });

  const banks = banksQuery.data ?? [];
  const available = balanceQuery.data?.available_balance ?? '0';
  const selectedBank = useMemo(() => banks.find((b) => b.id === bankAccountId), [banks, bankAccountId]);

  const createMutation = useMutation({
    mutationFn: () =>
      createFiatWithdrawal({
        amount: amount.trim(),
        bankAccountId,
        twoFactorCode: twoFactorCode.trim() || undefined,
        fund_password: fundPassword || undefined,
      }),
    onSuccess: () => {
      toast({
        title: tw('withdrawFiat.toastRequestedTitle'),
        description: tw('withdrawFiat.toastRequestedDesc'),
        variant: 'success',
      });
      setAmount('');
      setTwoFactorCode('');
      setFundPassword('');
      queryClient.invalidateQueries({ queryKey: FIAT_BALANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: FIAT_WITHDRAWALS_QUERY_KEY });
    },
    onError: (e: unknown) =>
      toast({
        title: tw('withdrawFiat.toastFailedTitle'),
        description: e instanceof Error ? e.message : tw('withdrawFiat.toastFailedDesc'),
        variant: 'destructive',
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFiatWithdrawal(id),
    onSuccess: () => {
      toast({
        title: tw('withdrawFiat.toastCancelledTitle'),
        description: tw('withdrawFiat.toastCancelledDesc'),
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: FIAT_BALANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: FIAT_WITHDRAWALS_QUERY_KEY });
    },
    onError: (e: unknown) =>
      toast({
        title: tw('withdrawFiat.toastCancelFailedTitle'),
        description: e instanceof Error ? e.message : tw('withdrawFiat.toastCancelFailedDesc'),
        variant: 'destructive',
      }),
  });

  const amountNum = Number(amount);
  const availNum = Number(available);
  const amountInvalid = !amount || !Number.isFinite(amountNum) || amountNum <= 0;
  const overBalance = Number.isFinite(amountNum) && amountNum > availNum;
  const canSubmit = !amountInvalid && !overBalance && !!bankAccountId && !createMutation.isPending;

  return (
    <WalletOperationsShell title={tw('withdrawFiat.title')} description={tw('withdrawFiat.description')}>
      <div className="mx-auto max-w-4xl space-y-4">
        <WalletWithdrawNav />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{tw('withdrawFiat.heading')}</h3>
                <p className="text-xs text-muted-foreground">
                  {tw('withdrawFiat.available', {
                    amount: balanceQuery.isLoading ? '—' : inr(available),
                  })}
                </p>
              </div>
            </div>

            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{tw('withdrawFiat.amountLabel')}</label>
            <div className="relative mb-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-7 pr-20 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => setAmount(available)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                {tw('withdrawFiat.max')}
              </button>
            </div>
            {overBalance && <p className="mb-2 text-xs text-red-500">{tw('withdrawFiat.overBalance')}</p>}

            <label className="mb-1.5 mt-4 block text-xs font-medium text-muted-foreground">{tw('withdrawFiat.destinationLabel')}</label>
            {banksQuery.isLoading ? (
              <Skeleton className="h-11 w-full rounded-xl" />
            ) : banks.length === 0 ? (
              <Link
                href={walletPath.paymentMethods}
                className="flex items-center justify-between rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> {tw('withdrawFiat.noBankSaved')}
                </span>
                <span className="flex items-center gap-1 text-primary">
                  <Plus className="h-4 w-4" /> {tw('withdrawFiat.addAccount')}
                </span>
              </Link>
            ) : (
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
              >
                <option value="">{tw('withdrawFiat.selectAccount')}</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {bankLabel(b)} · {b.method_name}
                  </option>
                ))}
              </select>
            )}
            {banks.length > 0 && (
              <Link href={walletPath.paymentMethods} className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" /> {tw('withdrawFiat.manageBankAccounts')}
              </Link>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{tw('withdrawFiat.twoFaLabel')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{tw('withdrawFiat.fundPasswordLabel')}</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={fundPassword}
                  onChange={(e) => setFundPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
                />
              </div>
            </div>

            {selectedBank && (
              <div className="mt-4 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                {tw('withdrawFiat.sendingTo', {
                  name: bankLabel(selectedBank),
                  method: selectedBank.method_name,
                })}
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => createMutation.mutate()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tw('withdrawFiat.requestButton')}
            </button>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{tw('withdrawFiat.infoBanner')}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-foreground">{tw('withdrawFiat.recentTitle')}</h3>
            {historyQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (historyQuery.data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{tw('withdrawFiat.noWithdrawals')}</p>
            ) : (
              <ul className="space-y-2.5">
                {historyQuery.data!.map((w: FiatWithdrawal) => (
                  <li key={w.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{inr(w.amount)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[w.status] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {walletTransactionStatusLabel(w.status, tw)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {w.bank_snapshot?.display_name || w.bank_snapshot?.method_name || tw('withdrawFiat.bankAccountFallback')} ·{' '}
                      {new Date(w.created_at ?? w.requested_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {w.failure_reason && (
                      <p className="mt-1 text-xs text-red-500">{tw('withdrawFiat.failureReason', { reason: w.failure_reason })}</p>
                    )}
                    {w.status === 'pending' && (
                      <button
                        type="button"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(w.id)}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-500 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> {tw('withdrawFiat.cancel')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </WalletOperationsShell>
  );
}
