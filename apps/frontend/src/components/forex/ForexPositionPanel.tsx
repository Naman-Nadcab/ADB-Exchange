'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { formatMarginLevel, formatPositionAge, livePositionValuation } from '@/lib/forex/models/live-valuation';
import {
  activeProtectionsFor,
  closeReferenceSide,
  closeSideForPosition,
  closeVolumeAllowed,
  fractionCloseVolume,
  positionPanelStatus,
  positionUiStatus,
  positionUnrealizedPnl,
  protectionInputOk,
  protectionVolumeMismatch,
} from '@/lib/forex/models/position';
import type { ForexPublicPosition } from '@/lib/forex/models/types';
import { useForexPositionActions } from '@/lib/forex/runtime/useForexPositionActions';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';
import { fxNum, fxPlain, fxSigned } from './format';

type ConfirmState = {
  position: ForexPublicPosition;
  volume: string;
};

type CloseByState = {
  position: ForexPublicPosition;
  oppositeId: string;
};

export function ForexPositionPanel() {
  const tp = useTranslations('forex.positionPanel');
  const session = useForexSession();
  const authed = session.authed;
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const hydrateError = useForexStore((s) => s.hydrateError);
  const socketState = useForexStore((s) => s.socketState);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);
  const positions = useForexStore((s) => s.positions);
  const protections = useForexStore((s) => s.protections);
  const pnl = useForexStore((s) => s.pnl);
  const instruments = useForexStore((s) => s.instruments);
  const quotes = useForexStore((s) => s.quotes);
  const fees = useForexStore((s) => s.fees);
  const swaps = useForexStore((s) => s.swaps);
  const account = useForexStore((s) => s.account);
  const margin = useForexStore((s) => s.margin);
  const actions = useForexPositionActions();
  const selectedSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const setBottomTab = useForexWorkspaceStore((s) => s.setBottomTab);
  const chartFocusPositionId = useForexWorkspaceStore((s) => s.chartFocusPositionId);
  const setChartFocusPositionId = useForexWorkspaceStore((s) => s.setChartFocusPositionId);
  const [menu, setMenu] = useState<{ x: number; y: number; positionId: string } | null>(null);
  const [trailDraft, setTrailDraft] = useState<Record<string, string>>({});

  const openRows = useMemo(
    () => Object.values(positions).filter((p) => p.status === 'OPEN').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [positions]
  );
  const status = positionPanelStatus({
    authed,
    hydratePhase,
    hydrateError,
    socketState,
    openCount: openRows.length,
    lastHydratedAt,
    sessionResolving: session.resolving,
  });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [modify, setModify] = useState<ForexPublicPosition | null>(null);
  const [reverseConfirm, setReverseConfirm] = useState<ForexPublicPosition | null>(null);
  const [closeBy, setCloseBy] = useState<CloseByState | null>(null);
  const [customVol, setCustomVol] = useState('');
  const [draft, setDraft] = useState<Record<string, { sl: string; tp: string }>>({});
  const accountMode = account?.positionMode ?? 'HEDGING';
  const hedging = accountMode === 'HEDGING';
  const floatingTotal = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const position of openRows) {
      const live = livePositionValuation({
        position,
        quote: quotes[position.symbol],
        instrument: instruments[position.symbol],
        accountCommission: openRows.length === 1 ? fees?.total ?? undefined : undefined,
        accountSwap: openRows.length === 1 ? swaps?.total ?? undefined : undefined,
      });
      if (live.status === 'CALCULATED' && live.floating != null) {
        sum += Number(live.floating);
        any = true;
      }
    }
    return any ? sum : null;
  }, [openRows, quotes, instruments, fees?.total, swaps?.total]);

  const oppositeCandidates = (p: ForexPublicPosition) =>
    openRows.filter((x) => x.positionId !== p.positionId && x.symbol === p.symbol && x.side !== p.side);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {status === 'SIGNED_OUT' ? (
        <div className="flex items-center gap-3 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{tp('signIn')}</p>
        </div>
      ) : status === 'LOADING' ? (
        <p className="p-3 text-[12px] text-muted-foreground">{tp('loading')}</p>
      ) : (
        <>
          {status === 'ERROR' && hydrateError ? (
            <p className="px-3 py-1 text-[11px] text-sell" role="alert">
              {hydrateError.message}
            </p>
          ) : null}
          {status === 'DISCONNECTED' ? (
            <p className="px-3 py-1 text-[11px] text-amber-800 dark:text-amber-200">{tp('disconnected')}</p>
          ) : null}
          {hedging &&
          openRows.filter((p) => p.symbol === selectedSymbol).length > 1 &&
          !openRows.some((p) => p.positionId === chartFocusPositionId && p.symbol === selectedSymbol) ? (
            <p className="border-b border-border px-3 py-1 text-[10px] text-amber-800 dark:text-amber-200">{tp('chartFocusHint')}</p>
          ) : null}
          {status === 'STALE' ? (
            <p className="px-3 pt-2 text-[11px] text-amber-800 dark:text-amber-200">{tp('stale')}</p>
          ) : null}
          {actions.actionError ? (
            <p className="px-3 pt-2 text-[11px] text-sell" role="alert">
              {actions.actionError.code}: {actions.actionError.message}
            </p>
          ) : null}
          {(status === 'EMPTY' || openRows.length === 0) && !confirm ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="fx-trade hidden w-full text-left font-mono text-[11px] md:table">
                <TradeTableHeader />
                <tbody>
                  <tr>
                    <td colSpan={14} className="px-2 py-3 text-center text-[12px] text-muted-foreground">
                      {tp('empty')}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="px-3 py-4 text-center text-[12px] text-muted-foreground md:hidden">{tp('empty')}</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="hidden md:block">
                <table className="fx-trade w-full text-left font-mono text-[11px]">
                  <TradeTableHeader />
                  <tbody>
                    {openRows.map((p) => (
                      <PositionRow
                        key={p.positionId}
                        chartLinked={chartFocusPositionId === p.positionId}
                        onSelectChart={
                          hedging
                            ? () => {
                                setChartFocusPositionId(p.positionId);
                                focusSymbol(p.symbol);
                              }
                            : undefined
                        }
                        position={p}
                        digits={instruments[p.symbol]?.digits ?? 5}
                        live={livePositionValuation({
                          position: p,
                          quote: quotes[p.symbol],
                          instrument: instruments[p.symbol],
                          accountCommission: openRows.length === 1 ? fees?.total ?? undefined : undefined,
                          accountSwap: openRows.length === 1 ? swaps?.total ?? undefined : undefined,
                        })}
                        serverPnl={positionUnrealizedPnl(pnl, p)}
                        prot={activeProtectionsFor(protections, p.positionId)}
                        closing={Boolean(actions.pendingClose[p.positionId])}
                        draft={draft[p.positionId] ?? { sl: '', tp: '' }}
                        trail={trailDraft[p.positionId] ?? ''}
                        onTrail={(v) => setTrailDraft((s) => ({ ...s, [p.positionId]: v }))}
                        onDraft={(next) => setDraft((s) => ({ ...s, [p.positionId]: next }))}
                        onClose={(vol) => {
                          setCustomVol(vol);
                          setConfirm({ position: p, volume: vol });
                        }}
                        onContext={(e) => {
                          e.preventDefault();
                          setMenu({ x: e.clientX, y: e.clientY, positionId: p.positionId });
                        }}
                        onModify={() => setModify(p)}
                        onSetSl={() => {
                          const v = draft[p.positionId]?.sl ?? '';
                          if (!protectionInputOk(v)) return;
                          void actions.createProtection(p, 'STOP_LOSS', v);
                        }}
                        onSetTp={() => {
                          const v = draft[p.positionId]?.tp ?? '';
                          if (!protectionInputOk(v)) return;
                          void actions.createProtection(p, 'TAKE_PROFIT', v);
                        }}
                        onUpdateSl={(id) => {
                          const v = draft[p.positionId]?.sl ?? '';
                          if (!protectionInputOk(v)) return;
                          void actions.updateProtection(p, 'STOP_LOSS', id, v);
                        }}
                        onUpdateTp={(id) => {
                          const v = draft[p.positionId]?.tp ?? '';
                          if (!protectionInputOk(v)) return;
                          void actions.updateProtection(p, 'TAKE_PROFIT', id, v);
                        }}
                        onRemoveSl={(id) => void actions.removeProtection(id, p.positionId, 'STOP_LOSS')}
                        onRemoveTp={(id) => void actions.removeProtection(id, p.positionId, 'TAKE_PROFIT')}
                        onTrailSet={(id) => void actions.setTrailing(p, trailDraft[p.positionId] ?? '', id)}
                        onTrailOff={(id) => void actions.setTrailing(p, null, id)}
                        protBusy={Boolean(actions.pendingProtection[`${p.positionId}:STOP_LOSS`] || actions.pendingProtection[`${p.positionId}:TAKE_PROFIT`])}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 p-2 md:hidden">
                {openRows.map((p) => (
                  <PositionCard
                    key={p.positionId}
                    position={p}
                    digits={instruments[p.symbol]?.digits ?? 5}
                    live={livePositionValuation({
                      position: p,
                      quote: quotes[p.symbol],
                      instrument: instruments[p.symbol],
                    })}
                    serverPnl={positionUnrealizedPnl(pnl, p)}
                    prot={activeProtectionsFor(protections, p.positionId)}
                    closing={Boolean(actions.pendingClose[p.positionId])}
                    draft={draft[p.positionId] ?? { sl: '', tp: '' }}
                    trail={trailDraft[p.positionId] ?? ''}
                    onTrail={(v) => setTrailDraft((s) => ({ ...s, [p.positionId]: v }))}
                    onDraft={(next) => setDraft((s) => ({ ...s, [p.positionId]: next }))}
                    onClose={(vol) => {
                      setCustomVol(vol);
                      setConfirm({ position: p, volume: vol });
                    }}
                    onContext={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, positionId: p.positionId });
                    }}
                    onModify={() => setModify(p)}
                    onSetSl={() => {
                      const v = draft[p.positionId]?.sl ?? '';
                      if (!protectionInputOk(v)) return;
                      void actions.createProtection(p, 'STOP_LOSS', v);
                    }}
                    onSetTp={() => {
                      const v = draft[p.positionId]?.tp ?? '';
                      if (!protectionInputOk(v)) return;
                      void actions.createProtection(p, 'TAKE_PROFIT', v);
                    }}
                    onUpdateSl={(id) => {
                      const v = draft[p.positionId]?.sl ?? '';
                      if (!protectionInputOk(v)) return;
                      void actions.updateProtection(p, 'STOP_LOSS', id, v);
                    }}
                    onUpdateTp={(id) => {
                      const v = draft[p.positionId]?.tp ?? '';
                      if (!protectionInputOk(v)) return;
                      void actions.updateProtection(p, 'TAKE_PROFIT', id, v);
                    }}
                    onRemoveSl={(id) => void actions.removeProtection(id, p.positionId, 'STOP_LOSS')}
                    onRemoveTp={(id) => void actions.removeProtection(id, p.positionId, 'TAKE_PROFIT')}
                    onTrailSet={(id) => void actions.setTrailing(p, trailDraft[p.positionId] ?? '', id)}
                    onTrailOff={(id) => void actions.setTrailing(p, null, id)}
                    protBusy={Boolean(actions.pendingProtection[`${p.positionId}:STOP_LOSS`] || actions.pendingProtection[`${p.positionId}:TAKE_PROFIT`])}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {menu ? (
        <div
          className="fixed z-50 min-w-[170px] border border-border bg-card py-1 text-[11px] shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {(() => {
            const p = openRows.find((x) => x.positionId === menu.positionId);
            if (!p) return null;
            const opposites = oppositeCandidates(p);
            return (
              <>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setModify(p); setMenu(null); }}>
                  {tp('menuModify')}
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setCustomVol(p.volume); setConfirm({ position: p, volume: p.volume }); setMenu(null); }}>
                  {tp('menuClose')}
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setCustomVol(fractionCloseVolume(p.volume, 0.5) ?? p.volume); setConfirm({ position: p, volume: fractionCloseVolume(p.volume, 0.5) ?? p.volume }); setMenu(null); }}>
                  {tp('menuPartial50')}
                </button>
                {hedging ? (
                  opposites.length > 0 ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-1 text-left hover:bg-muted"
                      onClick={() => {
                        setCloseBy({ position: p, oppositeId: opposites[0]!.positionId });
                        setMenu(null);
                      }}
                    >
                      {tp('menuCloseBy')}
                    </button>
                  ) : (
                    <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" disabled title={tp('menuCloseByNoOppositeTitle')}>
                      {tp('menuCloseByUnavailable')}
                    </button>
                  )
                ) : null}
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left hover:bg-muted"
                  onClick={() => {
                    setReverseConfirm(p);
                    setMenu(null);
                  }}
                >
                  {tp('menuReverse')}
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { focusSymbol(p.symbol); setMenu(null); }}>
                  {tp('menuViewChart')}
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setBottomTab('history'); setMenu(null); }}>
                  {tp('menuHistory')}
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" onClick={() => setMenu(null)}>
                  {tp('dismiss')}
                </button>
              </>
            );
          })()}
        </div>
      ) : null}
      {modify ? (
        <ModifyConfirm
          position={modify}
          prot={activeProtectionsFor(protections, modify.positionId)}
          busy={Boolean(actions.pendingProtection[`${modify.positionId}:STOP_LOSS`] || actions.pendingProtection[`${modify.positionId}:TAKE_PROFIT`])}
          onCancel={() => setModify(null)}
          onRemoveSl={() => {
            const id = activeProtectionsFor(protections, modify.positionId).sl?.protectionId;
            if (id) void actions.removeProtection(id, modify.positionId, 'STOP_LOSS');
          }}
          onRemoveTp={() => {
            const id = activeProtectionsFor(protections, modify.positionId).tp?.protectionId;
            if (id) void actions.removeProtection(id, modify.positionId, 'TAKE_PROFIT');
          }}
          onSave={async (sl, tpPrice, trail) => {
            const prot = activeProtectionsFor(useForexStore.getState().protections, modify.positionId);
            if (protectionInputOk(sl) && sl.trim() !== (prot.sl?.triggerPrice ?? '')) {
              const ok = prot.sl
                ? await actions.updateProtection(modify, 'STOP_LOSS', prot.sl.protectionId, sl)
                : await actions.createProtection(modify, 'STOP_LOSS', sl);
              if (!ok) return;
            }
            const afterSl = activeProtectionsFor(useForexStore.getState().protections, modify.positionId);
            if (protectionInputOk(tpPrice) && tpPrice.trim() !== (afterSl.tp?.triggerPrice ?? '')) {
              const ok = afterSl.tp
                ? await actions.updateProtection(modify, 'TAKE_PROFIT', afterSl.tp.protectionId, tpPrice)
                : await actions.createProtection(modify, 'TAKE_PROFIT', tpPrice);
              if (!ok) return;
            }
            const afterTp = activeProtectionsFor(useForexStore.getState().protections, modify.positionId);
            const prevTrail = afterTp.sl?.trailingDistance ?? '';
            if (trail.trim() !== String(prevTrail ?? '')) {
              await actions.setTrailing(modify, trail.trim() ? trail : null, afterTp.sl?.protectionId);
            }
            setModify(null);
          }}
        />
      ) : null}
      {confirm ? (
        <CloseConfirm
          position={confirm.position}
          volume={customVol || confirm.volume}
          digits={instruments[confirm.position.symbol]?.digits ?? 5}
          pnl={positionUnrealizedPnl(pnl, confirm.position)}
          busy={Boolean(actions.pendingClose[confirm.position.positionId])}
          onVolume={setCustomVol}
          onCancel={() => setConfirm(null)}
          onSubmit={() => {
            const check = closeVolumeAllowed(confirm.position.volume, customVol || confirm.volume);
            if (!check.ok) {
              return;
            }
            void actions.closePosition(confirm.position, customVol || confirm.volume).then(() => setConfirm(null));
          }}
        />
      ) : null}
      {reverseConfirm ? (
        <ReverseConfirm
          position={reverseConfirm}
          mode={accountMode}
          busy={Boolean(actions.pendingClose[reverseConfirm.positionId])}
          onCancel={() => setReverseConfirm(null)}
          onSubmit={() => {
            void actions.reversePosition(reverseConfirm).then(() => setReverseConfirm(null));
          }}
        />
      ) : null}
      {closeBy ? (
        <CloseByConfirm
          position={closeBy.position}
          oppositeId={closeBy.oppositeId}
          candidates={oppositeCandidates(closeBy.position)}
          busy={Boolean(actions.pendingClose[closeBy.position.positionId])}
          onOpposite={(id) => setCloseBy({ ...closeBy, oppositeId: id })}
          onCancel={() => setCloseBy(null)}
          onSubmit={() => {
            const other = openRows.find((x) => x.positionId === closeBy.oppositeId);
            if (!other) return;
            void actions.closeBy(closeBy.position, other).then(() => setCloseBy(null));
          }}
        />
      ) : null}
      {status !== 'SIGNED_OUT' && status !== 'LOADING' ? (
        <TradeSummary currency={account?.currency ?? 'USD'} account={account} margin={margin} floating={floatingTotal} />
      ) : null}
    </div>
  );
}

function formatTicketTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function dockAmount(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TradeSummary(props: {
  currency: string;
  account: {
    ledgerBalance?: string | null;
    equity?: string | null;
    usedMargin?: string | null;
    freeMargin?: string | null;
  } | null;
  margin: { usedMargin?: string | null; freeMargin?: string | null } | null;
  floating: number | null;
}) {
  const tf = useTranslations('forex');
  const used = props.margin?.usedMargin ?? props.account?.usedMargin;
  const level = formatMarginLevel(props.account?.equity, used);
  const tone = props.floating == null ? '' : props.floating > 0 ? 'text-buy' : props.floating < 0 ? 'text-sell' : '';
  return (
    <div className="fx-dock-summary" data-testid="trade-summary">
      <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5">
        <span>
          <span className="fx-k">{tf('bottomPanels.exposure.balance')}:</span>
          {dockAmount(props.account?.ledgerBalance)} {props.currency}
        </span>
        <span>
          <span className="fx-k">{tf('bottomPanels.exposure.equity')}:</span>
          {dockAmount(props.account?.equity)}
        </span>
        <span>
          <span className="fx-k">{tf('bottomPanels.mt4.margin')}:</span>
          {dockAmount(used)}
        </span>
        <span>
          <span className="fx-k">{tf('bottomPanels.mt4.freeMargin')}:</span>
          {dockAmount(props.margin?.freeMargin ?? props.account?.freeMargin)}
        </span>
        <span>
          <span className="fx-k">{tf('bottomPanels.mt4.marginLevel')}:</span>
          {level}
        </span>
      </p>
      <span className={cn('shrink-0 font-mono font-semibold', tone)}>
        {props.floating == null ? '' : dockAmount(props.floating)}
      </span>
    </div>
  );
}

function TradeTableHeader() {
  const tp = useTranslations('forex.positionPanel');
  return (
    <thead>
      <tr>
        <th>{tp('colOrder')}</th>
        <th>{tp('colTime')}</th>
        <th>{tp('colType')}</th>
        <th className="text-right">{tp('colSize')}</th>
        <th>{tp('colSymbol')}</th>
        <th className="text-right">{tp('colPrice')}</th>
        <th className="text-right">{tp('colSl')}</th>
        <th className="text-right">{tp('colTp')}</th>
        <th className="text-right">{tp('colPrice')}</th>
        <th className="text-right">{tp('colCommission')}</th>
        <th className="text-right">{tp('colTaxes')}</th>
        <th className="text-right">{tp('colSwap')}</th>
        <th className="text-right">{tp('colProfit')}</th>
        <th> </th>
      </tr>
    </thead>
  );
}

function TicketLevel(props: {
  kind: 'SL' | 'TP';
  digits: number;
  existing: ReturnType<typeof activeProtectionsFor>['sl'];
  positionVolume: string;
  onEdit: () => void;
}) {
  const tp = useTranslations('forex.positionPanel');
  const price = props.existing?.triggerPrice;
  const mismatch = props.existing ? protectionVolumeMismatch(props.positionVolume, props.existing.volume) : false;
  return (
    <button
      type="button"
      className={cn(
        'block min-h-[1.1rem] min-w-[3.2rem] text-left font-mono underline decoration-dotted underline-offset-2',
        props.kind === 'TP' && price && 'bg-buy px-1 text-primary-foreground no-underline'
      )}
      aria-label={tp('slPriceAria', { kind: props.kind === 'SL' ? 'S / L' : 'T / P' })}
      title={mismatch ? tp('volumeMismatch') : tp('menuModify')}
      onClick={(e) => {
        e.stopPropagation();
        props.onEdit();
      }}
    >
      {price ? fxNum(price, props.digits) : '—'}
    </button>
  );
}

function PnlCell({ pnl }: { pnl: ReturnType<typeof positionUnrealizedPnl> }) {
  const tp = useTranslations('forex.positionPanel');
  if (!pnl.available) return <span className="text-muted-foreground">{tp('pnlUnavailable')}</span>;
  return <span>{fxNum(pnl.value, 2)}{pnl.currency ? ` ${pnl.currency}` : ''}</span>;
}

function FloatCell({ live, fallback }: { live: ReturnType<typeof livePositionValuation>; fallback: ReturnType<typeof positionUnrealizedPnl> }) {
  if (live.status === 'CALCULATED' && live.floating != null) {
    const s = fxSigned(live.floating);
    return <span className={s.tone === 'pos' ? 'text-buy' : s.tone === 'neg' ? 'text-sell' : ''}>{s.text}</span>;
  }
  return <PnlCell pnl={fallback} />;
}

function PositionRow(props: {
  position: ForexPublicPosition;
  digits: number;
  live: ReturnType<typeof livePositionValuation>;
  serverPnl: ReturnType<typeof positionUnrealizedPnl>;
  prot: ReturnType<typeof activeProtectionsFor>;
  closing: boolean;
  draft: { sl: string; tp: string };
  trail: string;
  onTrail: (v: string) => void;
  onDraft: (n: { sl: string; tp: string }) => void;
  onClose: (volume: string) => void;
  onContext: (e: React.MouseEvent) => void;
  onModify: () => void;
  onSetSl: () => void;
  onSetTp: () => void;
  onUpdateSl: (id: string) => void;
  onUpdateTp: (id: string) => void;
  onRemoveSl: (id: string) => void;
  onRemoveTp: (id: string) => void;
  onTrailSet: (id: string | null) => void;
  onTrailOff: (id: string | null) => void;
  protBusy: boolean;
  chartLinked?: boolean;
  onSelectChart?: () => void;
}) {
  const tp = useTranslations('forex.positionPanel');
  const ts = useTranslations('forex.sides');
  const p = props.position;
  const live = props.live;
  const sideLabel = p.side === 'long' ? ts('buy') : ts('sell');
  const current = live.mark || p.currentPrice;
  return (
    <tr
      className={cn(
        'border-t border-border',
        props.chartLinked && 'bg-primary/10',
        props.onSelectChart && 'cursor-pointer hover:bg-muted/40'
      )}
      onContextMenu={props.onContext}
      onDoubleClick={props.onModify}
      aria-selected={props.chartLinked}
    >
      <td className="px-2 py-1" title={p.positionId}>
        {props.onSelectChart ? (
          <button
            type="button"
            className={cn('font-mono hover:underline', props.chartLinked && 'font-semibold text-primary')}
            aria-label={tp('selectForChartAria', { id: p.positionId.slice(0, 8) })}
            onClick={props.onSelectChart}
          >
            {p.positionId.slice(0, 8)}
          </button>
        ) : (
          p.positionId.slice(0, 8)
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-1">{formatTicketTime(p.openedAt)}</td>
      <td className={cn('px-2 py-1 font-medium lowercase', p.side === 'long' ? 'text-buy' : 'text-sell')}>{sideLabel}</td>
      <td className="px-2 py-1 text-right">{fxNum(p.volume, 2)}</td>
      <td className="px-2 py-1 font-medium lowercase">{p.symbol}</td>
      <td className="px-2 py-1 text-right">{fxNum(p.averageEntryPrice || p.entryPrice, props.digits)}</td>
      <td className="px-2 py-1">
        <TicketLevel
          kind="SL"
          digits={props.digits}
          existing={props.prot.sl}
          positionVolume={p.volume}
          onEdit={props.onModify}
        />
      </td>
      <td className="px-2 py-1">
        <TicketLevel
          kind="TP"
          digits={props.digits}
          existing={props.prot.tp}
          positionVolume={p.volume}
          onEdit={props.onModify}
        />
      </td>
      <td className="px-2 py-1 text-right">{current ? fxNum(current, props.digits) : ''}</td>
      <td className="px-2 py-1 text-right">{live.commission !== '' ? fxNum(live.commission, 2) : ''}</td>
      <td className="px-2 py-1 text-right">0.00</td>
      <td className="px-2 py-1 text-right">{fxNum(live.swap, 2)}</td>
      <td className="px-2 py-1 text-right font-semibold">
        <FloatCell live={live} fallback={props.serverPnl} />
      </td>
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          disabled={props.closing}
          onClick={() => props.onClose(p.volume)}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label={tp('close')}
          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[13px] leading-none text-muted-foreground hover:bg-sell/15 hover:text-sell disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.closing ? '…' : '×'}
        </button>
      </td>
    </tr>
  );
}

function PositionCard(props: Parameters<typeof PositionRow>[0]) {
  const tp = useTranslations('forex.positionPanel');
  const ts = useTranslations('forex.sides');
  const p = props.position;
  const ui = positionUiStatus(p, props.closing, false);
  const live = props.live;
  const sideLabel = p.side === 'long' ? ts('buy') : ts('sell');
  return (
    <article className="rounded border border-border bg-card p-3" onContextMenu={props.onContext}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[13px]">
          {p.symbol} <span className="uppercase text-muted-foreground">{sideLabel}</span> {p.volume}
        </div>
        <span className="text-[10px] uppercase text-muted-foreground">{ui} · {formatPositionAge(live.ageMs)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <dt>{tp('colId')}</dt>
        <dd className="text-right">{p.positionId.slice(0, 8)}</dd>
        <dt>{tp('cardEntry')}</dt>
        <dd className="text-right">{fxNum(p.averageEntryPrice || p.entryPrice, props.digits)}</dd>
        <dt>{tp('cardBidAsk')}</dt>
        <dd className="text-right">{live.bid ? fxNum(live.bid, props.digits) : '—'} / {live.ask ? fxNum(live.ask, props.digits) : '—'}</dd>
        <dt>{tp('colMark')} {live.markSource ?? ''}</dt>
        <dd className="text-right">{live.mark ? fxNum(live.mark, props.digits) : tp('unavailable')}</dd>
        <dt>{tp('colFloat')}</dt>
        <dd className="text-right">
          <FloatCell live={live} fallback={props.serverPnl} />
        </dd>
        <dt>{tp('cardCommSwap')}</dt>
        <dd className="text-right">{fxNum(live.commission, 2)} / {fxNum(live.swap, 2)}</dd>
        <dt>{tp('colMargin')}</dt>
        <dd className="text-right">{p.initialMargin != null && p.initialMargin !== '' ? fxNum(p.initialMargin, 2) : tp('unavailable')}</dd>
      </dl>
      <div className="mt-2 space-y-2">
        <button type="button" className="h-7 rounded border border-border px-2 text-[10px] uppercase" onClick={props.onModify}>
          {tp('menuModify')}
        </button>
        <ProtectionCell
          kind="SL"
          existing={props.prot.sl}
          positionVolume={p.volume}
          value={props.draft.sl}
          onChange={(sl) => props.onDraft({ ...props.draft, sl })}
          onSet={props.onSetSl}
          onUpdate={() => props.prot.sl && props.onUpdateSl(props.prot.sl.protectionId)}
          onRemove={() => props.prot.sl && props.onRemoveSl(props.prot.sl.protectionId)}
          busy={props.protBusy || props.closing}
        />
        <ProtectionCell
          kind="TP"
          existing={props.prot.tp}
          positionVolume={p.volume}
          value={props.draft.tp}
          onChange={(tp) => props.onDraft({ ...props.draft, tp })}
          onSet={props.onSetTp}
          onUpdate={() => props.prot.tp && props.onUpdateTp(props.prot.tp.protectionId)}
          onRemove={() => props.prot.tp && props.onRemoveTp(props.prot.tp.protectionId)}
          busy={props.protBusy || props.closing}
        />
      </div>
      <button
        type="button"
        disabled={props.closing}
        onClick={() => props.onClose(p.volume)}
        className="mt-3 h-10 w-full rounded border border-border text-[12px] uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.closing ? tp('closing') : tp('closeVolume', { volume: p.volume, symbol: p.symbol })}
      </button>
    </article>
  );
}

function ProtectionCell(props: {
  kind: 'SL' | 'TP';
  existing: ReturnType<typeof activeProtectionsFor>['sl'];
  positionVolume: string;
  value: string;
  onChange: (v: string) => void;
  onSet: () => void;
  onUpdate: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const tp = useTranslations('forex.positionPanel');
  const mismatch = props.existing ? protectionVolumeMismatch(props.positionVolume, props.existing.volume) : false;
  return (
    <div className="flex min-w-[9.5rem] flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="w-6 text-[10px] text-muted-foreground">{props.kind}</span>
        <span className="font-mono text-[11px]">{props.existing ? fxPlain(props.existing.triggerPrice) : '—'}</span>
      </div>
      {props.existing ? (
        <p className={`text-[10px] leading-tight ${mismatch ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
          {tp('coversVolume', { existing: fxPlain(props.existing.volume), total: fxPlain(props.positionVolume) })}
          {mismatch ? tp('volumeMismatch') : ''}
        </p>
      ) : null}
      <div className="flex items-center gap-1">
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          inputMode="decimal"
          aria-label={tp('slPriceAria', { kind: props.kind })}
          className="h-7 w-20 rounded border border-border bg-transparent px-1 font-mono text-[11px]"
        />
        {props.existing ? (
          <>
            <button type="button" disabled={props.busy || !protectionInputOk(props.value)} onClick={props.onUpdate} className="h-7 rounded px-1.5 text-[10px] uppercase disabled:opacity-40">
              {tp('set')}
            </button>
            <button type="button" disabled={props.busy} onClick={props.onRemove} className="h-7 rounded px-1.5 text-[10px] uppercase text-muted-foreground disabled:opacity-40">
              {tp('off')}
            </button>
          </>
        ) : (
          <button type="button" disabled={props.busy || !protectionInputOk(props.value)} onClick={props.onSet} className="h-7 rounded px-1.5 text-[10px] uppercase disabled:opacity-40">
            {tp('set')}
          </button>
        )}
      </div>
    </div>
  );
}

function ModifyConfirm(props: {
  position: ForexPublicPosition;
  prot: ReturnType<typeof activeProtectionsFor>;
  busy: boolean;
  onCancel: () => void;
  onSave: (sl: string, tp: string, trail: string) => Promise<void>;
  onRemoveSl: () => void;
  onRemoveTp: () => void;
}) {
  const tp = useTranslations('forex.positionPanel');
  const ts = useTranslations('forex.sides');
  const p = props.position;
  const [sl, setSl] = useState(props.prot.sl?.triggerPrice ?? '');
  const [take, setTake] = useState(props.prot.tp?.triggerPrice ?? '');
  const [trail, setTrail] = useState(props.prot.sl?.trailingDistance ?? '');
  const [note, setNote] = useState('');
  const side = p.side === 'long' ? ts('buy') : ts('sell');
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label={tp('modifyDialogAria')}>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tp('modifyTitle')}</h3>
      <p className="font-mono text-[12px]">
        {p.symbol} {side} {p.volume}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="block text-[10px] uppercase text-muted-foreground">
          {tp('modifySl')}
          <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]" aria-label={tp('slPriceAria', { kind: 'S / L' })} />
        </label>
        <label className="block text-[10px] uppercase text-muted-foreground">
          {tp('modifyTp')}
          <input value={take} onChange={(e) => setTake(e.target.value)} inputMode="decimal" className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]" aria-label={tp('slPriceAria', { kind: 'T / P' })} />
        </label>
        <label className="block text-[10px] uppercase text-muted-foreground">
          {tp('modifyTrail')}
          <input value={trail} onChange={(e) => setTrail(e.target.value)} inputMode="decimal" placeholder={tp('trailDistPlaceholder')} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]" aria-label={tp('trailDistAria')} />
        </label>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{tp('modifyHint')}</p>
      {note ? <p className="mt-1 text-[11px] text-sell">{note}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 rounded border border-border px-3 text-[12px]">
          {tp('cancel')}
        </button>
        {props.prot.sl ? (
          <button type="button" disabled={props.busy} onClick={props.onRemoveSl} className="h-9 rounded border border-border px-3 text-[12px] text-muted-foreground disabled:opacity-40">
            {tp('modifySl')} {tp('off')}
          </button>
        ) : null}
        {props.prot.tp ? (
          <button type="button" disabled={props.busy} onClick={props.onRemoveTp} className="h-9 rounded border border-border px-3 text-[12px] text-muted-foreground disabled:opacity-40">
            {tp('modifyTp')} {tp('off')}
          </button>
        ) : null}
        <button
          type="button"
          disabled={props.busy}
          onClick={() => {
            if (sl.trim() && !protectionInputOk(sl)) {
              setNote(tp('modifySl'));
              return;
            }
            if (take.trim() && !protectionInputOk(take)) {
              setNote(tp('modifyTp'));
              return;
            }
            setNote('');
            void props.onSave(sl, take, trail);
          }}
          className="h-9 rounded bg-primary px-3 text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? tp('submitting') : tp('modifySave')}
        </button>
      </div>
    </div>
  );
}

function CloseConfirm(props: {
  position: ForexPublicPosition;
  volume: string;
  digits: number;
  pnl: ReturnType<typeof positionUnrealizedPnl>;
  busy: boolean;
  onVolume: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const tp = useTranslations('forex.positionPanel');
  const p = props.position;
  const ref = closeReferenceSide(p.side);
  const side = closeSideForPosition(p.side);
  const allowed = closeVolumeAllowed(p.volume, props.volume);
  const parts = [
    { label: tp('closePct25'), vol: fractionCloseVolume(p.volume, 0.25) },
    { label: tp('closePct50'), vol: fractionCloseVolume(p.volume, 0.5) },
    { label: tp('closePct100'), vol: fractionCloseVolume(p.volume, 1) },
  ];
  const pnlText = props.pnl.available
    ? `${fxNum(props.pnl.value, 2)}${props.pnl.currency ? ` ${props.pnl.currency}` : ''}`
    : tp('unavailable');
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label={tp('closeDialogAria')}>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tp('closeDialogTitle')}</h3>
      <p className="font-mono text-[12px]">
        {p.symbol} {p.side.toUpperCase()} {p.volume}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {tp('closeCurrent', {
          ref,
          price: p.currentPrice ? fxNum(p.currentPrice, props.digits) : tp('unavailable'),
          side: side.toUpperCase(),
        })}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{tp('closePnl', { pnl: pnlText })}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {parts.map((x) =>
          x.vol ? (
            <button
              key={x.label}
              type="button"
              onClick={() => props.onVolume(x.vol!)}
              className={cn(
                'h-8 rounded border px-2 text-[11px]',
                props.volume === x.vol ? 'border-primary bg-primary/10' : 'border-border'
              )}
            >
              {x.label}
            </button>
          ) : null
        )}
      </div>
      <label className="mt-2 block text-[10px] uppercase text-muted-foreground">
        {tp('volumeLabel')}
        <input
          value={props.volume}
          onChange={(e) => props.onVolume(e.target.value)}
          className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]"
        />
      </label>
      {!allowed.ok ? <p className="mt-1 text-[11px] text-sell">{allowed.reason}</p> : null}
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{tp('closeDisclaimer')}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-border text-[12px]">
          {tp('cancel')}
        </button>
        <button
          type="button"
          disabled={props.busy || !allowed.ok}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-primary text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? tp('submitting') : tp('closeSubmit', { volume: props.volume, symbol: p.symbol })}
        </button>
      </div>
    </div>
  );
}

function ReverseConfirm(props: {
  position: ForexPublicPosition;
  mode: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const tp = useTranslations('forex.positionPanel');
  const ts = useTranslations('forex.sides');
  const p = props.position;
  const currentSide = p.side === 'long' ? ts('buy') : ts('sell');
  const oppositeSide = p.side === 'long' ? ts('sell') : ts('buy');
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label={tp('reverseDialogAria')}>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tp('reverseTitle')}</h3>
      <p className="font-mono text-[12px]">{tp('reverseCurrent', { side: currentSide, volume: p.volume, symbol: p.symbol })}</p>
      <p className="mt-1 font-mono text-[12px] text-foreground">
        {props.mode === 'HEDGING'
          ? tp('reverseResultHedging', { side: oppositeSide, volume: p.volume })
          : tp('reverseResultNetting', { side: oppositeSide, volume: p.volume })}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{tp('reverseDisclaimer')}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-border text-[12px]">
          {tp('cancel')}
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-primary text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? tp('reversing') : tp('confirmReverse')}
        </button>
      </div>
    </div>
  );
}

function CloseByConfirm(props: {
  position: ForexPublicPosition;
  oppositeId: string;
  candidates: ForexPublicPosition[];
  busy: boolean;
  onOpposite: (id: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const tp = useTranslations('forex.positionPanel');
  const ts = useTranslations('forex.sides');
  const p = props.position;
  const other = props.candidates.find((x) => x.positionId === props.oppositeId) ?? props.candidates[0];
  const sideLabel = p.side === 'long' ? ts('buy') : ts('sell');
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label={tp('closeByDialogAria')}>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tp('closeByTitle')}</h3>
      <p className="font-mono text-[12px]">
        {p.symbol} {sideLabel} {p.volume}
      </p>
      <label className="mt-2 block text-[10px] uppercase text-muted-foreground">
        {tp('oppositePosition')}
        <select
          value={other?.positionId ?? ''}
          onChange={(e) => props.onOpposite(e.target.value)}
          className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]"
        >
          {props.candidates.map((c) => (
            <option key={c.positionId} value={c.positionId}>
              {(c.side === 'long' ? ts('buy') : ts('sell')) + ` ${c.volume} · ${c.positionId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{tp('closeByDisclaimer')}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-border text-[12px]">
          {tp('cancel')}
        </button>
        <button
          type="button"
          disabled={props.busy || !other}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-primary text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? tp('submitting') : tp('closeBySubmit')}
        </button>
      </div>
    </div>
  );
}
