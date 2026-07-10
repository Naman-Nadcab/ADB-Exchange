import type { SpotWsClient } from './SpotWsClient';
import { WS_CHANNELS } from './channels';
import {
  handleTickerMessage,
  handleOrderbookMessage,
  handleTradesMessage,
  handleUserOrderMessage,
  handleUserTradeMessage,
} from './messageHandlers';
import { handleP2POrderUpdate, handleP2POrderRoomMessage } from './p2pMessageHandlers';

type Entry = {
  refCount: number;
  cleanup?: () => void;
};

/** Ref-counted WS subscriptions — memory-safe cleanup. */
export class SubscriptionManager {
  private subs = new Map<string, Entry>();

  constructor(private readonly client: SpotWsClient) {}

  subscribeTicker(symbol: string): () => void {
    return this.subscribeChannel(WS_CHANNELS.ticker(symbol), handleTickerMessage);
  }

  subscribeOrderbook(symbol: string): () => void {
    return this.subscribeChannel(WS_CHANNELS.orderbook(symbol), handleOrderbookMessage);
  }

  subscribeTrades(symbol: string): () => void {
    return this.subscribeChannel(WS_CHANNELS.trades(symbol), handleTradesMessage);
  }

  subscribeUserOrders(): () => void {
    return this.subscribeChannel(WS_CHANNELS.userOrders, handleUserOrderMessage);
  }

  subscribeUserTrades(): () => void {
    return this.subscribeChannel(WS_CHANNELS.userTrades, handleUserTradeMessage);
  }

  subscribeUserP2POrders(): () => void {
    return this.subscribeChannel(WS_CHANNELS.userP2POrders, handleP2POrderUpdate);
  }

  subscribeP2POrderRoom(orderId: string): () => void {
    return this.subscribeChannel(WS_CHANNELS.p2pOrder(orderId), handleP2POrderRoomMessage);
  }

  private subscribeChannel(channel: string, handler: (msg: unknown) => void): () => void {
    return this.acquire(channel, () => {
      this.client.subscribe(channel);
      const remove = this.client.addHandler(channel, handler);
      return () => {
        remove();
        this.client.unsubscribe(channel);
      };
    });
  }

  private acquire(channel: string, setup: () => () => void): () => void {
    const existing = this.subs.get(channel);
    if (existing) {
      existing.refCount += 1;
      return () => this.release(channel);
    }
    const cleanup = setup();
    this.subs.set(channel, { refCount: 1, cleanup });
    return () => this.release(channel);
  }

  private release(channel: string) {
    const entry = this.subs.get(channel);
    if (!entry) return;
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.cleanup?.();
      this.subs.delete(channel);
    }
  }

  resubscribeAll() {
    for (const channel of this.subs.keys()) {
      this.client.subscribe(channel);
    }
  }

  clear() {
    for (const [, entry] of this.subs) entry.cleanup?.();
    this.subs.clear();
  }
}
