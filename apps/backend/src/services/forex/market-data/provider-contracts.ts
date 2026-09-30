/**
 * Provider-ready market data contracts (no fabricated depth or tape).
 */
export type ForexDepthLevel = {
  price: string;
  volume: string;
  side: 'bid' | 'ask';
};

export type ForexDepthSnapshot = {
  symbol: string;
  source: string;
  timestamp: string;
  bids: ForexDepthLevel[];
  asks: ForexDepthLevel[];
};

export type ForexTapePrint = {
  timestamp: string;
  symbol: string;
  price: string;
  volume: string;
  side: 'buy' | 'sell' | 'unknown';
  aggressor?: 'buy' | 'sell' | null;
  source: string;
};

export type ForexMarketDataProviderCapabilities = {
  depth: boolean;
  timeAndSales: boolean;
  reason?: string;
};

export function mockForexMarketDataProviderCapabilities(): ForexMarketDataProviderCapabilities {
  return {
    depth: false,
    timeAndSales: false,
    reason: 'SIMULATED quote book only — no institutional depth or trade tape',
  };
}

/** Adapter hook for future LP / market-data providers. */
export type ForexDepthProvider = {
  getDepth(symbol: string): Promise<ForexDepthSnapshot | null>;
};

export type ForexTapeProvider = {
  listRecentTrades(symbol: string, limit?: number): Promise<ForexTapePrint[]>;
};
