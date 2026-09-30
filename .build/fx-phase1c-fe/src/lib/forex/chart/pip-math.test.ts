/**
 * Run: npx tsx apps/frontend/src/lib/forex/chart/pip-math.test.ts
 */
import { computeRiskReward, pipSizeFromInstrument, pipValuePerLotFromSpec, priceDistancePips, suggestPositionSize } from './pip-math';
import { ema, rsi } from './studies';
import { deriveStructureLevels } from './structure-levels';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testPips(): void {
  const pip = pipSizeFromInstrument({ pipSize: '0.0001', digits: 5 });
  assert(pip === 0.0001, 'eurusd pip');
  assert(Math.abs((priceDistancePips(1.16, 1.158, pip) ?? 0) - 20) < 1e-6, '20 pips');
}

function testRr(): void {
  const r = computeRiskReward({
    entry: 1.154,
    stop: 1.152,
    target: 1.16,
    pipSize: 0.0001,
  });
  assert(r != null && r.side === 'long', 'long');
  assert(Math.abs(r!.riskPips - 20) < 1e-6, 'risk');
  assert(Math.abs(r!.rewardPips - 60) < 1e-6, 'reward');
  assert(Math.abs(r!.rr - 3) < 1e-9, 'rr 3');
}

function testLevels(): void {
  const candles = [
    { timestamp: '2026-09-01T00:00:00.000Z', open: '1.10', high: '1.12', low: '1.09', close: '1.11' },
    { timestamp: '2026-09-01T12:00:00.000Z', open: '1.11', high: '1.13', low: '1.10', close: '1.12' },
    { timestamp: '2026-09-02T00:00:00.000Z', open: '1.12', high: '1.14', low: '1.11', close: '1.13' },
  ];
  const levels = deriveStructureLevels(candles);
  assert(levels.some((l) => l.id === 'DO'), 'daily open');
  assert(levels.some((l) => l.id === 'PDH' && l.price === 1.13), 'pdh');
}

function testSize(): void {
  const pipVal = pipValuePerLotFromSpec({ pipSize: 0.0001, contractSize: 100000 });
  assert(pipVal === 10, 'eurusd pip value');
  const s = suggestPositionSize({ equity: 10000, riskPercent: 1, stopPips: 20, pipValuePerLot: 10 });
  assert(s != null && Math.abs(s.lots - 0.5) < 1e-9, 'suggested lots');
  assert(suggestPositionSize({ equity: 0, riskPercent: 1, stopPips: 20, pipValuePerLot: 10 }) == null, 'no fake zero equity');
}

function testStudies(): void {
  const bars = Array.from({ length: 40 }, (_, i) => ({
    time: i,
    open: 1.1 + i * 0.0001,
    high: 1.11 + i * 0.0001,
    low: 1.09 + i * 0.0001,
    close: 1.105 + i * 0.0001,
  }));
  assert(ema(bars, 20).length > 0, 'ema');
  assert(rsi(bars, 14).length > 0, 'rsi');
}

testPips();
testRr();
testLevels();
testSize();
testStudies();
console.log('pip-math.test.ts ok');
