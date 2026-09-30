/**
 * HEDGING position math.
 *
 * Opens always create a new independent position (no same-side aggregation).
 * Reduces target a specific open position; never nets against another position;
 * never reverses leftover into a new opposite position on reduce.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexAppliedFill, ForexPositionEventType, ForexPositionSide } from './models.js';
import { fillSideToPosition, type NettingResult, type NettingState } from './netting.js';

export function applyHedgingOpen(fill: ForexAppliedFill): NettingResult {
  const fillVol = fxDecimal(fill.volume);
  const fillPx = fxDecimal(fill.price);
  if (!fillVol.gt(0) || !fillPx.gt(0)) {
    throw new Error('INVALID_FILL');
  }
  const side = fillSideToPosition(fill.side);
  return {
    before: null,
    after: { side, volume: fillVol.toFixed(), entryPrice: fillPx.toFixed(), status: 'OPEN' },
    eventType: 'POSITION_OPENED',
    closedVolume: '0',
    openedVolume: fillVol.toFixed(),
  };
}

/**
 * Reduce (partial/full close) a specific hedged position with an opposite-side fill.
 * Refuses same-side fills and oversize fills (no reverse).
 */
export function applyHedgingReduce(current: NettingState, fill: ForexAppliedFill): NettingResult {
  const fillVol = fxDecimal(fill.volume);
  const fillPx = fxDecimal(fill.price);
  if (!fillVol.gt(0) || !fillPx.gt(0)) {
    throw new Error('INVALID_FILL');
  }
  if (current.status !== 'OPEN' || !fxDecimal(current.volume).gt(0)) {
    throw new Error('POSITION_CLOSED');
  }
  const incoming = fillSideToPosition(fill.side);
  if (incoming === current.side) {
    throw new Error('HEDGE_REDUCE_SAME_SIDE');
  }
  const curVol = fxDecimal(current.volume);
  const curPx = fxDecimal(current.entryPrice);
  if (fillVol.gt(curVol)) {
    throw new Error('CLOSE_VOLUME_EXCEEDS_POSITION');
  }
  if (fillVol.eq(curVol)) {
    return {
      before: current,
      after: { side: current.side, volume: '0', entryPrice: curPx.toFixed(), status: 'CLOSED' },
      eventType: 'POSITION_CLOSED',
      closedVolume: fillVol.toFixed(),
      openedVolume: '0',
    };
  }
  return {
    before: current,
    after: { side: current.side, volume: curVol.minus(fillVol).toFixed(), entryPrice: curPx.toFixed(), status: 'OPEN' },
    eventType: 'POSITION_REDUCED',
    closedVolume: fillVol.toFixed(),
    openedVolume: '0',
  };
}

export function hedgingFillSideOk(positionSide: ForexPositionSide, fillSide: 'buy' | 'sell'): boolean {
  return fillSideToPosition(fillSide) !== positionSide;
}

export type { ForexPositionEventType };
