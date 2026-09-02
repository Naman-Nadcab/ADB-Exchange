/**
 * Instrument-aware pip / R:R helpers. No fake account balances.
 */

export function pipSizeFromInstrument(args: { pipSize?: string | null; digits?: number }): number {
  const fromSpec = Number(args.pipSize);
  if (Number.isFinite(fromSpec) && fromSpec > 0) return fromSpec;
  const digits = Math.max(0, Math.min(args.digits ?? 5, 8));
  // Common FX convention: pip = 10 * tick for 5/3 digit quotes.
  if (digits === 3 || digits === 5) return Math.pow(10, -(digits - 1));
  return Math.pow(10, -Math.max(digits, 1));
}

export function priceDistancePips(a: number, b: number, pipSize: number): number | null {
  if (![a, b, pipSize].every((n) => Number.isFinite(n)) || pipSize <= 0) return null;
  return Math.abs(a - b) / pipSize;
}

export function priceChangePct(from: number, to: number): number | null {
  if (![from, to].every((n) => Number.isFinite(n)) || from === 0) return null;
  return ((to - from) / from) * 100;
}

export type RiskRewardInput = {
  entry: number;
  stop: number;
  target: number;
  pipSize: number;
  /** Optional lot volume for estimated monetary risk when pipValue available. */
  volumeLots?: number | null;
  /** Monetary value of 1 pip for 1.00 lot, if known from contract. */
  pipValuePerLot?: number | null;
};

export type RiskRewardResult = {
  riskPips: number;
  rewardPips: number;
  rr: number;
  riskPctOfEntry: number;
  rewardPctOfEntry: number;
  estimatedRiskMoney: number | null;
  estimatedRewardMoney: number | null;
  side: 'long' | 'short';
};

export function computeRiskReward(input: RiskRewardInput): RiskRewardResult | null {
  const { entry, stop, target, pipSize } = input;
  if (![entry, stop, target, pipSize].every((n) => Number.isFinite(n) && n > 0) || pipSize <= 0) return null;
  if (stop === entry || target === entry) return null;
  const long = target > entry && stop < entry;
  const short = target < entry && stop > entry;
  if (!long && !short) return null;
  const riskPips = Math.abs(entry - stop) / pipSize;
  const rewardPips = Math.abs(target - entry) / pipSize;
  if (riskPips <= 0 || rewardPips <= 0) return null;
  const lots = input.volumeLots != null && Number.isFinite(input.volumeLots) ? Number(input.volumeLots) : null;
  const pipVal = input.pipValuePerLot != null && Number.isFinite(input.pipValuePerLot) ? Number(input.pipValuePerLot) : null;
  const money =
    lots != null && lots > 0 && pipVal != null && pipVal > 0
      ? { risk: riskPips * pipVal * lots, reward: rewardPips * pipVal * lots }
      : null;
  return {
    riskPips,
    rewardPips,
    rr: rewardPips / riskPips,
    riskPctOfEntry: (Math.abs(entry - stop) / entry) * 100,
    rewardPctOfEntry: (Math.abs(target - entry) / entry) * 100,
    estimatedRiskMoney: money?.risk ?? null,
    estimatedRewardMoney: money?.reward ?? null,
    side: long ? 'long' : 'short',
  };
}

/** Quote-currency pip value of 1.00 lot from instrument spec. No FX conversion. */
export function pipValuePerLotFromSpec(args: { pipSize: number; contractSize: number }): number | null {
  if (![args.pipSize, args.contractSize].every((n) => Number.isFinite(n) && n > 0)) return null;
  return args.pipSize * args.contractSize;
}

/**
 * Suggested lots from account risk % and stop distance.
 * Calculator only — never places an order. Requires a real equity figure.
 */
export function suggestPositionSize(args: {
  equity: number;
  riskPercent: number;
  stopPips: number;
  pipValuePerLot: number;
}): { lots: number; estimatedRisk: number } | null {
  const { equity, riskPercent, stopPips, pipValuePerLot } = args;
  if (![equity, riskPercent, stopPips, pipValuePerLot].every((n) => Number.isFinite(n))) return null;
  if (equity <= 0 || riskPercent <= 0 || stopPips <= 0 || pipValuePerLot <= 0) return null;
  const estimatedRisk = equity * (riskPercent / 100);
  const lots = estimatedRisk / (stopPips * pipValuePerLot);
  if (!Number.isFinite(lots) || lots <= 0) return null;
  return { lots, estimatedRisk };
}
