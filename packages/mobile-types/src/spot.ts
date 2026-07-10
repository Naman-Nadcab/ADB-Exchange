/** Spot market DTOs — mirror backend @ SHA 0098864 */

export type SpotMarket = {
  id: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  status: string;
  min_qty?: string;
  min_notional?: string;
  price_precision?: number;
  qty_precision?: number;
  maker_fee?: string;
  taker_fee?: string;
  last_price?: string;
  volume_24h?: string;
  open_24h?: string;
  high_24h?: string;
  low_24h?: string;
  change_pct?: number;
};

export type SpotTicker = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  last_price: string | null;
  open_24h: string | null;
  high_24h: string | null;
  low_24h: string | null;
  volume_24h: string;
  base_volume_24h?: string;
  change_pct?: number | null;
  last_price_source?: string;
  last_price_age_ms?: number;
  last_price_stale?: boolean;
};

export type SpotTickerDetail = SpotTicker & {
  status?: string;
  bid?: string | null;
  ask?: string | null;
  updated_at?: string;
};

export type WsTickerPayload = {
  symbol: string;
  last_price: string;
  bid?: string;
  ask?: string;
  high_24h?: string;
  low_24h?: string;
  volume_24h?: string;
  base_volume_24h?: string;
  open_24h?: string;
  price_change_pct_24h?: string | null;
};

export type MarketListItem = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  lastPrice: number;
  changePct: number;
  volume24h: number;
  high24h: number;
  low24h: number;
};

export type MarketSortKey = 'volume' | 'change' | 'name' | 'price';
export type MarketTab = 'favorites' | 'all' | 'gainers' | 'losers' | 'trending';

export type OrderbookLevel = { price: string; quantity: string };

export type OrderbookSnapshot = {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  lastUpdateId?: number;
  snapshotAtMs?: number;
};

export type OrderbookDelta = {
  symbol: string;
  seq: number;
  bids: [string, string][];
  asks: [string, string][];
};

export type RecentTrade = {
  id: string;
  order_id?: string;
  market: string;
  side: 'buy' | 'sell';
  price: string;
  quantity: string;
  time?: string;
  timestamp?: number;
  created_at?: string;
};

export type Candle = {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type OrderSide = 'buy' | 'sell';
export type OrderType =
  | 'limit'
  | 'market'
  | 'stop_loss'
  | 'stop_limit'
  | 'trailing_stop_market';

export type PlaceOrderRequest = {
  market: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  stop_price?: string;
  trailing_delta?: string;
  client_order_id?: string;
};

export type SpotOrder = {
  id: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price?: string;
  stop_price?: string;
  quantity: string;
  filled_quantity: string;
  status: string;
  displayStatus?: string;
  remaining_quantity?: string;
  created_at: string;
  updated_at?: string;
};

export type CancelAllResult = {
  requested: number;
  cancelled: number;
  failed: number;
  failed_order_ids?: string[];
};

