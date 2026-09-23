'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexStore } from '@/lib/forex/state/store';
import { syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';

export function ForexInternalTransferForm() {
  const t = useTranslations('forex.internalTransfer');
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const [fromAccountId, setFromAccountId] = useState(activeId ?? accounts[0]?.accountId ?? '');
  const [toAccountId, setToAccountId] = useState(accounts.find((a) => a.accountId !== fromAccountId)?.accountId ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const demoAccounts = accounts.filter((a) => a.accountKind.toUpperCase() === 'DEMO');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    const idempotencyKey = `xfer:${fromAccountId}:${toAccountId}:${Date.now()}`;
    const res = unwrap(
      await forexApi.postInternalTransfer({
        fromAccountId,
        toAccountId,
        amount: amount.trim(),
        idempotencyKey,
      })
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    setOk(t('success'));
    setAmount('');
    await syncForexAccountsFromServer();
  }

  if (demoAccounts.length < 2) {
    return (
      <ForexPortalModuleCard title={t('title')} subtitle={t('needTwoDemo')}>
        <p className="text-sm text-muted-foreground">{t('needTwoDemoBody')}</p>
      </ForexPortalModuleCard>
    );
  }

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <p className="mb-3 text-[11px] text-muted-foreground">{t('simulatedNotice')}</p>
      <form className="space-y-3 max-w-md" onSubmit={(e) => void onSubmit(e)}>
        <label className="block text-[11px]">
          <span className="text-muted-foreground">{t('fromAccount')}</span>
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-[12px]"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
          >
            {demoAccounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.label} ({a.accountId})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px]">
          <span className="text-muted-foreground">{t('toAccount')}</span>
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-[12px]"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
          >
            {demoAccounts.filter((a) => a.accountId !== fromAccountId).map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.label} ({a.accountId})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px]">
          <span className="text-muted-foreground">{t('amount')}</span>
          <input
            className="mt-1 w-full rounded border border-border bg-background px-2 py-2 font-mono text-[12px]"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        {err ? <p className="text-sm text-sell">{err}</p> : null}
        {ok ? <p className="text-sm text-buy">{ok}</p> : null}
        <button
          type="submit"
          disabled={busy || !amount.trim() || fromAccountId === toAccountId}
          className="inline-flex min-h-10 items-center rounded border border-primary/40 bg-primary/10 px-4 text-[12px] font-semibold text-primary disabled:opacity-50"
        >
          {busy ? t('submitting') : t('submit')}
        </button>
      </form>
    </ForexPortalModuleCard>
  );
}
