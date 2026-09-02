'use client';

import { useEffect, useMemo, useState } from 'react';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { isPreviewParamComplete } from '@/lib/forex/models/preview';
import { executablePrice, isQuoteStale } from '@/lib/forex/models/quotes';
import type { ForexOrderType, ForexSide } from '@/lib/forex/models/types';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexPreview } from '@/lib/forex/runtime/useForexPreview';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';

const TYPE_LABEL: Record<ForexOrderType, string> = {
  market: 'Market',
  limit: 'Limit',
  stop: 'Stop',
};

export function ForexOrderTicket() {
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const ticketDraft = useForexWorkspaceStore((s) => s.ticketDraft);
  const inst = useForexStore((s) => s.instruments[selected]);
  const quote = useForexStore((s) => s.quotes[selected]);
  const sessions = useForexStore((s) => s.sessions);
  const risk = useForexStore((s) => s.riskStatus);
  const config = useForexStore((s) => s.tradingConfig);
  const storeBusy = useForexStore((s) => s.ticketBusy);
  const storeLast = useForexStore((s) => s.ticketLastOrder);
  const storeError = useForexStore((s) => s.lastError);
  const account = useForexStore((s) => s.account);
  const hydratePhase = useForexStore((s) => s.hydratePhase);

  const engine = useForexOrderEngine();
  const [side, setSide] = useState<ForexSide>('buy');
  const [type, setType] = useState<ForexOrderType>('market');
  const [volume, setVolume] = useState(inst?.minVolume ?? '0.01');
  const [price, setPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!ticketDraft) return;
    if (ticketDraft.side) setSide(ticketDraft.side);
    if (ticketDraft.orderType) setType(ticketDraft.orderType);
    if (ticketDraft.price) {
      setPrice(ticketDraft.price);
      setType((cur) => ticketDraft.orderType ?? (cur === 'market' ? 'limit' : cur));
    }
    if (ticketDraft.sl) setSl(ticketDraft.sl);
    if (ticketDraft.tp) setTp(ticketDraft.tp);
    if (ticketDraft.volume) setVolume(ticketDraft.volume);
  }, [ticketDraft]);

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
  const busy = storeBusy || engine.busy;
  const previewReq = {
    symbol: selected,
    side,
    orderType: type,
    volume,
    ...(type !== 'market' && price.trim() ? { requestedPrice: price.trim() } : {}),
  };
  const preview = useForexPreview(authed && isPreviewParamComplete(previewReq) ? previewReq : null, refreshNonce);
  const previewData = preview.data;

  const pendingLabel = useMemo(() => {
    if (type === 'market') return null;
    if (type === 'limit') return side === 'buy' ? 'Buy Limit' : 'Sell Limit';
    return side === 'buy' ? 'Buy Stop' : 'Sell Stop';
  }, [type, side]);

  const blockReason = useMemo(() => {
    if (!authed) return 'Sign in to place Forex orders.';
    if (!sessionOpen) return `Market closed${sessions?.eligibility.reason ? ` · ${sessions.eligibility.reason}` : ''}.`;
    if (stale) return quote ? 'Quote is stale. Execution paused until feed recovers.' : 'Quote unavailable.';
    if (risk?.state === 'HALTED') return `Account halted${risk.reason ? ` · ${risk.reason}` : ''}.`;
    if (risk?.state === 'RESTRICTED' || risk?.state === 'LIQUIDATION_ONLY') {
      return `Risk ${risk.state}${risk.reason ? ` · ${risk.reason}` : ''}. New risk-increasing orders restricted.`;
    }
    if (!newOrders) return 'New orders are currently disabled.';
    if (!sideEnabled) return `${side.toUpperCase()} is disabled for this symbol.`;
    if ((type === 'limit' || type === 'stop') && !price.trim()) return 'Limit and stop orders require a trigger/entry price.';
    return null;
  }, [authed, sessionOpen, sessions?.eligibility.reason, stale, quote, risk, newOrders, sideEnabled, side, type, price]);

  const baseBlocked =
    !authed ||
    !sessionOpen ||
    stale ||
    risk?.state === 'HALTED' ||
    risk?.state === 'RESTRICTED' ||
    risk?.state === 'LIQUIDATION_ONLY' ||
    !newOrders ||
    ((type === 'limit' || type === 'stop') && !price.trim()) ||
    busy ||
    preview.status === 'STALE' ||
    preview.status === 'BLOCKED' ||
    preview.status === 'LOADING';

  async function submit(useSide: ForexSide) {
    setSide(useSide);
    if (baseBlocked) return;
    const sideOk = useSide === 'buy' ? dealing?.symbol.buyEnabled !== false : dealing?.symbol.sellEnabled !== false;
    if (!sideOk) return;
    await engine.place({
      symbol: selected,
      side: useSide,
      orderType: type,
      volume,
      requestedPrice: type !== 'market' ? price.trim() : undefined,
      stopLoss: sl.trim() || undefined,
      takeProfit: tp.trim() || undefined,
    });
  }

  const last = engine.lastOrder ?? storeLast;
  const lastError = engine.error ?? storeError;
  const canBuy = !baseBlocked && dealing?.symbol.buyEnabled !== false;
  const canSell = !baseBlocked && dealing?.symbol.sellEnabled !== false;

  return (
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-l border-border bg-card" aria-label="Order ticket">
      <div className="flex h-6 items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">New Order</span>
        <span className="font-mono text-[11px] font-semibold">{inst?.displaySymbol ?? selected}</span>
      </div>

      <div className="grid grid-cols-3 border-b border-border font-mono text-[11px]">
        <div className="border-r border-border px-2 py-1">
          <p className="text-[9px] text-muted-foreground">Bid</p>
          <p className="eda-quote font-semibold text-buy">{quote ? fxNum(quote.bid, digits) : '—'}</p>
        </div>
        <div className="border-r border-border px-2 py-1">
          <p className="text-[9px] text-muted-foreground">Ask</p>
          <p className="eda-quote font-semibold text-sell">{quote ? fxNum(quote.ask, digits) : '—'}</p>
        </div>
        <div className="px-2 py-1">
          <p className="text-[9px] text-muted-foreground">Spr</p>
          <p className="font-semibold">{quote?.spreadPips ?? '—'}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto px-2 py-1.5">
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14 shrink-0 uppercase">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ForexOrderType)}
            className="fx-mt5-field h-7 flex-1 px-1.5 text-[11px]"
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[9px] leading-snug text-muted-foreground">
          Stop Limit unavailable · Time in Force unavailable · SIMULATED / MOCK
          {pendingLabel ? ` · ${pendingLabel}` : ''}
        </p>

        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14 shrink-0 uppercase">Volume</span>
          <input
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="fx-mt5-field h-7 flex-1 px-1.5 text-[12px]"
            aria-label="Volume lots"
          />
        </label>
        {inst ? (
          <p className="pl-16 text-[9px] text-muted-foreground">
            {inst.minVolume}–{inst.maxVolume} · step {inst.volumeStep}
          </p>
        ) : null}

        {type !== 'market' ? (
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="w-14 shrink-0 uppercase">{type === 'stop' ? 'Trigger' : 'Price'}</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="fx-mt5-field h-7 flex-1 px-1.5 text-[12px]"
              aria-label={type === 'stop' ? 'Trigger price' : 'Limit price'}
            />
          </label>
        ) : null}

        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[10px] text-muted-foreground">
            <span className="mb-0.5 block uppercase">Stop Loss</span>
            <input value={sl} onChange={(e) => setSl(e.target.value)} className="fx-mt5-field h-7 w-full px-1.5 text-[12px]" />
          </label>
          <label className="text-[10px] text-muted-foreground">
            <span className="mb-0.5 block uppercase">Take Profit</span>
            <input value={tp} onChange={(e) => setTp(e.target.value)} className="fx-mt5-field h-7 w-full px-1.5 text-[12px]" />
          </label>
        </div>
        <p className="text-[9px] leading-snug text-muted-foreground">SL/TP attach after fill via protections.</p>

        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
          <dt>Balance</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? '…' : account ? fxNum(account.ledgerBalance, 2) : '—'}
          </dd>
          <dt>Free</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? '…' : account ? fxNum(account.freeMargin, 2) : '—'}
          </dd>
          <dt>Exec {side === 'buy' ? 'ASK' : 'BID'}</dt>
          <dd className="text-right text-foreground">{exec ? fxNum(exec, digits) : '—'}</dd>
          <dt>Ref {previewData?.referenceSide ?? ''}</dt>
          <dd className="text-right text-foreground">
            {previewData?.referencePrice ? fxNum(previewData.referencePrice, digits) : '—'}
          </dd>
          <dt>Spread</dt>
          <dd className="text-right text-foreground">{previewData?.spreadPips ?? quote?.spreadPips ?? '—'}</dd>
          <dt>Margin</dt>
          <dd className="text-right text-foreground">{previewData?.requiredMargin ?? '—'}</dd>
          <dt>Fee</dt>
          <dd className="text-right text-foreground">{previewData?.estimatedFee ?? '0'}</dd>
          <dt>Preview</dt>
          <dd className="text-right">
            <button type="button" className="text-primary hover:underline" onClick={() => setRefreshNonce((n) => n + 1)}>
              {preview.status}
              {previewData ? (previewData.allowed ? ' · OK' : ' · BLOCKED') : ''}
            </button>
          </dd>
        </dl>
        {previewData && !previewData.allowed && previewData.reason ? (
          <p className="border border-rose-900/60 bg-rose-950/30 px-1.5 py-1 text-[10px] text-rose-200" role="status">
            Preview rejected · {previewData.reason}
          </p>
        ) : null}

        {blockReason ? (
          <p className="border border-amber-800/60 bg-amber-950/30 px-1.5 py-1 text-[10px] text-amber-200" role="status">
            {blockReason}
          </p>
        ) : null}
        {lastError ? (
          <p className="border border-rose-900/60 bg-rose-950/30 px-1.5 py-1 text-[10px] text-rose-200" role="alert">
            {describeForexError(normalizeForexError(lastError))}
          </p>
        ) : null}
        {last ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            Last {last.orderId.slice(0, 8)}… {last.status}
          </p>
        ) : null}
        {engine.lastNote ? <p className="text-[9px] text-muted-foreground">{engine.lastNote}</p> : null}
      </div>

      {/* MT5-style twin execution buttons — not a crypto CTA pill */}
      <div className="grid grid-cols-2 gap-1 border-t border-border p-1.5">
        <button
          type="button"
          disabled={!canSell}
          onClick={() => void submit('sell')}
          className="fx-mt5-sell h-9 font-mono text-[12px] font-bold disabled:cursor-not-allowed"
        >
          {busy && side === 'sell' ? '…' : 'SELL'}
          <span className="mt-0.5 block text-[10px] font-medium opacity-90">
            {quote ? fxNum(quote.bid, digits) : '—'}
          </span>
        </button>
        <button
          type="button"
          disabled={!canBuy}
          onClick={() => void submit('buy')}
          className="fx-mt5-buy h-9 font-mono text-[12px] font-bold disabled:cursor-not-allowed"
        >
          {busy && side === 'buy' ? '…' : 'BUY'}
          <span className="mt-0.5 block text-[10px] font-medium opacity-90">
            {quote ? fxNum(quote.ask, digits) : '—'}
          </span>
        </button>
      </div>
    </aside>
  );
}
