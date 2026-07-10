export type TradeStackParamList = {
  SpotTrading: { symbol?: string } | undefined;
  PairSelector: undefined;
  ChartFullscreen: { symbol: string; interval?: number };
  OrderbookFullscreen: { symbol: string };
  TradesFullscreen: { symbol: string };
};
