/**
 * Locked hedging volume uses no margin.
 * Run: npx tsx src/services/forex/risk/hedged-margin.test.ts
 */
import assert from 'node:assert/strict';
import type { ForexPositionRecord } from '../positions/models.js';
import { calculateForexExposure, hedgedMarginCharge } from './exposure.js';

function ticket(side: 'long' | 'short', volume: string, margin: string, symbol = 'EURUSD'): ForexPositionRecord {
  return {
    positionId: `${side}-${volume}`,
    accountId: 'acct',
    symbol,
    side,
    volume,
    entryPrice: '1.1',
    averageEntryPrice: '1.1',
    currentPrice: '1.1',
    lastPriceTimestamp: '2026-01-01T00:00:00.000Z',
    contractSize: '100000',
    leverage: '100',
    initialMargin: margin,
    maintenanceMargin: '1',
    exposure: '1000',
    status: 'OPEN',
    mode: 'HEDGING',
    version: 1,
    appliedFills: [],
    source: 'SIMULATED',
    valuationKind: 'CALCULATED',
    openedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    closedAt: null,
  };
}

const full = hedgedMarginCharge([ticket('long', '0.10', '110'), ticket('short', '0.10', '110')]);
assert.equal(full.used.toFixed(), '0', 'equal hedge margin is zero');

const open = calculateForexExposure([ticket('long', '1', '1000')]);
assert.equal(open.usedMargin, '1000', 'a single ticket still uses its margin');

const partial = hedgedMarginCharge([ticket('long', '1', '1000'), ticket('short', '0.40', '400')]);
assert.equal(partial.used.toFixed(), '600', 'only the unmatched 0.60 lot is charged');

const otherSymbol = hedgedMarginCharge([
  ticket('long', '1', '1000', 'EURUSD'),
  ticket('short', '1', '800', 'GBPUSD'),
]);
assert.equal(otherSymbol.used.toFixed(), '1800', 'different symbols do not hedge each other');

console.log('hedged-margin.test.ts ok');
