'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { forexAccountOptionLabel } from './forex-enum-label';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexStore } from '@/lib/forex/state/store';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';

function positiveAmount(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function ForexInternalTransferForm(props?: { locked?: boolean }) {
  const t = useTranslations('forex.internalTransfer');
  const te = useTranslations('forex.enums');
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const demoAccounts = accounts.filter((a) => a.accountKind.toUpperCase() === 'DEMO');
  const locked = props?.locked === true;
  const ready = !locked && demoAccounts.length >= 2;
  const [fromAccountId, setFromAccountId] = useState(activeId ?? demoAccounts[0]?.accountId ?? '');
  const [toAccountId, setToAccountId] = useState(demoAccounts.find((a) => a.accountId !== fromAccountId)?.accountId ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const currency = demoAccounts.find((a) => a.accountId === fromAccountId)?.currency ?? demoAccounts[0]?.currency ?? 'USD';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    if (!positiveAmount(amount.trim())) {
      setErr(t('invalidAmount'));
      return;
    }
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

  return (
    <div className="space-y-3">
      {!locked && demoAccounts.length < 2 ? (
        <ForexPortalModuleCard title={t('title')} subtitle={t('needTwoDemo')}>
          <p className="text-sm text-muted-foreground">{t('needTwoDemoBody')}</p>
          <Link href={FOREX_ROUTES.openDemoAccount} className="mt-3 inline-flex text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
            {t('createDemo')}
          </Link>
        </ForexPortalModuleCard>
      ) : null}
      <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
        <p className="mb-3 text-[11px] text-muted-foreground">{t('simulatedNotice')}</p>
        <form className="max-w-md space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-[11px]">
            <span className="text-muted-foreground">{t('fromAccount')}</span>
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-[12px] disabled:opacity-60"
              value={ready ? fromAccountId : ''}
              onChange={(e) => setFromAccountId(e.target.value)}
              disabled={!ready}
            >
              {ready ? (
                demoAccounts.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {forexAccountOptionLabel(te, a)}
                  </option>
                ))
              ) : (
                <option value="">{t('previewAccount', { currency })}</option>
              )}
            </select>
          </label>
          <label className="block text-[11px]">
            <span className="text-muted-foreground">{t('toAccount')}</span>
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-[12px] disabled:opacity-60"
              value={ready ? toAccountId : ''}
              onChange={(e) => setToAccountId(e.target.value)}
              disabled={!ready}
            >
              {ready ? (
                demoAccounts.filter((a) => a.accountId !== fromAccountId).map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {forexAccountOptionLabel(te, a)}
                  </option>
                ))
              ) : (
                <option value="">{t('previewAccount', { currency })}</option>
              )}
            </select>
          </label>
          <label className="block text-[11px]">
            <span className="text-muted-foreground">{t('amountLabel', { currency })}</span>
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required={ready}
              disabled={!ready}
            />
          </label>
          {err ? <p className="text-sm text-sell">{err}</p> : null}
          {ok ? <p className="text-sm text-buy">{ok}</p> : null}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">{t('afterLead')}</p>
            <Link href={FOREX_ROUTES.ledger} className="inline-flex text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
              {t('viewLedger')}
            </Link>
          </div>
          <button
            type="submit"
            disabled={!ready || busy || !amount.trim() || fromAccountId === toAccountId}
            className="inline-flex min-h-10 items-center rounded border border-primary/40 bg-primary/10 px-4 text-[12px] font-semibold text-primary disabled:opacity-50"
          >
            {busy ? t('submitting') : t('submit')}
          </button>
        </form>
      </ForexPortalModuleCard>
    </div>
  );
}
