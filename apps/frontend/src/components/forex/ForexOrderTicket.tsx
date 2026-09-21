'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForexErrorMessage } from '@/hooks/useForexErrorMessage';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { isPreviewParamComplete } from '@/lib/forex/models/preview';
import { executablePrice, isQuoteStale } from '@/lib/forex/models/quotes';
import { estimateTicketRisk } from '@/lib/forex/models/ticket-risk';
import {
  availableOrderTypes,
  availableTimeInForce,
  coerceTimeInForce,
  isPendingOrderType,
  isTimeInForceAllowed,
  requiresLimitPrice,
  requiresTriggerPrice,
} from '@/lib/forex/models/order-type-tif';
import {
  describeCustomerOrderLabel,
  labelForexOrderType,
  labelForexTimeInForce,
  orderKindHelpLabel,
  timeInForceBlockedReasonLabel,
  unavailableTicketFeatureLabels,
} from '@/lib/forex/presentation/order-type-labels';
import type { ForexSide, ForexOrderType, ForexTimeInForce } from '@/lib/forex/models/types';
import { forexApi } from '@/lib/forex/api/client';
import { hydrateForexPrivate } from '@/lib/forex/runtime/hydrate';
import { useForexOrderEngine } from '@/lib/forex/runtime/useForexOrderEngine';
import { useForexPreview } from '@/lib/forex/runtime/useForexPreview';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum } from './format';

export function ForexOrderTicket() {
  const tf = useTranslations('forex');
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
  const [volume, setVolume] = useState('0.10');
  const [price, setPrice] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState<ForexTimeInForce>('GTC');
  const [expireAt, setExpireAt] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoNote, setDemoNote] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketDraft) return;
    if (ticketDraft.side) setSide(ticketDraft.side);
    if (ticketDraft.orderType) setType(ticketDraft.orderType);
    if (ticketDraft.price) {
      setPrice(ticketDraft.price);
      setType((cur) => ticketDraft.orderType ?? (cur === 'market' ? 'limit' : cur));
    }
    if (ticketDraft.limitPrice) setLimitPrice(ticketDraft.limitPrice);
    if (ticketDraft.sl) setSl(ticketDraft.sl);
    if (ticketDraft.tp) setTp(ticketDraft.tp);
    if (ticketDraft.volume) setVolume(ticketDraft.volume);
  }, [ticketDraft]);

  useEffect(() => {
    const min = Number(inst?.minVolume ?? 0.01);
    const max = Number(inst?.maxVolume ?? 100);
    const preferred = 0.1;
    setVolume(preferred >= min && preferred <= max ? '0.10' : inst?.minVolume ?? '0.01');
    setPrice('');
    setLimitPrice('');
  }, [selected, inst?.minVolume, inst?.maxVolume]);

  const allowedTypes = useMemo(() => availableOrderTypes(config), [config]);
  const tifOptions = useMemo(() => availableTimeInForce(config), [config]);
  const tifUnsupported = tifOptions.length <= 1;
  const missingFeatures = useMemo(() => unavailableTicketFeatureLabels(tf, config), [config, tf]);

  // A type change can invalidate the selected TIF — never submit a combination
  // the server is guaranteed to reject.
  useEffect(() => {
    setTif((cur) => coerceTimeInForce(type, cur, tifOptions));
  }, [type, tifOptions]);

  useEffect(() => {
    if (!requiresLimitPrice(type)) setLimitPrice('');
  }, [type]);

  useEffect(() => {
    setType((cur) => (allowedTypes.includes(cur) ? cur : allowedTypes[0] ?? 'market'));
  }, [allowedTypes]);

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
  const authed = useForexPrivateSession();
  const busy = storeBusy || engine.busy;
  const previewReq = {
    symbol: selected,
    side,
    orderType: type,
    volume,
    ...(requiresTriggerPrice(type) && price.trim() ? { requestedPrice: price.trim() } : {}),
    ...(requiresLimitPrice(type) && limitPrice.trim() ? { limitPrice: limitPrice.trim() } : {}),
    ...(tifUnsupported ? {} : { timeInForce: tif }),
    ...(tif === 'GTD' && expireAt ? { expireAt: new Date(expireAt).toISOString() } : {}),
  };
  const preview = useForexPreview(authed && isPreviewParamComplete(previewReq) ? previewReq : null, refreshNonce);
  const previewData = preview.data;
  const ticketRisk = useMemo(
    () =>
      estimateTicketRisk({
        instrument: inst,
        side,
        // stop_limit fills at its limit, so that is the honest entry estimate.
        entry: !isPendingOrderType(type)
          ? exec
          : (requiresLimitPrice(type) ? limitPrice.trim() : price.trim()) || exec,
        sl,
        tp,
        volume,
      }),
    [inst, side, type, exec, price, limitPrice, sl, tp, volume]
  );

  const orderActionLabel = useMemo(() => describeCustomerOrderLabel(tf, side, type), [side, type, tf]);
  const kindHelp = useMemo(() => orderKindHelpLabel(tf, type, side), [type, side, tf]);
  const positionMode = account?.positionMode ?? 'NETTING';

  const tifNote = timeInForceBlockedReasonLabel(tf, type, tif);

  const blockReason = useMemo(() => {
    const tail = (r?: string | null) => (r ? ` · ${r}` : '');
    if (!authed) return tf('ticket.blocks.signIn');
    if (!sessionOpen) return tf('ticket.blocks.marketClosed', { reason: tail(sessions?.eligibility.reason) });
    if (stale) return quote ? tf('ticket.blocks.quoteStale') : tf('ticket.blocks.quoteUnavailable');
    if (risk?.state === 'HALTED') return tf('ticket.blocks.accountHalted', { reason: tail(risk.reason) });
    if (risk?.state === 'RESTRICTED' || risk?.state === 'LIQUIDATION_ONLY') {
      return tf('ticket.blocks.riskRestricted', { state: risk.state, reason: tail(risk.reason) });
    }
    if (!newOrders) return tf('ticket.blocks.newOrdersDisabled');
    if (!sideEnabled) return tf('ticket.blocks.sideDisabled', { side: side === 'buy' ? tf('ticket.buy') : tf('ticket.sell') });
    if (requiresTriggerPrice(type) && !price.trim()) {
      return type === 'stop_limit' ? tf('ticket.blocks.stopLimitNeedsStop') : tf('ticket.blocks.needsTriggerPrice');
    }
    if (requiresLimitPrice(type) && !limitPrice.trim()) return tf('ticket.blocks.stopLimitNeedsLimit');
    if (tifNote) return tifNote;
    return null;
  }, [authed, sessionOpen, sessions?.eligibility.reason, stale, quote, risk, newOrders, sideEnabled, side, type, price, limitPrice, tifNote, tf]);

  const previewRejected = preview.status === 'BLOCKED' && previewData?.allowed === false;
  const previewLoadingNoData = preview.status === 'LOADING' && !previewData;
  const baseBlocked =
    !authed ||
    !sessionOpen ||
    stale ||
    risk?.state === 'HALTED' ||
    risk?.state === 'RESTRICTED' ||
    risk?.state === 'LIQUIDATION_ONLY' ||
    !newOrders ||
    (requiresTriggerPrice(type) && !price.trim()) ||
    (requiresLimitPrice(type) && !limitPrice.trim()) ||
    Boolean(tifNote) ||
    busy ||
    previewRejected ||
    previewLoadingNoData;

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
      requestedPrice: requiresTriggerPrice(type) ? price.trim() : undefined,
      limitPrice: requiresLimitPrice(type) ? limitPrice.trim() : undefined,
      timeInForce: tifUnsupported ? undefined : tif,
      expireAt: tif === 'GTD' && expireAt ? new Date(expireAt).toISOString() : undefined,
      stopLoss: sl.trim() || undefined,
      takeProfit: tp.trim() || undefined,
    });
  }

  const last = engine.lastOrder ?? storeLast;
  const lastError = engine.error ?? storeError;
  const lastErrorMsg = useForexErrorMessage(lastError);
  const canBuy = !baseBlocked && dealing?.symbol.buyEnabled !== false;
  const canSell = !baseBlocked && dealing?.symbol.sellEnabled !== false;
  const actionLabel = busy
    ? tf('ticket.executing')
    : preview.status === 'LOADING' && !previewData
      ? tf('ticket.previewing')
      : lastError
        ? tf('ticket.rejected')
        : last?.status === 'FILLED'
          ? tf('ticket.filled')
          : last?.status === 'REJECTED' || last?.status === 'FAILED'
            ? tf('ticket.rejected')
            : last?.status === 'PENDING' || last?.status === 'ACCEPTED'
              ? last.status
              : null;

  async function moveMockToTrigger() {
    const px = price.trim();
    if (!px || demoBusy) return;
    setDemoBusy(true);
    setDemoNote(null);
    try {
      const res = await forexApi.applyDemoPrice({ symbol: selected, price: px });
      if (!res.success || !res.data?.quote) {
        setDemoNote(describeForexError(normalizeForexError(res.error ?? res)));
        return;
      }
      const q = res.data.quote;
      setDemoNote(
        tf('ticket.demoTickNote', { bid: q.bid, ask: q.ask, spread: q.spread ?? '0' })
      );
      await hydrateForexPrivate();
    } catch (e) {
      setDemoNote(describeForexError(normalizeForexError(e)));
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <aside className="terminal-panel-subtle flex h-full min-h-0 flex-col border-l border-border bg-card" aria-label={tf('ticketPanel.ariaLabel')}>
      <div className="flex h-6 items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tf('ticketPanel.newOrder')}</span>
        <span className="font-mono text-[11px] font-semibold">{inst?.displaySymbol ?? selected}</span>
      </div>
      <div className="flex items-center justify-between border-b border-border px-2 py-0.5 text-[9px] text-muted-foreground">
        <span title={tf('ticketPanel.modeTitle')}>{tf('ticketPanel.modePrefix')} {positionMode}</span>
        <span className="font-medium text-foreground">{orderActionLabel}</span>
      </div>

      <div className="grid grid-cols-3 border-b border-border font-mono text-[11px]">
        <div className="border-r border-border px-2 py-1">
          <p className="text-[9px] text-muted-foreground">{tf('ticketPanel.bid')}</p>
          <p className="eda-quote font-semibold text-buy">{quote ? fxNum(quote.bid, digits) : '—'}</p>
        </div>
        <div className="border-r border-border px-2 py-1">
          <p className="text-[9px] text-muted-foreground">{tf('ticketPanel.ask')}</p>
          <p className="eda-quote font-semibold text-sell">{quote ? fxNum(quote.ask, digits) : '—'}</p>
        </div>
        <div className="px-2 py-1">
          <p className="text-[9px] text-muted-foreground">{tf('ticketPanel.spread')}</p>
          <p className="font-semibold">{quote?.spreadPips ?? '—'}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto px-2 py-1.5">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            aria-pressed={side === 'sell'}
            onClick={() => setSide('sell')}
            className={cn(
              'h-7 rounded border font-mono text-[11px] font-semibold',
              side === 'sell' ? 'border-sell bg-sell/15 text-sell' : 'border-border text-muted-foreground'
            )}
          >
            {tf('ticketPanel.sell')}
          </button>
          <button
            type="button"
            aria-pressed={side === 'buy'}
            onClick={() => setSide('buy')}
            className={cn(
              'h-7 rounded border font-mono text-[11px] font-semibold',
              side === 'buy' ? 'border-buy bg-buy/15 text-buy' : 'border-border text-muted-foreground'
            )}
          >
            {tf('ticketPanel.buy')}
          </button>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14 shrink-0 uppercase">{tf('ticketPanel.kind')}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ForexOrderType)}
            className="fx-mt5-field h-7 flex-1 px-1.5 text-[11px]"
            aria-label={tf('ticketPanel.kindAria')}
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {labelForexOrderType(tf, t)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[9px] leading-snug text-muted-foreground">{kindHelp}</p>

        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14 shrink-0 uppercase">{tf('ticketPanel.tif')}</span>
          <select
            value={tif}
            disabled={tifUnsupported}
            onChange={(e) => setTif(e.target.value as ForexTimeInForce)}
            className="fx-mt5-field h-7 flex-1 px-1.5 text-[11px] disabled:opacity-50"
            aria-label={tf('ticketPanel.tifAria')}
          >
            {tifOptions.map((t) => (
              <option key={t} value={t} disabled={!isTimeInForceAllowed(type, t)}>
                {labelForexTimeInForce(tf, t)}
                {isTimeInForceAllowed(type, t) ? '' : tf('ticketPanel.tifNaSuffix')}
              </option>
            ))}
          </select>
        </label>
        <p className="pl-16 text-[9px] leading-snug text-muted-foreground">
          {tifUnsupported
            ? tf('ticketPanel.tifBackendGtcOnly')
            : isPendingOrderType(type)
              ? tf('ticketPanel.tifPendingHelp')
              : tf('ticketPanel.tifMarketHelp')}
        </p>

        {tif === 'GTD' && isPendingOrderType(type) ? (
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="w-14 shrink-0 uppercase">{tf('ticketPanel.expires')}</span>
            <input
              type="datetime-local"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
              className="fx-mt5-field h-7 flex-1 px-1.5 text-[11px]"
              aria-label={tf('ticketPanel.expiresAria')}
            />
          </label>
        ) : null}

        <p className="text-[9px] leading-snug text-muted-foreground">
          {[...missingFeatures, tf('ticketPanel.simulatedMock')].join(' · ')}
        </p>

        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="w-14 shrink-0 uppercase">{tf('ticketPanel.volume')}</span>
          <input
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="fx-mt5-field h-7 flex-1 px-1.5 text-[12px]"
            aria-label={tf('ticketPanel.volumeAria')}
          />
        </label>
        {inst ? (
          <p className="pl-16 text-[9px] text-muted-foreground">
            {tf('ticketPanel.volumeRange', { min: inst.minVolume, max: inst.maxVolume, step: inst.volumeStep })}
          </p>
        ) : null}

        {requiresTriggerPrice(type) ? (
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="w-14 shrink-0 uppercase">
              {type === 'limit' ? tf('ticketPanel.price') : type === 'stop_limit' ? tf('ticketPanel.stop') : tf('ticketPanel.trigger')}
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="fx-mt5-field h-7 flex-1 px-1.5 text-[12px]"
              aria-label={
                type === 'limit'
                  ? tf('ticketPanel.limitPriceAria')
                  : type === 'stop_limit'
                    ? tf('ticketPanel.stopPriceAria')
                    : tf('ticketPanel.triggerPriceAria')
              }
            />
          </label>
        ) : null}

        {requiresLimitPrice(type) ? (
          <>
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="w-14 shrink-0 uppercase">{tf('ticketPanel.limit')}</span>
              <input
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="fx-mt5-field h-7 flex-1 px-1.5 text-[12px]"
                aria-label={tf('ticketPanel.limitAria')}
              />
            </label>
            <p className="pl-16 text-[9px] leading-snug text-muted-foreground">
              {side === 'buy' ? tf('ticket.stopLimitBuyHint') : tf('ticket.stopLimitSellHint')}{' '}
              {tf('ticketPanel.stopLimitFollowUp')}
            </p>
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[10px] text-muted-foreground" htmlFor="fx-ticket-sl">
            <span className="mb-0.5 block uppercase">{tf('ticketPanel.stopLoss')}</span>
            <input
              id="fx-ticket-sl"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              aria-label={tf('ticketPanel.stopLossAria')}
              className="fx-mt5-field h-7 w-full px-1.5 text-[12px]"
            />
          </label>
          <label className="text-[10px] text-muted-foreground" htmlFor="fx-ticket-tp">
            <span className="mb-0.5 block uppercase">{tf('ticketPanel.takeProfit')}</span>
            <input
              id="fx-ticket-tp"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              aria-label={tf('ticketPanel.takeProfitAria')}
              className="fx-mt5-field h-7 w-full px-1.5 text-[12px]"
            />
          </label>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">{tf('ticketPanel.slTpAttach')}</p>

        <p className="text-[11px] leading-snug text-muted-foreground">{tf('ticketPanel.slTpEstimated')}</p>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
          <dt>{tf('ticketPanel.balance')}</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? '…' : account ? fxNum(account.ledgerBalance, 2) : '—'}
          </dd>
          <dt>{tf('ticketPanel.free')}</dt>
          <dd className="text-right text-foreground">
            {hydratePhase === 'hydrating' && !account ? '…' : account ? fxNum(account.freeMargin, 2) : '—'}
          </dd>
          <dt>{side === 'buy' ? tf('ticketPanel.execAsk') : tf('ticketPanel.execBid')}</dt>
          <dd className="text-right text-foreground">{exec ? fxNum(exec, digits) : '—'}</dd>
          <dt>
            {tf('ticketPanel.ref')} {previewData?.referenceSide ?? ''}
          </dt>
          <dd className="text-right text-foreground">
            {previewData?.referencePrice ? fxNum(previewData.referencePrice, digits) : '—'}
          </dd>
          <dt>{tf('ticketPanel.spreadLabel')}</dt>
          <dd className="text-right text-foreground">{previewData?.spread ?? quote?.spread ?? previewData?.spreadPips ?? quote?.spreadPips ?? '—'}</dd>
          <dt>{tf('ticketPanel.ledger')}</dt>
          <dd className="text-right text-foreground">{previewData?.ledgerBalance ?? account?.ledgerBalance ?? '—'}</dd>
          <dt>{tf('ticket.margin')}</dt>
          <dd className="text-right text-foreground">{previewData?.requiredMargin ?? '—'}</dd>
          <dt>{tf('ticket.fee')}</dt>
          <dd className="text-right text-foreground">{previewData?.estimatedFee ?? '0'}</dd>
          <dt>{tf('ticket.estExposure')}</dt>
          <dd className="text-right text-foreground">
            {ticketRisk.estimatedExposure != null ? fxNum(ticketRisk.estimatedExposure, 0) : '—'}
          </dd>
          <dt>{tf('ticket.estSl')}</dt>
          <dd className="text-right text-foreground">
            {ticketRisk.slDistancePips != null ? `${ticketRisk.slDistancePips.toFixed(1)}p` : '—'}
            {ticketRisk.estimatedRisk != null ? ` · ${fxNum(ticketRisk.estimatedRisk, 2)}` : ''}
          </dd>
          <dt>{tf('ticket.estTp')}</dt>
          <dd className="text-right text-foreground">
            {ticketRisk.tpDistancePips != null ? `${ticketRisk.tpDistancePips.toFixed(1)}p` : '—'}
            {ticketRisk.estimatedReward != null ? ` · ${fxNum(ticketRisk.estimatedReward, 2)}` : ''}
          </dd>
          <dt>{tf('ticket.estRr')}</dt>
          <dd className="text-right text-foreground">
            {ticketRisk.riskReward != null ? ticketRisk.riskReward.toFixed(2) : '—'}
          </dd>
          <dt>{tf('ticket.freeAfter')}</dt>
          <dd className="text-right text-foreground">{previewData?.projectedFreeMargin ?? '—'}</dd>
          <dt>{tf('ticket.preview')}</dt>
          <dd className="text-right">
            <button type="button" className="text-primary hover:underline" onClick={() => setRefreshNonce((n) => n + 1)}>
              {preview.status}
              {previewData ? (previewData.allowed ? tf('ticket.previewOkSuffix') : tf('ticket.previewBlockedSuffix')) : ''}
            </button>
          </dd>
        </dl>
        {requiresTriggerPrice(type) && price.trim() ? (
          <button
            type="button"
            disabled={demoBusy || !authed}
            onClick={() => void moveMockToTrigger()}
            className="w-full border border-border px-1.5 py-1 text-left text-[10px] text-muted-foreground hover:border-primary/40 disabled:opacity-50"
          >
            {demoBusy ? tf('ticket.demoMoving') : tf('ticket.demoMoveButton')}
          </button>
        ) : null}
        {demoNote ? <p className="text-[11px] text-muted-foreground">{demoNote}</p> : null}
        {previewData && !previewData.allowed && previewData.reason ? (
          <p className="border border-rose-900/60 bg-rose-950/30 px-1.5 py-1 text-[11px] text-rose-200" role="status">
            {tf('ticket.previewRejected', { reason: previewData.reason })}
            {previewData.ledgerBalance != null
              ? tf('ticket.previewLedgerSuffix', { balance: previewData.ledgerBalance })
              : ''}
            {previewData.requiredMargin != null
              ? tf('ticket.previewRequiredSuffix', { margin: previewData.requiredMargin })
              : ''}
          </p>
        ) : null}

        {blockReason ? (
          <p className="border border-amber-800/60 bg-amber-950/30 px-1.5 py-1 text-[11px] text-amber-200" role="status">
            {blockReason}
          </p>
        ) : null}
        {lastErrorMsg ? (
          <p className="border border-rose-900/60 bg-rose-950/30 px-1.5 py-1 text-[11px] text-rose-200" role="alert">
            {lastErrorMsg}
          </p>
        ) : null}
        {last ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            {tf('ticket.lastOrder', { id: last.orderId.slice(0, 8), status: last.status })}
          </p>
        ) : null}
        {engine.lastNote ? <p className="text-[11px] text-muted-foreground">{engine.lastNote}</p> : null}
        {actionLabel ? <p className="text-[10px] font-semibold text-foreground">{actionLabel}</p> : null}
      </div>

      <div className="border-t border-border p-1.5">
        {type === 'market' ? (
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              disabled={!canSell}
              onClick={() => void submit('sell')}
              className="fx-mt5-sell h-9 font-mono text-[12px] font-bold disabled:cursor-not-allowed"
            >
              {busy && side === 'sell' ? tf('ticket.executing') : preview.status === 'LOADING' && !previewData && side === 'sell' ? tf('ticket.previewing') : tf('ticket.marketSell')}
              <span className="mt-0.5 block text-[10px] font-medium opacity-90">{quote ? fxNum(quote.bid, digits) : '—'}</span>
            </button>
            <button
              type="button"
              disabled={!canBuy}
              onClick={() => void submit('buy')}
              className="fx-mt5-buy h-9 font-mono text-[12px] font-bold disabled:cursor-not-allowed"
            >
              {busy && side === 'buy' ? tf('ticket.executing') : preview.status === 'LOADING' && !previewData && side === 'buy' ? tf('ticket.previewing') : tf('ticket.marketBuy')}
              <span className="mt-0.5 block text-[10px] font-medium opacity-90">{quote ? fxNum(quote.ask, digits) : '—'}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={side === 'buy' ? !canBuy : !canSell}
            onClick={() => void submit(side)}
            className={cn(
              'h-9 w-full font-mono text-[12px] font-bold disabled:cursor-not-allowed',
              side === 'buy' ? 'fx-mt5-buy' : 'fx-mt5-sell'
            )}
          >
            {busy ? tf('ticket.submitting') : preview.status === 'LOADING' && !previewData ? tf('ticket.previewing') : tf('ticket.placeOrder', { action: orderActionLabel })}
          </button>
        )}
      </div>
    </aside>
  );
}
