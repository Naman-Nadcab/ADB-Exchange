import type { ForexExecutionRequest } from './request.js';
import type { ForexExecEventType, ForexExecReason, ForexExecutionState } from './states.js';

export interface ForexExecutionAttempt {
  attemptNo: number;
  provider: string;
  status: 'SUBMITTED' | 'ACK' | 'REJECT' | 'TIMEOUT' | 'MALFORMED';
  venueExecId: string | null;
  rejectReason: string | null;
  submittedAt: string;
  completedAt: string | null;
}

export interface ForexFill {
  fillId: string;
  executionId: string;
  clientExecId: string;
  venueExecId: string | null;
  provider: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: string;
  volume: string;
  timestamp: string;
  liquiditySource: 'MOCK';
}

export interface ForexExecutionEvent {
  eventId: string;
  executionId: string;
  clientExecId: string;
  timestamp: string;
  eventType: ForexExecEventType;
  provider?: string;
  reason?: ForexExecReason | string;
  metadata?: Record<string, unknown>;
}

export interface ForexExecutionRecord {
  executionId: string;
  clientExecId: string;
  fingerprint: string;
  request: ForexExecutionRequest;
  status: ForexExecutionState;
  selectedProvider: string | null;
  routingReason: string | null;
  snapshotStatus: string | null;
  expectedPrice: string | null;
  executionPrice: string | null;
  requestedVolume: string;
  filledVolume: string;
  remainingVolume: string;
  failureReason: ForexExecReason | null;
  source: 'SIMULATED';
  attempts: ForexExecutionAttempt[];
  fills: ForexFill[];
  events: ForexExecutionEvent[];
  createdAt: string;
  updatedAt: string;
}

export class ForexExecutionError extends Error {
  constructor(
    readonly reason: ForexExecReason,
    message: string
  ) {
    super(message);
    this.name = 'ForexExecutionError';
  }
}
