'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
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
  const cryptoBalances = useBalancesSummary(true);
  const [fxAccount, setFxAccount] = useState<Load<ForexAccountView>>({ status: 'loading' });
  const [fxRisk, setFxRisk] = useState<Load<ForexRiskStatus>>({ status: 'loading' });
  const [fxPositions, setFxPositions] = useState<Load<ForexPublicPosition[]>>({ status: 'loading' });
  const [fxOrders, setFxOrders] = useState<Load<ForexPublicOrder[]>>({ status: 'loading' });
  const [fxFills, setFxFills] = useState<Load<ForexFillRow[]>>({ status: 'loading' });
  const [fxLedger, setFxLedger] = useState<Load<ForexLedgerRow[]>>({ status: 'loading' });
  const [fxSessions, setFxSessions] = useState<Load<ForexSessionSnapshot>>({ status: 'loading' });
  const [intel, setIntel] = useState<{ news: string; calendar: string; events: CalEvent[] }>({
    news: 'Loading',
    calendar: 'Loading',
    events: [],
  });
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
      setIntel({
        news: n.ok && n.data.availability === 'AVAILABLE' ? `${n.data.count} headlines` : `News ${n.ok ? n.data.reason ?? 'unavailable' : 'unavailable'}`,
        calendar: c.ok && c.data.availability === 'AVAILABLE' ? `${c.data.count} events` : `Calendar ${c.ok ? c.data.reason ?? 'unavailable' : 'unavailable'}`,
        events,
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
  const sessionLabel =
    fxSessions.status === 'ready'
      ? fxSessions.data.eligibility?.sessions?.length
        ? fxSessions.data.eligibility.sessions.join(' · ')
        : fxSessions.data.eligibility?.reason ?? 'Unknown'
      : fxSessions.status === 'loading'
        ? 'Loading'
        : 'Unavailable';

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return intel.events
      .filter((ev) => {
        if (!ev.time) return false;
        const ms = Date.parse(ev.time);
        return Number.isFinite(ms) && ms >= now - 60_000;
      })
      .sort((a, b) => Date.parse(String(a.time)) - Date.parse(String(b.time)))
      .slice(0, 5);
  }, [intel.events]);

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
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">My EDA</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Customer command center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Crypto and Forex accounts stay separate. No combined total is calculated here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SessionChip open={sessionOpen} label={sessionLabel} />
            {fxRisk.status === 'ready' ? (
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide', riskTone(fxRisk.data.state))}>
                Risk {fxRisk.data.state}
              </span>
            ) : null}
            {watch ? (
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium', freshnessTone(watch.status))}>
                <span className={cn('h-1.5 w-1.5 rounded-full', watch.status === 'LIVE' ? 'bg-buy' : 'bg-muted-foreground')} aria-hidden />
                Markets {watch.status}
              </span>
            ) : null}
          </div>
        </header>

        {/* Quick actions — Markets CTA language */}
        <section className="eda-card flex flex-wrap gap-2 p-3" aria-label="Quick actions">
          <ActionLink href={SPOT_TRADE_HREF} primary>
            Open Crypto Spot
          </ActionLink>
          <ActionLink href={FOREX_ROUTES.trade} primary>
            Open Forex
          </ActionLink>
          <ActionLink href={WALLET_HREF}>Funds</ActionLink>
          <ActionLink href={FOREX_ROUTES.portfolio}>Portfolio</ActionLink>
          <ActionLink href={FOREX_ROUTES.alerts}>Alerts</ActionLink>
          <ActionLink href={FOREX_ROUTES.analysis}>Analysis</ActionLink>
          <ActionLink href={ROUTES.markets}>Crypto Markets</ActionLink>
        </section>

        {highImpactNext ? (
          <section className="eda-card-featured flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary">Next calendar event</p>
              <p className="mt-0.5 text-sm font-medium">
                <span className="text-primary">{String(highImpactNext.impact ?? '·')}</span>{' '}
                {highImpactNext.currency ? `${highImpactNext.currency} · ` : ''}
                {highImpactNext.event}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {highImpactNext.time ? new Date(highImpactNext.time).toLocaleString() : 'Time unavailable'}
              </p>
            </div>
            <Link
              href={FOREX_ROUTES.analysis}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Open analysis
            </Link>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="eda-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Crypto</h2>
              <Link href={WALLET_HREF} className="text-[12px] text-primary underline-offset-2 hover:underline">
                Wallet
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Trading" state={cryptoState} />
              <Metric label="Funding" state={fundingState} />
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">Wallet summary only · no combined Crypto+Forex total</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink href={SPOT_TRADE_HREF} primary>
                Trade Spot
              </ActionLink>
              <ActionLink href={WALLET_HREF}>Deposit / Withdraw</ActionLink>
            </div>
          </article>

          <article className="eda-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Forex</h2>
              <Link href={FOREX_ROUTES.account} className="text-[12px] text-primary underline-offset-2 hover:underline">
                Account
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Metric label="Balance" state={balance} />
              <Metric label="Equity" state={equity} />
              <Metric label="Free margin" state={free} />
              <Metric label="Used margin" state={used} />
              <Metric label="Unrealized P&L" state={upnl} signed />
              <Metric label="Realized P&L" state={rpnl} signed />
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">SIMULATED execution · backend account is authoritative</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink href={FOREX_ROUTES.trade} primary>
                Trade Forex
              </ActionLink>
              <ActionLink href={FOREX_ROUTES.markets}>Explore FX</ActionLink>
              <ActionLink href={FOREX_ROUTES.funds}>Funds</ActionLink>
            </div>
          </article>
        </section>

        <section className="eda-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Open Forex positions</h2>
            <Link href={FOREX_ROUTES.portfolio} className="text-[12px] text-primary underline-offset-2 hover:underline">
              View Portfolio
            </Link>
          </div>
          {fxPositions.status === 'loading' ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading positions…</p>
          ) : fxPositions.status === 'error' ? (
            <p className="mt-3 text-sm text-muted-foreground">Positions unavailable</p>
          ) : openPositions.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">No open Forex positions.</p>
              <ActionLink href={FOREX_ROUTES.trade} primary>
                Place first trade
              </ActionLink>
            </div>
          ) : (
            <div className="eda-table-wrap mt-3">
              <table className="eda-table min-w-[720px] font-mono text-[12px]">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Volume</th>
                    <th>Entry</th>
                    <th>Current</th>
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
                      <td>{p.currentPrice || 'Unavailable'}</td>
                      <td className="text-right">
                        <Link
                          href={`${FOREX_ROUTES.trade}?symbol=${encodeURIComponent(p.symbol)}`}
                          className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          Manage
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
            <h2 className="text-sm font-semibold">Risk &amp; margin</h2>
            {fxRisk.status === 'loading' ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading risk…</p>
            ) : fxRisk.status === 'error' ? (
              <p className="mt-3 text-sm text-muted-foreground">Risk unavailable</p>
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
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Margin level</dt>
                    <dd className="mt-1 text-foreground">
                      {acc?.marginLevel == null || acc.marginLevel === ''
                        ? fxLoading
                          ? 'Loading'
                          : 'Unavailable'
                        : acc.marginLevel}
                    </dd>
                  </div>
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Used</dt>
                    <dd className="mt-1">
                      <EdaMoney state={used} />
                    </dd>
                  </div>
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Free</dt>
                    <dd className="mt-1">
                      <EdaMoney state={free} />
                    </dd>
                  </div>
                  <div className="eda-metric !min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Session</dt>
                    <dd className={cn('mt-1', sessionOpen === true ? 'text-buy' : sessionOpen === false ? 'text-sell' : 'text-muted-foreground')}>
                      {sessionOpen === true ? 'Open' : sessionOpen === false ? 'Closed' : '—'}
                    </dd>
                  </div>
                </dl>
              </>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">Backend risk/status only · no synthetic score</p>
          </article>

          <article className="eda-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Market watch</h2>
              <div className="flex items-center gap-2">
                {watchUpdatedAt ? (
                  <span className="text-[10px] text-muted-foreground">
                    Updated {new Date(watchUpdatedAt).toLocaleTimeString()}
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
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Watch tabs">
              {(['watchlist', 'crypto', 'forex', 'favorites'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={watchTab === t}
                  onClick={() => setWatchTab(t)}
                  className={cn('eda-tab', watchTab === t && 'eda-tab-active')}
                >
                  {t}
                </button>
              ))}
            </div>
            {!watch ? (
              <p className="mt-3 text-sm text-muted-foreground">Connecting…</p>
            ) : visibleCrypto.length === 0 && visibleForex.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {watchTab === 'favorites' ? 'Star symbols to build a local favorites list.' : 'No rows for this tab.'}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {visibleCrypto.map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2 py-2.5">
                    <button
                      type="button"
                      aria-label={favorites.includes(r.symbol.toUpperCase()) ? 'Remove favorite' : 'Add favorite'}
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
                        <span className={freshnessTone(r.freshness)}>{r.freshness}</span>
                        <span className={changeTone(r.change)}>{formatChange(r.change)}</span>
                      </div>
                    </Link>
                    <Link
                      href={tradeSpotWithSymbol(r.symbol)}
                      className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Trade
                    </Link>
                  </li>
                ))}
                {visibleForex.map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2 py-2.5">
                    <button
                      type="button"
                      aria-label={favorites.includes(r.symbol.toUpperCase()) ? 'Remove favorite' : 'Add favorite'}
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
                        <span className={freshnessTone(r.freshness)}>{r.freshness}</span>
                        <span>{r.spread != null ? `Spr ${r.spread}` : '—'}</span>
                      </div>
                      {r.metalsProxy ? <p className="mt-0.5 text-[10px] text-amber-400/90">{r.metalsProxy}</p> : null}
                    </Link>
                    <Link
                      href={`${FOREX_ROUTES.trade}?symbol=${r.symbol}`}
                      className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Trade
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="eda-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Forex activity</h2>
            <Link href={FOREX_ROUTES.ledger} className="text-[12px] text-primary underline-offset-2 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <ActivityCol
              title="Orders"
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
              title="Fills"
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
              title="Ledger"
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
            <h2 className="text-sm font-semibold">Market intelligence</h2>
            <Link href={FOREX_ROUTES.analysis} className="text-[12px] text-primary underline-offset-2 hover:underline">
              Open analysis
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {intel.news} · {intel.calendar}
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
                        {ev.time ? new Date(ev.time).toLocaleString() : 'Time unavailable'}
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
                      {ev.impact ?? 'n/a'}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No upcoming calendar rows in the current feed window.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionLink href={FOREX_ROUTES.analysis} primary>
              Analysis workspace
            </ActionLink>
            <ActionLink href={ROUTES.markets}>Crypto Markets intel</ActionLink>
          </div>
        </section>

        <p className="text-[12px] text-muted-foreground">
          Crypto overview remains at{' '}
          <Link href={ROUTES.dashboard.root} className="text-primary underline-offset-2 hover:underline">
            /dashboard
          </Link>
          . This home does not replace the Crypto Spot terminal.
        </p>
      </main>
    </div>
  );
}

function SessionChip(props: { open: boolean | null; label: string }) {
  if (props.open == null) {
    return (
      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
        Session —
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
      FX {props.open ? 'Open' : 'Closed'}
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
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">{props.title}</h3>
      {props.loading ? <p className="mt-2 text-sm text-muted-foreground">Loading…</p> : null}
      {props.error ? <p className="mt-2 text-sm text-muted-foreground">Unavailable</p> : null}
      {props.empty ? <p className="mt-2 text-sm text-muted-foreground">No Forex account activity.</p> : null}
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
        View {props.title}
      </Link>
    </div>
  );
}
