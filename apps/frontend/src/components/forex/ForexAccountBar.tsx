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
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);

  if (!authed) {
    return (
      <div className="flex h-9 items-center gap-4 overflow-x-auto border-t border-stone-200 bg-white px-3 text-[11px] text-stone-500 dark:border-stone-800 dark:bg-[#0e1012]">
        <span>Sign in to load Forex balance, equity, and margin from the backend.</span>
        <Link href="/login?redirect=/forex/account" className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
          Sign in
        </Link>
      </div>
    );
  }

  const currency = account?.currency ?? balance?.currency ?? 'USD';
  const ledger = account?.ledgerBalance ?? balance?.ledgerBalance;
  const equity = account?.equity ?? balance?.equity ?? margin?.equityReference;
  const used = account?.usedMargin ?? margin?.usedMargin;
  const free = account?.freeMargin ?? margin?.freeMargin;
  const level = account?.marginLevel ?? margin?.marginLevel;
  const u = fxSigned(account?.unrealizedPnl ?? pnl?.unrealized);
  const status = account?.calculationStatus ?? balance?.calculationStatus ?? margin?.calculationStatus;

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-5 overflow-x-auto border-t border-stone-200 bg-white px-3 font-mono text-[11px] dark:border-stone-800 dark:bg-[#0e1012]"
      aria-label="Account bar"
    >
      <Item k="Balance" v={fxMoney(ledger, currency)} />
      <Item k="Equity" v={fxMoney(equity, currency)} />
      <Item k="Used margin" v={fxMoney(used, currency)} />
      <Item k="Free margin" v={fxMoney(free, currency)} />
      <Item k="Margin level" v={level == null || level === '' ? 'Unavailable' : `${fxPlain(Number(level).toFixed(2))}%`} />
      <span>
        <span className="mr-1 text-stone-400">Unrealized</span>
        <span
          className={
            u.tone === 'pos' ? 'text-emerald-700 dark:text-emerald-400' : u.tone === 'neg' ? 'text-rose-700 dark:text-rose-400' : 'text-stone-800 dark:text-stone-100'
          }
        >
          {u.text}
        </span>
        <span className="sr-only">{u.tone === 'pos' ? 'profit' : u.tone === 'neg' ? 'loss' : 'unchanged'}</span>
      </span>
      <span className="ml-auto text-stone-400">
        {status ? `calc ${fxPlain(status)}` : ''}
        {lastHydratedAt ? ` · ${new Date(lastHydratedAt).toLocaleTimeString()}` : ''}
      </span>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="mr-1 text-stone-400">{k}</span>
      <span className="text-stone-800 dark:text-stone-100">{v}</span>
    </span>
  );
}
