'use client';

import { useTranslations } from 'next-intl';

import Link from 'next/link';
import { useMemo } from 'react';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { composeAccountMetrics } from '@/lib/forex/models/account-metrics';
import { livePositionValuation, sumLiveFloating } from '@/lib/forex/models/live-valuation';
import { useForexStore } from '@/lib/forex/state/store';
import { fxMoney, fxSigned } from './format';
import { ForexPositionModeSwitch } from './ForexPositionModeSwitch';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';

export function ForexAccountBar(props?: { compact?: boolean }) {
  const t = useTranslations('forex.accountBar');
  const authed = useForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);
  const quotes = useForexStore((s) => s.quotes);
  const instruments = useForexStore((s) => s.instruments);
  const positions = useForexStore((s) => s.positions);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const liveFloat = useMemo(() => {
    const open = Object.values(positions).filter((p) => p.status === 'OPEN');
    return sumLiveFloating(
      open.map((p) =>
        livePositionValuation({
          position: p,
          quote: quotes[p.symbol],
          instrument: instruments[p.symbol],
        })
      )
    );
  }, [positions, quotes, instruments]);
  const h = props?.compact ? 'h-8' : 'h-10';

  if (!authed) {
    return (
      <div className={`flex ${h} items-center gap-4 overflow-x-auto border-t border-border bg-card px-3 text-[11px]`}>
        <span className="text-muted-foreground">{t('signInPrompt')}</span>
        <Link
          href="/login?redirect=/forex/trade"
          className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('signIn')}
        </Link>
      </div>
    );
  }

  if ((hydratePhase === 'idle' || hydratePhase === 'hydrating') && !account && !balance) {
    return (
      <div className={`flex ${h} items-center border-t border-border bg-card px-3 text-[11px] text-muted-foreground`} role="status">
        {t('loading')}
      </div>
    );
  }

  if (hydratePhase === 'error' && !account && !balance) {
    return (
      <div className={`flex ${h} items-center border-t border-border bg-card px-3 text-[11px] text-sell`} role="alert">
        {t('loadFailed')}
      </div>
    );
  }

  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const metrics = composeAccountMetrics({
    currency,
    balance: account?.ledgerBalance ?? balance?.ledgerBalance,
    equity: account?.equity ?? balance?.equity ?? margin?.equityReference,
    usedMargin: account?.usedMargin ?? margin?.usedMargin,
    freeMargin: account?.freeMargin ?? margin?.freeMargin,
    floating: liveFloat.available ? liveFloat.value : account?.unrealizedPnl ?? pnl?.unrealized,
    realized: account?.realizedPnl ?? pnl?.realized,
    commission: fees?.total ?? '0',
    swap: swaps?.total ?? '0',
  });
  const realized = fxSigned(metrics.realized);
  const u = fxSigned(metrics.floating);
  const net = fxSigned(metrics.net);
  const ledgerNum = Number(metrics.balance ?? 0);
  const needsDemo = Number.isFinite(ledgerNum) && ledgerNum <= 0;

  return (
    <div
      className={`flex ${h} w-full min-w-0 shrink-0 items-center gap-3 overflow-x-auto overflow-y-hidden border-t border-border bg-card px-2.5 font-mono text-[11px] tabular-nums`}
      aria-label={t('ariaLabel')}
    >
      <ForexAccountSwitcher compact={props?.compact} />
      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
        SIMULATED
      </span>
      <span
        className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
        title={t('positionModeTitle')}
      >
        {account?.positionMode === 'HEDGING' ? t('hedging') : t('netting')}
      </span>
      <ForexPositionModeSwitch />
      <Item k="Balance" v={fxMoney(metrics.balance, currency)} />
      <Item k="Equity" v={fxMoney(metrics.equity, currency)} />
      <Item k="Used" v={fxMoney(metrics.usedMargin, currency)} />
      <Item k="Free" v={fxMoney(metrics.freeMargin, currency)} />
      <Item k="Level" v={metrics.marginLevel} />
      <Signed k="Floating" value={u} />
      <Signed k="Realized" value={realized} />
      <Item k="Comm" v={fxMoney(metrics.commission, currency)} />
      <Item k="Swap" v={fxMoney(metrics.swap, currency)} />
      <Signed k="Net" value={net} />
      {needsDemo ? (
        <Link
          href="/forex/account/funds"
          className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t('claimDemoFunds')}
        </Link>
      ) : null}
      <span className="ml-auto text-[10px] text-muted-foreground">
        {lastHydratedAt ? new Date(lastHydratedAt).toLocaleTimeString() : ''}
      </span>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className="text-foreground">{v}</span>
    </span>
  );
}

function Signed({ k, value }: { k: string; value: { text: string; tone: 'pos' | 'neg' | 'flat' | 'na' } }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className={value.tone === 'pos' ? 'text-buy' : value.tone === 'neg' ? 'text-sell' : 'text-foreground'}>
        {value.text}
      </span>
    </span>
  );
}
