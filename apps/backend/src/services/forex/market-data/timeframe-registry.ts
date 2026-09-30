import { FOREX_CANDLE_TIMEFRAME_PLANS, listForexCustomerCandleTimeframes } from './candle-timeframe-plans.js';

function yahooOhlcEnabled(): boolean {
  const raw = (process.env.FOREX_OHLC_PROVIDER ?? 'yahoo').trim().toLowerCase();
  return !(raw === 'off' || raw === '0' || raw === 'false');
}

export type ForexTimeframeRegistryEntry = {
  id: string;
  mt5Label: string;
  bucketMs: number | null;
  historicalSupported: boolean;
  liveSupported: boolean;
  customerSupported: boolean;
  note?: string;
};

export const FOREX_TIMEFRAME_REGISTRY: ForexTimeframeRegistryEntry[] = listForexCustomerCandleTimeframes().map((id) => {
  const plan = FOREX_CANDLE_TIMEFRAME_PLANS[id]!;
  const mt5Label = plan.mt5Label;
  const bucketMs = plan.kind === 'yahoo' ? null : plan.bucketMs;
  const yahooOn = yahooOhlcEnabled();
  return {
    id,
    mt5Label,
    bucketMs: plan.kind === 'aggregate' ? plan.bucketMs : plan.timeframe === '1m' ? 60_000 : plan.timeframe === '5m' ? 300_000 : plan.timeframe === '15m' ? 900_000 : plan.timeframe === '1h' ? 3_600_000 : 86_400_000,
    historicalSupported: yahooOn,
    liveSupported: true,
    customerSupported: yahooOn,
    note: plan.kind === 'aggregate' ? plan.note : undefined,
  };
});

export function forexCustomerSupportedTimeframes(): string[] {
  if (!yahooOhlcEnabled()) return [];
  return listForexCustomerCandleTimeframes();
}
