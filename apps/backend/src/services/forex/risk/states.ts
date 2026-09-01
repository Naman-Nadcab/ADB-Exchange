export const FOREX_ACCOUNT_RISK_STATES = [
  'NORMAL',
  'WARNING',
  'RESTRICTED',
  'LIQUIDATION_ONLY',
  'HALTED',
] as const;
export type ForexAccountRiskState = (typeof FOREX_ACCOUNT_RISK_STATES)[number];

const TRANSITIONS: Readonly<Record<ForexAccountRiskState, readonly ForexAccountRiskState[]>> = {
  NORMAL: ['WARNING', 'RESTRICTED', 'LIQUIDATION_ONLY', 'HALTED'],
  WARNING: ['NORMAL', 'RESTRICTED', 'LIQUIDATION_ONLY', 'HALTED'],
  RESTRICTED: ['NORMAL', 'WARNING', 'LIQUIDATION_ONLY', 'HALTED'],
  LIQUIDATION_ONLY: ['NORMAL', 'WARNING', 'RESTRICTED', 'HALTED'],
  HALTED: ['NORMAL', 'WARNING', 'RESTRICTED', 'LIQUIDATION_ONLY'],
};

export function canAccountRiskTransition(from: ForexAccountRiskState, to: ForexAccountRiskState): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function assertAccountRiskTransition(from: ForexAccountRiskState, to: ForexAccountRiskState): void {
  if (!canAccountRiskTransition(from, to)) {
    throw new Error(`INVALID_ACCOUNT_RISK_TRANSITION:${from}->${to}`);
  }
}

/** Rank for escalation (higher = more severe). Warning never implies liquidation. */
export function riskStateRank(state: ForexAccountRiskState): number {
  return { NORMAL: 0, WARNING: 1, RESTRICTED: 2, LIQUIDATION_ONLY: 3, HALTED: 4 }[state];
}

export function maxRiskState(a: ForexAccountRiskState, b: ForexAccountRiskState): ForexAccountRiskState {
  return riskStateRank(a) >= riskStateRank(b) ? a : b;
}
