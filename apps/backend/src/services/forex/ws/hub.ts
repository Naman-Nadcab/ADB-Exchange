import type { WebSocket } from 'ws';
import { forexWsEnvelope, isForexOrderChannel, isPublicForexChannel } from './protocol.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexRoutingSnapshot } from '../liquidity/snapshot.js';

interface ForexWsConn {
  socket: WebSocket;
  channels: Set<string>;
  userId?: string;
}

class ForexWsHub {
  private readonly conns = new Map<string, ForexWsConn>();
  private n = 0;

  register(socket: WebSocket, userId?: string): string {
    this.n += 1;
    const id = `fxws-${this.n}`;
    this.conns.set(id, { socket, channels: new Set(), userId });
    return id;
  }

  unregister(id: string): void {
    this.conns.delete(id);
  }

  subscribe(id: string, channel: string): boolean {
    const conn = this.conns.get(id);
    if (!conn) return false;
    if (isForexOrderChannel(channel)) {
      if (!conn.userId) return false;
      conn.channels.add(channel);
      return true;
    }
    if (!isPublicForexChannel(channel)) return false;
    conn.channels.add(channel);
    return true;
  }

  unsubscribe(id: string, channel: string): void {
    this.conns.get(id)?.channels.delete(channel);
  }

  publishQuote(quote: ForexQuoteDto): void {
    this.fanout(`fx.quote.${quote.symbol}`, 'fx.quote.*', 'fx.quote', quote);
  }

  publishLiquidity(snapshot: ForexRoutingSnapshot): void {
    this.fanout(`fx.liquidity.${snapshot.symbol}`, 'fx.liquidity.*', 'fx.liquidity', snapshot);
  }

  publishExecution(payload: unknown): void {
    this.fanout('fx.execution', 'fx.execution.*', 'fx.execution', payload);
  }

  publishOrder(userId: string, type: string, payload: unknown): void {
    const message = forexWsEnvelope(type, type, payload);
    for (const conn of this.conns.values()) {
      if (conn.userId !== userId) continue;
      if (conn.channels.has('fx.order') || conn.channels.has('fx.order.*') || conn.channels.has(type)) {
        try {
          if (conn.socket.readyState === 1) conn.socket.send(message);
        } catch {
          /* drop on closed socket */
        }
      }
    }
  }

  private fanout(specific: string, wildcard: string, type: string, data: unknown): void {
    const payload = forexWsEnvelope(type, specific, data);
    for (const conn of this.conns.values()) {
      if (conn.channels.has(specific) || conn.channels.has(wildcard)) {
        try {
          if (conn.socket.readyState === 1) conn.socket.send(payload);
        } catch {
          /* drop on closed socket */
        }
      }
    }
  }

  connectionCount(): number {
    return this.conns.size;
  }
}

export const forexWsHub = new ForexWsHub();
