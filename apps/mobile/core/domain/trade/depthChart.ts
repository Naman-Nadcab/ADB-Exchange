import type { OrderbookLevel } from '@exchange/mobile-types';

export type DepthPoint = { x: number; y: number };

export type DepthSeries = {
  bidPoints: DepthPoint[];
  askPoints: DepthPoint[];
  bidPath: string;
  askPath: string;
  mid: number;
  spreadPct: number;
  maxCum: number;
  bestBid: number;
  bestAsk: number;
  hasDepth: boolean;
};

function qtyToNum(q: string): number {
  const n = parseFloat(q);
  return Number.isFinite(n) ? n : 0;
}

function priceToNum(p: string): number {
  const n = parseFloat(p);
  return Number.isFinite(n) ? n : 0;
}

/** Cumulative depth series — mirrors web SpotDepthChart math. */
export function buildDepthSeries(
  bids: OrderbookLevel[],
  asks: OrderbookLevel[],
  viewBoxHeight = 120,
): DepthSeries {
  const bidRows = bids
    .map((r) => ({ price: priceToNum(r.price), quantity: qtyToNum(r.quantity) }))
    .filter((r) => r.price > 0 && r.quantity > 0)
    .sort((a, b) => b.price - a.price);
  const askRows = asks
    .map((r) => ({ price: priceToNum(r.price), quantity: qtyToNum(r.quantity) }))
    .filter((r) => r.price > 0 && r.quantity > 0)
    .sort((a, b) => a.price - b.price);

  const cumBid = bidRows.reduce<number[]>((acc, row, i) => {
    acc.push((acc[i - 1] ?? 0) + row.quantity);
    return acc;
  }, []);
  const cumAsk = askRows.reduce<number[]>((acc, row, i) => {
    acc.push((acc[i - 1] ?? 0) + row.quantity);
    return acc;
  }, []);

  const maxCum = Math.max(...cumBid, ...cumAsk, 1);
  const bestBid = bidRows[0]?.price ?? 0;
  const bestAsk = askRows[0]?.price ?? 0;
  const mid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;
  const spreadPct = mid > 0 && bestAsk > bestBid ? ((bestAsk - bestBid) / mid) * 100 : 0;

  const chartTop = 6;
  const chartBottom = viewBoxHeight - 16;
  const chartHeight = Math.max(1, chartBottom - chartTop);
  const centerX = 50;

  const bidPoints = cumBid.map((v, i) => ({
    x: centerX - (i / Math.max(1, cumBid.length - 1)) * 50,
    y: chartBottom - (v / maxCum) * chartHeight,
  }));
  const askPoints = cumAsk.map((v, i) => ({
    x: centerX + (i / Math.max(1, cumAsk.length - 1)) * 50,
    y: chartBottom - (v / maxCum) * chartHeight,
  }));

  const bidPath =
    bidPoints.length >= 2
      ? `${centerX},${chartBottom} ${bidPoints.map((p) => `${p.x},${p.y}`).join(' ')} 0,${chartBottom}`
      : `0,${chartBottom} ${centerX},${chartBottom}`;
  const askPath =
    askPoints.length >= 2
      ? `${centerX},${chartBottom} ${askPoints.map((p) => `${p.x},${p.y}`).join(' ')} 100,${chartBottom}`
      : `${centerX},${chartBottom} 100,${chartBottom}`;

  return {
    bidPoints,
    askPoints,
    bidPath,
    askPath,
    mid,
    spreadPct,
    maxCum,
    bestBid,
    bestAsk,
    hasDepth: bidRows.length > 0 && askRows.length > 0,
  };
}

export function formatDepthQty(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n > 0) return n.toPrecision(2);
  return '0';
}
