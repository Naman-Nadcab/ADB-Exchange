'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { EdaMoney } from '@/components/eda/EdaMoney';
import { moneyFromBackend, type EdaMoneyState } from '@/lib/eda/money-state';
import { fetchEdaPublicMarkets, type EdaPublicMarkets, type MarketFreshness } from '@/lib/eda/public-markets';
import { useBalancesSummary } from '@/lib/balances';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, tradeSpotWithSymbol, WALLET_HREF } from '@/lib/routes';
import type {
  ForexAccountView,
  ForexFillRow,
  ForexLedgerRow,
  ForexPublicOrder,
  ForexPublicPosition,
  ForexRiskStatus,
  ForexSessionSnapshot,
} from '@/lib/forex/models/types';
import { isOpenPosition } from '@/lib/forex/models/position';
import { cn } from '@/lib/utils';

type Load<T> = { status: 'loading' } | { status: 'error'; reason?: string } | { status: 'ready'; data: T };

type CalEvent = {
  time?: string | null;
  currency?: string | null;
  event?: string;
  impact?: string;
};

type IntelFeedMeta = {
  newsOk: boolean;
  newsAvailable: boolean;
  newsCount?: number;
  newsReason?: string;
  calOk: boolean;
  calAvailable: boolean;
  calCount?: number;
  calReason?: string;
};

const FAV_KEY = 'eda-command-favorites-v1';

function riskTone(state: string | undefined): string {
  const s = String(state ?? '').toUpperCase();
  if (s === 'NORMAL' || s === 'OK') return 'bg-buy/15 text-buy border-buy/30';
  if (s === 'HALTED' || s === 'LIQUIDATION_ONLY') return 'bg-sell/15 text-sell border-sell/30';
  if (s === 'RESTRICTED' || s === 'WARNING' || s === 'MARGIN_CALL') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

function freshnessTone(f: MarketFreshness): string {
  if (f === 'LIVE') return 'text-buy';
  if (f === 'STALE') return 'text-amber-400';
  return 'text-muted-foreground';
}

function changeTone(change: string | null): string {
  if (change == null || change === '') return 'text-muted-foreground';
  const n = Number(change);
  if (!Number.isFinite(n)) return 'text-muted-foreground';
  if (n > 0) return 'text-buy';
  if (n < 0) return 'text-sell';
  return 'text-muted-foreground';
}

function formatChange(change: string | null): string {
  if (change == null || change === '') return '—';
  const n = Number(change);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.map((s) => String(s).toUpperCase()) : [];
  } catch {
    return [];
  }
}

export function EdaCustomerHome() {
  const th = useTranslations('home');
  const tc = useTranslations('home.customer');
  const tn = useTranslations('navigation');
  const tf = useTranslations('forex');
  const tw = useTranslations('wallet.actions');
  const tActions = useTranslations('common.actions');
  const tStates = useTranslations('common.states');

  const marketStatusLabel = useCallback(
    (status: MarketFreshness): string => {
      if (status === 'LIVE') return th('status.live');
      if (status === 'STALE') return th('status.stale');
      if (status === 'CONNECTING') return th('status.connecting');
      return th('status.unavailable');
    },
    [th]
  );

  const cryptoBalances = useBalancesSummary(true);
  const [fxAccount, setFxAccount] = useState<Load<ForexAccountView>>({ status: 'loading' });
  const [fxRisk, setFxRisk] = useState<Load<ForexRiskStatus>>({ status: 'loading' });
  const [fxPositions, setFxPositions] = useState<Load<ForexPublicPosition[]>>({ status: 'loading' });
  const [fxOrders, setFxOrders] = useState<Load<ForexPublicOrder[]>>({ status: 'loading' });
  const [fxFills, setFxFills] = useState<Load<ForexFillRow[]>>({ status: 'loading' });
  const [fxLedger, setFxLedger] = useState<Load<ForexLedgerRow[]>>({ status: 'loading' });
  const [fxSessions, setFxSessions] = useState<Load<ForexSessionSnapshot>>({ status: 'loading' });
  const [intelMeta, setIntelMeta] = useState<IntelFeedMeta | null>(null);
  const [intelEvents, setIntelEvents] = useState<CalEvent[]>([]);
  const [watch, setWatch] = useState<EdaPublicMarkets | null>(null);
  const [watchTab, setWatchTab] = useState<'watchlist' | 'crypto' | 'forex' | 'favorites'>('watchlist');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [watchUpdatedAt, setWatchUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  const refreshWatch = useCallback(async (signal?: AbortSignal) => {
    const data = await fetchEdaPublicMarkets(signal);
    setWatch(data);
    setWatchUpdatedAt(Date.now());
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const [account, risk, positions, orders, fills, ledger, news, calendar, sessions] = await Promise.all([
        forexApi.account(),
        forexApi.riskStatus(),
        forexApi.positions(),
        forexApi.orders(),
        forexApi.fills(),
        forexApi.ledger(),
        forexApi.news(),
        forexApi.calendar(),
        forexApi.sessions(),
      ]);
      const acc = unwrap(account);
      setFxAccount(acc.ok && acc.data.account ? { status: 'ready', data: acc.data.account } : { status: 'error', reason: acc.ok ? undefined : acc.error.message });
      const riskU = unwrap(risk);
      setFxRisk(riskU.ok ? { status: 'ready', data: riskU.data } : { status: 'error', reason: riskU.error.message });
      const pos = unwrap(positions);
      setFxPositions(pos.ok ? { status: 'ready', data: pos.data.positions ?? [] } : { status: 'error', reason: pos.error.message });
      const ord = unwrap(orders);
      setFxOrders(ord.ok ? { status: 'ready', data: ord.data.orders ?? [] } : { status: 'error', reason: ord.error.message });
      const fil = unwrap(fills);
      setFxFills(fil.ok ? { status: 'ready', data: fil.data.fills ?? [] } : { status: 'error', reason: fil.error.message });
      const led = unwrap(ledger);
      setFxLedger(led.ok ? { status: 'ready', data: led.data.transactions ?? [] } : { status: 'error', reason: led.error.message });
      const sess = unwrap(sessions);
      setFxSessions(sess.ok ? { status: 'ready', data: sess.data } : { status: 'error', reason: sess.error.message });
      const n = unwrap(news);
      const c = unwrap(calendar);
      const events = c.ok && Array.isArray(c.data.events) ? (c.data.events as CalEvent[]) : [];
      setIntelEvents(events);
      setIntelMeta({
        newsOk: n.ok,
        newsAvailable: n.ok && n.data.availability === 'AVAILABLE',
        newsCount: n.ok ? n.data.count : undefined,
        newsReason: n.ok ? (n.data.reason ?? undefined) : undefined,
        calOk: c.ok,
        calAvailable: c.ok && c.data.availability === 'AVAILABLE',
        calCount: c.ok ? c.data.count : undefined,
        calReason: c.ok ? (c.data.reason ?? undefined) : undefined,
      });
    })();
    void refreshWatch(ctrl.signal);
    return () => ctrl.abort();
  }, [refreshWatch]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshWatch();
    }, 8000);
    return () => window.clearInterval(id);
  }, [refreshWatch]);

  const toggleFavorite = (symbol: string) => {
    const s = symbol.toUpperCase();
    setFavorites((cur) => {
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const cryptoState: EdaMoneyState = moneyFromBackend({
    loading: cryptoBalances.isPending,
    failed: Boolean(cryptoBalances.isError || cryptoBalances.data?.balanceError),
    value: cryptoBalances.data ? cryptoBalances.data.tradingBalance.totalUsd : null,
    reason: cryptoBalances.data?.balanceError ?? undefined,
  });
  const fundingState: EdaMoneyState = moneyFromBackend({
    loading: cryptoBalances.isPending,
    failed: Boolean(cryptoBalances.isError || cryptoBalances.data?.balanceError),
    value: cryptoBalances.data ? cryptoBalances.data.fundingBalance.totalUsd : null,
    reason: cryptoBalances.data?.balanceError ?? undefined,
  });

  const fxLoading = fxAccount.status === 'loading';
  const fxFailed = fxAccount.status === 'error';
  const acc = fxAccount.status === 'ready' ? fxAccount.data : null;
  const balance = moneyFromBackend({ loading: fxLoading, failed: fxFailed, value: acc?.ledgerBalance });
  const equity = moneyFromBackend({ loading: fxLoading, failed: fxFailed, value: acc?.equity });
  const used = moneyFromBackend({ loading: fxLoading, failed: fxFailed, value: acc?.usedMargin });
  const free = moneyFromBackend({ loading: fxLoading, failed: fxFailed, value: acc?.freeMargin });
  const upnl = moneyFromBackend({ loading: fxLoading, failed: fxFailed, value: acc?.unrealizedPnl });
  const rpnl = moneyFromBackend({ loading: fxLoading, failed: fxFailed, value: acc?.realizedPnl });

  const openPositions = fxPositions.status === 'ready' ? fxPositions.data.filter(isOpenPosition) : [];

  const sessionOpen = fxSessions.status === 'ready' ? fxSessions.data.eligibility?.open === true : null;
  const sessionLabel = useMemo(() => {
    if (fxSessions.status === 'ready') {
      if (fxSessions.data.eligibility?.sessions?.length) {
        return fxSessions.data.eligibility.sessions.join(' · ');
      }
      return fxSessions.data.eligibility?.reason ?? tc('unknown');
    }
    if (fxSessions.status === 'loading') return th('status.connecting');
    return th('status.unavailable');
  }, [fxSessions, tc, th]);

  const intelSummary = useMemo(() => {
    const unavail = tc('intelligenceSection.unavailableReason');
    if (!intelMeta) {
      return { news: th('status.connecting'), calendar: th('status.connecting') };
    }
    const news =
      intelMeta.newsAvailable && intelMeta.newsCount != null
        ? tc('intelligenceSection.headlinesCount', { count: intelMeta.newsCount })
        : tc('intelligenceSection.newsUnavailable', {
            reason: intelMeta.newsOk ? (intelMeta.newsReason ?? unavail) : unavail,
          });
    const calendar =
      intelMeta.calAvailable && intelMeta.calCount != null
        ? tc('intelligenceSection.eventsCount', { count: intelMeta.calCount })
        : tc('intelligenceSection.calendarUnavailable', {
            reason: intelMeta.calOk ? (intelMeta.calReason ?? unavail) : unavail,
          });
    return { news, calendar };
  }, [intelMeta, tc, th]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return intelEvents
      .filter((ev) => {
        if (!ev.time) return false;
        const ms = Date.parse(ev.time);
        return Number.isFinite(ms) && ms >= now - 60_000;
      })
      .sort((a, b) => Date.parse(String(a.time)) - Date.parse(String(b.time)))
      .slice(0, 5);
  }, [intelEvents]);

  const highImpactNext = upcomingEvents.find((e) => String(e.impact ?? '').toLowerCase().includes('high')) ?? upcomingEvents[0] ?? null;

  const cryptoRows = watch?.crypto ?? [];
  const forexRows = watch?.forex ?? [];
  const visibleCrypto =
    watchTab === 'forex'
      ? []
      : watchTab === 'favorites'
        ? cryptoRows.filter((r) => favorites.includes(r.symbol.toUpperCase()))
        : cryptoRows;
  const visibleForex =
    watchTab === 'crypto'
      ? []
      : watchTab === 'favorites'
        ? forexRows.filter((r) => favorites.includes(r.symbol.toUpperCase()))
        : forexRows;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-[1320px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{tc('eyebrow')}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tc('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tc('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SessionChip open={sessionOpen} label={sessionLabel} />
            {fxRisk.status === 'ready' ? (
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', riskTone(fxRisk.data.state))}>
                {tc('riskBadge', { state: fxRisk.data.state })}
              </span>
            ) : null}
            {watch ? (
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium', freshnessTone(watch.status))}>
                <span className={cn('h-1.5 w-1.5 rounded-full', watch.status === 'LIVE' ? 'bg-buy' : 'bg-muted-foreground')} aria-hidden />
                {tc('marketsBadge', { status: marketStatusLabel(watch.status) })}
              </span>
            ) : null}
          </div>
        </header>

        {/* Quick actions — Markets CTA language */}
        <section className="eda-card flex flex-wrap gap-2 p-3" aria-label={tc('quickActionsAria')}>
          <ActionLink href={SPOT_TRADE_HREF} primary>
            {tc('actions.openCryptoSpot')}
          </ActionLink>
          <ActionLink href={FOREX_ROUTES.trade} primary>
            {tc('actions.openForex')}
          </ActionLink>
          <ActionLink href={WALLET_HREF}>{tn('funds')}</ActionLink>
          <ActionLink href={FOREX_ROUTES.portfolio}>{tn('portfolio')}</ActionLink>
          <ActionLink href={FOREX_ROUTES.alerts}>{tf('nav.alerts')}</ActionLink>
          <ActionLink href={FOREX_ROUTES.analysis}>{tf('nav.analysis')}</ActionLink>
          <ActionLink href={ROUTES.markets}>{tc('actions.cryptoMarkets')}</ActionLink>
        </section>

        {highImpactNext ? (
          <section className="eda-card-featured flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary">{tc('calendarBanner.eyebrow')}</p>
              <p className="mt-0.5 text-sm font-medium">
                <span className="text-primary">{String(highImpactNext.impact ?? '·')}</span>{' '}
                {highImpactNext.currency ? `${highImpactNext.currency} · ` : ''}
                {highImpactNext.event}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {highImpactNext.time ? new Date(highImpactNext.time).toLocaleString() : tc('timeUnavailable')}
              </p>
            </div>
            <Link
              href={FOREX_ROUTES.analysis}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {tc('actions.openAnalysis')}
            </Link>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="eda-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tc('cryptoSection.title')}</h2>
              <Link href={WALLET_HREF} className="text-[12px] text-primary underline-offset-2 hover:underline">
                {tn('wallet')}
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Metric label={tc('metrics.trading')} state={cryptoState} />
              <Metric label={tc('metrics.funding')} state={fundingState} />
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">{tc('cryptoSection.footnote')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink href={SPOT_TRADE_HREF} primary>
                {tc('actions.tradeSpot')}
              </ActionLink>
              <ActionLink href={WALLET_HREF}>{tc('actions.depositWithdraw')}</ActionLink>
            </div>
          </article>

          <article className="eda-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tc('forexSection.title')}</h2>
              <Link href={FOREX_ROUTES.account} className="text-[12px] text-primary underline-offset-2 hover:underline">
                {tn('account')}
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Metric label={tc('metrics.balance')} state={balance} />
              <Metric label={tc('metrics.equity')} state={equity} />
              <Metric label={tc('metrics.freeMargin')} state={free} />
              <Metric label={tc('metrics.usedMargin')} state={used} />
              <Metric label={tc('metrics.unrealizedPnl')} state={upnl} signed />
              <Metric label={tc('metrics.realizedPnl')} state={rpnl} signed />
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">{tc('forexSection.footnote')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink href={FOREX_ROUTES.trade} primary>
                {tc('actions.tradeForex')}
              </ActionLink>
              <ActionLink href={FOREX_ROUTES.markets}>{tc('actions.exploreFx')}</ActionLink>
              <ActionLink href={FOREX_ROUTES.funds}>{tn('funds')}</ActionLink>
            </div>
          </article>
        </section>

        <section className="eda-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{tc('positions.title')}</h2>
            <Link href={FOREX_ROUTES.portfolio} className="text-[12px] text-primary underline-offset-2 hover:underline">
              {tc('actions.viewPortfolio')}
            </Link>
          </div>
          {fxPositions.status === 'loading' ? (
            <p className="mt-3 text-sm text-muted-foreground">{tc('positions.loading')}</p>
          ) : fxPositions.status === 'error' ? (
            <p className="mt-3 text-sm text-muted-foreground">{tc('positions.unavailable')}</p>
          ) : openPositions.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{tc('positions.empty')}</p>
              <ActionLink href={FOREX_ROUTES.trade} primary>
                {tc('actions.placeFirstTrade')}
              </ActionLink>
            </div>
          ) : (
            <div className="eda-table-wrap mt-3">
              <table className="eda-table min-w-[720px] font-mono text-[12px]">
                <thead>
                  <tr>
                    <th>{tc('positionsTable.symbol')}</th>
                    <th>{tc('positionsTable.side')}</th>
                    <th>{tc('positionsTable.volume')}</th>
                    <th>{tc('positionsTable.entry')}</th>
                    <th>{tc('positionsTable.current')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {openPositions.slice(0, 8).map((p) => (
                    <tr key={p.positionId}>
                      <td className="font-medium text-foreground">{p.symbol}</td>
                      <td className={cn('uppercase', p.side === 'long' ? 'text-buy' : 'text-sell')}>{p.side}</td>
                      <td>{p.volume}</td>
                      <td>{p.averageEntryPrice || p.entryPrice}</td>
                      <td>{p.currentPrice || tc('positionsTable.priceUnavailable')}</td>
                      <td className="text-right">
                        <Link
                          href={`${FOREX_ROUTES.trade}?symbol=${encodeURIComponent(p.symbol)}`}
                          className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          {tc('actions.manage')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="eda-card p-5">
            <h2 className="text-sm font-semibold">{tc('riskSection.title')}</h2>
            {fxRisk.status === 'loading' ? (
              <p className="mt-3 text-sm text-muted-foreground">{tc('riskSection.loading')}</p>
            ) : fxRisk.status === 'error' ? (
              <p className="mt-3 text-sm text-muted-foreground">{tc('riskSection.unavailable')}</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase', riskTone(fxRisk.data.state))}>
                    {fxRisk.data.state}
                  </span>
                  {fxRisk.data.reason ? (
                    <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">{fxRisk.data.reason}</span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px]">
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{tc('riskSection.marginLevel')}</dt>
                    <dd className="mt-1 text-foreground">
                      {acc?.marginLevel == null || acc.marginLevel === ''
                        ? fxLoading
                          ? tStates('loading')
                          : th('liveMarkets.unavailable')
                        : acc.marginLevel}
                    </dd>
                  </div>
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{tc('riskSection.used')}</dt>
                    <dd className="mt-1">
                      <EdaMoney state={used} />
                    </dd>
                  </div>
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{tc('riskSection.free')}</dt>
                    <dd className="mt-1">
                      <EdaMoney state={free} />
                    </dd>
                  </div>
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{tc('riskSection.session')}</dt>
                    <dd className={cn('mt-1', sessionOpen === true ? 'text-buy' : sessionOpen === false ? 'text-sell' : 'text-muted-foreground')}>
                      {sessionOpen === true ? tc('riskSection.sessionOpen') : sessionOpen === false ? tc('riskSection.sessionClosed') : '—'}
                    </dd>
                  </div>
                </dl>
              </>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">{tc('riskSection.footnote')}</p>
          </article>

          <article className="eda-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{tc('watch.title')}</h2>
              <div className="flex items-center gap-2">
                {watchUpdatedAt ? (
                  <span className="text-[10px] text-muted-foreground">
                    {tc('watch.updatedAt', { time: new Date(watchUpdatedAt).toLocaleTimeString() })}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => {
                    setRefreshing(true);
                    void refreshWatch().finally(() => setRefreshing(false));
                  }}
                  className="eda-tab !normal-case !tracking-normal"
                >
                  {refreshing ? tc('watch.refreshing') : tActions('refresh')}
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label={tc('watch.tabsAria')}>
              {(['watchlist', 'crypto', 'forex', 'favorites'] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  aria-selected={watchTab === tabKey}
                  onClick={() => setWatchTab(tabKey)}
                  className={cn('eda-tab', watchTab === tabKey && 'eda-tab-active')}
                >
                  {tc(`watch.tabs.${tabKey}`)}
                </button>
              ))}
            </div>
            {!watch ? (
              <p className="mt-3 text-sm text-muted-foreground">{th('status.connecting')}</p>
            ) : visibleCrypto.length === 0 && visibleForex.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {watchTab === 'favorites' ? tc('watch.emptyFavorites') : tc('watch.emptyTab')}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {visibleCrypto.map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2 py-2.5">
                    <button
                      type="button"
                      aria-label={
                        favorites.includes(r.symbol.toUpperCase()) ? tf('watchlist.removeFavorite') : tf('watchlist.addFavorite')
                      }
                      onClick={() => toggleFavorite(r.symbol)}
                      className={cn('text-[14px]', favorites.includes(r.symbol.toUpperCase()) ? 'text-primary' : 'text-muted-foreground')}
                    >
                      ★
                    </button>
                    <Link href={tradeSpotWithSymbol(r.symbol)} className="min-w-0 flex-1 hover:text-primary">
                      <div className="flex items-center justify-between gap-2 font-mono text-[12px]">
                        <span className="font-medium text-foreground">{r.display}</span>
                        <span className="text-foreground">{r.price ?? '—'}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px]">
                        <span className={freshnessTone(r.freshness)}>{marketStatusLabel(r.freshness)}</span>
                        <span className={changeTone(r.change)}>{formatChange(r.change)}</span>
                      </div>
                    </Link>
                    <Link
                      href={tradeSpotWithSymbol(r.symbol)}
                      className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {tc('actions.trade')}
                    </Link>
                  </li>
                ))}
                {visibleForex.map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2 py-2.5">
                    <button
                      type="button"
                      aria-label={
                        favorites.includes(r.symbol.toUpperCase()) ? tf('watchlist.removeFavorite') : tf('watchlist.addFavorite')
                      }
                      onClick={() => toggleFavorite(r.symbol)}
                      className={cn('text-[14px]', favorites.includes(r.symbol.toUpperCase()) ? 'text-primary' : 'text-muted-foreground')}
                    >
                      ★
                    </button>
                    <Link href={`${FOREX_ROUTES.trade}?symbol=${r.symbol}`} className="min-w-0 flex-1 hover:text-primary">
                      <div className="flex items-center justify-between gap-2 font-mono text-[12px]">
                        <span className="font-medium text-foreground">{r.display}</span>
                        <span>
                          <span className="text-buy">{r.bid ?? '—'}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-sell">{r.ask ?? '—'}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className={freshnessTone(r.freshness)}>{marketStatusLabel(r.freshness)}</span>
                        <span>{r.spread != null ? tc('watch.spreadPrefix', { spread: r.spread }) : '—'}</span>
                      </div>
                      {r.metalsProxy ? <p className="mt-0.5 text-[10px] text-amber-400/90">{r.metalsProxy}</p> : null}
                    </Link>
                    <Link
                      href={`${FOREX_ROUTES.trade}?symbol=${r.symbol}`}
                      className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {tc('actions.trade')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="eda-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{tc('activity.title')}</h2>
            <Link href={FOREX_ROUTES.ledger} className="text-[12px] text-primary underline-offset-2 hover:underline">
              {tw('viewAll')}
            </Link>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <ActivityCol
              title={tc('activity.orders')}
              loading={fxOrders.status === 'loading'}
              error={fxOrders.status === 'error'}
              empty={fxOrders.status === 'ready' && fxOrders.data.length === 0}
              rows={
                fxOrders.status === 'ready'
                  ? fxOrders.data.slice(0, 5).map((o) => ({
                      id: o.orderId,
                      primary: `${o.symbol} ${o.side.toUpperCase()} ${o.requestedVolume}`,
                      secondary: o.status,
                      tone: o.side === 'buy' ? 'buy' : 'sell',
                      href: FOREX_ROUTES.orders,
                    }))
                  : []
              }
              href={FOREX_ROUTES.orders}
            />
            <ActivityCol
              title={tc('activity.fills')}
              loading={fxFills.status === 'loading'}
              error={fxFills.status === 'error'}
              empty={fxFills.status === 'ready' && fxFills.data.length === 0}
              rows={
                fxFills.status === 'ready'
                  ? fxFills.data.slice(0, 5).map((f) => ({
                      id: f.fillId,
                      primary: `${f.symbol} ${f.side} ${f.volume}`,
                      secondary: f.price,
                      tone: String(f.side).toLowerCase().includes('buy') ? 'buy' : 'sell',
                      href: FOREX_ROUTES.orders,
                    }))
                  : []
              }
              href={FOREX_ROUTES.orders}
            />
            <ActivityCol
              title={tc('activity.ledger')}
              loading={fxLedger.status === 'loading'}
              error={fxLedger.status === 'error'}
              empty={fxLedger.status === 'ready' && fxLedger.data.length === 0}
              rows={
                fxLedger.status === 'ready'
                  ? fxLedger.data.slice(0, 5).map((r) => ({
                      id: r.transactionId,
                      primary: `${r.type}`,
                      secondary: String(r.net ?? r.credit ?? '—'),
                      tone: 'neutral' as const,
                      href: FOREX_ROUTES.ledger,
                    }))
                  : []
              }
              href={FOREX_ROUTES.ledger}
            />
          </div>
        </section>

        <section className="eda-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{tc('intelligenceSection.title')}</h2>
            <Link href={FOREX_ROUTES.analysis} className="text-[12px] text-primary underline-offset-2 hover:underline">
              {tc('actions.openAnalysis')}
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {intelSummary.news} · {intelSummary.calendar}
          </p>
          {upcomingEvents.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {upcomingEvents.map((ev, i) => {
                const impact = String(ev.impact ?? '').toLowerCase();
                return (
                  <li key={`${ev.time}-${i}`} className="eda-card-interactive flex items-start justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">
                        {ev.currency ? `${ev.currency} · ` : ''}
                        {ev.event}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ev.time ? new Date(ev.time).toLocaleString() : tc('timeUnavailable')}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                        impact.includes('high')
                          ? 'border-sell/40 bg-sell/15 text-sell'
                          : impact.includes('medium')
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                            : 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {ev.impact ?? tc('intelligenceSection.impactNa')}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{tc('intelligenceSection.noUpcomingEvents')}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionLink href={FOREX_ROUTES.analysis} primary>
              {tc('actions.analysisWorkspace')}
            </ActionLink>
            <ActionLink href={ROUTES.markets}>{tc('actions.cryptoMarketsIntel')}</ActionLink>
          </div>
        </section>

        <p className="text-[12px] text-muted-foreground">
          {tc('footer.cryptoOverviewPrefix')}{' '}
          <Link href={ROUTES.dashboard.root} className="text-primary underline-offset-2 hover:underline">
            /dashboard
          </Link>
          {tc('footer.cryptoOverviewSuffix')}
        </p>
      </main>
    </div>
  );
}

function SessionChip(props: { open: boolean | null; label: string }) {
  const tc = useTranslations('home.customer');
  if (props.open == null) {
    return (
      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
        {tc('sessionChip.unknown')}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        props.open ? 'border-buy/30 bg-buy/10 text-buy' : 'border-sell/30 bg-sell/10 text-sell'
      )}
      title={props.label}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', props.open ? 'bg-buy' : 'bg-sell')} aria-hidden />
      {props.open ? tc('sessionChip.fxOpen') : tc('sessionChip.fxClosed')}
    </span>
  );
}

function ActionLink(props: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={props.href}
      className={cn(
        'inline-flex h-9 items-center rounded-lg px-3 text-[12px] font-semibold transition-colors',
        props.primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/60'
      )}
    >
      {props.children}
    </Link>
  );
}

function Metric(props: { label: string; state: EdaMoneyState; signed?: boolean }) {
  return (
    <div className="eda-metric !min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 text-base">
        <EdaMoney state={props.state} signed={props.signed} />
      </dd>
    </div>
  );
}

function ActivityCol(props: {
  title: string;
  loading: boolean;
  error: boolean;
  empty: boolean;
  rows: Array<{ id: string; primary: string; secondary: string; tone: 'buy' | 'sell' | 'neutral'; href: string }>;
  href: string;
}) {
  const tc = useTranslations('home.customer');
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">{props.title}</h3>
      {props.loading ? <p className="mt-2 text-sm text-muted-foreground">{tc('activity.loading')}</p> : null}
      {props.error ? <p className="mt-2 text-sm text-muted-foreground">{tc('activity.unavailable')}</p> : null}
      {props.empty ? <p className="mt-2 text-sm text-muted-foreground">{tc('activity.empty')}</p> : null}
      {props.rows.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {props.rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} className="eda-card-interactive block px-2.5 py-1.5 font-mono text-[11px]">
                <span
                  className={cn(
                    'font-medium',
                    row.tone === 'buy' ? 'text-buy' : row.tone === 'sell' ? 'text-sell' : 'text-foreground'
                  )}
                >
                  {row.primary}
                </span>
                <span className="mt-0.5 block text-muted-foreground">{row.secondary}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={props.href} className="mt-2 inline-block text-[12px] text-primary underline-offset-2 hover:underline">
        {tc('activity.viewSection', { section: props.title })}
      </Link>
    </div>
  );
}
