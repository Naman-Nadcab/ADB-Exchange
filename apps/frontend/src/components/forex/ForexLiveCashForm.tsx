'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexStore } from '@/lib/forex/state/store';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';

export function ForexLiveCashForm(props: { direction: 'deposit' | 'withdraw' }) {
  const t = useTranslations('forex.liveCash');
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const liveAccounts = accounts.filter((a) => a.accountKind.toUpperCase() === 'LIVE');
  const [accountId, setAccountId] = useState(
    liveAccounts.some((a) => a.accountId === activeId) ? (activeId ?? liveAccounts[0]?.accountId ?? '') : (liveAccounts[0]?.accountId ?? ''),
  );
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (liveAccounts.length === 0) {
    return (
      <ForexPortalModuleCard title={t(props.direction === 'deposit' ? 'depositTitle' : 'withdrawTitle')} subtitle={t('needLive')}>
        <p className="text-sm text-muted-foreground">{t('needLiveBody')}</p>
        <Link href={FOREX_ROUTES.openLiveAccount} className="mt-3 inline-flex text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
          {t('openLive')}
        </Link>
      </ForexPortalModuleCard>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    const idempotencyKey = `${props.direction}:${accountId}:${Date.now()}`;
    const body = { accountId, amount: amount.trim(), idempotencyKey };
    const res =
      props.direction === 'deposit'
        ? unwrap(await forexApi.postLiveDeposit(body))
        : unwrap(await forexApi.postLiveWithdrawal(body));
    setBusy(false);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    const ref = res.data.brokerRef;
    setOk(props.direction === 'deposit' ? t('successDeposit', { ref }) : t('successWithdraw', { ref }));
    setAmount('');
    await syncForexAccountsFromServer();
  }

  return (
    <ForexPortalModuleCard
      title={t(props.direction === 'deposit' ? 'depositTitle' : 'withdrawTitle')}
      subtitle={t(props.direction === 'deposit' ? 'depositSubtitle' : 'withdrawSubtitle')}
    >
      <p className="mb-3 text-[11px] text-muted-foreground">{t('notice')}</p>
      <form className="max-w-md space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <label className="block text-[11px]">
          <span className="text-muted-foreground">{t('account')}</span>
          <select
            className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-[12px]"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {liveAccounts.map((a) => (
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
          disabled={busy || !amount.trim() || !accountId}
          className="inline-flex min-h-10 items-center rounded border border-primary/40 bg-primary/10 px-4 text-[12px] font-semibold text-primary disabled:opacity-50"
        >
          {busy ? t('submitting') : t(props.direction === 'deposit' ? 'submitDeposit' : 'submitWithdraw')}
        </button>
      </form>
    </ForexPortalModuleCard>
  );
}
