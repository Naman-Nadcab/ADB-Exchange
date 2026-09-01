import { fxDecimal } from '../decimal-fx.js';
import type { ForexAppliedFill, ForexPositionEventType, ForexPositionSide } from './models.js';

export interface NettingState {
  side: ForexPositionSide;
  volume: string;
  entryPrice: string;
  status: 'OPEN' | 'CLOSED';
}

export interface NettingResult {
  before: NettingState | null;
  after: NettingState;
  eventType: ForexPositionEventType;
  closedVolume: string;
  openedVolume: string;
}

export function fillSideToPosition(side: 'buy' | 'sell'): ForexPositionSide {
  return side === 'buy' ? 'long' : 'short';
}

/**
 * NETTING apply. Opposite-side reduces; equal volume closes; excess reverses.
 * Reduction preserves entry price. Increase uses weighted average.
 * Reverse opens the leftover at the fill price.
 */
export function applyNettingFill(current: NettingState | null, fill: ForexAppliedFill): NettingResult {
  const fillVol = fxDecimal(fill.volume);
  const fillPx = fxDecimal(fill.price);
  if (!fillVol.gt(0) || !fillPx.gt(0)) {
    throw new Error('INVALID_FILL');
  }
  const incoming = fillSideToPosition(fill.side);

  if (!current || current.status === 'CLOSED' || !fxDecimal(current.volume).gt(0)) {
    return {
      before: current,
      after: { side: incoming, volume: fillVol.toFixed(), entryPrice: fillPx.toFixed(), status: 'OPEN' },
      eventType: 'POSITION_OPENED',
      closedVolume: '0',
      openedVolume: fillVol.toFixed(),
    };
  }

  const curVol = fxDecimal(current.volume);
  const curPx = fxDecimal(current.entryPrice);

  if (incoming === current.side) {
    const nextVol = curVol.plus(fillVol);
    const avg = curVol.times(curPx).plus(fillVol.times(fillPx)).div(nextVol);
    return {
      before: current,
      after: { side: current.side, volume: nextVol.toFixed(), entryPrice: avg.toFixed(), status: 'OPEN' },
      eventType: 'POSITION_INCREASED',
      closedVolume: '0',
      openedVolume: fillVol.toFixed(),
    };
  }

  if (fillVol.lt(curVol)) {
    return {
      before: current,
      after: { side: current.side, volume: curVol.minus(fillVol).toFixed(), entryPrice: curPx.toFixed(), status: 'OPEN' },
      eventType: 'POSITION_REDUCED',
      closedVolume: fillVol.toFixed(),
      openedVolume: '0',
    };
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

  const leftover = fillVol.minus(curVol);
  return {
    before: current,
    after: { side: incoming, volume: leftover.toFixed(), entryPrice: fillPx.toFixed(), status: 'OPEN' },
    eventType: 'POSITION_REVERSED',
    closedVolume: curVol.toFixed(),
    openedVolume: leftover.toFixed(),
  };
}

/** Replay fills to reconstruct netting volume/side/entry. Used for reconciliation (no silent repair). */
export function replayNetting(fills: ForexAppliedFill[]): NettingState | null {
  let state: NettingState | null = null;
  for (const f of fills) {
    state = applyNettingFill(state, f).after;
    if (state.status === 'CLOSED') state = null;
  }
  return state;
}
