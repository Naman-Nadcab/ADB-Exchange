import { fxDecimal } from '../decimal-fx.js';
import type {
  ForexCancelAck,
  ForexExecAck,
  ForexExecRequest,
  ForexExecutionVenue,
  ForexVenueHealth,
} from './venue.js';

/**
 * Deterministic mock venue for automated tests only.
 * Never writes Forex positions, P&L, or Crypto settlement.
 */
export class MockForexExecutionVenue implements ForexExecutionVenue {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  private acceptCount = 0;
  private rejectCount = 0;
  private partialCount = 0;
  private lastAckAt: Date | null = null;
  private readonly live = new Map<string, ForexExecAck>();
  private n = 0;

  constructor(code = 'MOCK-A', name = 'EDA Mock Execution A', id = 'f0000000-0000-4000-8000-0000000000a1') {
    this.code = code;
    this.name = name;
    this.id = id;
  }

  async placeOrder(req: ForexExecRequest): Promise<ForexExecAck> {
    this.n += 1;
    const now = new Date();
    const volume = fxDecimal(req.volume);
    const half = volume.div(2);
    let status: ForexExecAck['status'] = 'accepted';
    let filled = volume;
    let rejectReason: string | null = null;

    if (!volume.gt(0) || req.clientExecId.includes('REJECT') || req.volume === '0') {
      status = 'rejected';
      filled = fxDecimal(0);
      rejectReason = 'MOCK_REJECT';
      this.rejectCount += 1;
    } else if (req.clientExecId.includes('PARTIAL') || req.volume.endsWith('03')) {
      status = 'partial';
      filled = half;
      this.partialCount += 1;
    } else {
      this.acceptCount += 1;
    }

    const ack: ForexExecAck = {
      clientExecId: req.clientExecId,
      venueOrderId: status === 'rejected' ? null : `mock-${this.code}-${this.n}`,
      status,
      filledVolume: filled.toFixed(),
      remainingVolume: volume.minus(filled).toFixed(),
      avgPrice: status === 'rejected' ? null : (req.price ?? null),
      rejectReason,
      venueCode: this.code,
      latencyMs: 0,
      timestamp: now.toISOString(),
    };
    this.lastAckAt = now;
    if (ack.venueOrderId) this.live.set(ack.venueOrderId, ack);
    return ack;
  }

  async cancelOrder(venueOrderId: string): Promise<ForexCancelAck> {
    const existing = this.live.get(venueOrderId);
    if (!existing) return { venueOrderId, cancelled: false, reason: 'NOT_FOUND' };
    this.live.delete(venueOrderId);
    return { venueOrderId, cancelled: true, reason: null };
  }

  async getHealth(): Promise<ForexVenueHealth> {
    return {
      venueCode: this.code,
      status: 'HEALTHY',
      lastAckAt: this.lastAckAt?.toISOString() ?? null,
      acceptCount: this.acceptCount,
      rejectCount: this.rejectCount,
      partialCount: this.partialCount,
    };
  }
}
