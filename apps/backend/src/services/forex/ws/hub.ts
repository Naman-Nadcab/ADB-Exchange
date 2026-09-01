import type { WebSocket } from 'ws';
import { forexWsEnvelope, isPublicForexChannel } from './protocol.js';
import type { ForexQuoteDto } from '../types.js';

interface ForexWsConn {
  socket: WebSocket;
  channels: Set<string>;
}

class ForexWsHub {
  private readonly conns = new Map<string, ForexWsConn>();
  private n = 0;

  register(socket: WebSocket): string {
    this.n += 1;
    const id = `fxws-${this.n}`;
    this.conns.set(id, { socket, channels: new Set() });
    return id;
  }

  unregister(id: string): void {
    this.conns.delete(id);
  }

  subscribe(id: string, channel: string): boolean {
    const conn = this.conns.get(id);
    if (!conn) return false;
    if (!isPublicForexChannel(channel)) return false;
    conn.channels.add(channel);
    return true;
  }

  unsubscribe(id: string, channel: string): void {
    this.conns.get(id)?.channels.delete(channel);
  }

  publishQuote(quote: ForexQuoteDto): void {
    const specific = `fx.quote.${quote.symbol}`;
    const payload = forexWsEnvelope('fx.quote', specific, quote);
    for (const conn of this.conns.values()) {
      if (conn.channels.has(specific) || conn.channels.has('fx.quote.*')) {
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
