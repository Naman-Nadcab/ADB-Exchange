'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { EdaPublicFooter } from '@/components/eda/EdaPublicFooter';
import { fetchEdaPublicMarkets, type EdaForexRow, type EdaPublicMarkets, type MarketFreshness } from '@/lib/eda/public-markets';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, tradeSpotWithSymbol } from '@/lib/routes';
import { cn } from '@/lib/utils';

type MarketTab = 'all' | 'crypto' | 'forex' | 'metals';

const CAPABILITY_KEYS = ['execution', 'marketData', 'riskControl', 'security', 'liquidity', 'transparency'] as const;
const PIPELINE_KEYS = ['marketData', 'liquidity', 'execution', 'risk', 'settlement', 'ledger'] as const;
const SECURITY_KEYS = ['twoFa', 'accountProtection', 'sessionControls', 'apiPermissions', 'withdrawalSafeguards', 'loginActivity'] as const;
const ACCOUNT_LABEL_KEYS = ['balance', 'equity', 'margin', 'unrealizedPnl', 'exposure', 'activity'] as const;

function changeTone(change: string | null): 'pos' | 'neg' | 'flat' {
  if (change == null || change === '') return 'flat';
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'pos' : 'neg';
}

export function EdaPublicHome() {
  const t = useTranslations('home');
  const [markets, setMarkets] = useState<EdaPublicMarkets | null>(null);
  const [tab, setTab] = useState<MarketTab>('all');

  const statusLabel = (status: MarketFreshness): string => {
    if (status === 'LIVE') return t('status.live');
    if (status === 'STALE') return t('status.stale');
    if (status === 'CONNECTING') return t('status.connecting');
    return t('status.unavailable');
  };

  const unavailable = t('liveMarkets.unavailable');
  const loading = t('liveMarkets.loading');

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchEdaPublicMarkets(ctrl.signal).then(setMarkets);
    return () => ctrl.abort();
  }, []);

  const stripStatus = markets?.status ?? 'CONNECTING';
  const crypto = markets?.crypto ?? [];
  const forex = markets?.forex ?? [];

  const marketTypeLabel = (market: 'Crypto' | 'Forex' | 'Metals') => {
    if (market === 'Crypto') return t('globalTable.marketTypes.crypto');
    if (market === 'Forex') return t('globalTable.marketTypes.forex');
    return t('globalTable.marketTypes.metals');
  };

  const tableRows = useMemo(() => {
    const cryptoRows = crypto.map((r) => ({
      key: r.symbol,
      market: 'Crypto' as const,
      display: r.display,
      href: tradeSpotWithSymbol(r.symbol),
      bidOrPrice: r.price ?? unavailable,
      askOrChange: r.change != null ? `${Number(r.change) > 0 ? '+' : ''}${r.change}%` : unavailable,
      changeTone: changeTone(r.change),
      spread: '—',
      freshness: r.freshness,
      note: undefined as string | undefined,
    }));
    const forexRows = forex.map((r) => ({
      key: r.symbol,
      market: r.metalsProxy ? ('Metals' as const) : ('Forex' as const),
      display: r.display,
      href: `${FOREX_ROUTES.trade}?symbol=${r.symbol}`,
      bidOrPrice: r.bid ?? unavailable,
      askOrChange: r.ask ?? unavailable,
      changeTone: 'flat' as const,
      spread: r.spread ?? unavailable,
      freshness: r.freshness,
      note: r.metalsProxy,
    }));
    const all = [...cryptoRows, ...forexRows];
    if (tab === 'crypto') return all.filter((r) => r.market === 'Crypto');
    if (tab === 'forex') return all.filter((r) => r.market === 'Forex');
    if (tab === 'metals') return all.filter((r) => r.market === 'Metals');
    return all;
  }, [crypto, forex, tab, unavailable]);

  return (
    <div className="dark exchange-ui min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main>
        <section className="eda-hero-grid border-b border-border">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">{t('hero.eyebrow')}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {t('hero.titleLine1')}
                <br />
                {t('hero.titleLine2')}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{t('hero.description')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#global-markets"
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('hero.exploreMarkets')}
                </Link>
                <Link
                  href={ROUTES.signup}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('hero.createAccount')}
                </Link>
              </div>
            </div>
            <aside className="eda-card-featured p-4" aria-label={t('liveMarkets.aria')}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('liveMarkets.heading')}</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn(stripStatus === 'LIVE' ? 'eda-live-dot' : 'h-1.5 w-1.5 rounded-full bg-muted-foreground')} aria-hidden />
                  {markets ? statusLabel(stripStatus) : loading}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {crypto.map((r) => (
                  <HeroQuote
                    key={r.symbol}
                    href={tradeSpotWithSymbol(r.symbol)}
                    label={r.display}
                    value={r.price}
                    change={r.change}
                    freshness={r.freshness}
                    unavailable={unavailable}
                  />
                ))}
                {forex.slice(0, 3).map((r) => (
                  <HeroFxQuote key={r.symbol} row={r} />
                ))}
                {!markets ? <li className="py-6 text-sm text-muted-foreground">{loading}</li> : null}
              </ul>
            </aside>
          </div>
        </section>

        <section className="border-b border-border" aria-label={t('ticker.aria')}>
          <div className="mx-auto flex max-w-[1320px] items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-primary">{t('ticker.globalMarkets')}</span>
            {crypto.map((r) => (
              <Link key={r.symbol} href={tradeSpotWithSymbol(r.symbol)} className="eda-card-interactive shrink-0 px-3 py-1.5 font-mono text-[12px] tabular-nums">
                {r.display} <span className="eda-quote text-foreground">{r.price ?? unavailable}</span>
              </Link>
            ))}
            {forex.slice(0, 3).map((r) => (
              <Link key={r.symbol} href={`${FOREX_ROUTES.trade}?symbol=${r.symbol}`} className="eda-card-interactive shrink-0 px-3 py-1.5 font-mono text-[12px] tabular-nums">
                {r.display}{' '}
                <span className="eda-quote text-buy">{r.bid ?? '—'}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="eda-quote text-sell">{r.ask ?? '—'}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('dualMarket.eyebrow')}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="eda-card-product flex flex-col p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-primary">{t('dualMarket.cryptoLabel')}</p>
                <h2 className="mt-2 text-2xl font-semibold">{t('dualMarket.cryptoTitle')}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t('dualMarket.cryptoDesc')}</p>
                <ul className="mt-4 space-y-1.5 font-mono text-[12px] tabular-nums">
                  {crypto.length ? (
                    crypto.map((r) => (
                      <li key={r.symbol} className="flex justify-between">
                        <span>{r.display}</span>
                        <span className={cn('eda-quote', changeClass(r.change))}>{r.price ?? unavailable}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">{loading}</li>
                  )}
                </ul>
                <ul className="mt-4 space-y-1 text-[12px] text-muted-foreground">
                  <li>{t('dualMarket.cryptoBullets.spot')}</li>
                  <li>{t('dualMarket.cryptoBullets.wallet')}</li>
                  <li>{t('dualMarket.cryptoBullets.p2p')}</li>
                </ul>
                <Link href={SPOT_TRADE_HREF} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
                  {t('dualMarket.cryptoExplore')}
                </Link>
              </article>
              <article className="eda-card-product flex flex-col p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-primary">{t('dualMarket.forexLabel')}</p>
                <h2 className="mt-2 text-2xl font-semibold">{t('dualMarket.forexTitle')}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t('dualMarket.forexDesc')}</p>
                <ul className="mt-4 space-y-1.5 font-mono text-[12px] tabular-nums">
                  {forex
                    .filter((r) => !r.metalsProxy)
                    .slice(0, 3)
                    .map((r) => (
                      <li key={r.symbol} className="flex justify-between gap-3">
                        <span>{r.display}</span>
                        <span>
                          <span className="eda-quote text-buy">{r.bid ?? '—'}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="eda-quote text-sell">{r.ask ?? '—'}</span>
                        </span>
                      </li>
                    ))}
                </ul>
                <ul className="mt-4 space-y-1 text-[12px] text-muted-foreground">
                  <li>{t('dualMarket.forexBullets.trading')}</li>
                  <li>{t('dualMarket.forexBullets.margin')}</li>
                  <li>{t('dualMarket.forexBullets.risk')}</li>
                </ul>
                <Link href={FOREX_ROUTES.trade} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
                  {t('dualMarket.forexExplore')}
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="global-markets" className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('globalTable.eyebrow')}</p>
                <h2 className="mt-1 text-xl font-semibold">{t('globalTable.title')}</h2>
              </div>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('globalTable.tabsAria')}>
                {(['all', 'crypto', 'forex', 'metals'] as const).map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    role="tab"
                    aria-selected={tab === tabKey}
                    onClick={() => setTab(tabKey)}
                    className={cn('eda-tab capitalize', tab === tabKey && 'eda-tab-active')}
                  >
                    {t(`globalTable.tabs.${tabKey}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="eda-card mt-5 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left font-mono text-[12px] tabular-nums">
                <thead className="text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t('globalTable.instrument')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('globalTable.market')}</th>
                    <th className="px-3 py-2.5 font-medium">{tab === 'crypto' ? t('globalTable.price') : t('globalTable.bidPrice')}</th>
                    <th className="px-3 py-2.5 font-medium">{tab === 'crypto' ? t('globalTable.change') : t('globalTable.ask')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('globalTable.spread')}</th>
                    <th className="px-4 py-2.5 font-medium">{t('globalTable.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                        {markets ? t('globalTable.emptyFilter') : loading}
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => (
                      <tr key={row.key} className="border-t border-border transition-colors duration-150 hover:bg-accent/60">
                        <td className="px-4 py-2.5">
                          <Link href={row.href} className="text-foreground hover:text-primary">
                            {row.display}
                          </Link>
                          {row.note ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{row.note}</span> : null}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{marketTypeLabel(row.market)}</td>
                        <td className="eda-quote px-3 py-2.5">{row.bidOrPrice}</td>
                        <td className={cn('eda-quote px-3 py-2.5', row.changeTone === 'pos' && 'text-buy', row.changeTone === 'neg' && 'text-sell')}>
                          {row.askOrChange}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.spread}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn('h-1.5 w-1.5 rounded-full', row.freshness === 'LIVE' ? 'bg-buy' : 'bg-muted-foreground')} aria-hidden />
                            {statusLabel(row.freshness)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('platform.eyebrow')}</p>
            <h2 className="mt-1 text-xl font-semibold">{t('platform.title')}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITY_KEYS.map((key) => (
                <article key={key} className="eda-card-elevated p-5">
                  <h3 className="text-sm font-semibold">{t(`platform.capabilities.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`platform.capabilities.${key}.body`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('trust.eyebrow')}</p>
            <h2 className="mt-1 text-xl font-semibold">{t('trust.coreTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('trust.coreDesc')}</p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {PIPELINE_KEYS.map((key, i) => (
                <li key={key} className="eda-card-elevated px-3 py-4 text-center">
                  <span className="block font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mt-1 block text-[13px] font-medium">{t(`trust.pipeline.${key}`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('accountPreview.eyebrow')}</p>
            <h2 className="mt-1 text-xl font-semibold">{t('accountPreview.title')}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('accountPreview.desc')}</p>
            <div className="eda-card-featured mt-5 p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t('accountPreview.previewLabel')}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {ACCOUNT_LABEL_KEYS.map((key) => (
                  <div key={key} className="eda-card p-3">
                    <dt className="text-[11px] uppercase text-muted-foreground">{t(`accountPreview.labels.${key}`)}</dt>
                    <dd className="mt-1 text-sm">{t('accountPreview.afterSignIn')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('trust.eyebrow')}</p>
            <h2 className="mt-1 text-xl font-semibold">{t('trust.securityTitle')}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SECURITY_KEYS.map((key) => (
                <article key={key} className="eda-card-elevated px-4 py-4 text-sm">
                  {t(`trust.securityItems.${key}`)}
                </article>
              ))}
            </div>
            <Link href={ROUTES.dashboard.security} className="mt-5 inline-block text-sm text-primary underline underline-offset-2">
              {t('trust.securityLink')}
            </Link>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{t('intelligence.eyebrow')}</p>
            <h2 className="mt-1 text-xl font-semibold">{t('intelligence.title')}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('intelligence.desc')}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Link href={ROUTES.markets} className="eda-card-interactive p-5">
                <h3 className="text-sm font-semibold">{t('intelligence.marketDataTitle')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t('intelligence.marketDataDesc')}</p>
              </Link>
              <Link href={FOREX_ROUTES.analysis} className="eda-card-interactive p-5">
                <h3 className="text-sm font-semibold">{t('intelligence.calendarTitle')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t('intelligence.calendarDesc')}</p>
              </Link>
              <Link href={FOREX_ROUTES.analysis} className="eda-card-interactive p-5">
                <h3 className="text-sm font-semibold">{t('intelligence.newsTitle')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t('intelligence.newsDesc')}</p>
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold">{t('cta.title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('cta.desc')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#global-markets" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                {t('cta.exploreMarkets')}
              </Link>
              <Link href={ROUTES.signup} className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold hover:border-primary/50">
                {t('cta.createAccount')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <EdaPublicFooter />
    </div>
  );
}

function changeClass(change: string | null): string {
  const tone = changeTone(change);
  if (tone === 'pos') return 'text-buy';
  if (tone === 'neg') return 'text-sell';
  return 'text-foreground';
}

function HeroQuote(props: {
  href: string;
  label: string;
  value: string | null;
  change: string | null;
  freshness: MarketFreshness;
  unavailable: string;
}) {
  return (
    <li>
      <Link href={props.href} className="eda-card-interactive flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[12px]">{props.label}</span>
        <span className={cn('eda-quote font-mono text-[12px]', changeClass(props.change))}>{props.value ?? props.unavailable}</span>
      </Link>
    </li>
  );
}

function HeroFxQuote({ row }: { row: EdaForexRow }) {
  return (
    <li>
      <Link href={`${FOREX_ROUTES.trade}?symbol=${row.symbol}`} className="eda-card-interactive flex items-center justify-between gap-3 px-3 py-2">
        <span className="font-mono text-[12px]">{row.display}</span>
        <span className="font-mono text-[12px] tabular-nums">
          <span className="eda-quote text-buy">{row.bid ?? '—'}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="eda-quote text-sell">{row.ask ?? '—'}</span>
          {row.spread ? <span className="ml-2 text-[10px] text-muted-foreground">Spr {row.spread}</span> : null}
        </span>
      </Link>
    </li>
  );
}
