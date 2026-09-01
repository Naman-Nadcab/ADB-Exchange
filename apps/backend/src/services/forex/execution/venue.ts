/**
 * Execution venue contract. Phase 2 defines the interface and a mock.
 * Phase 3 will call this from the order path. No customer orders here.
 */

export type ForexExecSide = 'buy' | 'sell';
export type ForexExecStatus = 'accepted' | 'rejected' | 'partial';

export interface ForexExecRequest {
  clientExecId: string;
  symbol: string;
  side: ForexExecSide;
  volume: string;
  price?: string;
  providerCode?: string;
}

export interface ForexExecAck {
  clientExecId: string;
  venueOrderId: string | null;
  status: ForexExecStatus;
  filledVolume: string;
  remainingVolume: string;
  avgPrice: string | null;
  rejectReason: string | null;
  venueCode: string;
  latencyMs: number;
  timestamp: string;
}

export interface ForexCancelAck {
  venueOrderId: string;
  cancelled: boolean;
  reason: string | null;
}

export interface ForexVenueHealth {
  venueCode: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  lastAckAt: string | null;
  acceptCount: number;
  rejectCount: number;
  partialCount: number;
}

export interface ForexExecutionVenue {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  placeOrder(req: ForexExecRequest): Promise<ForexExecAck>;
  cancelOrder(venueOrderId: string): Promise<ForexCancelAck>;
  getHealth(): Promise<ForexVenueHealth>;
}

/**
 * Routing decision only — not an order, fill, or ledger posting.
 */
export interface ForexExecutionDecision {
  symbol: string;
  side: ForexExecSide;
  requestedVolume: string;
  selectedProvider: string | null;
  quote: { bid: string; ask: string; providerCode: string } | null;
  expectedPrice: string | null;
  maxSlippage: string;
  routingReason: string;
  snapshotStatus: string;
  timestamp: string;
}
