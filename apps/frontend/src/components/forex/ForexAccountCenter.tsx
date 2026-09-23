'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { fxMoney, fxPlain } from '@/components/forex/format';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexApi, unwrap, type ForexAccountHubPayload } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexWalletKyc } from '@/lib/forex/hooks/useForexWalletKyc';
import {
  createForexDemoAccountAndActivate,
  switchForexActiveAccount,
  syncForexAccountsFromServer,
} from '@/lib/forex/runtime/hydrate';
import { ForexCustomerIdentityStrip } from '@/components/forex/ForexCustomerIdentityStrip';
import { ROUTES } from '@/lib/routes';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

export function ForexAccountCenter() {
  const t = useTranslations('forex.accountCenter');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { gates } = useForexProductGates();
  const kyc = useForexWalletKyc();
  const [hubs, setHubs] = useState<Record<string, ForexAccountHubPayload>>({});

  function kindLabel(kind: string): string {
    const k = kind.toUpperCase();
    if (k === 'DEMO') return t('kindDemo');
    if (k === 'LIVE' || k === 'REAL') return t('kindLive');
    return kind;
  }

  const reload = useCallback(async () => {
    if (!authed) return;
    await syncForexAccountsFromServer();
  }, [authed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!authed || accounts.length === 0) {
      setHubs({});
      return;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        accounts.map(async (a) => {
          const res = unwrap(await forexApi.getAccountById(a.accountId));
          return res.ok ? ([a.accountId, res.data] as const) : null;
        })
      );
      if (cancelled) return;
      const next: Record<string, ForexAccountHubPayload> = {};
      for (const p of pairs) {
        if (p) next[p[0]] = p[1];
      }
      setHubs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [accounts, authed]);

  async function onCreateDemo() {
    if (busy) return;
    setBusy('create');
    setErr(null);
    setNote(null);
    try {
      const ok = await createForexDemoAccountAndActivate();
      if (!ok) {
        setErr(t('createDemoFailed'));
        return;
      }
      await reload();
      setNote(t('createDemoSuccess'));
    } finally {
      setBusy(null);
    }
  }

  async function onSwitch(accountId: string) {
    if (busy || accountId === activeId) return;
    setBusy(accountId);
    setErr(null);
    setNote(null);
    try {
      const ok = await switchForexActiveAccount(accountId);
      if (!ok) {
        setErr(t('switchFailed'));
        return;
      }
      await reload();
      setNote(t('activeAccount', { accountId }));
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.accounts}`} sectionKey="forexAccounts" />;
  }

  const currency = account?.currency ?? balance?.currency ?? 'USD';

  return (
    <div className="space-y-3">
      <ForexCustomerIdentityStrip />
      {!gates.liveAccountEnabled ? (
        <ForexPortalModuleCard title={t('liveUnavailableTitle')} accent>
          <p className="text-sm text-muted-foreground">{t('liveUnavailableBody')}</p>
          {!kyc.verified && !kyc.loading ? (
            <Link href={ROUTES.dashboard.identity} className="mt-2 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
              {t('liveUnavailableKycCta')}
            </Link>
          ) : null}
        </ForexPortalModuleCard>
      ) : null}
      <ForexPortalModuleCard
        title={t('cardsSectionTitle')}
        subtitle={t('cardsSectionSubtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void onCreateDemo()}
              className="inline-flex min-h-9 items-center rounded border border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              {busy === 'create' ? t('createDemoBusy') : t('createDemo')}
            </button>
            <Link
              href={FOREX_ROUTES.openDemoAccount}
              className="inline-flex min-h-9 items-center rounded border border-border px-3 text-[11px] font-semibold hover:border-primary/40"
            >
              {t('openDemoFlow')}
            </Link>
            <Link
              href={FOREX_ROUTES.openLiveAccount}
              className={
                gates.liveAccountEnabled
                  ? 'inline-flex min-h-9 items-center rounded border border-border px-3 text-[11px] font-semibold hover:border-primary/40'
                  : 'inline-flex min-h-9 items-center rounded border border-border/60 px-3 text-[11px] font-semibold text-muted-foreground hover:border-primary/30'
              }
              title={gates.liveAccountEnabled ? undefined : t('openLiveUnavailableHint')}
            >
              {t('openLiveAccount')}
            </Link>
            <Link
              href={FOREX_ROUTES.trade}
              className="inline-flex min-h-9 items-center gap-1 rounded border border-border px-3 text-[11px] font-semibold hover:border-primary/40"
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              {t('openTradeTerminal')}
            </Link>
          </div>
        }
      >
        {note ? <p className="mb-3 text-sm text-buy">{note}</p> : null}
        {err ? <p className="mb-3 text-sm text-sell">{err}</p> : null}
        {hydratePhase === 'hydrating' && !accounts.length ? (
          <p className="text-sm text-muted-foreground">{t('loadingAccounts')}</p>
        ) : null}
        {!accounts.length && hydratePhase !== 'hydrating' ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => {
              const isActive = a.accountId === activeId;
              const lev = 'leverageOverride' in a && a.leverageOverride ? String(a.leverageOverride) : '—';
              const kind = a.accountKind.toUpperCase();
              const snap = hubs[a.accountId]?.financialSnapshot;
              const cardCurrency = snap?.currency ?? a.currency;
              return (
                <article
                  key={a.accountId}
                  className={cn(
                    'flex flex-col rounded border p-3',
                    isActive ? 'border-primary/35 bg-primary/[0.06]' : 'border-border/80 bg-card/80'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <ForexPortalStatusBadge tone={kind === 'DEMO' ? 'primary' : 'neutral'}>{kindLabel(a.accountKind)}</ForexPortalStatusBadge>
                      {isActive ? (
                        <ForexPortalStatusBadge tone="success" className="ml-1">
                          {t('activeBadge')}
                        </ForexPortalStatusBadge>
                      ) : null}
                      <p className="mt-2 font-mono text-[13px] font-semibold text-foreground">{fxPlain(a.accountId)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fxPlain(a.currency)} · {t('cardServer')}: {t('cardServerSimulated')} · {t('leverageLabel', { value: lev })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('cardCreated', { date: new Date(a.createdAt).toLocaleDateString() })}
                      </p>
                    </div>
                    <ForexPortalStatusBadge tone={String(a.status).toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}>
                      {fxPlain(a.status)}
                    </ForexPortalStatusBadge>
                  </div>
                  {snap ? (
                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 font-mono text-[11px] sm:grid-cols-4">
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricBalance')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(snap.ledgerBalance, cardCurrency)}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricEquity')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(snap.equity, cardCurrency)}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricFreeMargin')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(snap.freeMargin, cardCurrency)}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricMargin')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(snap.usedMargin, cardCurrency)}</dd>
                      </div>
                    </dl>
                  ) : isActive ? (
                    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 font-mono text-[11px]">
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricBalance')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(account?.ledgerBalance ?? balance?.ledgerBalance, currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricEquity')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(account?.equity ?? balance?.equity, currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-[9px] uppercase text-muted-foreground">{t('metricMargin')}</dt>
                        <dd className="mt-0.5 tabular-nums">{fxMoney(account?.usedMargin ?? margin?.usedMargin, currency)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">{t('metricsLoading')}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isActive ? (
                      <span className="text-[11px] text-muted-foreground">{t('current')}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy != null}
                        onClick={() => void onSwitch(a.accountId)}
                        className="rounded border border-border px-2.5 py-1 text-[11px] font-medium hover:border-primary/40 disabled:opacity-50"
                      >
                        {busy === a.accountId ? t('switching') : t('switch')}
                      </button>
                    )}
                    <Link
                      href={FOREX_ROUTES.trade}
                      className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] font-medium hover:border-primary/40"
                    >
                      <LayoutGrid className="h-3 w-3" aria-hidden />
                      {t('openTradeTerminal')}
                    </Link>
                    <Link
                      href={FOREX_ROUTES.accountDetail(a.accountId)}
                      className="inline-flex items-center gap-1 rounded border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Settings2 className="h-3 w-3" aria-hidden />
                      {t('viewDetail')}
                    </Link>
                    {kind === 'DEMO' ? (
                      <Link
                        href={FOREX_ROUTES.funds}
                        className="inline-flex items-center rounded border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {t('demoFundingShort')}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ForexPortalModuleCard>

      {accounts.length > 0 ? (
        <ForexPortalModuleCard title={t('tableSectionTitle')} subtitle={t('tableSectionSubtitle')}>
          <div className="overflow-x-auto rounded border border-border/80">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('colAccountId')}</th>
                  <th className="px-3 py-2 font-medium">{t('colType')}</th>
                  <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
                  <th className="px-3 py-2 font-medium">{t('colCurrency')}</th>
                  <th className="px-3 py-2 font-medium">{t('colPositionMode')}</th>
                  <th className="px-3 py-2 font-medium">{t('colLeverage')}</th>
                  <th className="px-3 py-2 font-medium">{t('colActive')}</th>
                  <th className="px-3 py-2 font-medium">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const isActive = a.accountId === activeId;
                  const lev = 'leverageOverride' in a && a.leverageOverride ? String(a.leverageOverride) : '—';
                  return (
                    <tr key={a.accountId} className={cn('border-b border-border/60', isActive && 'bg-primary/5')}>
                      <td className="px-3 py-2 font-mono">{fxPlain(a.accountId)}</td>
                      <td className="px-3 py-2">{kindLabel(a.accountKind)}</td>
                      <td className="px-3 py-2">{fxPlain(a.status)}</td>
                      <td className="px-3 py-2">{fxPlain(a.currency)}</td>
                      <td className="px-3 py-2">{fxPlain(a.positionMode)}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{lev}</td>
                      <td className="px-3 py-2">{isActive ? t('yes') : '—'}</td>
                      <td className="px-3 py-2">
                        {isActive ? (
                          <span className="text-muted-foreground">{t('current')}</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy != null}
                            onClick={() => void onSwitch(a.accountId)}
                            className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:border-primary/40 disabled:opacity-50"
                          >
                            {busy === a.accountId ? t('switching') : t('switch')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ForexPortalModuleCard>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {t.rich('quickSwitchHint', {
          tradeLink: (chunks) => (
            <Link href={FOREX_ROUTES.trade} className="text-primary underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
