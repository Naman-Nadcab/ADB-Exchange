import type { ForexAccountRiskState } from './states.js';

export class ForexRiskError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = 'ForexRiskError';
  }
}

export interface ForexAccountRiskRecord {
  accountId: string;
  state: ForexAccountRiskState;
  reason: string | null;
  updatedAt: string;
}

export interface ForexRiskEvent {
  eventId: string;
  accountId: string;
  eventType: string;
  reason: string | null;
  fromState?: ForexAccountRiskState;
  toState?: ForexAccountRiskState;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ForexPreTradeDecision {
  ok: boolean;
  reason: string | null;
  state: ForexAccountRiskState;
  direction: 'INCREASING' | 'REDUCING';
  kind: string;
  source: 'SIMULATED';
  executionMode: 'MOCK';
}
