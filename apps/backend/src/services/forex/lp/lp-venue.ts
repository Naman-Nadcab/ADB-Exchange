import type { ForexCancelAck, ForexExecAck, ForexExecRequest, ForexExecutionVenue, ForexVenueHealth } from '../execution/venue.js';
import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import { LpApiError, lpCancelOrder, lpPlaceOrder } from './lp-api-client.js';

/** Execution venue that forwards place/cancel to the LP client. */
export class LpExecutionVenue implements ForexExecutionVenue {
  readonly id = FOREX_PROVIDER_IDS.LP;
  readonly code = 'LP-1';
  readonly name = 'External LP';
  private acceptCount = 0;
  private rejectCount = 0;
  private partialCount = 0;
  private lastAckAt: string | null = null;

  async placeOrder(req: ForexExecRequest): Promise<ForexExecAck> {
    const started = Date.now();
    try {
      const ack = await lpPlaceOrder({
        symbol: req.symbol,
        side: req.side,
        volume: req.volume,
        price: req.price,
        clientExecId: req.clientExecId,
      });
      const now = new Date().toISOString();
      this.lastAckAt = now;
      if (ack.status === 'accepted') this.acceptCount += 1;
      else if (ack.status === 'partial') this.partialCount += 1;
      else this.rejectCount += 1;
      return {
        clientExecId: req.clientExecId,
        venueOrderId: ack.venueOrderId,
        status: ack.status,
        filledVolume: ack.filledVolume,
        remainingVolume: ack.remainingVolume,
        avgPrice: ack.avgPrice,
        rejectReason: ack.rejectReason,
        venueCode: this.code,
        latencyMs: Date.now() - started,
        timestamp: now,
      };
    } catch (error) {
      this.rejectCount += 1;
      this.lastAckAt = new Date().toISOString();
      return {
        clientExecId: req.clientExecId,
        venueOrderId: null,
        status: 'rejected',
        filledVolume: '0',
        remainingVolume: req.volume,
        avgPrice: null,
        rejectReason: error instanceof LpApiError ? error.code : 'LP_REJECT',
        venueCode: this.code,
        latencyMs: Date.now() - started,
        timestamp: this.lastAckAt,
      };
    }
  }

  async cancelOrder(venueOrderId: string): Promise<ForexCancelAck> {
    try {
      const ack = await lpCancelOrder(venueOrderId);
      return { venueOrderId, cancelled: ack.cancelled, reason: ack.reason };
    } catch (error) {
      return { venueOrderId, cancelled: false, reason: error instanceof Error ? error.message : 'LP_CANCEL_FAILED' };
    }
  }

  async getHealth(): Promise<ForexVenueHealth> {
    const total = this.acceptCount + this.rejectCount + this.partialCount;
    return {
      venueCode: this.code,
      status: total === 0 ? 'HEALTHY' : this.rejectCount > this.acceptCount ? 'DEGRADED' : 'HEALTHY',
      lastAckAt: this.lastAckAt,
      acceptCount: this.acceptCount,
      rejectCount: this.rejectCount,
      partialCount: this.partialCount,
    };
  }
}
