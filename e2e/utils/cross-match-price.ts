/**
 * Resolve an isolated cross price for E2E maker/taker tests.
 * Limit buys sweep all asks below the limit — competing MM liquidity breaks Phase 14 WS cert.
 * When the ask side is empty, anchor above the best bid so only the maker sell rests.
 */
const DEFAULT_TIMEOUT = 10_000;

function parseLevels(levels: unknown): Array<{ price: number }> {
  if (!Array.isArray(levels)) return [];
  return levels
    .map((row) => {
      if (Array.isArray(row)) return Number(row[0]);
      if (row && typeof row === 'object' && 'price' in row) return Number((row as { price?: unknown }).price);
      return NaN;
    })
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((price) => ({ price }));
}

export async function resolveCrossMatchPrice(
  baseUrl: string,
  market: string,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<string> {
  const override = process.env.E2E_MATCH_PRICE?.trim();
  if (override) return override;

  const res = await fetch(`${baseUrl}/api/v1/spot/orderbook/${encodeURIComponent(market)}?limit=20`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { asks?: unknown[]; bids?: unknown[] };
  };
  const asks = parseLevels(data?.data?.asks);
  const bids = parseLevels(data?.data?.bids);

  if (asks.length === 0 && bids.length > 0) {
    const bestBid = bids[0]!.price;
    return (bestBid * 1.0005).toFixed(2);
  }

  if (asks.length > 0) {
    const bestAsk = asks[0]!.price;
    return (bestAsk * 1.0005).toFixed(2);
  }

  if (market === 'ETH_USDT') return '3501.00';
  return '74000.00';
}
