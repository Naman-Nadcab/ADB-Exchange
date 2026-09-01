export const FOREX_ORDER_STATES = [
  'NEW',
  'VALIDATING',
  'ROUTING',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'FILLED',
  'REJECTED',
  'CANCEL_PENDING',
  'CANCELLED',
  'FAILED',
] as const;

export type ForexOrderState = (typeof FOREX_ORDER_STATES)[number];

const TRANSITIONS: Readonly<Record<ForexOrderState, readonly ForexOrderState[]>> = {
  NEW: ['VALIDATING', 'CANCELLED'],
  VALIDATING: ['ROUTING', 'REJECTED'],
  ROUTING: ['SUBMITTED', 'REJECTED', 'FAILED'],
  SUBMITTED: ['PARTIALLY_FILLED', 'FILLED', 'REJECTED', 'FAILED', 'CANCEL_PENDING'],
  PARTIALLY_FILLED: ['FILLED', 'CANCEL_PENDING', 'FAILED'],
  CANCEL_PENDING: ['CANCELLED', 'PARTIALLY_FILLED'],
  FILLED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
};

export const FOREX_ORDER_TERMINAL: ReadonlySet<ForexOrderState> = new Set([
  'FILLED',
  'REJECTED',
  'CANCELLED',
  'FAILED',
]);

export function canOrderTransition(from: ForexOrderState, to: ForexOrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: ForexOrderState, to: ForexOrderState): void {
  if (!canOrderTransition(from, to)) {
    throw new Error(`INVALID_ORDER_STATE_TRANSITION:${from}->${to}`);
  }
}

export const FOREX_ORDER_EVENT_TYPES = [
  'ORDER_CREATED',
  'ORDER_VALIDATION_STARTED',
  'ORDER_VALIDATION_FAILED',
  'ORDER_ROUTING',
  'ORDER_SUBMITTED',
  'ORDER_ACKNOWLEDGED',
  'ORDER_PARTIAL_FILL',
  'ORDER_FILLED',
  'ORDER_REJECTED',
  'ORDER_CANCEL_REQUESTED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
  'ORDER_IDEMPOTENCY_HIT',
] as const;

export type ForexOrderEventType = (typeof FOREX_ORDER_EVENT_TYPES)[number];

export const FOREX_ORDER_REASONS = [
  'OK',
  'INVALID_CLIENT_ORDER_ID',
  'UNKNOWN_INSTRUMENT',
  'INSTRUMENT_HALTED',
  'INVALID_SIDE',
  'INVALID_VOLUME',
  'INVALID_VOLUME_PRECISION',
  'INVALID_VOLUME_STEP',
  'INVALID_PRICE',
  'INVALID_SLIPPAGE',
  'INVALID_DEVIATION',
  'UNSUPPORTED_ORDER_TYPE',
  'UNAUTHENTICATED',
  'IDEMPOTENCY_CONFLICT',
  'DUPLICATE',
  'CANCEL_NOT_SUPPORTED',
  'CANCEL_FILLED_REJECTED',
  'ORDER_NOT_FOUND',
  'FORBIDDEN',
  'OVERFILL',
  'INVALID_STATE_TRANSITION',
] as const;

export type ForexOrderReason = (typeof FOREX_ORDER_REASONS)[number];
