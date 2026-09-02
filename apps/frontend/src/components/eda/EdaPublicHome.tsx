'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { EdaPublicFooter } from '@/components/eda/EdaPublicFooter';
import { fetchEdaPublicMarkets, type EdaForexRow, type EdaPublicMarkets, type MarketFreshness } from '@/lib/eda/public-markets';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, tradeSpotWithSymbol } from '@/lib/routes';
import { cn } from '@/lib/utils';

type MarketTab = 'all' | 'crypto' | 'forex' | 'metals';

const CAPABILITIES = [
  { title: 'Execution', body: 'Designed around market-specific execution workflows for digital assets and FX.' },
  { title: 'Market Data', body: 'Real-time market information across Crypto spot and global FX.' },
  { title: 'Risk Control', body: 'Margin, exposure and position controls for Forex, kept separate from Crypto wallets.' },
  { title: 'Security', body: 'Account protection, authentication and controlled access on every session.' },
  { title: 'Liquidity', body: 'Market-specific liquidity architecture for digital assets and FX.' },
  { title: 'Transparency', body: 'Account, ledger and financial state visibility after you sign in.' },
] as const;

const PIPELINE = ['Market Data', 'Liquidity', 'Execution', 'Risk', 'Settlement', 'Ledger'] as const;

const SECURITY = [
  'Two-factor authentication',
  'Account protection',
  'Session controls',
  'API permissions',
  'Withdrawal safeguards',
  'Login activity',
] as const;

function statusLabel(status: MarketFreshness): string {
  if (status === 'LIVE') return 'Live';
  if (status === 'STALE') return 'Stale';
  if (status === 'CONNECTING') return 'Connecting';
  return 'Unavailable';
}

function changeTone(change: string | null): 'pos' | 'neg' | 'flat' {
  if (change == null || change === '') return 'flat';
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'pos' : 'neg';
}

export function EdaPublicHome() {
  const [markets, setMarkets] = useState<EdaPublicMarkets | null>(null);
  const [tab, setTab] = useState<MarketTab>('all');

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchEdaPublicMarkets(ctrl.signal).then(setMarkets);
    return () => ctrl.abort();
  }, []);

  const stripStatus = markets?.status ?? 'CONNECTING';
  const crypto = markets?.crypto ?? [];
  const forex = markets?.forex ?? [];

  const tableRows = useMemo(() => {
    const cryptoRows = crypto.map((r) => ({
      key: r.symbol,
      market: 'Crypto' as const,
      display: r.display,
      href: tradeSpotWithSymbol(r.symbol),
      bidOrPrice: r.price ?? 'Unavailable',
      askOrChange: r.change != null ? `${Number(r.change) > 0 ? '+' : ''}${r.change}%` : 'Unavailable',
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
      bidOrPrice: r.bid ?? 'Unavailable',
      askOrChange: r.ask ?? 'Unavailable',
      changeTone: 'flat' as const,
      spread: r.spread ?? 'Unavailable',
      freshness: r.freshness,
      note: r.metalsProxy,
    }));
    const all = [...cryptoRows, ...forexRows];
    if (tab === 'crypto') return all.filter((r) => r.market === 'Crypto');
    if (tab === 'forex') return all.filter((r) => r.market === 'Forex');
    if (tab === 'metals') return all.filter((r) => r.market === 'Metals');
    return all;
  }, [crypto, forex, tab]);

  return (
    <div className="dark exchange-ui min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main>
        <section className="eda-hero-grid border-b border-border">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">FDM · Fintech Digital Market</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Fintech Digital Market.
                <br />
                Crypto and Forex.
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Access digital assets and global FX through one professional financial platform built for precision,
                transparency and control.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#global-markets"
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Explore Markets
                </Link>
                <Link
                  href={ROUTES.signup}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Create Account
                </Link>
              </div>
            </div>
            <aside className="eda-card-featured p-4" aria-label="Live markets">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Markets</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn(stripStatus === 'LIVE' ? 'eda-live-dot' : 'h-1.5 w-1.5 rounded-full bg-muted-foreground')} aria-hidden />
                  {markets ? statusLabel(stripStatus) : 'Loading market data…'}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {crypto.map((r) => (
                  <HeroQuote key={r.symbol} href={tradeSpotWithSymbol(r.symbol)} label={r.display} value={r.price} change={r.change} freshness={r.freshness} />
                ))}
                {forex.slice(0, 3).map((r) => (
                  <HeroFxQuote key={r.symbol} row={r} />
                ))}
                {!markets ? <li className="py-6 text-sm text-muted-foreground">Loading market data…</li> : null}
              </ul>
            </aside>
          </div>
        </section>

        <section className="border-b border-border" aria-label="Market ticker">
          <div className="mx-auto flex max-w-[1320px] items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-primary">Global Markets</span>
            {crypto.map((r) => (
              <Link key={r.symbol} href={tradeSpotWithSymbol(r.symbol)} className="eda-card-interactive shrink-0 px-3 py-1.5 font-mono text-[12px] tabular-nums">
                {r.display} <span className="eda-quote text-foreground">{r.price ?? 'Unavailable'}</span>
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
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">One platform. Two markets.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="eda-card-product flex flex-col p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-primary">Crypto</p>
                <h2 className="mt-2 text-2xl font-semibold">Digital Asset Markets</h2>
                <p className="mt-2 text-sm text-muted-foreground">Spot trading for digital assets.</p>
                <ul className="mt-4 space-y-1.5 font-mono text-[12px] tabular-nums">
                  {crypto.length ? crypto.map((r) => (
                    <li key={r.symbol} className="flex justify-between">
                      <span>{r.display}</span>
                      <span className={cn('eda-quote', changeClass(r.change))}>{r.price ?? 'Unavailable'}</span>
                    </li>
                  )) : <li className="text-muted-foreground">Loading market data…</li>}
                </ul>
                <ul className="mt-4 space-y-1 text-[12px] text-muted-foreground">
                  <li>Spot</li>
                  <li>Wallet</li>
                  <li>P2P</li>
                </ul>
                <Link href={SPOT_TRADE_HREF} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
                  Explore Crypto →
                </Link>
              </article>
              <article className="eda-card-product flex flex-col p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-primary">Forex</p>
                <h2 className="mt-2 text-2xl font-semibold">Global FX Markets</h2>
                <p className="mt-2 text-sm text-muted-foreground">Professional FX trading with dedicated margin, positions and risk management.</p>
                <ul className="mt-4 space-y-1.5 font-mono text-[12px] tabular-nums">
                  {forex.filter((r) => !r.metalsProxy).slice(0, 3).map((r) => (
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
                  <li>FX Trading</li>
                  <li>Margin</li>
                  <li>Risk</li>
                </ul>
                <Link href={FOREX_ROUTES.trade} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
                  Explore Forex →
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="global-markets" className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Markets</p>
                <h2 className="mt-1 text-xl font-semibold">Global Markets</h2>
              </div>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Market class">
                {(['all', 'crypto', 'forex', 'metals'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn('eda-tab capitalize', tab === t && 'eda-tab-active')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="eda-card mt-5 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left font-mono text-[12px] tabular-nums">
                <thead className="text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Instrument</th>
                    <th className="px-3 py-2.5 font-medium">Market</th>
                    <th className="px-3 py-2.5 font-medium">{tab === 'crypto' ? 'Price' : 'Bid / Price'}</th>
                    <th className="px-3 py-2.5 font-medium">{tab === 'crypto' ? 'Change' : 'Ask'}</th>
                    <th className="px-3 py-2.5 font-medium">Spread</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                        {markets ? 'No instruments for this filter.' : 'Loading market data…'}
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
                        <td className="px-3 py-2.5 text-muted-foreground">{row.market}</td>
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
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Platform</p>
            <h2 className="mt-1 text-xl font-semibold">Built for precision</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((item) => (
                <article key={item.title} className="eda-card-elevated p-5">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Trust</p>
            <h2 className="mt-1 text-xl font-semibold">Built on a financial core</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Market data, execution, risk, settlement and financial records operate through dedicated platform services.
            </p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {PIPELINE.map((step, i) => (
                <li key={step} className="eda-card-elevated px-3 py-4 text-center">
                  <span className="block font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mt-1 block text-[13px] font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Account</p>
            <h2 className="mt-1 text-xl font-semibold">Complete account visibility</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track your balance, equity, margin, exposure, P&amp;L and account activity from one place after you sign in.
            </p>
            <div className="eda-card-featured mt-5 p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Product preview</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {['Balance', 'Equity', 'Margin', 'Unrealized P&L', 'Exposure', 'Activity'].map((label) => (
                  <div key={label} className="eda-card p-3">
                    <dt className="text-[11px] uppercase text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm">Available after sign-in</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Trust</p>
            <h2 className="mt-1 text-xl font-semibold">Security built into the platform</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SECURITY.map((item) => (
                <article key={item} className="eda-card-elevated px-4 py-4 text-sm">
                  {item}
                </article>
              ))}
            </div>
            <Link href={ROUTES.dashboard.security} className="mt-5 inline-block text-sm text-primary underline underline-offset-2">
              Account security
            </Link>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Intelligence</p>
            <h2 className="mt-1 text-xl font-semibold">Market intelligence</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Stay informed with market data, economic events and financial news alongside your trading workflow.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Link href={ROUTES.markets} className="eda-card-interactive p-5">
                <h3 className="text-sm font-semibold">Market data</h3>
                <p className="mt-2 text-sm text-muted-foreground">Live Crypto and FX instruments from FDM markets.</p>
              </Link>
              <Link href={FOREX_ROUTES.analysis} className="eda-card-interactive p-5">
                <h3 className="text-sm font-semibold">Economic calendar</h3>
                <p className="mt-2 text-sm text-muted-foreground">Scheduled events inside the Forex analysis workspace.</p>
              </Link>
              <Link href={FOREX_ROUTES.analysis} className="eda-card-interactive p-5">
                <h3 className="text-sm font-semibold">Financial news</h3>
                <p className="mt-2 text-sm text-muted-foreground">Headlines from the platform news provider — never invented here.</p>
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold">Ready for the markets?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Access digital assets and global FX through FDM.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#global-markets" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Explore Markets
              </Link>
              <Link href={ROUTES.signup} className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold hover:border-primary/50">
                Create Account
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

function HeroQuote(props: { href: string; label: string; value: string | null; change: string | null; freshness: MarketFreshness }) {
  return (
    <li>
      <Link href={props.href} className="eda-card-interactive flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[12px]">{props.label}</span>
        <span className={cn('eda-quote font-mono text-[12px]', changeClass(props.change))}>
          {props.value ?? 'Unavailable'}
        </span>
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
