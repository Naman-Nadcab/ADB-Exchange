'use client';

import { useId } from 'react';

interface SpotDepthChartProps {
  bids: { price: string; quantity: string }[];
  asks: { price: string; quantity: string }[];
  height?: number;
  className?: string;
}

function qtyToNum(q: string): number {
  const n = parseFloat(q);
  return Number.isFinite(n) ? n : 0;
}

function priceToNum(p: string): number {
  const n = parseFloat(p);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n > 0) return n.toPrecision(2);
  return '0';
}

export function SpotDepthChart({ bids, asks, height, className }: SpotDepthChartProps) {
  const gradId = useId().replace(/:/g, '');
  const bidGradId = `depth-bid-fill-${gradId}`;
  const askGradId = `depth-ask-fill-${gradId}`;
  const bidRows = bids
    .map((r) => ({ price: priceToNum(r.price), quantity: qtyToNum(r.quantity) }))
    .filter((r) => r.price > 0 && r.quantity > 0)
    .sort((a, b) => b.price - a.price);
  const askRows = asks
    .map((r) => ({ price: priceToNum(r.price), quantity: qtyToNum(r.quantity) }))
    .filter((r) => r.price > 0 && r.quantity > 0)
    .sort((a, b) => a.price - b.price);
  const hasDepth = bidRows.length > 0 && askRows.length > 0;

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

  const viewBoxHeight = height ?? 120;
  const chartTop = 6;
  const chartBottom = viewBoxHeight - 16;
  const chartHeight = Math.max(1, chartBottom - chartTop);
  const centerX = 50;

  const bidPoints = cumBid.map((v, i) => {
    const x = centerX - (i / Math.max(1, cumBid.length - 1)) * 50;
    const y = chartBottom - (v / maxCum) * chartHeight;
    return `${x},${y}`;
  });
  const askPoints = cumAsk.map((v, i) => {
    const x = centerX + (i / Math.max(1, cumAsk.length - 1)) * 50;
    const y = chartBottom - (v / maxCum) * chartHeight;
    return `${x},${y}`;
  });
  const bidPath = bidPoints.length >= 2 ? `${centerX},${chartBottom} ${bidPoints.join(' ')} 0,${chartBottom}` : `0,${chartBottom} ${centerX},${chartBottom}`;
  const askPath = askPoints.length >= 2 ? `${centerX},${chartBottom} ${askPoints.join(' ')} 100,${chartBottom}` : `${centerX},${chartBottom} 100,${chartBottom}`;

  return (
    <div
      className={`bg-card border-t border-border px-2 pb-2 ${height != null ? 'flex-shrink-0' : ''} ${className ?? ''}`}
      style={height != null ? { height } : undefined}
    >
      <div className="mb-1 flex items-center justify-between text-label text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-buy" />
          Bid depth
        </span>
        <span className="inline-flex items-center gap-1">
          Mid {mid > 0 ? fmt(mid) : '—'}
          {spreadPct > 0 ? <span>· Spread {spreadPct.toFixed(3)}%</span> : null}
        </span>
        <span className="inline-flex items-center gap-1">
          Ask depth
          <span className="h-2 w-2 rounded-full bg-sell" />
        </span>
      </div>
      {!hasDepth ? (
        <div className="flex min-h-[120px] items-center justify-center rounded border border-dashed border-border text-sm text-muted-foreground">
          Waiting for orderbook depth...
        </div>
      ) : (
      <svg viewBox={`0 0 100 ${viewBoxHeight}`} className="h-full min-h-[120px] w-full" preserveAspectRatio="none" aria-label="Orderbook depth chart">
        <defs>
          <linearGradient id={bidGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={askGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2="100" y1={chartBottom} y2={chartBottom} stroke="currentColor" opacity="0.2" />
        <line x1={centerX} x2={centerX} y1={chartTop} y2={chartBottom} stroke="currentColor" opacity="0.2" strokeDasharray="1.5 1.5" />
        <line x1="0" x2="100" y1={chartTop + chartHeight * 0.5} y2={chartTop + chartHeight * 0.5} stroke="currentColor" opacity="0.08" />
        <polygon points={bidPath} fill={`url(#${bidGradId})`} />
        <polygon points={askPath} fill={`url(#${askGradId})`} />
        <polyline points={bidPoints.join(' ')} fill="none" stroke="rgb(34, 197, 94)" strokeWidth="0.9" />
        <polyline points={askPoints.join(' ')} fill="none" stroke="rgb(239, 68, 68)" strokeWidth="0.9" />
        <text x="1" y={chartTop + 4} fontSize="3.2" fill="currentColor" opacity="0.7">
          Cum Qty {fmt(maxCum)}
        </text>
        <text x="1" y={chartBottom - 1} fontSize="3.2" fill="currentColor" opacity="0.6">
          Bid {fmt(bestBid)}
        </text>
        <text x="99" y={chartBottom - 1} fontSize="3.2" fill="currentColor" opacity="0.6" textAnchor="end">
          Ask {fmt(bestAsk)}
        </text>
      </svg>
      )}
    </div>
  );
}
