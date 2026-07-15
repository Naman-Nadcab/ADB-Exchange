import type { OrderbookSnapshot, RecentTrade } from '@exchange/mobile-types';

export type SpotWsStreamPhase = 'connecting' | 'live' | 'reconnecting' | 'disconnected';

export type MarketContext = {
  positionPct: number;
  distFromHighPct: number;
  distFromLowPct: number;
} | null;

export type MarketPulse = {
  momentum: string;
  liquidity: string;
  volatility: string;
  marketBias: string;
};

export function computeMarketContext(input: {
  high?: number | null;
  low?: number | null;
  last?: number | null;
}): MarketContext {
  const high = input.high ?? NaN;
  const low = input.low ?? NaN;
  const last = input.last ?? NaN;
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(last) || high <= low) {
    return null;
  }
  const range = high - low;
  const positionPct = Math.min(100, Math.max(0, ((last - low) / range) * 100));
  const distFromHighPct = high > 0 ? ((high - last) / high) * 100 : NaN;
  const distFromLowPct = low > 0 ? ((last - low) / low) * 100 : NaN;
  return { positionPct, distFromHighPct, distFromLowPct };
}

export function computeMarketPulse(input: {
  changePct?: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  orderbook?: OrderbookSnapshot | null;
  recentTrades?: RecentTrade[];
}): MarketPulse {
  const changePct = input.changePct ?? NaN;
  const high = input.high ?? NaN;
  const low = input.low ?? NaN;
  const open = input.open ?? NaN;
  const bestBid = Number(input.orderbook?.bids?.[0]?.price ?? NaN);
  const bestAsk = Number(input.orderbook?.asks?.[0]?.price ?? NaN);
  const bidQty = Number(input.orderbook?.bids?.[0]?.quantity ?? NaN);
  const askQty = Number(input.orderbook?.asks?.[0]?.quantity ?? NaN);
  const tape = (input.recentTrades ?? []).slice(0, 20);
  const buyCount = tape.filter((t) => t.side === 'buy').length;
  const sellCount = tape.filter((t) => t.side === 'sell').length;

  const momentum = Number.isFinite(changePct)
    ? Math.abs(changePct) >= 0.01
      ? changePct > 0
        ? 'Up'
        : 'Down'
      : 'Flat'
    : 'Unknown';

  const spreadPct =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestAsk > bestBid
      ? ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100
      : NaN;
  const liquidity = !Number.isFinite(spreadPct)
    ? 'Unknown'
    : spreadPct < 0.08
      ? 'High'
      : spreadPct < 0.2
        ? 'Medium'
        : 'Thin';

  const volatilityPct =
    Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(open) && open > 0
      ? ((high - low) / open) * 100
      : NaN;
  const volatility =
    Number.isFinite(volatilityPct) && volatilityPct >= 6
      ? 'High'
      : Number.isFinite(volatilityPct) && volatilityPct >= 2
        ? 'Medium'
        : 'Low';

  const microImbalance =
    Number.isFinite(bidQty) && Number.isFinite(askQty) && bidQty + askQty > 0
      ? ((bidQty - askQty) / (bidQty + askQty)) * 100
      : 0;
  const tapeBias = buyCount - sellCount;
  const biasScore = (Number.isFinite(changePct) ? changePct : 0) + microImbalance * 0.1 + tapeBias * 0.2;
  const marketBias = biasScore > 0.8 ? 'Bullish' : biasScore < -0.8 ? 'Bearish' : 'Neutral';

  return { momentum, liquidity, volatility, marketBias };
}

export function streamPhaseFromWsState(state: string): 'connecting' | 'live' | 'reconnecting' | 'disconnected' {
  if (state === 'connected') return 'live';
  if (state === 'reconnecting') return 'reconnecting';
  if (state === 'connecting') return 'connecting';
  return 'disconnected';
}

export function streamPhaseToChip(phase: ReturnType<typeof streamPhaseFromWsState>) {
  switch (phase) {
    case 'live':
      return { label: 'Live', tone: 'live' as const, pulse: true };
    case 'connecting':
      return { label: 'Connecting', tone: 'sync' as const, pulse: true };
    case 'reconnecting':
      return { label: 'Syncing', tone: 'sync' as const, pulse: true };
    default:
      return { label: 'Offline', tone: 'off' as const, pulse: false };
  }
}
