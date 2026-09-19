import type { WebSocket } from 'ws';
import { forexWsEnvelope, isForexAccountPrivateChannel, isPublicForexChannel } from './protocol.js';
import type { ForexQuoteDto } from '../types.js';
import type { ForexRoutingSnapshot } from '../liquidity/snapshot.js';

interface ForexWsConn {
  socket: WebSocket;
  channels: Set<string>;
  userId?: string;
  /** Active Forex account for private event fan-out (server-resolved). */
  forexAccountId?: string;
}

class ForexWsHub {
  private readonly conns = new Map<string, ForexWsConn>();
  private n = 0;

  register(socket: WebSocket, userId?: string, forexAccountId?: string): string {
    this.n += 1;
    const id = `fxws-${this.n}`;
    this.conns.set(id, { socket, channels: new Set(), userId, forexAccountId });
    return id;
  }

  unregister(id: string): void {
    this.conns.delete(id);
  }

  setForexAccount(id: string, forexAccountId: string | undefined): void {
    const conn = this.conns.get(id);
    if (conn) conn.forexAccountId = forexAccountId;
  }

  subscribe(id: string, channel: string): boolean {
    const conn = this.conns.get(id);
    if (!conn) return false;
    if (isForexAccountPrivateChannel(channel)) {
      if (!conn.userId || !conn.forexAccountId) return false;
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

  publishOrder(accountId: string, type: string, payload: unknown): void {
    this.publishPrivate(accountId, type, payload);
  }

  /** Private events are delivered only to connections whose active Forex account matches. */
  publishPrivate(accountId: string, type: string, payload: unknown): void {
    const enriched =
      payload && typeof payload === 'object'
        ? { ...(payload as Record<string, unknown>), accountId }
        : { accountId, payload };
    const root = type.split('.')[0] + '.' + (type.split('.')[1] ?? type);
    const message = forexWsEnvelope(type, type, enriched);
    for (const conn of this.conns.values()) {
      if (conn.forexAccountId !== accountId) continue;
      if (conn.channels.has(root) || conn.channels.has(`${root}.*`) || conn.channels.has(type)) {
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
