'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bookmark, Radio, Layers } from 'lucide-react';
import { ForexAuthPending, ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalKpiCard, ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexAccountOptionLabel } from '@/components/forex/forex-enum-label';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

type Provider = { providerId: string; name: string; status: 'paused' | 'active' };
type Account = { accountId: string; currency: string; accountKind: string };

function SettingRow(props: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-2 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{props.label}</div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{props.hint}</p>
      </div>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

const fieldClass =
  'h-9 w-full rounded-md border border-border bg-background px-2.5 text-right font-mono text-[12px] text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

export default function ForexSignalsPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.signalsPage');
  const te = useTranslations('forex.enums');
  const session = useForexSession();
  const authed = session.authed;
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
      const firstOpen = board.data.providers.find((provider) => provider.status === 'active') ?? board.data.providers[0];
      if (firstOpen) setProviderId((current) => current || firstOpen.providerId);
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
        if (rows[0]) setAccountId((current) => current || rows[0].accountId);
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

  const ready = providers.length > 0;
  const selected = providers.find((provider) => provider.providerId === providerId);
  const deposit = Number(depositPct);
  const fieldsOn = ready && authed && selected?.status === 'active';
  const canSave = fieldsOn && Boolean(accountId) && Number.isFinite(deposit) && deposit > 0 && deposit <= 100 && !busy;
  const steps = [
    { n: '1', title: t('step1Title'), body: t('step1') },
    { n: '2', title: t('step2Title'), body: t('step2') },
    { n: '3', title: t('step3Title'), body: t('step3') },
  ];

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
      <div className="grid gap-2 sm:grid-cols-3">
        <ForexPortalKpiCard
          label={t('kpiCopying')}
          value={t('kpiOff')}
          kind="plain"
          emphasis="primary"
          tone="warning"
          icon={Radio}
          hint={t('kpiCopyingHint')}
        />
        <ForexPortalKpiCard
          label={t('kpiProviders')}
          value={providers.length}
          kind="plain"
          emphasis="secondary"
          tone={ready ? 'brand' : 'neutral'}
          icon={Layers}
          hint={ready ? t('listed') : t('noneYet')}
        />
        <ForexPortalKpiCard
          label={t('kpiSubscription')}
          value={saved ? t('kpiWaiting') : t('kpiNone')}
          kind="plain"
          emphasis="secondary"
          tone={saved ? 'brand' : 'neutral'}
          icon={Bookmark}
          hint={saved ? selected?.name : t('kpiSubscriptionHint')}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.n} className="flex gap-3 rounded-md border border-border/80 bg-card px-3 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[12px] font-semibold text-primary">
              {step.n}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">{step.title}</div>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      {session.status !== 'AUTHENTICATED' && (ready || session.status === 'SIGNED_OUT') ? (
        <ForexAuthPending status={session.status} href={`/login?redirect=${FOREX_ROUTES.signals}`} sectionKey="signals" />
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <ForexPortalModuleCard
          title={t('listTitle')}
          subtitle={t('listSubtitle')}
          actions={<ForexPortalStatusBadge tone={ready ? 'primary' : 'warning'}>{ready ? t('listed') : t('noneYet')}</ForexPortalStatusBadge>}
        >
          {!ready ? (
            <div className="flex items-start gap-3 rounded-md border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Radio className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <div className="text-[13px] font-medium text-foreground">{t('emptyTitle')}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t('listEmpty')}</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {providers.map((provider) => {
                const on = provider.providerId === providerId;
                return (
                  <li key={provider.providerId}>
                    <button
                      type="button"
                      onClick={() => setProviderId(provider.providerId)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
                        on
                          ? 'border-primary/70 bg-primary/[0.08] text-foreground'
                          : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{provider.name}</span>
                        <span className="mt-0.5 block text-[11px]">{provider.status === 'active' ? t('providerActive') : t('providerPaused')}</span>
                      </span>
                      <ForexPortalStatusBadge tone={provider.status === 'active' ? 'success' : 'warning'}>
                        {provider.status === 'active' ? t('providerActive') : t('providerPaused')}
                      </ForexPortalStatusBadge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href={FOREX_ROUTES.trade} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
            {t('goTrade')}
          </Link>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('settingsTitle')} subtitle={ready ? t('settingsReady') : t('settingsLead')}>
          <form onSubmit={(e) => { e.preventDefault(); void onSave(); }}>
            <SettingRow label={t('account')} hint={t('accountHint')}>
              <select
                className={cn(fieldClass, 'text-left font-sans')}
                value={accountId}
                disabled={!fieldsOn || accounts.length === 0}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.length === 0 ? <option value="">{t('noAccount')}</option> : null}
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {forexAccountOptionLabel(te, account)}
                  </option>
                ))}
              </select>
            </SettingRow>
            <SettingRow label={t('depositPct')} hint={t('depositHint')}>
              <input className={fieldClass} inputMode="decimal" disabled={!fieldsOn} value={depositPct} onChange={(e) => setDepositPct(e.target.value)} />
            </SettingRow>
            <SettingRow label={t('equityStop')} hint={t('equityHint')}>
              <input className={fieldClass} inputMode="decimal" disabled={!fieldsOn} value={equityStop} onChange={(e) => setEquityStop(e.target.value)} />
            </SettingRow>
            <SettingRow label={t('slippage')} hint={t('slippageHint')}>
              <input className={fieldClass} inputMode="decimal" disabled={!fieldsOn} value={slippage} onChange={(e) => setSlippage(e.target.value)} />
            </SettingRow>
            <label className="flex items-center justify-between gap-3 py-3 text-[13px] text-foreground">
              <span>
                <span className="block font-medium">{t('copySlTp')}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{t('copySlTpHint')}</span>
              </span>
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={copySlTp} disabled={!fieldsOn} onChange={(e) => setCopySlTp(e.target.checked)} />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
              <p className="max-w-sm text-[12px] leading-snug text-muted-foreground">
                {selected?.status === 'paused' ? t('paused') : saved ? t('saved') : t('locked')}
              </p>
              <button
                type="submit"
                disabled={!canSave}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-45"
              >
                {t('subscribe')}
              </button>
            </div>
          </form>
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
