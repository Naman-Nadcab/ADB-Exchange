'use client';

import { useMemo, useState } from 'react';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { isPreviewParamComplete } from '@/lib/forex/models/preview';
import { executablePrice, isQuoteStale } from '@/lib/forex/models/quotes';
import type { ForexOrderType, ForexSide } from '@/lib/forex/models/types';
import { useForexPreview } from '@/lib/forex/runtime/useForexPreview';
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
  const account = useForexStore((s) => s.account);
  const hydratePhase = useForexStore((s) => s.hydratePhase);

  const [side, setSide] = useState<ForexSide>('buy');
  const [type, setType] = useState<ForexOrderType>('market');
  const [volume, setVolume] = useState(inst?.minVolume ?? '0.01');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

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
  const authed = hasForexPrivateSession();
  const previewReq = {
    symbol: selected,
    side,
    orderType: type,
    volume,
    ...(type !== 'market' && price.trim() ? { requestedPrice: price.trim() } : {}),
  };
  const preview = useForexPreview(authed && isPreviewParamComplete(previewReq) ? previewReq : null, refreshNonce);
  const previewData = preview.data;

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
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-l border-border bg-card" aria-label="Order ticket">
      <div className="flex h-8 items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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
                'h-8 rounded font-mono text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                s === 'buy' && side === 'buy' && 'bg-buy text-white',
                s === 'sell' && side === 'sell' && 'bg-sell text-white',
                side !== s && 'bg-muted text-muted-foreground'
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
                'h-7 flex-1 rounded border text-[11px] capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                type === t ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'
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
        <Field label="Stop loss" value={sl} onChange={setSl} hint="Attached after a fill via backend protections. Not sent with the order." />
        <Field label="Take profit" value={tp} onChange={setTp} />

        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <dt>Balance</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? 'Loading' : account ? fxNum(account.ledgerBalance, 2) : 'Unavailable'}
          </dd>
          <dt>Equity</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? 'Loading' : account ? fxNum(account.equity, 2) : 'Unavailable'}
          </dd>
          <dt>Free margin</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? 'Loading' : account ? fxNum(account.freeMargin, 2) : 'Unavailable'}
          </dd>
          <dt>Bid</dt><dd className="text-right text-buy">{quote ? fxNum(quote.bid, digits) : '—'}</dd>
          <dt>Ask</dt><dd className="text-right text-sell">{quote ? fxNum(quote.ask, digits) : '—'}</dd>
          <dt>Spread</dt><dd className="text-right">{quote?.spreadPips ?? '—'}</dd>
          <dt>Executable</dt><dd className="text-right">{exec ? fxNum(exec, digits) : '—'}</dd>
          <dt>Session</dt><dd className="text-right">{sessionOpen ? 'OPEN' : sessions?.eligibility.reason ?? '—'}</dd>
          <dt>Quote</dt><dd className="text-right">{quote ? `${quote.freshness}/${quote.status}` : '—'}</dd>
          <dt>Risk</dt><dd className="text-right">{risk?.state ?? '—'}</dd>
        </dl>
        <div className="rounded border border-border p-2" aria-live="polite">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Preview · {preview.status}</span>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Refresh
            </button>
          </div>
          {preview.status === 'LOADING' ? <p className="text-[11px] text-muted-foreground">Loading preview…</p> : null}
          {preview.status === 'IDLE' ? (
            <p className="text-[11px] text-muted-foreground">
              {authed ? 'Enter a valid size to request an authoritative preview.' : 'Sign in to request a backend trade preview.'}
            </p>
          ) : null}
          {preview.status === 'ERROR' && preview.error ? (
            <p className="text-[11px] text-sell" role="alert">
              {preview.error.code}: {preview.error.message}
            </p>
          ) : null}
          {preview.status === 'STALE' ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200">Preview is stale. Refresh before submitting.</p>
          ) : null}
          {previewData && (preview.status === 'READY' || preview.status === 'BLOCKED' || preview.status === 'STALE') ? (
            <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
              {previewData.referencePrice ? (
                <>
                  <dt>Reference {previewData.referenceSide}</dt>
                  <dd className="text-right">{fxNum(previewData.referencePrice, digits)}</dd>
                </>
              ) : null}
              {previewData.estimatedFee != null ? (
                <>
                  <dt>Estimated fee</dt>
                  <dd className="text-right">{previewData.estimatedFee}{previewData.feeCurrency ? ` ${previewData.feeCurrency}` : ''}</dd>
                </>
              ) : null}
              {previewData.requiredMargin != null ? (
                <>
                  <dt>Required margin</dt>
                  <dd className="text-right">{previewData.requiredMargin}</dd>
                </>
              ) : null}
              {previewData.freeMargin != null ? (
                <>
                  <dt>Free margin</dt>
                  <dd className="text-right">{previewData.freeMargin}</dd>
                </>
              ) : null}
              {previewData.projectedFreeMargin != null ? (
                <>
                  <dt>Free margin after</dt>
                  <dd className="text-right">{previewData.projectedFreeMargin}</dd>
                </>
              ) : null}
              {previewData.projectedMarginLevel != null ? (
                <>
                  <dt>Margin level</dt>
                  <dd className="text-right">{previewData.projectedMarginLevel}</dd>
                </>
              ) : null}
              {previewData.spreadPips != null ? (
                <>
                  <dt>Spread (pips)</dt>
                  <dd className="text-right">{previewData.spreadPips}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {preview.status === 'BLOCKED' && previewData?.reason ? (
            <p className="mt-1 text-[11px] text-amber-900 dark:text-amber-200" role="status">
              {previewData.reason}: order is not currently allowed. Preview is indicative — submission still revalidates.
            </p>
          ) : null}
          {preview.status === 'READY' ? (
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Indicative only. Quotes, margin, and risk can change before POST /orders. Buy uses ASK, sell uses BID.
            </p>
          ) : null}
        </div>
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
      <div className="border-t border-border p-2">
        <button
          type="button"
          disabled={Boolean(blockReason) || busy || preview.status === 'STALE' || preview.status === 'BLOCKED' || preview.status === 'LOADING'}
          onClick={() => void submit()}
          className={cn(
            'h-9 w-full rounded font-mono text-[12px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            side === 'buy' ? 'bg-buy hover:bg-buy/90' : 'bg-sell hover:bg-sell/90'
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
      <label htmlFor={id} className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
