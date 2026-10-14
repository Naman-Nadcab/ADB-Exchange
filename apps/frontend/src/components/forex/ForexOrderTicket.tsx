'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForexErrorMessage } from '@/hooks/useForexErrorMessage';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { describeForexError, normalizeForexError } from '@/lib/forex/models/errors';
import { isPreviewParamComplete } from '@/lib/forex/models/preview';
import { executablePrice, isQuoteStale } from '@/lib/forex/models/quotes';
import { pipSizeFromInstrument, priceDistancePips } from '@/lib/forex/chart/pip-math';
import { estimateTicketRisk, protectionPriceFromInput, stepLotVolume } from '@/lib/forex/models/ticket-risk';
import {
  availableOrderTypes,
  availableTimeInForce,
  coerceTimeInForce,
  isPendingOrderType,
  requiresLimitPrice,
  requiresTriggerPrice,
} from '@/lib/forex/models/order-type-tif';
import {
  describeCustomerOrderLabel,
  labelForexOrderType,
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

  const engine = useForexOrderEngine();
  const [side, setSide] = useState<ForexSide>('buy');
  const [type, setType] = useState<ForexOrderType>('market');
  const [volume, setVolume] = useState('0.10');
  const [price, setPrice] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState<ForexTimeInForce>('GTC');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [protectMode, setProtectMode] = useState<'price' | 'pips'>('price');
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
  };
  const preview = useForexPreview(authed && isPreviewParamComplete(previewReq) ? previewReq : null, refreshNonce);
  const previewData = preview.data;
  const pipSize = pipSizeFromInstrument({ pipSize: inst?.pipSize, digits });
  const entryRaw = !isPendingOrderType(type)
    ? exec
    : (requiresLimitPrice(type) ? limitPrice.trim() : price.trim()) || exec;
  const entryNum = entryRaw != null && entryRaw !== '' ? Number(entryRaw) : NaN;
  const entry = Number.isFinite(entryNum) && entryNum > 0 ? entryNum : null;
  const resolvedSl = protectionPriceFromInput({
    side,
    kind: 'sl',
    entry,
    raw: sl,
    mode: protectMode,
    pipSize,
    digits,
  });
  const resolvedTp = protectionPriceFromInput({
    side,
    kind: 'tp',
    entry,
    raw: tp,
    mode: protectMode,
    pipSize,
    digits,
  });
  const ticketRisk = useMemo(
    () =>
      estimateTicketRisk({
        instrument: inst,
        side,
        entry,
        sl: resolvedSl,
        tp: resolvedTp,
        volume,
      }),
    [inst, side, entry, resolvedSl, resolvedTp, volume]
  );

  function switchProtectMode(next: 'price' | 'pips') {
    if (next === protectMode) return;
    const convert = (raw: string, kind: 'sl' | 'tp') => {
      const trimmed = raw.trim();
      if (!trimmed || entry == null) return trimmed;
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n <= 0) return trimmed;
      if (protectMode === 'price') {
        const pips = priceDistancePips(entry, n, pipSize);
        return pips == null ? '' : String(Math.round(pips * 10) / 10);
      }
      return (
        protectionPriceFromInput({
          side,
          kind,
          entry,
          raw: trimmed,
          mode: 'pips',
          pipSize,
          digits,
        }) ?? ''
      );
    };
    setSl((cur) => convert(cur, 'sl'));
    setTp((cur) => convert(cur, 'tp'));
    setProtectMode(next);
  }

  const orderActionLabel = useMemo(() => describeCustomerOrderLabel(tf, side, type), [side, type, tf]);
  const kindHelp = useMemo(() => orderKindHelpLabel(tf, type, side), [type, side, tf]);

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
      stopLoss: resolvedSl,
      takeProfit: resolvedTp,
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
    <aside className="fx-ticket terminal-panel-subtle flex h-full min-h-0 flex-col border-border bg-card lg:border-r" aria-label={tf('ticketPanel.ariaLabel')}>
      <div className="fx-ticket-head">
        <span className="fx-ticket-kicker">{tf('ticketPanel.newOrder')}</span>
        <span className="fx-ticket-symbol">{inst?.displaySymbol ?? selected}</span>
        <span className="fx-ticket-spread">
          {tf('ticketPanel.spread')} {quote?.spreadPips ?? '—'}
        </span>
      </div>

      <div className="fx-ticket-body min-h-0 flex-1 overflow-auto">
        {type === 'market' ? null : (
        <div className="fx-ticket-sides">
          <button
            type="button"
            aria-pressed={side === 'sell'}
            onClick={() => setSide('sell')}
            className={cn(side === 'sell' && 'is-on')}
          >
            {tf('ticketPanel.sell')}
          </button>
          <button
            type="button"
            aria-pressed={side === 'buy'}
            onClick={() => setSide('buy')}
            className={cn(side === 'buy' && 'is-on')}
          >
            {tf('ticketPanel.buy')}
          </button>
        </div>
        )}
        <label className="fx-ticket-row">
          <span className="fx-ticket-label">{tf('ticketPanel.kind')}</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ForexOrderType)}
            className="fx-mt5-field min-w-0 flex-1 px-2"
            aria-label={tf('ticketPanel.kindAria')}
            title={kindHelp}
          >
            {allowedTypes.map((t) => (
              <option key={t} value={t}>
                {labelForexOrderType(tf, t)}
              </option>
            ))}
          </select>
        </label>

        <div className="fx-ticket-row">
          <span className="fx-ticket-label">{tf('ticketPanel.volume')}</span>
          <div className="fx-ticket-stepper">
            <button
              type="button"
              aria-label={tf('ticketPanel.volumeDown')}
              onClick={() =>
                setVolume((cur) =>
                  stepLotVolume(cur, -1, {
                    minVolume: inst?.minVolume,
                    maxVolume: inst?.maxVolume,
                    volumeStep: inst?.volumeStep,
                  })
                )
              }
            >
              −
            </button>
            <input
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="fx-mt5-field min-w-0 flex-1 text-center"
              aria-label={tf('ticketPanel.volumeAria')}
              inputMode="decimal"
            />
            <button
              type="button"
              aria-label={tf('ticketPanel.volumeUp')}
              onClick={() =>
                setVolume((cur) =>
                  stepLotVolume(cur, 1, {
                    minVolume: inst?.minVolume,
                    maxVolume: inst?.maxVolume,
                    volumeStep: inst?.volumeStep,
                  })
                )
              }
            >
              +
            </button>
          </div>
        </div>

        {requiresTriggerPrice(type) ? (
          <label className="fx-ticket-row">
            <span className="fx-ticket-label">
              {type === 'limit' ? tf('ticketPanel.price') : type === 'stop_limit' ? tf('ticketPanel.stop') : tf('ticketPanel.trigger')}
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="fx-mt5-field min-w-0 flex-1 px-2"
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
          <label className="fx-ticket-row">
            <span className="fx-ticket-label">{tf('ticketPanel.limit')}</span>
            <input
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="fx-mt5-field min-w-0 flex-1 px-2"
              aria-label={tf('ticketPanel.limitAria')}
              title={`${side === 'buy' ? tf('ticket.stopLimitBuyHint') : tf('ticket.stopLimitSellHint')} ${tf('ticketPanel.stopLimitFollowUp')}`}
            />
          </label>
        ) : null}

        <div className="fx-ticket-protect">
          <div className="fx-ticket-mode" role="group" aria-label={tf('ticketPanel.protectModeAria')}>
            {(['price', 'pips'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={protectMode === mode}
                onClick={() => switchProtectMode(mode)}
              >
                {mode === 'price' ? tf('ticketPanel.protectPrice') : tf('ticketPanel.protectPips')}
              </button>
            ))}
          </div>
          <label htmlFor="fx-ticket-sl">
            <span>{tf('ticketPanel.stopLoss')}</span>
            <input
              id="fx-ticket-sl"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder={protectMode === 'pips' ? tf('ticketPanel.pipsPlaceholder') : ''}
              aria-label={tf('ticketPanel.stopLossAria')}
              className="fx-mt5-field w-full px-2"
              inputMode="decimal"
            />
          </label>
          <label htmlFor="fx-ticket-tp">
            <span>{tf('ticketPanel.takeProfit')}</span>
            <input
              id="fx-ticket-tp"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder={protectMode === 'pips' ? tf('ticketPanel.pipsPlaceholder') : ''}
              aria-label={tf('ticketPanel.takeProfitAria')}
              className="fx-mt5-field w-full px-2"
              inputMode="decimal"
            />
          </label>
        </div>
        <details className="fx-ticket-details">
          <summary className="cursor-pointer" title={missingFeatures.join(' · ') || undefined}>
            {tf('ticketPanel.details')}
          </summary>
          <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
            <dt>{tf('ticketPanel.balance')}</dt>
            <dd className="text-right text-foreground">
              {account ? fxNum(account.ledgerBalance, 2) : '—'}
            </dd>
            {previewData?.requiredMargin != null ? (
              <>
                <dt>{tf('ticket.margin')}</dt>
                <dd className="text-right text-foreground">{previewData.requiredMargin}</dd>
              </>
            ) : null}
            {previewData?.referencePrice ? (
              <>
                <dt>{tf('ticketPanel.ref')} {previewData.referenceSide ?? ''}</dt>
                <dd className="text-right text-foreground">{fxNum(previewData.referencePrice, digits)}</dd>
              </>
            ) : null}
            {previewData?.estimatedFee != null ? (
              <>
                <dt>{tf('ticket.fee')}</dt>
                <dd className="text-right text-foreground">{previewData.estimatedFee}</dd>
              </>
            ) : null}
            {ticketRisk.estimatedRisk != null ? (
              <>
                <dt>{tf('ticket.estSl')}</dt>
                <dd className="text-right text-foreground">
                  {ticketRisk.slDistancePips != null ? `${ticketRisk.slDistancePips.toFixed(1)}p · ` : ''}
                  {fxNum(ticketRisk.estimatedRisk, 2)}
                </dd>
              </>
            ) : null}
            {ticketRisk.estimatedReward != null ? (
              <>
                <dt>{tf('ticket.estTp')}</dt>
                <dd className="text-right text-foreground">
                  {ticketRisk.tpDistancePips != null ? `${ticketRisk.tpDistancePips.toFixed(1)}p · ` : ''}
                  {fxNum(ticketRisk.estimatedReward, 2)}
                </dd>
              </>
            ) : null}
            {ticketRisk.riskReward != null ? (
              <>
                <dt>{tf('ticket.estRr')}</dt>
                <dd className="text-right text-foreground">{ticketRisk.riskReward.toFixed(2)}</dd>
              </>
            ) : null}
            {previewData?.projectedFreeMargin != null ? (
              <>
                <dt>{tf('ticket.freeAfter')}</dt>
                <dd className="text-right text-foreground">{previewData.projectedFreeMargin}</dd>
              </>
            ) : null}
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
              className="mt-1 w-full border border-border px-1.5 py-1 text-left text-[10px] text-muted-foreground hover:border-primary/40 disabled:opacity-50"
            >
              {demoBusy ? tf('ticket.demoMoving') : tf('ticket.demoMoveButton')}
            </button>
          ) : null}
          {demoNote ? <p className="mt-1 text-[11px] text-muted-foreground">{demoNote}</p> : null}
        </details>
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

      <div className="fx-ticket-actions">
        {type === 'market' ? (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={!canSell}
              onClick={() => void submit('sell')}
              className="fx-mt5-sell font-mono font-bold disabled:cursor-not-allowed"
            >
              <span className="fx-ticket-action">{busy && side === 'sell' ? tf('ticket.executing') : preview.status === 'LOADING' && !previewData && side === 'sell' ? tf('ticket.previewing') : tf('ticket.marketSell')}</span>
              <span className="fx-ticket-px">{quote ? fxNum(quote.bid, digits) : '—'}</span>
            </button>
            <button
              type="button"
              disabled={!canBuy}
              onClick={() => void submit('buy')}
              className="fx-mt5-buy font-mono font-bold disabled:cursor-not-allowed"
            >
              <span className="fx-ticket-action">{busy && side === 'buy' ? tf('ticket.executing') : preview.status === 'LOADING' && !previewData && side === 'buy' ? tf('ticket.previewing') : tf('ticket.marketBuy')}</span>
              <span className="fx-ticket-px">{quote ? fxNum(quote.ask, digits) : '—'}</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={side === 'buy' ? !canBuy : !canSell}
            onClick={() => void submit(side)}
            className={cn(
              'w-full font-mono font-bold disabled:cursor-not-allowed',
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
