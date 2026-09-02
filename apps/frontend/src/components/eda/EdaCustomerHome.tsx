'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { EdaMoney } from '@/components/eda/EdaMoney';
import { moneyFromBackend, type EdaMoneyState } from '@/lib/eda/money-state';
import { fetchEdaPublicMarkets, type EdaPublicMarkets } from '@/lib/eda/public-markets';
import { useBalancesSummary } from '@/lib/balances';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { ROUTES, SPOT_TRADE_HREF, tradeSpotWithSymbol, WALLET_HREF } from '@/lib/routes';
import type { ForexAccountView, ForexFillRow, ForexLedgerRow, ForexPublicOrder, ForexPublicPosition, ForexRiskStatus } from '@/lib/forex/models/types';
import { isOpenPosition } from '@/lib/forex/models/position';

type Load<T> = { status: 'loading' } | { status: 'error'; reason?: string } | { status: 'ready'; data: T };

export function EdaCustomerHome() {
  const cryptoBalances = useBalancesSummary(true);
  const [fxAccount, setFxAccount] = useState<Load<ForexAccountView>>({ status: 'loading' });
  const [fxRisk, setFxRisk] = useState<Load<ForexRiskStatus>>({ status: 'loading' });
  const [fxPositions, setFxPositions] = useState<Load<ForexPublicPosition[]>>({ status: 'loading' });
  const [fxOrders, setFxOrders] = useState<Load<ForexPublicOrder[]>>({ status: 'loading' });
  const [fxFills, setFxFills] = useState<Load<ForexFillRow[]>>({ status: 'loading' });
  const [fxLedger, setFxLedger] = useState<Load<ForexLedgerRow[]>>({ status: 'loading' });
  const [intel, setIntel] = useState<{ news: string; calendar: string }>({ news: 'Loading', calendar: 'Loading' });
  const [watch, setWatch] = useState<EdaPublicMarkets | null>(null);
  const [watchTab, setWatchTab] = useState<'watchlist' | 'crypto' | 'forex'>('watchlist');

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const [account, risk, positions, orders, fills, ledger, news, calendar] = await Promise.all([
        forexApi.account(),
        forexApi.riskStatus(),
        forexApi.positions(),
        forexApi.orders(),
        forexApi.fills(),
        forexApi.ledger(),
        forexApi.news(),
        forexApi.calendar(),
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
      const n = unwrap(news);
      const c = unwrap(calendar);
      setIntel({
        news: n.ok && n.data.availability === 'AVAILABLE' ? `${n.data.count} headlines` : `News ${n.ok ? n.data.reason ?? 'unavailable' : 'unavailable'}`,
        calendar: c.ok && c.data.availability === 'AVAILABLE' ? `${c.data.count} events` : `Calendar ${c.ok ? c.data.reason ?? 'unavailable' : 'unavailable'}`,
      });
    })();
    void fetchEdaPublicMarkets(ctrl.signal).then(setWatch);
    return () => ctrl.abort();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#05070B] text-white">
      <PublicHeader />
      <main className="mx-auto max-w-[1320px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#F5B800]">My EDA</p>
          <h1 className="mt-1 text-2xl font-semibold">Customer command center</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Crypto and Forex accounts stay separate. No combined total is calculated here.</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Crypto</h2>
              <Link href={WALLET_HREF} className="text-[12px] text-[#9CA3AF] underline underline-offset-2">Wallet</Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[11px] uppercase text-[#6B7280]">Trading</dt>
                <dd className="mt-1 text-lg">
                  <EdaMoney state={cryptoState} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#6B7280]">Funding</dt>
                <dd className="mt-1 text-lg">
                  <EdaMoney state={fundingState} />
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-[#6B7280]">GET /api/v1/wallet/balances/summary · existing Crypto wallet</p>
            <Link href={SPOT_TRADE_HREF} className="mt-4 inline-flex min-h-10 items-center text-sm underline underline-offset-2">
              Open Crypto
            </Link>
          </article>

          <article className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Forex</h2>
              <Link href={FOREX_ROUTES.account} className="text-[12px] text-[#9CA3AF] underline underline-offset-2">Account</Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Metric label="Balance" state={balance} />
              <Metric label="Equity" state={equity} />
              <Metric label="Free margin" state={free} />
              <Metric label="Used margin" state={used} />
              <Metric label="Unrealized P&L" state={upnl} />
              <Metric label="Realized P&L" state={rpnl} />
            </dl>
            <p className="mt-3 text-[11px] text-[#6B7280]">GET /api/v1/forex/account · ledgerBalance / equity / margin / pnl</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href={FOREX_ROUTES.markets} className="underline underline-offset-2">Explore FX Markets</Link>
              <Link href={FOREX_ROUTES.trade} className="underline underline-offset-2">Open Forex</Link>
            </div>
          </article>
        </section>

        <section className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open positions</h2>
            <Link href={FOREX_ROUTES.portfolio} className="text-[12px] underline underline-offset-2">View Portfolio</Link>
          </div>
          {fxPositions.status === 'loading' ? (
            <p className="mt-3 text-sm text-[#9CA3AF]">Loading positions…</p>
          ) : fxPositions.status === 'error' ? (
            <p className="mt-3 text-sm text-[#9CA3AF]">Positions unavailable</p>
          ) : openPositions.length === 0 ? (
            <p className="mt-3 text-sm text-[#9CA3AF]">No open Forex positions.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[640px] w-full text-left font-mono text-[12px]">
                <thead className="text-[#6B7280]">
                  <tr>
                    <th className="py-1 font-medium">Symbol</th>
                    <th className="py-1 font-medium">Side</th>
                    <th className="py-1 font-medium">Volume</th>
                    <th className="py-1 font-medium">Entry</th>
                    <th className="py-1 font-medium">Current</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.slice(0, 8).map((p) => (
                    <tr key={p.positionId} className="border-t border-[#F5B80014]">
                      <td className="py-1.5">{p.symbol}</td>
                      <td className="py-1.5 uppercase">{p.side}</td>
                      <td className="py-1.5">{p.volume}</td>
                      <td className="py-1.5">{p.averageEntryPrice || p.entryPrice}</td>
                      <td className="py-1.5">{p.currentPrice || 'Unavailable'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
            <h2 className="text-sm font-semibold">Risk &amp; margin</h2>
            {fxRisk.status === 'loading' ? (
              <p className="mt-3 text-sm text-[#9CA3AF]">Loading risk…</p>
            ) : fxRisk.status === 'error' ? (
              <p className="mt-3 text-sm text-[#9CA3AF]">Risk unavailable</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px]">
                <div>
                  <dt className="text-[#6B7280]">State</dt>
                  <dd>{fxRisk.data.state}</dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Margin level</dt>
                  <dd>
                    {acc?.marginLevel == null || acc.marginLevel === ''
                      ? fxLoading
                        ? 'Loading'
                        : 'Unavailable'
                      : `${acc.marginLevel}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Used</dt>
                  <dd>
                    <EdaMoney state={used} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Free</dt>
                  <dd>
                    <EdaMoney state={free} />
                  </dd>
                </div>
              </dl>
            )}
            <p className="mt-3 text-[11px] text-[#6B7280]">GET /risk/status and /account. No synthetic score.</p>
          </article>

          <article className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
            <h2 className="text-sm font-semibold">Market watch</h2>
            <div className="mt-3 flex gap-2" role="tablist">
              {(['watchlist', 'crypto', 'forex'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-selected={watchTab === t}
                  onClick={() => setWatchTab(t)}
                  className={`rounded px-2 py-1 text-[12px] capitalize ${watchTab === t ? 'bg-white/10' : 'text-[#9CA3AF]'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {!watch ? (
              <p className="mt-3 text-sm text-[#9CA3AF]">Connecting…</p>
            ) : (
              <ul className="mt-3 space-y-1 font-mono text-[12px]">
                {(watchTab !== 'forex' ? watch.crypto : []).map((r) => (
                  <li key={r.symbol}>
                    <Link href={tradeSpotWithSymbol(r.symbol)} className="flex justify-between hover:text-[#F5B800]">
                      <span>{r.display}</span>
                      <span>{r.price ?? r.freshness}</span>
                    </Link>
                  </li>
                ))}
                {(watchTab !== 'crypto' ? watch.forex : []).map((r) => (
                  <li key={r.symbol}>
                    <Link href={`${FOREX_ROUTES.trade}?symbol=${r.symbol}`} className="flex justify-between hover:text-[#F5B800]">
                      <span>{r.display}</span>
                      <span>{r.bid ?? r.freshness}</span>
                    </Link>
                    {r.metalsProxy ? <span className="block text-[10px] text-[#6B7280]">{r.metalsProxy}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Link href={FOREX_ROUTES.ledger} className="text-[12px] underline underline-offset-2">View all</Link>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <ActivityCol
              title="Orders"
              loading={fxOrders.status === 'loading'}
              error={fxOrders.status === 'error'}
              empty={fxOrders.status === 'ready' && fxOrders.data.length === 0}
              rows={fxOrders.status === 'ready' ? fxOrders.data.slice(0, 5).map((o) => `${o.symbol} ${o.side} ${o.volume}`) : []}
              href={FOREX_ROUTES.orders}
            />
            <ActivityCol
              title="Fills"
              loading={fxFills.status === 'loading'}
              error={fxFills.status === 'error'}
              empty={fxFills.status === 'ready' && fxFills.data.length === 0}
              rows={fxFills.status === 'ready' ? fxFills.data.slice(0, 5).map((f) => `${f.symbol} ${f.side} ${f.volume}`) : []}
              href={FOREX_ROUTES.orders}
            />
            <ActivityCol
              title="Ledger"
              loading={fxLedger.status === 'loading'}
              error={fxLedger.status === 'error'}
              empty={fxLedger.status === 'ready' && fxLedger.data.length === 0}
              rows={fxLedger.status === 'ready' ? fxLedger.data.slice(0, 5).map((r) => `${r.type} ${r.net ?? r.credit}`) : []}
              href={FOREX_ROUTES.ledger}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-5">
          <h2 className="text-sm font-semibold">Market intelligence</h2>
          <p className="mt-2 text-sm text-[#9CA3AF]">{intel.news} · {intel.calendar}</p>
          <Link href={FOREX_ROUTES.analysis} className="mt-2 inline-block text-sm underline underline-offset-2">
            Open analysis
          </Link>
        </section>

        <p className="text-[12px] text-[#6B7280]">
          Crypto overview remains at <Link href={ROUTES.dashboard.root} className="underline">/dashboard</Link>. This home does not replace the Crypto terminal.
        </p>
      </main>
    </div>
  );
}

function Metric(props: { label: string; state: EdaMoneyState }) {
  return (
    <div>
      <dt className="text-[11px] uppercase text-[#6B7280]">{props.label}</dt>
      <dd className="mt-1">
        <EdaMoney state={props.state} />
      </dd>
    </div>
  );
}

function ActivityCol(props: { title: string; loading: boolean; error: boolean; empty: boolean; rows: string[]; href: string }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase text-[#6B7280]">{props.title}</h3>
      {props.loading ? <p className="mt-2 text-sm text-[#9CA3AF]">Loading…</p> : null}
      {props.error ? <p className="mt-2 text-sm text-[#9CA3AF]">Unavailable</p> : null}
      {props.empty ? <p className="mt-2 text-sm text-[#9CA3AF]">No Forex account activity.</p> : null}
      {props.rows.length > 0 ? (
        <ul className="mt-2 space-y-1 font-mono text-[12px]">
          {props.rows.map((row, i) => (
            <li key={`${row}-${i}`}>{row}</li>
          ))}
        </ul>
      ) : null}
      <Link href={props.href} className="mt-2 inline-block text-[12px] underline underline-offset-2">
        View {props.title}
      </Link>
    </div>
  );
}
