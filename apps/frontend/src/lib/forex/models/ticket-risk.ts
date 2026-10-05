/**
 * Pre-trade estimates for the order ticket. Never presented as booked values.
 */
import { computeRiskReward, pipSizeFromInstrument, pipValuePerLotFromSpec, priceDistancePips } from '../chart/pip-math';
import type { ForexInstrument } from './types';

export interface TicketRiskEstimate {
  slDistancePips: number | null;
  tpDistancePips: number | null;
  estimatedRisk: number | null;
  estimatedReward: number | null;
  riskReward: number | null;
  estimatedExposure: number | null;
}

export function estimateTicketRisk(args: {
  instrument?: ForexInstrument;
  side: 'buy' | 'sell';
  entry: string | number | null | undefined;
  sl?: string;
  tp?: string;
  volume: string;
}): TicketRiskEstimate {
  const empty: TicketRiskEstimate = {
    slDistancePips: null,
    tpDistancePips: null,
    estimatedRisk: null,
    estimatedReward: null,
    riskReward: null,
    estimatedExposure: null,
  };
  const inst = args.instrument;
  const entry = Number(args.entry);
  const vol = Number(args.volume);
  const cs = Number(inst?.contractSize ?? 0);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(vol) || vol <= 0) return empty;
  const pip = pipSizeFromInstrument({ pipSize: inst?.pipSize, digits: inst?.digits });
  const sl = args.sl?.trim() ? Number(args.sl) : NaN;
  const tp = args.tp?.trim() ? Number(args.tp) : NaN;
  const slPips = Number.isFinite(sl) ? priceDistancePips(entry, sl, pip) : null;
  const tpPips = Number.isFinite(tp) ? priceDistancePips(entry, tp, pip) : null;
  const pipVal = pipValuePerLotFromSpec({ pipSize: pip, contractSize: cs });
  const estimatedExposure = cs > 0 ? vol * cs * entry : null;
  if (Number.isFinite(sl) && Number.isFinite(tp) && sl > 0 && tp > 0) {
    const rr = computeRiskReward({
      entry,
      stop: sl,
      target: tp,
      pipSize: pip,
      volumeLots: vol,
      pipValuePerLot: pipVal,
    });
    if (rr) {
      return {
        slDistancePips: rr.riskPips,
        tpDistancePips: rr.rewardPips,
        estimatedRisk: rr.estimatedRiskMoney,
        estimatedReward: rr.estimatedRewardMoney,
        riskReward: rr.rr,
        estimatedExposure,
      };
    }
  }
  return {
    slDistancePips: slPips,
    tpDistancePips: tpPips,
    estimatedRisk: slPips != null && pipVal != null ? slPips * pipVal * vol : null,
    estimatedReward: tpPips != null && pipVal != null ? tpPips * pipVal * vol : null,
    riskReward: slPips && tpPips && slPips > 0 ? tpPips / slPips : null,
    estimatedExposure,
  };
}

export function stepLotVolume(
  current: string,
  direction: 1 | -1,
  bounds: { minVolume?: string; maxVolume?: string; volumeStep?: string }
): string {
  const stepRaw = bounds.volumeStep ?? '0.01';
  const step = Number(stepRaw);
  const min = Number(bounds.minVolume ?? '0.01');
  const max = Number(bounds.maxVolume ?? '100');
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.01;
  const safeMin = Number.isFinite(min) ? min : 0.01;
  const safeMax = Number.isFinite(max) && max >= safeMin ? max : safeMin;
  const cur = Number(current);
  const base = Number.isFinite(cur) ? cur : safeMin;
  const next = Math.min(safeMax, Math.max(safeMin, base + direction * safeStep));
  const decimals = stepRaw.includes('.') ? stepRaw.split('.')[1]?.length ?? 0 : 0;
  return next.toFixed(decimals);
}

/** Ticket input → protection price. Pips are a distance from entry, never sent raw. */
export function protectionPriceFromInput(args: {
  side: 'buy' | 'sell';
  kind: 'sl' | 'tp';
  entry: number | null;
  raw: string;
  mode: 'price' | 'pips';
  pipSize: number;
  digits: number;
}): string | undefined {
  const raw = args.raw.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const digits = Math.min(8, Math.max(0, args.digits));
  if (args.mode === 'price') return n.toFixed(digits);
  if (args.entry == null || !Number.isFinite(args.entry) || args.entry <= 0) return undefined;
  if (!Number.isFinite(args.pipSize) || args.pipSize <= 0) return undefined;
  const sign = args.kind === 'sl' ? (args.side === 'buy' ? -1 : 1) : args.side === 'buy' ? 1 : -1;
  const price = args.entry + sign * n * args.pipSize;
  if (!Number.isFinite(price) || price <= 0) return undefined;
  return price.toFixed(digits);
}
