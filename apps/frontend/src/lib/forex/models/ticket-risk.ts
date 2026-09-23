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
