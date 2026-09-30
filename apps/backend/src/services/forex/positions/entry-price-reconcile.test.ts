/**
 * Position entry_price reconciliation at NUMERIC(20,8) persist scale.
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/positions/entry-price-reconcile.test.ts
 */
import assert from 'node:assert/strict';
import { fxDecimal, fxToPriceString } from '../decimal-fx.js';
import { replayNetting } from './netting.js';
import { resetForexPositionServiceForTests } from './service.js';
import type { ForexAppliedFill } from './models.js';

const QA_FILLS: ForexAppliedFill[] = [
  { fillId: '1', side: 'sell', volume: '0.10000000', price: '1.15503000', timestamp: 't' },
  { fillId: '2', side: 'buy', volume: '0.05000000', price: '1.15498000', timestamp: 't' },
  { fillId: '3', side: 'sell', volume: '0.05000000', price: '1.15500000', timestamp: 't' },
  { fillId: '4', side: 'buy', volume: '0.01000000', price: '1.15504000', timestamp: 't' },
  { fillId: '5', side: 'buy', volume: '0.01000000', price: '1.16500000', timestamp: 't' },
  { fillId: '6', side: 'buy', volume: '0.01000000', price: '1.16500000', timestamp: 't' },
  { fillId: '7', side: 'buy', volume: '0.01000000', price: '1.16500000', timestamp: 't' },
  { fillId: '8', side: 'buy', volume: '0.01000000', price: '1.16008000', timestamp: 't' },
  { fillId: '9', side: 'sell', volume: '0.01000000', price: '1.15996000', timestamp: 't' },
  { fillId: '10', side: 'buy', volume: '0.01000000', price: '0.66145000', timestamp: 't' },
  { fillId: '11', side: 'sell', volume: '0.01000000', price: '1.16002000', timestamp: 't' },
  { fillId: '12', side: 'buy', volume: '0.01000000', price: '1.16000000', timestamp: 't' },
  { fillId: '13', side: 'sell', volume: '0.01000000', price: '0.69142000', timestamp: 't' },
  { fillId: '14', side: 'buy', volume: '0.01000000', price: '0.76145000', timestamp: 't' },
  { fillId: '15', side: 'sell', volume: '0.01000000', price: '0.66145000', timestamp: 't' },
  { fillId: '16', side: 'buy', volume: '0.01000000', price: '1.15992000', timestamp: 't' },
  { fillId: '17', side: 'sell', volume: '0.01000000', price: '1.15992000', timestamp: 't' },
  { fillId: '18', side: 'buy', volume: '0.01000000', price: '1.15995000', timestamp: 't' },
];

{
  const replayed = replayNetting(QA_FILLS);
  assert.ok(replayed);
  assert.equal(replayed.side, 'short');
  assert.equal(replayed.volume, '0.05');
  const scaled = fxToPriceString(fxDecimal(replayed.entryPrice), 8);
  assert.equal(scaled, '1.03450517', 'QA replay entry at 8dp (banker round)');
  assert.ok(fxDecimal(replayed.entryPrice).minus('1.034505169110082').abs().lt('0.000000001'));

  const svc = resetForexPositionServiceForTests();
  const position = {
    positionId: 'qa-pos',
    accountId: 'qa',
    symbol: 'EURUSD',
    side: 'short' as const,
    volume: '0.05000000',
    entryPrice: '1.03450518',
    averageEntryPrice: '1.03450518',
    currentPrice: '1.17',
    lastPriceTimestamp: 't',
    contractSize: '100000',
    leverage: '100',
    initialMargin: '1',
    maintenanceMargin: '1',
    exposure: '1',
    status: 'OPEN' as const,
    mode: 'NETTING' as const,
    version: 1,
    appliedFills: QA_FILLS,
    source: 'SIMULATED' as const,
    valuationKind: 'CALCULATED' as const,
    openedAt: 't',
    updatedAt: 't',
    closedAt: null,
  };
  assert.equal(svc.reconcile(position).ok, true, 'equivalent entry at persist scale must pass');

  const wrong = { ...position, entryPrice: '1.03450500' };
  const bad = svc.reconcile(wrong);
  assert.equal(bad.ok, false);
  assert.equal(bad.ok === false && bad.reason, 'POSITION_RECONCILIATION_ERROR');
}

console.log('entry-price-reconcile.test.ts ok');
