'use client';

import { useMemo, useState } from 'react';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { formatPositionAge, livePositionValuation } from '@/lib/forex/models/live-valuation';
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
  const actions = useForexPositionActions();
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const setBottomTab = useForexWorkspaceStore((s) => s.setBottomTab);
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
  const [reverseConfirm, setReverseConfirm] = useState<ForexPublicPosition | null>(null);
  const [closeBy, setCloseBy] = useState<CloseByState | null>(null);
  const [customVol, setCustomVol] = useState('');
  const [draft, setDraft] = useState<Record<string, { sl: string; tp: string }>>({});
  const accountMode = useForexStore((s) => s.account?.positionMode ?? 'NETTING');
  const hedging = accountMode === 'HEDGING';

  const oppositeCandidates = (p: ForexPublicPosition) =>
    openRows.filter((x) => x.positionId !== p.positionId && x.symbol === p.symbol && x.side !== p.side);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {status === 'SIGNED_OUT' ? (
        <div className="flex items-center gap-3 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Sign in for positions, P&amp;L, SL/TP.</p>
        </div>
      ) : status === 'LOADING' ? (
        <p className="p-3 text-[12px] text-muted-foreground">Loading positions…</p>
      ) : status === 'ERROR' && hydrateError ? (
        <p className="p-3 text-[12px] text-sell" role="alert">
          {hydrateError.code}: {hydrateError.message}
        </p>
      ) : status === 'DISCONNECTED' ? (
        <p className="p-3 text-[12px] text-amber-800 dark:text-amber-200">Account data disconnected.</p>
      ) : (
        <>
          <p className="border-b border-border px-3 py-1 text-[10px] text-muted-foreground">
            Account mode · <span className="font-semibold text-foreground">{accountMode}</span>
            {hedging
              ? ' · Each open ticket is independent; Close By is available for opposite legs.'
              : ' · One net position per symbol; opposite fills net together.'}
          </p>
          {status === 'STALE' ? (
            <p className="px-3 pt-2 text-[11px] text-amber-800 dark:text-amber-200">Position data may be stale.</p>
          ) : null}
          {actions.actionError ? (
            <p className="px-3 pt-2 text-[11px] text-sell" role="alert">
              {actions.actionError.code}: {actions.actionError.message}
            </p>
          ) : null}
          {status === 'EMPTY' && !confirm ? (
            <p className="p-3 text-[12px] text-muted-foreground">No open Forex positions.</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="hidden md:block">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 font-medium">Id</th>
                      <th className="px-2 py-1 font-medium">Symbol</th>
                      <th className="px-2 py-1 font-medium">Side</th>
                      <th className="px-2 py-1 font-medium">Vol</th>
                      <th className="px-2 py-1 font-medium">Open</th>
                      <th className="px-2 py-1 font-medium">Bid</th>
                      <th className="px-2 py-1 font-medium">Ask</th>
                      <th className="px-2 py-1 font-medium">Mark</th>
                      <th className="px-2 py-1 font-medium">Float</th>
                      <th className="px-2 py-1 font-medium">%</th>
                      <th className="px-2 py-1 font-medium">Comm</th>
                      <th className="px-2 py-1 font-medium">Swap</th>
                      <th className="px-2 py-1 font-medium">Net</th>
                      <th className="px-2 py-1 font-medium">SL</th>
                      <th className="px-2 py-1 font-medium">TP</th>
                      <th className="px-2 py-1 font-medium">Trail</th>
                      <th className="px-2 py-1 font-medium">Margin</th>
                      <th className="px-2 py-1 font-medium">Age</th>
                      <th className="px-2 py-1 font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRows.map((p) => (
                      <PositionRow
                        key={p.positionId}
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
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setCustomVol(p.volume); setConfirm({ position: p, volume: p.volume }); setMenu(null); }}>
                  Close Position
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setCustomVol(fractionCloseVolume(p.volume, 0.5) ?? p.volume); setConfirm({ position: p, volume: fractionCloseVolume(p.volume, 0.5) ?? p.volume }); setMenu(null); }}>
                  Partial Close 50%
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
                      Close By…
                    </button>
                  ) : (
                    <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" disabled title="No opposite open position">
                      Close By (unavailable)
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
                  Reverse position…
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { focusSymbol(p.symbol); setMenu(null); }}>
                  View on chart
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left hover:bg-muted" onClick={() => { setBottomTab('history'); setMenu(null); }}>
                  View History
                </button>
                <button type="button" className="block w-full px-3 py-1 text-left text-muted-foreground" onClick={() => setMenu(null)}>
                  Dismiss
                </button>
              </>
            );
          })()}
        </div>
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
    </div>
  );
}

function PnlCell({ pnl }: { pnl: ReturnType<typeof positionUnrealizedPnl> }) {
  if (!pnl.available) return <span className="text-muted-foreground">P&amp;L unavailable</span>;
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
  onSetSl: () => void;
  onSetTp: () => void;
  onUpdateSl: (id: string) => void;
  onUpdateTp: (id: string) => void;
  onRemoveSl: (id: string) => void;
  onRemoveTp: (id: string) => void;
  onTrailSet: (id: string | null) => void;
  onTrailOff: (id: string | null) => void;
  protBusy: boolean;
}) {
  const p = props.position;
  const ui = positionUiStatus(p, props.closing, false);
  const live = props.live;
  return (
    <tr className="border-t border-border align-top" onContextMenu={props.onContext}>
      <td className="px-2 py-1.5" title={p.positionId}>{p.positionId.slice(0, 8)}</td>
      <td className="px-2 py-1.5">{p.symbol}</td>
      <td className="px-2 py-1.5 uppercase">{p.side === 'long' ? 'Buy' : 'Sell'}</td>
      <td className="px-2 py-1.5">{p.volume}</td>
      <td className="px-2 py-1.5">{fxNum(p.averageEntryPrice || p.entryPrice, props.digits)}</td>
      <td className="px-2 py-1.5">{live.bid ? fxNum(live.bid, props.digits) : '—'}</td>
      <td className="px-2 py-1.5">{live.ask ? fxNum(live.ask, props.digits) : '—'}</td>
      <td className="px-2 py-1.5">
        {live.mark ? (
          <>
            {fxNum(live.mark, props.digits)} <span className="text-muted-foreground">{live.markSource}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{live.reason ?? 'unavailable'}</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <FloatCell live={live} fallback={props.serverPnl} />
      </td>
      <td className="px-2 py-1.5">{live.floatingPct != null ? `${live.floatingPct}%` : '—'}</td>
      <td className="px-2 py-1.5">{fxNum(live.commission, 2)}</td>
      <td className="px-2 py-1.5">{fxNum(live.swap, 2)}</td>
      <td className="px-2 py-1.5">{live.net != null ? fxNum(live.net, 2) : '—'}</td>
      <td className="px-2 py-1.5">
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
      </td>
      <td className="px-2 py-1.5">
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
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input
            value={props.trail}
            onChange={(e) => props.onTrail(e.target.value)}
            placeholder={props.prot.sl?.trailingDistance ?? 'dist'}
            className="h-7 w-14 rounded border border-border bg-transparent px-1 font-mono text-[10px]"
            aria-label="Trailing distance"
          />
          <button
            type="button"
            disabled={props.protBusy}
            className="h-7 rounded px-1 text-[10px] uppercase disabled:opacity-40"
            onClick={() => props.onTrailSet(props.prot.sl?.protectionId ?? null)}
          >
            Set
          </button>
          {props.prot.sl?.trailingDistance ? (
            <button type="button" disabled={props.protBusy} className="h-7 rounded px-1 text-[10px] uppercase text-muted-foreground" onClick={() => props.onTrailOff(props.prot.sl?.protectionId ?? null)}>
              Off
            </button>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-1.5">{p.initialMargin != null && p.initialMargin !== '' ? fxNum(p.initialMargin, 2) : 'unavailable'}</td>
      <td className="px-2 py-1.5">{formatPositionAge(live.ageMs)} · {ui}</td>
      <td className="px-2 py-1.5">
        <button
          type="button"
          disabled={props.closing}
          onClick={() => props.onClose(p.volume)}
          className="h-7 rounded border border-border px-2 text-[10px] uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.closing ? 'Closing…' : 'Close'}
        </button>
      </td>
    </tr>
  );
}

function PositionCard(props: Parameters<typeof PositionRow>[0]) {
  const p = props.position;
  const ui = positionUiStatus(p, props.closing, false);
  const live = props.live;
  return (
    <article className="rounded border border-border bg-card p-3" onContextMenu={props.onContext}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[13px]">
          {p.symbol} <span className="uppercase text-muted-foreground">{p.side === 'long' ? 'Buy' : 'Sell'}</span> {p.volume}
        </div>
        <span className="text-[10px] uppercase text-muted-foreground">{ui} · {formatPositionAge(live.ageMs)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <dt>Id</dt>
        <dd className="text-right">{p.positionId.slice(0, 8)}</dd>
        <dt>Entry</dt>
        <dd className="text-right">{fxNum(p.averageEntryPrice || p.entryPrice, props.digits)}</dd>
        <dt>Bid / Ask</dt>
        <dd className="text-right">{live.bid ? fxNum(live.bid, props.digits) : '—'} / {live.ask ? fxNum(live.ask, props.digits) : '—'}</dd>
        <dt>Mark {live.markSource ?? ''}</dt>
        <dd className="text-right">{live.mark ? fxNum(live.mark, props.digits) : 'unavailable'}</dd>
        <dt>Float</dt>
        <dd className="text-right">
          <FloatCell live={live} fallback={props.serverPnl} />
        </dd>
        <dt>Comm / Swap</dt>
        <dd className="text-right">{fxNum(live.commission, 2)} / {fxNum(live.swap, 2)}</dd>
        <dt>Margin</dt>
        <dd className="text-right">{p.initialMargin != null && p.initialMargin !== '' ? fxNum(p.initialMargin, 2) : 'unavailable'}</dd>
      </dl>
      <div className="mt-2 space-y-2">
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
        {props.closing ? 'Closing…' : `Close ${p.volume} ${p.symbol}`}
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
  const mismatch = props.existing ? protectionVolumeMismatch(props.positionVolume, props.existing.volume) : false;
  return (
    <div className="flex min-w-[9.5rem] flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="w-6 text-[10px] text-muted-foreground">{props.kind}</span>
        <span className="font-mono text-[11px]">{props.existing ? fxPlain(props.existing.triggerPrice) : '—'}</span>
      </div>
      {props.existing ? (
        <p className={`text-[10px] leading-tight ${mismatch ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
          Covers {fxPlain(props.existing.volume)} of {fxPlain(props.positionVolume)}
          {mismatch ? ' · does not cover remaining volume' : ''}
        </p>
      ) : null}
      <div className="flex items-center gap-1">
        <input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          inputMode="decimal"
          aria-label={`${props.kind} price`}
          className="h-7 w-20 rounded border border-border bg-transparent px-1 font-mono text-[11px]"
        />
        {props.existing ? (
          <>
            <button type="button" disabled={props.busy || !protectionInputOk(props.value)} onClick={props.onUpdate} className="h-7 rounded px-1.5 text-[10px] uppercase disabled:opacity-40">
              Set
            </button>
            <button type="button" disabled={props.busy} onClick={props.onRemove} className="h-7 rounded px-1.5 text-[10px] uppercase text-muted-foreground disabled:opacity-40">
              Off
            </button>
          </>
        ) : (
          <button type="button" disabled={props.busy || !protectionInputOk(props.value)} onClick={props.onSet} className="h-7 rounded px-1.5 text-[10px] uppercase disabled:opacity-40">
            Set
          </button>
        )}
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
  const p = props.position;
  const ref = closeReferenceSide(p.side);
  const side = closeSideForPosition(p.side);
  const allowed = closeVolumeAllowed(p.volume, props.volume);
  const parts = [
    { label: '25%', vol: fractionCloseVolume(p.volume, 0.25) },
    { label: '50%', vol: fractionCloseVolume(p.volume, 0.5) },
    { label: '100%', vol: fractionCloseVolume(p.volume, 1) },
  ];
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label="Close position">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Close position</h3>
      <p className="font-mono text-[12px]">
        {p.symbol} {p.side.toUpperCase()} {p.volume}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        Current {ref}: {p.currentPrice ? fxNum(p.currentPrice, props.digits) : 'unavailable'} · action {side.toUpperCase()}
      </p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        P&amp;L: {props.pnl.available ? `${fxNum(props.pnl.value, 2)}${props.pnl.currency ? ` ${props.pnl.currency}` : ''}` : 'unavailable'}
      </p>
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
              Close {x.label}
            </button>
          ) : null
        )}
      </div>
      <label className="mt-2 block text-[10px] uppercase text-muted-foreground">
        Volume
        <input
          value={props.volume}
          onChange={(e) => props.onVolume(e.target.value)}
          className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]"
        />
      </label>
      {!allowed.ok ? <p className="mt-1 text-[11px] text-sell">{allowed.reason}</p> : null}
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Final execution price is determined by the backend. Close is reduce-only and will not reverse the position.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-border text-[12px]">
          Cancel
        </button>
        <button
          type="button"
          disabled={props.busy || !allowed.ok}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-primary text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? 'Submitting…' : `Close ${props.volume} ${p.symbol}`}
        </button>
      </div>
    </div>
  );
}

function reverseSideLabel(side: ForexPublicPosition['side']): string {
  return side === 'long' ? 'Buy' : 'Sell';
}

function oppositeSideLabel(side: ForexPublicPosition['side']): string {
  return side === 'long' ? 'Sell' : 'Buy';
}

function ReverseConfirm(props: {
  position: ForexPublicPosition;
  mode: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const p = props.position;
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label="Reverse position">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reverse position</h3>
      <p className="font-mono text-[12px]">
        Current: {reverseSideLabel(p.side)} {p.volume} lot · {p.symbol}
      </p>
      <p className="mt-1 font-mono text-[12px] text-foreground">
        Result: {oppositeSideLabel(p.side)} {p.volume} lot · {props.mode === 'HEDGING' ? 'close + open opposite' : 'netting flip (2× volume market)'}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Server executes atomic reverse per account position mode. SIMULATED / MOCK · not real money.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-border text-[12px]">
          Cancel
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-primary text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? 'Reversing…' : 'Confirm reverse'}
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
  const p = props.position;
  const other = props.candidates.find((x) => x.positionId === props.oppositeId) ?? props.candidates[0];
  return (
    <div className="border-t border-border bg-muted/40 p-3" role="dialog" aria-label="Close By">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Close By</h3>
      <p className="font-mono text-[12px]">
        {p.symbol} {p.side === 'long' ? 'Buy' : 'Sell'} {p.volume}
      </p>
      <label className="mt-2 block text-[10px] uppercase text-muted-foreground">
        Opposite position
        <select
          value={other?.positionId ?? ''}
          onChange={(e) => props.onOpposite(e.target.value)}
          className="mt-1 h-8 w-full rounded border border-border bg-background px-2 font-mono text-[12px]"
        >
          {props.candidates.map((c) => (
            <option key={c.positionId} value={c.positionId}>
              {(c.side === 'long' ? 'Buy' : 'Sell') + ` ${c.volume} · ${c.positionId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Matches min volume on both sides. HEDGING only. Atomic reduce — not available in NETTING.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-border text-[12px]">
          Cancel
        </button>
        <button
          type="button"
          disabled={props.busy || !other}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-primary text-[12px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busy ? 'Submitting…' : 'Close By'}
        </button>
      </div>
    </div>
  );
}
