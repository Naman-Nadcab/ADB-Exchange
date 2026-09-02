'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { EdaPublicFooter } from '@/components/eda/EdaPublicFooter';
import { fetchEdaPublicMarkets, type EdaPublicMarkets } from '@/lib/eda/public-markets';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, tradeSpotWithSymbol } from '@/lib/routes';

type MarketTab = 'all' | 'crypto' | 'forex' | 'metals';

const CAPABILITIES = [
  { title: 'Execution', body: 'Separate Crypto and Forex execution paths. Each market keeps its own order and fill model.' },
  { title: 'Market Data', body: 'Public Crypto tickers and Forex bid/ask from EDA backends. Freshness is shown, never invented.' },
  { title: 'Risk', body: 'Forex margin, exposure, and protection stay on the Forex ledger. Crypto risk stays on Crypto wallets.' },
  { title: 'Security', body: '2FA, sessions, withdrawal controls, login history, and API permissions on the customer account.' },
  { title: 'Liquidity', body: 'Crypto matching is the live spot book. Forex currently executes in simulated mock-LP mode.' },
  { title: 'Infrastructure', body: 'Market data, execution, risk, settlement, and ledger remain backend-authoritative.' },
] as const;

const PIPELINE = ['Market Data', 'Liquidity', 'Execution', 'Risk', 'Settlement', 'Ledger'] as const;

export function EdaPublicHome() {
  const [markets, setMarkets] = useState<EdaPublicMarkets | null>(null);
  const [tab, setTab] = useState<MarketTab>('all');

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchEdaPublicMarkets(ctrl.signal).then(setMarkets);
    return () => ctrl.abort();
  }, []);

  const stripStatus = markets?.status ?? 'CONNECTING';

  const tableRows = useMemo(() => {
    const crypto = (markets?.crypto ?? []).map((r) => ({
      key: r.symbol,
      market: 'Crypto' as const,
      display: r.display,
      href: tradeSpotWithSymbol(r.symbol),
      a: r.price ?? 'Unavailable',
      b: r.change != null ? `${r.change}%` : 'Unavailable',
      c: '—',
      d: r.freshness,
      note: undefined as string | undefined,
    }));
    const forex = (markets?.forex ?? []).map((r) => ({
      key: r.symbol,
      market: r.metalsProxy ? ('Metals' as const) : ('Forex' as const),
      display: r.display,
      href: `${FOREX_ROUTES.trade}?symbol=${r.symbol}`,
      a: r.bid ?? 'Unavailable',
      b: r.ask ?? 'Unavailable',
      c: r.spread ?? 'Unavailable',
      d: r.freshness,
      note: r.metalsProxy,
    }));
    const all = [...crypto, ...forex];
    if (tab === 'crypto') return all.filter((r) => r.market === 'Crypto');
    if (tab === 'forex') return all.filter((r) => r.market === 'Forex');
    if (tab === 'metals') return all.filter((r) => r.market === 'Metals');
    return all;
  }, [markets, tab]);

  return (
    <div className="min-h-screen bg-[#05070B] text-white">
      <PublicHeader />
      <main>
        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#F5B800]">EDA</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Global markets.
              <br />
              One platform.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#9CA3AF]">
              Digital assets and global FX through a professional financial platform built around execution, risk,
              transparency and control.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#global-markets" className="inline-flex min-h-11 items-center rounded-lg bg-[#F5B800] px-5 text-sm font-semibold text-[#05070B] hover:bg-[#FFD54A]">
                Explore Markets
              </Link>
              <Link href={ROUTES.signup} className="inline-flex min-h-11 items-center rounded-lg border border-[#F5B8001F] px-5 text-sm font-semibold text-white hover:border-[#F5B80066]">
                Create Account
              </Link>
            </div>
            <div className="mt-10 rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6B7280]">Platform Preview</p>
              <p className="mt-2 font-mono text-[12px] text-[#9CA3AF]">
                Market strip uses public Crypto tickers and Forex quotes. Not a live trading terminal.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]" aria-label="Global markets strip">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-4 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
            <span className="text-[11px] uppercase tracking-[0.16em] text-[#F5B800]">Global Markets</span>
            <span className="font-mono text-[11px] text-[#9CA3AF]">{stripStatus === 'CONNECTING' && !markets ? 'Connecting' : stripStatus}</span>
            {(markets?.crypto ?? []).map((r) => (
              <Link key={r.symbol} href={tradeSpotWithSymbol(r.symbol)} className="font-mono text-[12px] text-[#D1D5DB] hover:text-white">
                {r.display} <span className="eda-quote text-[#9CA3AF]">{r.price ?? 'Unavailable'}</span>
              </Link>
            ))}
            {(markets?.forex ?? []).slice(0, 3).map((r) => (
              <Link key={r.symbol} href={`${FOREX_ROUTES.trade}?symbol=${r.symbol}`} className="font-mono text-[12px] text-[#D1D5DB] hover:text-white">
                {r.display} <span className="eda-quote text-[#9CA3AF]">{r.bid ?? 'Unavailable'}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#F5B800]">One platform. Multiple markets.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="eda-surface-hover flex flex-col rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">Crypto</p>
                <h2 className="mt-2 text-2xl font-semibold">Digital Asset Markets</h2>
                <p className="mt-2 flex-1 text-sm text-[#9CA3AF]">Spot trading for digital assets. Existing Crypto terminal, wallet, and P2P remain unchanged.</p>
                <ul className="mt-4 space-y-1 text-[12px] text-[#9CA3AF]">
                  <li>Spot</li>
                  <li>Wallet</li>
                  <li>P2P</li>
                </ul>
                <Link href={SPOT_TRADE_HREF} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-[#F5B8001F] px-5 text-sm font-semibold hover:border-[#F5B80066]">
                  Explore Crypto
                </Link>
              </article>
              <article className="eda-surface-hover flex flex-col rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-6">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">Forex</p>
                <h2 className="mt-2 text-2xl font-semibold">Global FX Markets</h2>
                <p className="mt-2 flex-1 text-sm text-[#9CA3AF]">Currency trading with a separate account, margin, and ledger. Simulated execution. Not a Crypto add-on.</p>
                <ul className="mt-4 space-y-1 text-[12px] text-[#9CA3AF]">
                  <li>FX Trading</li>
                  <li>Margin</li>
                  <li>Positions</li>
                  <li>Risk</li>
                </ul>
                <Link href={FOREX_ROUTES.root} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-[#F5B8001F] px-5 text-sm font-semibold hover:border-[#F5B80066]">
                  Explore Forex
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="global-markets" className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-semibold">Global Markets</h2>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Market class">
                {(['all', 'crypto', 'forex', 'metals'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1.5 text-[12px] capitalize ${tab === t ? 'bg-white/10 text-white' : 'text-[#9CA3AF] hover:text-white'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left font-mono text-[12px]">
                <thead className="text-[11px] uppercase text-[#6B7280]">
                  <tr>
                    <th className="py-2 font-medium">Instrument</th>
                    <th className="py-2 font-medium">Market</th>
                    <th className="py-2 font-medium">{tab === 'crypto' ? 'Price' : 'Bid / Price'}</th>
                    <th className="py-2 font-medium">{tab === 'crypto' ? 'Change' : 'Ask / Change'}</th>
                    <th className="py-2 font-medium">Spread</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-[#9CA3AF]">
                        {markets ? 'No instruments for this filter.' : 'Connecting to market…'}
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => (
                      <tr key={row.key} className="border-t border-[#F5B80014]">
                        <td className="py-2.5">
                          <Link href={row.href} className="text-white hover:underline">
                            {row.display}
                          </Link>
                          {row.note ? <span className="mt-0.5 block text-[10px] text-[#6B7280]">{row.note}</span> : null}
                        </td>
                        <td className="py-2.5 text-[#9CA3AF]">{row.market}</td>
                        <td className="py-2.5">{row.a}</td>
                        <td className="py-2.5">{row.b}</td>
                        <td className="py-2.5">{row.c}</td>
                        <td className="py-2.5 text-[#9CA3AF]">{row.d}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold">Platform</h2>
            <div className="mt-6 grid gap-px bg-[#F5B8001F] sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((item) => (
                <article key={item.title} className="bg-[#05070B] p-5">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold">Financial infrastructure</h2>
            <ol className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {PIPELINE.map((step, i) => (
                <li key={step} className="flex items-center gap-2 font-mono text-[12px] text-[#D1D5DB]">
                  <span className="rounded border border-[#F5B8001F] px-3 py-2">{step}</span>
                  {i < PIPELINE.length - 1 ? <span className="text-[#6B7280]" aria-hidden>↓</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold">Account transparency</h2>
            <p className="mt-2 max-w-2xl text-sm text-[#9CA3AF]">
              Forex customers see balance, equity, margin, P&amp;L, exposure, and ledger from the Forex backend. These are
              not guest account values.
            </p>
            <div className="mt-5 rounded-xl border border-dashed border-[#F5B80033] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#6B7280]">Illustrative interface</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-[12px] text-[#9CA3AF] md:grid-cols-4">
                <div>
                  <dt>Balance</dt>
                  <dd>Ledger cash</dd>
                </div>
                <div>
                  <dt>Equity</dt>
                  <dd>Cash + unrealized</dd>
                </div>
                <div>
                  <dt>Margin</dt>
                  <dd>Used / free / level</dd>
                </div>
                <div>
                  <dt>Ledger</dt>
                  <dd>Posted activity</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold">Security</h2>
            <ul className="mt-4 grid gap-2 text-sm text-[#9CA3AF] sm:grid-cols-2 lg:grid-cols-3">
              <li>Two-factor authentication</li>
              <li>Session controls</li>
              <li>Withdrawal safeguards</li>
              <li>Login history</li>
              <li>API permissions</li>
              <li>Account protection</li>
            </ul>
            <Link href={ROUTES.dashboard.security} className="mt-4 inline-block text-sm text-white underline underline-offset-2">
              Account security
            </Link>
          </div>
        </section>

        <section className="border-b border-[#F5B8001F]">
          <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold">Market intelligence</h2>
            <p className="mt-2 text-sm text-[#9CA3AF]">Markets, economic calendar, and news are available inside Forex analysis. Headlines are never fabricated here.</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href={ROUTES.markets} className="underline underline-offset-2">Markets</Link>
              <Link href={FOREX_ROUTES.analysis} className="underline underline-offset-2">Calendar &amp; news</Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold">Access the markets</h2>
            <p className="mt-2 text-sm text-[#9CA3AF]">Digital assets and global FX through EDA.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#global-markets" className="inline-flex min-h-11 items-center rounded-lg bg-[#F5B800] px-5 text-sm font-semibold text-[#05070B]">
                Explore Markets
              </Link>
              <Link href={ROUTES.signup} className="inline-flex min-h-11 items-center rounded-lg border border-[#F5B8001F] px-5 text-sm font-semibold">
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
