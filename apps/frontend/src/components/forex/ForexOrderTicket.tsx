'use client';

import { useMemo, useState } from 'react';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexBearer } from '@/lib/forex/api/auth-token';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { executablePrice, isQuoteStale } from '@/lib/forex/models/quotes';
import type { ForexOrderType, ForexSide } from '@/lib/forex/models/types';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';

export function ForexOrderTicket() {
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const inst = useForexStore((s) => s.instruments[selected]);
  const quote = useForexStore((s) => s.quotes[selected]);
  const sessions = useForexStore((s) => s.sessions);
  const risk = useForexStore((s) => s.riskStatus);
  const config = useForexStore((s) => s.tradingConfig);
  const busy = useForexStore((s) => s.ticketBusy);
  const last = useForexStore((s) => s.ticketLastOrder);
  const lastError = useForexStore((s) => s.lastError);

  const [side, setSide] = useState<ForexSide>('buy');
  const [type, setType] = useState<ForexOrderType>('market');
  const [volume, setVolume] = useState(inst?.minVolume ?? '0.01');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');

  const allowedTypes = config?.orderTypes ?? ['market', 'limit', 'stop'];
  const stale = !quote || isQuoteStale(quote);
  const sessionOpen = sessions?.eligibility.open === true;
  const digits = inst?.digits ?? 5;
  const exec = executablePrice(side, quote);
  const dealing = risk?.dealing;
  const newOrders =
    dealing?.account.newOrderEnabled !== false &&
    dealing?.symbol.newOrderEnabled !== false &&
    dealing?.symbol.enabled !== false;
  const sideEnabled = side === 'buy' ? dealing?.symbol.buyEnabled !== false : dealing?.symbol.sellEnabled !== false;
  const authed = hasForexBearer();

  const blockReason = useMemo(() => {
    if (!authed) return 'Sign in with a user JWT to place Forex orders.';
    if (!sessionOpen) return `Market closed (${sessions?.eligibility.reason ?? 'SESSION'}).`;
    if (stale) return quote ? `Quote is ${quote.freshness}/${quote.quality}/${quote.status}. Live execution disabled.` : 'No quote from backend.';
    if (risk?.state === 'HALTED') return `Account halted (${risk.reason ?? 'FOREX_HALTED'}).`;
    if (risk?.state === 'RESTRICTED' || risk?.state === 'LIQUIDATION_ONLY') {
      return `Risk ${risk.state}${risk.reason ? `: ${risk.reason}` : ''}. New risk-increasing orders are restricted.`;
    }
    if (!newOrders) return 'Dealing desk has disabled new orders.';
    if (!sideEnabled) return `${side.toUpperCase()} is disabled for this symbol.`;
    if ((type === 'limit' || type === 'stop') && !price.trim()) return 'Limit and stop orders require requestedPrice.';
    return null;
  }, [authed, sessionOpen, sessions?.eligibility.reason, stale, quote, risk, newOrders, sideEnabled, side, type, price]);

  async function submit() {
    if (blockReason || busy) return;
    const store = useForexStore.getState();
    store.setTicketBusy(true);
    store.setLastError(null);
    const clientOrderId = `fx-${crypto.randomUUID()}`;
    const body = {
      clientOrderId,
      symbol: selected,
      side,
      orderType: type,
      volume,
      ...(type !== 'market' && price.trim() ? { requestedPrice: price.trim() } : {}),
    };
    const res = await forexApi.placeOrder(body);
    const u = unwrap(res);
    store.setTicketBusy(false);
    if (!u.ok) {
      store.setLastError(u.error);
      return;
    }
    store.setTicketLastOrder(u.data.order);
    store.applyPrivateHydrate({ orders: [u.data.order, ...Object.values(store.orders)] });
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-stone-200 bg-white dark:border-stone-800 dark:bg-[#101214]" aria-label="Order ticket">
      <div className="flex h-8 items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
        Order ticket
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-2">
        <div className="grid grid-cols-2 gap-1">
          {(['buy', 'sell'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                'h-8 rounded font-mono text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
                s === 'buy' && side === 'buy' && 'bg-emerald-700 text-white',
                s === 'sell' && side === 'sell' && 'bg-rose-700 text-white',
                side !== s && 'bg-stone-100 text-stone-600 dark:bg-stone-800'
              )}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {allowedTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'h-7 flex-1 rounded border text-[11px] capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
                type === t ? 'border-stone-800 bg-stone-800 text-white dark:border-stone-200 dark:bg-stone-200 dark:text-stone-900' : 'border-stone-200 dark:border-stone-700'
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Field label="Size (lots)" value={volume} onChange={setVolume} hint={inst ? `${inst.minVolume}–${inst.maxVolume} step ${inst.volumeStep}` : undefined} />
        {type !== 'market' ? (
          <Field label="Requested price" value={price} onChange={setPrice} />
        ) : null}
        <Field label="Stop loss (not sent with order)" value={sl} onChange={setSl} hint="SL/TP attach after a position exists via POST /protections." />
        <Field label="Take profit (not sent with order)" value={tp} onChange={setTp} />

        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
          <dt>Bid</dt><dd className="text-right text-emerald-700 dark:text-emerald-400">{quote ? fxNum(quote.bid, digits) : '—'}</dd>
          <dt>Ask</dt><dd className="text-right text-rose-700 dark:text-rose-400">{quote ? fxNum(quote.ask, digits) : '—'}</dd>
          <dt>Spread</dt><dd className="text-right">{quote?.spreadPips ?? '—'}</dd>
          <dt>Executable</dt><dd className="text-right">{exec ? fxNum(exec, digits) : '—'}</dd>
          <dt>Session</dt><dd className="text-right">{sessionOpen ? 'OPEN' : sessions?.eligibility.reason ?? '—'}</dd>
          <dt>Quote</dt><dd className="text-right">{quote ? `${quote.freshness}/${quote.status}` : '—'}</dd>
          <dt>Risk</dt><dd className="text-right">{risk?.state ?? '—'}</dd>
        </dl>
        <p className="text-[10px] leading-relaxed text-stone-400">
          Required margin, projected free margin, and dollar risk are not shown — no trade-preview endpoint exists.
          Buy uses ASK, sell uses BID from the backend quote. Mid is not used for execution.
        </p>
        {blockReason ? (
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" role="status">
            {blockReason}
          </p>
        ) : null}
        {lastError ? (
          <p className="rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            {describeForexError(normalizeForexError(lastError))}
          </p>
        ) : null}
        {last ? (
          <p className="font-mono text-[11px] text-stone-600 dark:text-stone-300" role="status">
            Last order {last.orderId.slice(0, 8)}… {last.status}
            {last.failureReason ? ` · ${last.failureReason}` : ''}
          </p>
        ) : null}
      </div>
      <div className="border-t border-stone-200 p-2 dark:border-stone-800">
        <button
          type="button"
          disabled={Boolean(blockReason) || busy}
          onClick={() => void submit()}
          className={cn(
            'h-9 w-full rounded font-mono text-[12px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-50',
            side === 'buy' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
          )}
        >
          {busy ? 'Submitting…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${inst?.displaySymbol ?? selected}`}
        </button>
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="mb-0.5 block text-[10px] uppercase tracking-wide text-stone-500">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded border border-stone-200 bg-white px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-700 dark:bg-[#0e1012]"
      />
      {hint ? <p className="mt-0.5 text-[10px] text-stone-400">{hint}</p> : null}
    </div>
  );
}
