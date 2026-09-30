/**
 * Run: npx tsx apps/frontend/src/lib/forex/chart/indicator-registry.test.ts
 */
import assert from 'node:assert/strict';
import { FOREX_INDICATOR_REGISTRY, getForexIndicatorDefinition } from './indicator-registry.js';

const required = [
  'sma',
  'ema',
  'wma',
  'smma',
  'rsi',
  'macd',
  'stochastic',
  'cci',
  'momentum',
  'roc',
  'williams_r',
  'adx',
  'ichimoku',
  'psar',
  'atr',
  'bb',
  'obv',
  'mfi',
];

for (const id of required) {
  assert.ok(getForexIndicatorDefinition(id), `missing ${id}`);
}

const overlay = new Set(['sma', 'ema', 'wma', 'smma', 'ichimoku', 'psar', 'bb']);
for (const d of FOREX_INDICATOR_REGISTRY) {
  if (overlay.has(d.id)) assert.equal(d.pane, 'overlay', `${d.id} pane`);
  else assert.equal(d.pane, 'oscillator', `${d.id} pane`);
}

const bars = Array.from({ length: 80 }, (_, i) => ({
  time: 1_700_000_000 + i * 3600,
  open: 1.1 + i * 0.0001,
  high: 1.101 + i * 0.0001,
  low: 1.099 + i * 0.0001,
  close: 1.1 + i * 0.0001,
}));

const rsiDef = getForexIndicatorDefinition('rsi')!;
const out = rsiDef.compute(bars, { period: 14 });
assert.ok(out.lines[0]!.points.length > 0, 'rsi points');

console.log('indicator-registry.test.ts ok');
