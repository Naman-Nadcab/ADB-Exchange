/**
 * Phase 14 helpers — local studies and product routes.
 * Run: npx tsx apps/frontend/src/lib/forex/eda-unification.test.ts
 */
import { lastAtr, lastMacd, lastStochastic, type FxBar } from './local-indicators';
import { FOREX_ROUTES } from './routes';
import { SPOT_TRADE_HREF } from '../routes';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function bars(n: number): FxBar[] {
  const out: FxBar[] = [];
  let px = 1.1;
  for (let i = 0; i < n; i++) {
    px += (i % 3 === 0 ? 0.001 : -0.0006);
    out.push({ time: 1_700_000_000 + i * 60, open: px, high: px + 0.0004, low: px - 0.0004, close: px + 0.0001 });
  }
  return out;
}

function testInsufficient(): void {
  assert(lastAtr(bars(5)) == null, 'ATR needs enough bars');
  assert(lastMacd(bars(10)) == null, 'MACD needs enough bars');
  assert(lastStochastic(bars(5)) == null, 'Stoch needs enough bars');
}

function testReady(): void {
  const sample = bars(80);
  const atr = lastAtr(sample);
  const macd = lastMacd(sample);
  const stoch = lastStochastic(sample);
  assert(atr != null && Number.isFinite(atr), 'ATR from valid OHLC');
  assert(macd != null && Number.isFinite(macd.macd), 'MACD from valid OHLC');
  assert(stoch != null && Number.isFinite(stoch.k), 'Stoch from valid OHLC');
}

function testRoutes(): void {
  assert(SPOT_TRADE_HREF === '/trade/spot', 'crypto canonical');
  assert(FOREX_ROUTES.trade === '/forex/trade', 'forex canonical');
}

testInsufficient();
testReady();
testRoutes();
console.log('eda-unification.test.ts ok');
