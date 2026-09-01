import type { ForexLiquidationState } from './states.js';

export class ForexLiquidationError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = 'ForexLiquidationError';
  }
}

export interface ForexLiquidationRecord {
  liquidationId: string;
  accountId: string;
  status: ForexLiquidationState;
  reason: string;
  equity: string | null;
  usedMargin: string;
  maintenanceMargin: string;
  marginLevel: string | null;
  selectedPositionId: string | null;
  attempt: number;
  orderIds: string[];
  source: 'SIMULATED';
  executionMode: 'MOCK';
  createdAt: string;
  updatedAt: string;
}

export interface ForexLiquidationEvent {
  eventId: string;
  liquidationId: string;
  accountId: string;
  eventType: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function publicForexLiquidation(l: ForexLiquidationRecord) {
  return {
    liquidationId: l.liquidationId,
    status: l.status,
    reason: l.reason,
    equity: l.equity,
    usedMargin: l.usedMargin,
    maintenanceMargin: l.maintenanceMargin,
    marginLevel: l.marginLevel,
    selectedPositionId: l.selectedPositionId,
    attempt: l.attempt,
    orderIds: l.orderIds,
    source: l.source,
    executionMode: l.executionMode,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
