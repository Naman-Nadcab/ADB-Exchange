'use client';

import { useMemo, useState } from 'react';
import {
  computeRiskReward,
  pipSizeFromInstrument,
  pipValuePerLotFromSpec,
  priceDistancePips,
  suggestPositionSize,
} from '@/lib/forex/chart/pip-math';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { fxNum } from './format';

export function ForexRiskTools() {
  const selected = useForexWorkspaceStore((s) => s.selectedSymbol);
  const setDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const inst = useForexStore((s) => s.instruments[selected]);
  const account = useForexStore((s) => s.account);
  const quote = useForexStore((s) => s.quotes[selected]);
  const digits = inst?.digits ?? 5;
  const pipSize = pipSizeFromInstrument({ pipSize: inst?.pipSize, digits });
  const contract = Number(inst?.contractSize);
  const pipVal = pipValuePerLotFromSpec({ pipSize, contractSize: contract });
  const equity = account ? Number(account.equity) : null;

  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [volume, setVolume] = useState(inst?.minVolume ?? '0.01');
  const [riskPct, setRiskPct] = useState('1');

  const e = Number(entry);
  const sl = Number(stop);
  const tp = Number(target);
  const lots = Number(volume);
  const rr = useMemo(
    () =>
      computeRiskReward({
        entry: e,
        stop: sl,
        target: tp,
        pipSize,
        volumeLots: Number.isFinite(lots) ? lots : null,
        pipValuePerLot: pipVal,
      }),
    [e, sl, tp, pipSize, lots, pipVal]
  );
  const stopPips = Number.isFinite(e) && Number.isFinite(sl) ? priceDistancePips(e, sl, pipSize) : null;
  const suggested =
    equity != null && equity > 0 && stopPips != null && pipVal != null
      ? suggestPositionSize({
          equity,
          riskPercent: Number(riskPct),
          stopPips,
          pipValuePerLot: pipVal,
        })
      : null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/15 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pip / R:R calculator</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Mini label="Entry" value={entry} onChange={setEntry} placeholder={quote ? String(quote.bid) : ''} />
        <Mini label="Volume" value={volume} onChange={setVolume} />
        <Mini label="Stop" value={stop} onChange={setStop} />
        <Mini label="Target" value={target} onChange={setTarget} />
      </div>
      {rr ? (
        <p className="font-mono text-[10px] text-foreground">
          Risk {rr.riskPips.toFixed(1)}p · Reward {rr.rewardPips.toFixed(1)}p · R:R {rr.rr.toFixed(2)}
          {rr.estimatedRiskMoney != null ? ` · Est. ${fxNum(rr.estimatedRiskMoney, 2)} / ${fxNum(rr.estimatedRewardMoney, 2)}` : ''}
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">Enter entry, stop (beyond), and target (beyond) on the same side.</p>
      )}
      <div className="border-t border-border/70 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Position size (estimated)</p>
        <Mini label="Account risk %" value={riskPct} onChange={setRiskPct} />
        {equity == null || !(equity > 0) ? (
          <p className="mt-1 text-[10px] text-muted-foreground">Sign in with a funded SIM account to estimate lots from equity.</p>
        ) : pipVal == null ? (
          <p className="mt-1 text-[10px] text-muted-foreground">Instrument pip/contract spec unavailable.</p>
        ) : suggested ? (
          <p className="mt-1 font-mono text-[10px] text-foreground">
            Suggested {suggested.lots.toFixed(2)} lots · est. risk {fxNum(suggested.estimatedRisk, 2)}
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-muted-foreground">Need a valid stop distance.</p>
        )}
      </div>
      <button
        type="button"
        disabled={!rr}
        onClick={() => {
          if (!rr) return;
          setDraft({
            nonce: Date.now(),
            price: String(e),
            sl: String(sl),
            tp: String(tp),
            volume: suggested ? String(Number(suggested.lots.toFixed(2))) : volume,
          });
        }}
        className="h-7 w-full rounded border border-border text-[10px] font-medium text-foreground hover:bg-muted disabled:opacity-40"
      >
        Apply to ticket (preview only)
      </button>
    </div>
  );
}

function Mini({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = `risk-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label className="block text-[9px] uppercase tracking-wide text-muted-foreground" htmlFor={id}>
      {label}
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 h-7 w-full rounded border border-border bg-background px-1.5 font-mono text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
