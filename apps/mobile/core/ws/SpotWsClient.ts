import type { WsConnectionState } from './channels';
import { nextReconnectDelay, DEFAULT_RECONNECT_POLICY } from './reconnectPolicy';

export type WsMessageHandler = (message: unknown) => void;

export type SpotWsClientOptions = {
  getWsUrl: () => string;
  onStateChange?: (state: WsConnectionState) => void;
  onReconnect?: () => void;
};

const HEARTBEAT_INTERVAL_MS = 25_000;

export class SpotWsClient {
  private socket: WebSocket | null = null;
  private state: WsConnectionState = 'idle';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers = new Map<string, Set<WsMessageHandler>>();
  private activeChannels = new Set<string>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(private readonly options: SpotWsClientOptions) {}

  getState(): WsConnectionState {
    return this.state;
  }

  private setState(state: WsConnectionState) {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;
    this.setState('connecting');
    const ws = new WebSocket(this.options.getWsUrl());
    this.socket = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.startHeartbeat();
      for (const channel of this.activeChannels) {
        this.sendSubscribe(channel);
      }
      this.options.onReconnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data));
        this.routeMessage(parsed);
      } catch {
        // drop malformed
      }
    };

    ws.onerror = () => this.setState('disconnected');
    ws.onclose = () => {
      this.stopHeartbeat();
      this.setState('disconnected');
      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.setState('idle');
  }

  subscribe(channel: string): void {
    this.activeChannels.add(channel);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(channel);
    } else if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      this.connect();
    }
  }

  unsubscribe(channel: string): void {
    this.activeChannels.delete(channel);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
    this.handlers.delete(channel);
  }

  authenticate(ticket: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'auth', data: { ticket } }));
    }
  }

  addGlobalHandler(type: string, handler: WsMessageHandler): () => void {
    const key = `__type__:${type}`;
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(handler);
    return () => this.handlers.get(key)?.delete(handler);
  }

  addHandler(channel: string, handler: WsMessageHandler): () => void {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    this.handlers.get(channel)!.add(handler);
    return () => this.handlers.get(channel)?.delete(handler);
  }

  private sendSubscribe(channel: string) {
    this.socket?.send(JSON.stringify({ type: 'subscribe', channel }));
  }

  private routeMessage(message: unknown) {
    if (!message || typeof message !== 'object') return;
    const channel = (message as { channel?: string }).channel;
    if (channel) {
      const set = this.handlers.get(channel);
      set?.forEach((h) => h(message));
    }
    const type = (message as { type?: string }).type;
    if (type) {
      const global = this.handlers.get(`__type__:${type}`);
      global?.forEach((h) => h(message));
    }
    if (type === 'orderbook_snapshot' || type === 'orderbook_update' || type === 'orderbook_delta' || type === 'orderbook_resync') {
      if (channel) this.handlers.get(channel)?.forEach((h) => h(message));
    }
    if (type === 'trades' && channel) {
      this.handlers.get(channel)?.forEach((h) => h(message));
    }
    if (type === 'ticker' && channel) {
      this.handlers.get(channel)?.forEach((h) => h(message));
    }
    if (type === 'auth_result') {
      this.handlers.get('__type__:auth_result')?.forEach((h) => h(message));
    }
    if (
      type === 'p2p_order_update' ||
      type === 'message:new' ||
      type === 'message:read' ||
      type === 'typing' ||
      type === 'order:updated' ||
      type === 'order:status_changed'
    ) {
      if (channel) this.handlers.get(channel)?.forEach((h) => h(message));
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    this.clearReconnectTimer();
    const delay = nextReconnectDelay(this.reconnectAttempt, DEFAULT_RECONNECT_POLICY);
    this.reconnectAttempt += 1;
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /** Send a raw WS payload (e.g. p2p_typing). */
  send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}
