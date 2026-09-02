'use client';

import Link from 'next/link';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useAuthStore } from '@/store/auth';
import { useForexStore } from '@/lib/forex/state/store';
import { fxMoney, fxPlain, fxSigned } from './format';

export function ForexAccountBar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);

  if (!authed) {
    return (
      <div className="flex h-10 items-center gap-4 overflow-x-auto border-t border-border bg-card px-3 text-[11px]">
        <span className="text-muted-foreground">Sign in to view balance, equity and margin.</span>
        <Link
          href="/login?redirect=/forex/trade"
          className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if ((hydratePhase === 'idle' || hydratePhase === 'hydrating') && !account && !balance) {
    return (
      <div className="flex h-10 items-center border-t border-border bg-card px-3 text-[11px] text-muted-foreground" role="status">
        Loading account…
      </div>
    );
  }

  if (hydratePhase === 'error' && !account && !balance) {
    return (
      <div className="flex h-10 items-center border-t border-border bg-card px-3 text-[11px] text-sell" role="alert">
        Unable to load account.
      </div>
    );
  }

  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const ledger = account?.ledgerBalance ?? balance?.ledgerBalance;
  const equity = account?.equity ?? balance?.equity ?? margin?.equityReference;
  const used = account?.usedMargin ?? margin?.usedMargin;
  const free = account?.freeMargin ?? margin?.freeMargin;
  const level = account?.marginLevel ?? margin?.marginLevel;
  const realized = fxSigned(account?.realizedPnl ?? pnl?.realized);
  const u = fxSigned(account?.unrealizedPnl ?? pnl?.unrealized);

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-5 overflow-x-auto border-t border-border bg-card px-3 font-mono text-[11px] tabular-nums"
      aria-label="Account bar"
    >
      <Item k="Balance" v={fxMoney(ledger, currency)} />
      <Item k="Equity" v={fxMoney(equity, currency)} />
      <Item k="Used" v={fxMoney(used, currency)} />
      <Item k="Free" v={fxMoney(free, currency)} />
      <Item k="Level" v={level == null || level === '' ? 'Unavailable' : `${fxPlain(Number(level).toFixed(2))}%`} />
      <Signed k="Realized" value={realized} />
      <Signed k="Unrealized" value={u} />
      <span className="ml-auto text-[10px] text-muted-foreground">
        {lastHydratedAt ? new Date(lastHydratedAt).toLocaleTimeString() : ''}
      </span>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className="text-foreground">{v}</span>
    </span>
  );
}

function Signed({ k, value }: { k: string; value: { text: string; tone: 'pos' | 'neg' | 'flat' | 'na' } }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className={value.tone === 'pos' ? 'text-buy' : value.tone === 'neg' ? 'text-sell' : 'text-foreground'}>
        {value.text}
      </span>
    </span>
  );
}
