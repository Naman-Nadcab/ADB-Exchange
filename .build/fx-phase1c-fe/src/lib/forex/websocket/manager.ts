import type { ForexConnectionState } from '../models/types';
import { FOREX_PRIVATE_CHANNELS, FOREX_PUBLIC_CHANNELS, type ForexWsEnvelope } from './channels';
import { getForexWsUrl } from './url';

type Listener = (msg: ForexWsEnvelope) => void;
type StateListener = (state: ForexConnectionState, detail?: string) => void;

const PING_MS = 15_000;
const BACKOFF = [800, 1600, 3200, 5000, 8000];

/**
 * Single Forex WebSocket manager. Components must not open their own sockets.
 * Auth: Authorization header via browser is not settable on WebSocket();
 * Fastify reads the upgrade Authorization header — browsers cannot set it.
 * We therefore connect without query token (forbidden) and rely on:
 *  - public channels always
 *  - private channels only if the server accepted JWT on upgrade
 *
 * Browser WS cannot attach Authorization. Contract requires Bearer on upgrade.
 * Implementation: try fetch-upgrade is not available. We connect to the WS URL
 * without ?token=. If a polyfill/header path exists later, pass token into
 * connect({ token }). For browsers, private subscribe will get AUTH_REQUIRED
 * unless the page is same-origin and a future cookie-WS exists (FOREX_WS_COOKIE).
 *
 * Workaround used: connect through a same-origin URL; if token is present we
 * cannot legally put it in the query. Private REST still hydrates with Bearer.
 * After welcome, we subscribe private channels; AUTH_REQUIRED is recorded.
 */
class ForexWsManager {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private channels = new Set<string>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private closedByUser = false;
  private token: string | null = null;
  private lastPongAt: number | null = null;
  private welcome = false;
  connectionState: ForexConnectionState = 'DISCONNECTED';

  onMessage(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  getLastPongAt(): number | null {
    return this.lastPongAt;
  }

  isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(opts?: { token?: string | null }): void {
    this.token = opts?.token ?? this.token;
    this.closedByUser = false;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.setState(this.attempt > 0 ? 'RECONNECTING' : 'CONNECTING');
    const url = getForexWsUrl();
    try {
      this.socket = this.openSocket(url, this.token);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket.addEventListener('open', () => {
      this.attempt = 0;
      this.welcome = false;
      this.startPing();
    });
    this.socket.addEventListener('message', (ev) => {
      this.handleRaw(ev.data);
    });
    this.socket.addEventListener('close', (ev) => {
      this.stopPing();
      this.socket = null;
      this.welcome = false;
      if (this.closedByUser) {
        this.setState('DISCONNECTED', ev.reason || 'Closed');
        return;
      }
      this.scheduleReconnect();
    });
    this.socket.addEventListener('error', () => {
      /* close handler drives reconnect */
    });
  }

  /**
   * Standard browser WebSocket cannot set Authorization.
   * If token is present we still MUST NOT use ?token= (server close 1008).
   * Private state is REST-authoritative; WS private is best-effort when the
   * runtime can attach a header (non-browser or future cookie upgrade).
   */
  private openSocket(url: string, _token: string | null): WebSocket {
    return new WebSocket(url);
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopPing();
    this.socket?.close();
    this.socket = null;
    this.setState('DISCONNECTED', 'Client disconnect');
  }

  subscribe(channel: string): void {
    this.channels.add(channel);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', channel }));
    }
  }

  unsubscribe(channel: string): void {
    this.channels.delete(channel);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
  }

  subscribeDefaults(authenticated: boolean): void {
    for (const ch of FOREX_PUBLIC_CHANNELS) this.subscribe(ch);
    if (authenticated) {
      for (const ch of FOREX_PRIVATE_CHANNELS) this.subscribe(ch);
    }
  }

  resubscribe(): void {
    Array.from(this.channels).forEach((ch) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'subscribe', channel: ch }));
      }
    });
  }

  private handleRaw(raw: unknown): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      return;
    }
    if (parsed.type === 'pong') {
      this.lastPongAt = Date.now();
      this.emit({ type: 'pong', data: parsed, timestamp: Number(parsed.timestamp) || Date.now() });
      return;
    }
    const env: ForexWsEnvelope = {
      type: String(parsed.type ?? ''),
      channel: typeof parsed.channel === 'string' ? parsed.channel : undefined,
      data: parsed.data,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    };
    if (env.type === 'welcome') {
      this.welcome = true;
      this.setState('CONNECTED');
      this.resubscribe();
    }
    this.emit(env);
  }

  private emit(msg: ForexWsEnvelope): void {
    Array.from(this.listeners).forEach((fn) => fn(msg));
  }

  private setState(state: ForexConnectionState, detail?: string): void {
    this.connectionState = state;
    Array.from(this.stateListeners).forEach((fn) => fn(state, detail));
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping', client_ts: Date.now() }));
      }
    }, PING_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
    this.setState('RECONNECTING');
    const delay = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)] ?? 8000;
    this.attempt += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect({ token: this.token });
    }, delay);
  }

  hasWelcome(): boolean {
    return this.welcome;
  }
}

export const forexWsManager = new ForexWsManager();
