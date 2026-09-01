/**
 * Deterministic liquidation selection. Never random.
 *
 * 1. Highest used-margin contribution (initialMargin) first — worst cushion drain
 * 2. Then highest exposure
 * 3. Then positionId ascending
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexPositionRecord } from '../positions/models.js';

export function rankLiquidationCandidates(positions: ForexPositionRecord[]): ForexPositionRecord[] {
  const open = positions.filter((p) => p.status === 'OPEN' && fxDecimal(p.volume).gt(0));
  return [...open].sort((a, b) => {
    const marginCmp = fxDecimal(b.initialMargin).cmp(fxDecimal(a.initialMargin));
    if (marginCmp !== 0) return marginCmp;
    const expCmp = fxDecimal(b.exposure).cmp(fxDecimal(a.exposure));
    if (expCmp !== 0) return expCmp;
    return a.positionId < b.positionId ? -1 : a.positionId > b.positionId ? 1 : 0;
  });
}
