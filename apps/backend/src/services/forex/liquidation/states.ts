export const FOREX_LIQUIDATION_STATES = [
  'NOT_ELIGIBLE',
  'ELIGIBLE',
  'PENDING',
  'EXECUTING',
  'PARTIALLY_LIQUIDATED',
  'LIQUIDATED',
  'FAILED',
  'HALTED',
] as const;
export type ForexLiquidationState = (typeof FOREX_LIQUIDATION_STATES)[number];

const TRANSITIONS: Readonly<Record<ForexLiquidationState, readonly ForexLiquidationState[]>> = {
  NOT_ELIGIBLE: ['ELIGIBLE', 'HALTED'],
  ELIGIBLE: ['PENDING', 'NOT_ELIGIBLE', 'HALTED'],
  PENDING: ['EXECUTING', 'FAILED', 'HALTED'],
  EXECUTING: ['PARTIALLY_LIQUIDATED', 'LIQUIDATED', 'FAILED', 'HALTED'],
  PARTIALLY_LIQUIDATED: ['EXECUTING', 'LIQUIDATED', 'FAILED', 'HALTED'],
  LIQUIDATED: [],
  FAILED: [],
  HALTED: [],
};

export function canLiquidationTransition(from: ForexLiquidationState, to: ForexLiquidationState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertLiquidationTransition(from: ForexLiquidationState, to: ForexLiquidationState): void {
  if (!canLiquidationTransition(from, to)) {
    throw new Error(`INVALID_LIQUIDATION_TRANSITION:${from}->${to}`);
  }
}

export const FOREX_LIQUIDATION_ACTIVE = new Set<ForexLiquidationState>([
  'PENDING',
  'EXECUTING',
  'PARTIALLY_LIQUIDATED',
]);
