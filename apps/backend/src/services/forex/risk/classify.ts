/**
 * Risk-increasing vs risk-reducing. Never classify by BUY/SELL alone.
 * Uses the current netting position for the symbol.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexPositionRecord } from '../positions/models.js';

export type ForexRiskDirection = 'INCREASING' | 'REDUCING';

export interface ForexRiskClass {
  direction: ForexRiskDirection;
  kind: 'OPEN' | 'INCREASE' | 'PARTIAL_CLOSE' | 'FULL_CLOSE' | 'REVERSAL';
  currentVolume: string;
  resultingVolume: string;
}

export function classifyForexOrderRisk(args: {
  side: 'buy' | 'sell';
  volume: string;
  position: ForexPositionRecord | null | undefined;
}): ForexRiskClass {
  const orderVol = fxDecimal(args.volume);
  const pos = args.position && args.position.status === 'OPEN' && fxDecimal(args.position.volume).gt(0) ? args.position : null;
  if (!pos) {
    return { direction: 'INCREASING', kind: 'OPEN', currentVolume: '0', resultingVolume: orderVol.toFixed() };
  }
  const current = fxDecimal(pos.volume);
  const sameDir = (pos.side === 'long' && args.side === 'buy') || (pos.side === 'short' && args.side === 'sell');
  if (sameDir) {
    return {
      direction: 'INCREASING',
      kind: 'INCREASE',
      currentVolume: current.toFixed(),
      resultingVolume: current.plus(orderVol).toFixed(),
    };
  }
  if (orderVol.lt(current)) {
    return {
      direction: 'REDUCING',
      kind: 'PARTIAL_CLOSE',
      currentVolume: current.toFixed(),
      resultingVolume: current.minus(orderVol).toFixed(),
    };
  }
  if (orderVol.eq(current)) {
    return {
      direction: 'REDUCING',
      kind: 'FULL_CLOSE',
      currentVolume: current.toFixed(),
      resultingVolume: '0',
    };
  }
  return {
    direction: 'INCREASING',
    kind: 'REVERSAL',
    currentVolume: current.toFixed(),
    resultingVolume: orderVol.minus(current).toFixed(),
  };
}
