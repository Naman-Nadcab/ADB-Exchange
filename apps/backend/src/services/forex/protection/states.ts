export const FOREX_PROTECTION_TYPES = ['STOP_LOSS', 'TAKE_PROFIT'] as const;
export type ForexProtectionType = (typeof FOREX_PROTECTION_TYPES)[number];

export const FOREX_PROTECTION_STATES = [
  'ACTIVE',
  'TRIGGERING',
  'TRIGGERED',
  'EXECUTING',
  'FILLED',
  'CANCELLED',
  'FAILED',
] as const;
export type ForexProtectionState = (typeof FOREX_PROTECTION_STATES)[number];

const TRANSITIONS: Readonly<Record<ForexProtectionState, readonly ForexProtectionState[]>> = {
  ACTIVE: ['TRIGGERING', 'CANCELLED'],
  TRIGGERING: ['TRIGGERED', 'FAILED'],
  TRIGGERED: ['EXECUTING', 'FAILED'],
  EXECUTING: ['FILLED', 'FAILED'],
  FILLED: [],
  CANCELLED: [],
  FAILED: [],
};

export function canProtectionTransition(from: ForexProtectionState, to: ForexProtectionState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertProtectionTransition(from: ForexProtectionState, to: ForexProtectionState): void {
  if (!canProtectionTransition(from, to)) {
    throw new Error(`INVALID_PROTECTION_TRANSITION:${from}->${to}`);
  }
}
