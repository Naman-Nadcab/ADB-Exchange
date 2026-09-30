import type { ForexPositionMode } from './mode.js';

export type ForexPositionSide = 'long' | 'short';
export type ForexPositionStatus = 'OPEN' | 'CLOSED';

export interface ForexAppliedFill {
  fillId: string;
  side: 'buy' | 'sell';
  volume: string;
  price: string;
  timestamp: string;
  executionId?: string;
  orderId?: string;
}

export interface ForexPositionRecord {
  positionId: string;
  accountId: string;
  symbol: string;
  side: ForexPositionSide;
  volume: string;
  entryPrice: string;
  averageEntryPrice: string;
  currentPrice: string;
  lastPriceTimestamp: string;
  contractSize: string;
  leverage: string;
  initialMargin: string;
  maintenanceMargin: string;
  exposure: string;
  status: ForexPositionStatus;
  mode: ForexPositionMode;
  version: number;
  appliedFills: ForexAppliedFill[];
  source: 'SIMULATED';
  valuationKind: 'CALCULATED';
  openedAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface ForexPositionEvent {
  eventId: string;
  positionId: string;
  accountId: string;
  symbol: string;
  side: ForexPositionSide | null;
  volume: string | null;
  entryPrice: string | null;
  eventType: ForexPositionEventType;
  sourceFillId: string | null;
  timestamp: string;
  reason: string | null;
  metadata?: Record<string, unknown>;
}

export const FOREX_POSITION_EVENT_TYPES = [
  'POSITION_OPENED',
  'POSITION_INCREASED',
  'POSITION_REDUCED',
  'POSITION_CLOSED',
  'POSITION_REVERSED',
  'POSITION_RECOVERED',
  'POSITION_UPDATE_REJECTED',
  'POSITION_RECONCILIATION_ERROR',
] as const;

export type ForexPositionEventType = (typeof FOREX_POSITION_EVENT_TYPES)[number];

export class ForexPositionError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = 'ForexPositionError';
  }
}

export function publicForexPosition(p: ForexPositionRecord) {
  return {
    positionId: p.positionId,
    symbol: p.symbol,
    side: p.side,
    volume: p.volume,
    entryPrice: p.entryPrice,
    averageEntryPrice: p.averageEntryPrice,
    currentPrice: p.currentPrice,
    contractSize: p.contractSize,
    leverage: p.leverage,
    initialMargin: p.initialMargin,
    maintenanceMargin: p.maintenanceMargin,
    exposure: p.exposure,
    status: p.status,
    mode: p.mode,
    version: p.version,
    source: p.source,
    valuationKind: p.valuationKind,
    openedAt: p.openedAt,
    updatedAt: p.updatedAt,
    closedAt: p.closedAt,
  };
}

export interface ForexPositionFillInput {
  fillId: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: string;
  price: string;
  timestamp: string;
  executionId?: string;
  orderId?: string;
  /**
   * When set, apply as reduce-only against this position (HEDGING closes /
   * protection / liquidation). Required for HEDGING reduce intents.
   */
  reducePositionId?: string;
  /** Order intent hint — open vs reduce. Default treated as open/customer. */
  intent?: 'CUSTOMER' | 'CUSTOMER_CLOSE' | 'PROTECTION_CLOSE' | 'LIQUIDATION_CLOSE';
}
