'use client';

import { useMemo, useState } from 'react';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
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
import { cn } from '@/lib/utils';
import { fxNum, fxPlain } from './format';

type ConfirmState = {
  position: ForexPublicPosition;
  volume: string;
};

export function ForexPositionPanel() {
  const authed = hasForexPrivateSession();
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const hydrateError = useForexStore((s) => s.hydrateError);
  const socketState = useForexStore((s) => s.socketState);
  const lastHydratedAt = useForexStore((s) => s.lastHydratedAt);
  const positions = useForexStore((s) => s.positions);
  const protections = useForexStore((s) => s.protections);
  const pnl = useForexStore((s) => s.pnl);
  const instruments = useForexStore((s) => s.instruments);
  const actions = useForexPositionActions();

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
  });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [customVol, setCustomVol] = useState('');
  const [draft, setDraft] = useState<Record<string, { sl: string; tp: string }>>({});

  return (
    <div className="flex h-full min-h-0 flex-col">
      {status === 'SIGNED_OUT' ? (
        <p className="p-3 text-[12px] text-stone-500">Sign in to view positions.</p>
      ) : status === 'LOADING' ? (
        <p className="p-3 text-[12px] text-stone-500">Loading positions…</p>
      ) : status === 'ERROR' && hydrateError ? (
        <p className="p-3 text-[12px] text-rose-800 dark:text-rose-200" role="alert">
          {hydrateError.code}: {hydrateError.message}
        </p>
      ) : status === 'DISCONNECTED' ? (
        <p className="p-3 text-[12px] text-amber-800 dark:text-amber-200">Account data disconnected.</p>
      ) : (
        <>
          {status === 'STALE' ? (
            <p className="px-3 pt-2 text-[11px] text-amber-800 dark:text-amber-200">Position data may be stale.</p>
          ) : null}
          {actions.actionError ? (
            <p className="px-3 pt-2 text-[11px] text-rose-800 dark:text-rose-200" role="alert">
              {actions.actionError.code}: {actions.actionError.message}
            </p>
          ) : null}
          {status === 'EMPTY' && !confirm ? (
            <p className="p-3 text-[12px] text-stone-500">No open Forex positions.</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="hidden md:block">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="text-stone-500">
                    <tr>
                      <th className="px-2 py-1 font-medium">Symbol</th>
                      <th className="px-2 py-1 font-medium">Side</th>
                      <th className="px-2 py-1 font-medium">Vol</th>
                      <th className="px-2 py-1 font-medium">Entry</th>
                      <th className="px-2 py-1 font-medium">Close px</th>
                      <th className="px-2 py-1 font-medium">P&amp;L</th>
                      <th className="px-2 py-1 font-medium">SL</th>
                      <th className="px-2 py-1 font-medium">TP</th>
                      <th className="px-2 py-1 font-medium">Margin</th>
                      <th className="px-2 py-1 font-medium">Status</th>
                      <th className="px-2 py-1 font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRows.map((p) => (
                      <PositionRow
                        key={p.positionId}
                        position={p}
                        digits={instruments[p.symbol]?.digits ?? 5}
                        pnl={positionUnrealizedPnl(pnl, p)}
                        prot={activeProtectionsFor(protections, p.positionId)}
                        closing={Boolean(actions.pendingClose[p.positionId])}
                        draft={draft[p.positionId] ?? { sl: '', tp: '' }}
                        onDraft={(next) => setDraft((s) => ({ ...s, [p.positionId]: next }))}
                        onClose={(vol) => {
                          setCustomVol(vol);
                          setConfirm({ position: p, volume: vol });
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
                    pnl={positionUnrealizedPnl(pnl, p)}
                    prot={activeProtectionsFor(protections, p.positionId)}
                    closing={Boolean(actions.pendingClose[p.positionId])}
                    draft={draft[p.positionId] ?? { sl: '', tp: '' }}
                    onDraft={(next) => setDraft((s) => ({ ...s, [p.positionId]: next }))}
                    onClose={(vol) => {
                      setCustomVol(vol);
                      setConfirm({ position: p, volume: vol });
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
                    protBusy={Boolean(actions.pendingProtection[`${p.positionId}:STOP_LOSS`] || actions.pendingProtection[`${p.positionId}:TAKE_PROFIT`])}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
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
    </div>
  );
}

function PnlCell({ pnl }: { pnl: ReturnType<typeof positionUnrealizedPnl> }) {
  if (!pnl.available) return <span className="text-stone-400">P&amp;L unavailable</span>;
  return <span>{fxNum(pnl.value, 2)}{pnl.currency ? ` ${pnl.currency}` : ''}</span>;
}

function PositionRow(props: {
  position: ForexPublicPosition;
  digits: number;
  pnl: ReturnType<typeof positionUnrealizedPnl>;
  prot: ReturnType<typeof activeProtectionsFor>;
  closing: boolean;
  draft: { sl: string; tp: string };
  onDraft: (n: { sl: string; tp: string }) => void;
  onClose: (volume: string) => void;
  onSetSl: () => void;
  onSetTp: () => void;
  onUpdateSl: (id: string) => void;
  onUpdateTp: (id: string) => void;
  onRemoveSl: (id: string) => void;
  onRemoveTp: (id: string) => void;
  protBusy: boolean;
}) {
  const p = props.position;
  const ui = positionUiStatus(p, props.closing, false);
  const ref = closeReferenceSide(p.side);
  return (
    <tr className="border-t border-stone-100 align-top dark:border-stone-800">
      <td className="px-2 py-1.5">{p.symbol}</td>
      <td className="px-2 py-1.5 uppercase">{p.side}</td>
      <td className="px-2 py-1.5">{p.volume}</td>
      <td className="px-2 py-1.5">{fxNum(p.averageEntryPrice || p.entryPrice, props.digits)}</td>
      <td className="px-2 py-1.5">
        {p.currentPrice ? (
          <>
            {fxNum(p.currentPrice, props.digits)} <span className="text-stone-400">{ref}</span>
          </>
        ) : (
          <span className="text-stone-400">unavailable</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <PnlCell pnl={props.pnl} />
      </td>
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
      <td className="px-2 py-1.5">{p.initialMargin != null && p.initialMargin !== '' ? fxNum(p.initialMargin, 2) : 'unavailable'}</td>
      <td className="px-2 py-1.5">{ui}</td>
      <td className="px-2 py-1.5">
        <button
          type="button"
          disabled={props.closing}
          onClick={() => props.onClose(p.volume)}
          className="h-7 rounded border border-stone-300 px-2 text-[10px] uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"
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
  const ref = closeReferenceSide(p.side);
  return (
    <article className="rounded border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-[#101214]">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[13px]">
          {p.symbol} <span className="uppercase text-stone-500">{p.side}</span> {p.volume}
        </div>
        <span className="text-[10px] uppercase text-stone-500">{ui}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
        <dt>Entry</dt>
        <dd className="text-right">{fxNum(p.averageEntryPrice || p.entryPrice, props.digits)}</dd>
        <dt>Close {ref}</dt>
        <dd className="text-right">{p.currentPrice ? fxNum(p.currentPrice, props.digits) : 'unavailable'}</dd>
        <dt>P&amp;L</dt>
        <dd className="text-right">
          <PnlCell pnl={props.pnl} />
        </dd>
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
        className="mt-3 h-10 w-full rounded border border-stone-300 text-[12px] uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"
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
        <span className="w-6 text-[10px] text-stone-400">{props.kind}</span>
        <span className="font-mono text-[11px]">{props.existing ? fxPlain(props.existing.triggerPrice) : '—'}</span>
      </div>
      {props.existing ? (
        <p className={`text-[10px] leading-tight ${mismatch ? 'text-amber-800 dark:text-amber-300' : 'text-stone-400'}`}>
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
          className="h-7 w-20 rounded border border-stone-300 bg-transparent px-1 font-mono text-[11px] dark:border-stone-700"
        />
        {props.existing ? (
          <>
            <button type="button" disabled={props.busy || !protectionInputOk(props.value)} onClick={props.onUpdate} className="h-7 rounded px-1.5 text-[10px] uppercase disabled:opacity-40">
              Set
            </button>
            <button type="button" disabled={props.busy} onClick={props.onRemove} className="h-7 rounded px-1.5 text-[10px] uppercase text-stone-500 disabled:opacity-40">
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
    <div className="border-t border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-[#141618]" role="dialog" aria-label="Close position">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">Close position</h3>
      <p className="font-mono text-[12px]">
        {p.symbol} {p.side.toUpperCase()} {p.volume}
      </p>
      <p className="mt-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
        Current {ref}: {p.currentPrice ? fxNum(p.currentPrice, props.digits) : 'unavailable'} · action {side.toUpperCase()}
      </p>
      <p className="mt-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
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
                props.volume === x.vol ? 'border-stone-800 dark:border-stone-200' : 'border-stone-300 dark:border-stone-700'
              )}
            >
              Close {x.label}
            </button>
          ) : null
        )}
      </div>
      <label className="mt-2 block text-[10px] uppercase text-stone-400">
        Volume
        <input
          value={props.volume}
          onChange={(e) => props.onVolume(e.target.value)}
          className="mt-1 h-8 w-full rounded border border-stone-300 bg-white px-2 font-mono text-[12px] dark:border-stone-700 dark:bg-transparent"
        />
      </label>
      {!allowed.ok ? <p className="mt-1 text-[11px] text-rose-800 dark:text-rose-200">{allowed.reason}</p> : null}
      <p className="mt-2 text-[10px] leading-relaxed text-stone-400">
        Final execution price is determined by the backend. Close is reduce-only and will not reverse the position.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={props.onCancel} className="h-9 flex-1 rounded border border-stone-300 text-[12px] dark:border-stone-700">
          Cancel
        </button>
        <button
          type="button"
          disabled={props.busy || !allowed.ok}
          onClick={props.onSubmit}
          className="h-9 flex-1 rounded bg-stone-800 text-[12px] text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-200 dark:text-stone-900"
        >
          {props.busy ? 'Submitting…' : `Close ${props.volume} ${p.symbol}`}
        </button>
      </div>
    </div>
  );
}
