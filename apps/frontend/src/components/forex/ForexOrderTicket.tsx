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
import { ForexRiskTools } from './ForexRiskTools';
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

  async function submit() {
    if (blockReason || busy) return;
    await engine.place({
      symbol: selected,
      side,
      orderType: type,
      volume,
      requestedPrice: type !== 'market' ? price.trim() : undefined,
      stopLoss: sl.trim() || undefined,
      takeProfit: tp.trim() || undefined,
    });
  }

  const last = engine.lastOrder ?? storeLast;
  const lastError = engine.error ?? storeError;

  return (
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-l border-border bg-card" aria-label="Order ticket">
      <div className="flex h-7 items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">New Order</span>
        <span className="font-mono text-[11px] font-medium">{inst?.displaySymbol ?? selected}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 border-b border-border bg-muted/20 px-2 py-1 font-mono text-[11px]">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Bid</p>
          <p className="eda-quote font-medium text-buy">{quote ? fxNum(quote.bid, digits) : '—'}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Ask</p>
          <p className="eda-quote font-medium text-sell">{quote ? fxNum(quote.ask, digits) : '—'}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Spread</p>
          <p className="font-medium text-foreground">{quote?.spreadPips ?? '—'}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
        <div className="grid grid-cols-2 gap-1">
          {(['buy', 'sell'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                'h-8 rounded font-mono text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                s === 'buy' && side === 'buy' && 'bg-buy text-white',
                s === 'sell' && side === 'sell' && 'bg-sell text-white',
                side !== s && 'bg-muted text-muted-foreground hover:text-foreground'
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
                'h-7 flex-1 rounded-md border text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                type === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="rounded border border-border/70 bg-muted/15 px-2 py-1 text-[10px] text-muted-foreground">
          Stop Limit unavailable — backend supports Market / Limit / Stop only · SIMULATED / MOCK
          {pendingLabel ? ` · ${pendingLabel}` : ''}
        </p>
        <Field label="Volume (lots)" value={volume} onChange={setVolume} hint={inst ? `${inst.minVolume}–${inst.maxVolume} · step ${inst.volumeStep}` : undefined} />
        {type !== 'market' ? (
          <Field
            label={type === 'stop' ? 'Trigger price' : 'Limit price'}
            value={price}
            onChange={setPrice}
            hint={type === 'stop' ? 'Stop becomes active when market reaches this price.' : 'Limit rests until price is available.'}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Stop loss" value={sl} onChange={setSl} />
          <Field label="Take profit" value={tp} onChange={setTp} />
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          SL/TP attach via protections after fill when a position exists. Pending: set from Positions after fill.
        </p>
        <ForexRiskTools />

        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/20 px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
          <dt>Balance</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? 'Loading' : account ? fxNum(account.ledgerBalance, 2) : '—'}
          </dd>
          <dt>Equity</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? 'Loading' : account ? fxNum(account.equity, 2) : '—'}
          </dd>
          <dt>Free margin</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? 'Loading' : account ? fxNum(account.freeMargin, 2) : '—'}
          </dd>
          <dt>Used margin</dt>
          <dd className="text-right text-foreground">
            {account ? fxNum(account.usedMargin, 2) : '—'}
          </dd>
          <dt>Executable</dt>
          <dd className="text-right text-foreground">{exec ? fxNum(exec, digits) : '—'}</dd>
          <dt>Mode</dt>
          <dd className="text-right text-foreground">NETTING · MOCK</dd>
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
              {authed ? 'Enter volume to preview margin.' : 'Sign in to preview and execute.'}
            </p>
          ) : null}
          {preview.status === 'ERROR' && preview.error ? (
            <p className="text-[11px] text-sell" role="alert">
              {preview.error.code}: {preview.error.message}
            </p>
          ) : null}
          {previewData && (preview.status === 'READY' || preview.status === 'BLOCKED' || preview.status === 'STALE') ? (
            <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
              {previewData.referencePrice ? (
                <>
                  <dt>Ref {previewData.referenceSide}</dt>
                  <dd className="text-right">{fxNum(previewData.referencePrice, digits)}</dd>
                </>
              ) : null}
              {previewData.estimatedFee != null ? (
                <>
                  <dt>Est. fee</dt>
                  <dd className="text-right">{previewData.estimatedFee}</dd>
                </>
              ) : null}
              {previewData.requiredMargin != null ? (
                <>
                  <dt>Est. margin</dt>
                  <dd className="text-right">{previewData.requiredMargin}</dd>
                </>
              ) : null}
              {previewData.projectedFreeMargin != null ? (
                <>
                  <dt>Free after</dt>
                  <dd className="text-right">{previewData.projectedFreeMargin}</dd>
                </>
              ) : null}
              {previewData.projectedMarginLevel != null ? (
                <>
                  <dt>Margin lvl</dt>
                  <dd className="text-right">{previewData.projectedMarginLevel}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {preview.status === 'BLOCKED' && previewData?.reason ? (
            <p className="mt-1 text-[11px] text-amber-900 dark:text-amber-200" role="status">
              {previewData.reason} — not allowed. Submit still revalidates.
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
          <p className="font-mono text-[11px] text-muted-foreground" role="status">
            Last {last.orderId.slice(0, 8)}… {last.status}
            {last.failureReason ? ` · ${last.failureReason}` : ''}
          </p>
        ) : null}
        {engine.lastNote ? (
          <p className="text-[10px] text-muted-foreground" role="status">
            {engine.lastNote}
          </p>
        ) : null}
      </div>
      <div className="border-t border-border p-2.5">
        <button
          type="button"
          disabled={Boolean(blockReason) || busy || preview.status === 'STALE' || preview.status === 'BLOCKED' || preview.status === 'LOADING'}
          onClick={() => void submit()}
          className={cn(
            'h-10 w-full rounded-md font-mono text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            side === 'buy' ? 'bg-buy hover:bg-buy/90' : 'bg-sell hover:bg-sell/90'
          )}
        >
          {busy
            ? 'Submitting…'
            : type === 'market'
              ? `${side === 'buy' ? 'Buy' : 'Sell'} ${inst?.displaySymbol ?? selected}`
              : `Place ${pendingLabel}`}
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
