'use client';

import { hasForexBearer } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { fxNum, fxPlain } from './format';

export function ForexAccountBar() {
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const margin = useForexStore((s) => s.margin);
  const pnl = useForexStore((s) => s.pnl);
  const authed = hasForexBearer();

  if (!authed) {
    return (
      <div className="flex h-8 items-center gap-4 overflow-x-auto border-t border-stone-200 bg-white px-3 font-mono text-[11px] text-stone-500 dark:border-stone-800 dark:bg-[#0e1012]">
        Sign in to load Forex account, margin, and risk from the backend.
      </div>
    );
  }

  const ledger = account?.ledgerBalance ?? balance?.ledgerBalance;
  const equity = account?.equity ?? balance?.equity ?? margin?.equityReference;
  const used = account?.usedMargin ?? margin?.usedMargin;
  const free = account?.freeMargin ?? margin?.freeMargin;
  const avail = account?.availableBalance ?? balance?.availableBalance;
  const level = account?.marginLevel ?? margin?.marginLevel;
  const status = account?.calculationStatus ?? balance?.calculationStatus ?? margin?.calculationStatus;

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-4 overflow-x-auto border-t border-stone-200 bg-white px-3 font-mono text-[11px] dark:border-stone-800 dark:bg-[#0e1012]"
      aria-label="Account bar"
    >
      <Item k="Balance" v={fxNum(ledger, 2)} />
      <Item k="Equity" v={fxNum(equity, 2)} />
      <Item k="Used" v={fxNum(used, 2)} />
      <Item k="Free" v={fxNum(free, 2)} />
      <Item k="Avail" v={fxNum(avail, 2)} />
      <Item k="Level" v={level == null ? '—' : fxNum(level, 2)} />
      <Item k="uPnL" v={fxNum(account?.unrealizedPnl ?? pnl?.unrealized, 2)} />
      <Item k="rPnL" v={fxNum(account?.realizedPnl ?? pnl?.realized, 2)} />
      <span className="ml-auto text-stone-400">{status ? `calc ${fxPlain(status)}` : ''}</span>
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
