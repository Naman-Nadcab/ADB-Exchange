/** WS channel naming — subscriptions implemented Sprint 2+. */
export const WS_CHANNELS = {
  orderbook: (symbol: string) => `orderbook:${symbol}`,
  ticker: (symbol: string) => `ticker:${symbol}`,
  trades: (symbol: string) => `trades:${symbol}`,
  userOrders: 'user.orders',
  userTrades: 'user.trades',
  userP2POrders: 'user.p2p_orders',
  p2pOrder: (orderId: string) => `p2p.order.${orderId}`,
} as const;

export type WsConnectionState = 'idle' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | 'disconnected';
