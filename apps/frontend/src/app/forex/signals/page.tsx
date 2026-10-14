'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexAccountOptionLabel } from '@/components/forex/forex-enum-label';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

type Provider = { providerId: string; name: string; status: 'paused' | 'active' };
type Account = { accountId: string; currency: string; accountKind: string };

export default function ForexSignalsPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.signalsPage');
  const te = useTranslations('forex.enums');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [providerId, setProviderId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [depositPct, setDepositPct] = useState('');
  const [equityStop, setEquityStop] = useState('');
  const [slippage, setSlippage] = useState('');
  const [copySlTp, setCopySlTp] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const board = unwrap(await forexApi.getSignalBoard());
      if (!board.ok) return;
      setProviders(board.data.providers);
      if (board.data.providers[0]) setProviderId(board.data.providers[0].providerId);
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      const listed = unwrap(await forexApi.listAccounts());
      if (listed.ok) {
        const rows = listed.data.accounts.map((row) => ({
          accountId: row.accountId,
          currency: row.currency,
          accountKind: row.accountKind,
        }));
        setAccounts(rows);
        if (rows[0]) setAccountId(rows[0].accountId);
      }
      const mine = unwrap(await forexApi.getMySignalSubscription());
      if (!mine.ok || !mine.data.subscription) return;
      const sub = mine.data.subscription;
      setProviderId(sub.providerId);
      setAccountId(sub.accountId);
      setDepositPct(sub.depositPct);
      setEquityStop(sub.equityStop ?? '');
      setSlippage(sub.slippagePoints ?? '');
      setCopySlTp(sub.copySlTp);
      setSaved(sub.status === 'WAITING');
    })();
  }, [authed]);

  const ready = providers != null && providers.length > 0;
  const deposit = Number(depositPct);
  const canSave = authed && ready && Boolean(providerId) && Boolean(accountId) && Number.isFinite(deposit) && deposit > 0 && deposit <= 100 && !busy;

  async function onSave() {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    const res = unwrap(await forexApi.saveSignalSubscription({
      providerId,
      accountId,
      depositPct,
      equityStop: equityStop.trim() || null,
      slippagePoints: slippage.trim() || null,
      copySlTp,
    }));
    setBusy(false);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <ForexPageFrame title={tf('pages.signals.title')} subtitle={tf('pages.signals.subtitle')}>
      <ForexPortalModuleCard title={t('flowTitle')} accent>
        <ol className="list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-muted-foreground">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
        </ol>
        <Link href={FOREX_ROUTES.trade} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
          {t('goTrade')}
        </Link>
      </ForexPortalModuleCard>

      {!authed && ready ? <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.signals}`} sectionKey="signals" /> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <ForexPortalModuleCard title={t('listTitle')} subtitle={t('listSubtitle')}>
          <ForexPortalStatusBadge tone={ready ? 'primary' : 'warning'}>{ready ? t('listed') : t('noneYet')}</ForexPortalStatusBadge>
          {!ready ? <p className="mt-3 text-sm text-muted-foreground">{t('listEmpty')}</p> : (
            <ul className="mt-3 space-y-2">
              {providers?.map((provider) => (
                <li key={provider.providerId}>
                  <button
                    type="button"
                    onClick={() => setProviderId(provider.providerId)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-[13px] ${providerId === provider.providerId ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}
                  >
                    <span>{provider.name}</span>
                    <span className="text-[11px] uppercase">{provider.status === 'active' ? t('providerActive') : t('providerPaused')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('settingsTitle')}>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{ready ? t('settingsReady') : t('settingsLead')}</p>
          <form className="mt-3 max-w-md space-y-3" onSubmit={(e) => { e.preventDefault(); void onSave(); }}>
            {ready ? (
              <label className="block text-[11px]">
                <span className="text-muted-foreground">{t('account')}</span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-[12px] disabled:opacity-60"
                  value={accountId}
                  disabled={!authed || accounts.length === 0}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.length === 0 ? <option value="">{t('noAccount')}</option> : null}
                  {accounts.map((account) => (
                    <option key={account.accountId} value={account.accountId}>
                      {forexAccountOptionLabel(te, account)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('depositPct')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled={!ready || !authed}
                value={depositPct}
                onChange={(e) => setDepositPct(e.target.value)}
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('equityStop')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled={!ready || !authed}
                value={equityStop}
                onChange={(e) => setEquityStop(e.target.value)}
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('slippage')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled={!ready || !authed}
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <input type="checkbox" checked={copySlTp} disabled={!ready || !authed} onChange={(e) => setCopySlTp(e.target.checked)} />
              {t('copySlTp')}
            </label>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t('subscribe')}
            </button>
          </form>
          {saved ? <p className="mt-3 text-[12px] text-foreground">{t('saved')}</p> : null}
          {accounts.length === 0 && ready && authed ? (
            <Link href={FOREX_ROUTES.openDemoAccount} className="mt-2 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
              {t('openDemo')}
            </Link>
          ) : null}
          {err ? <p className="mt-2 text-sm text-sell">{err}</p> : null}
        </ForexPortalModuleCard>
      </div>
    </ForexPageFrame>
  );
}
