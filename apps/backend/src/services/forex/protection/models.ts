import type { ForexProtectionState, ForexProtectionType } from './states.js';

export class ForexProtectionError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = 'ForexProtectionError';
  }
}

export interface ForexProtectionRecord {
  protectionId: string;
  clientProtectionId: string;
  accountId: string;
  positionId: string;
  symbol: string;
  positionSide: 'long' | 'short';
  type: ForexProtectionType;
  volume: string;
  triggerPrice: string;
  /** Absolute price distance. Absent/null when trailing is not set. */
  trailingDistance?: string | null;
  status: ForexProtectionState;
  fingerprint: string;
  lastQuoteKey: string | null;
  lastEvalPrice: string | null;
  lastEvalSource: 'BID' | 'ASK' | null;
  orderId: string | null;
  failureReason: string | null;
  source: 'SIMULATED';
  executionMode: 'MOCK';
  createdAt: string;
  updatedAt: string;
}

export interface ForexProtectionEvent {
  eventId: string;
  protectionId: string;
  accountId: string;
  eventType: string;
  quoteKey?: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ForexProtectionRequest {
  clientProtectionId: string;
  positionId: string;
  type: ForexProtectionType;
  triggerPrice: string;
  volume?: string;
  trailingDistance?: string;
}

export function protectionFingerprint(req: {
  type: string;
  positionId: string;
  volume: string;
  triggerPrice: string;
}): string {
  return [req.type, req.positionId, req.volume, req.triggerPrice].join('|');
}

export function publicForexProtection(p: ForexProtectionRecord) {
  return {
    protectionId: p.protectionId,
    clientProtectionId: p.clientProtectionId,
    positionId: p.positionId,
    symbol: p.symbol,
    positionSide: p.positionSide,
    type: p.type,
    volume: p.volume,
    triggerPrice: p.triggerPrice,
    trailingDistance: p.trailingDistance,
    status: p.status,
    lastEvalPrice: p.lastEvalPrice,
    lastEvalSource: p.lastEvalSource,
    orderId: p.orderId,
    failureReason: p.failureReason,
    source: p.source,
    executionMode: p.executionMode,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
