import type { WsConnectionState } from './channels';
import { streamPhaseFromWsState } from '@core/domain/trade/marketPulse';
import { useWsMetricsStore } from '@core/state/wsMetricsStore';
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
  private pendingPings = new Map<number, number>();
  private pingSeq = 0;

  constructor(private readonly options: SpotWsClientOptions) {}

  getState(): WsConnectionState {
    return this.state;
  }

  private setState(state: WsConnectionState) {
    this.state = state;
    useWsMetricsStore.getState().setStreamPhase(streamPhaseFromWsState(state));
    if (state === 'connected') {
      useWsMetricsStore.getState().setReconnectAttempt(0);
    }
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
        if (parsed && typeof parsed === 'object' && (parsed as { type?: string }).type === 'pong') {
          const clientTs = (parsed as { client_ts?: number }).client_ts;
          if (typeof clientTs === 'number' && this.pendingPings.has(clientTs)) {
            this.pendingPings.delete(clientTs);
            useWsMetricsStore.getState().setLastRttMs(Math.round(Date.now() - clientTs));
          }
        }
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
    } else if ((!this.socket || this.socket.readyState === WebSocket.CLOSED) && this.shouldReconnect) {
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
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    this.clearReconnectTimer();
    const delay = nextReconnectDelay(this.reconnectAttempt, DEFAULT_RECONNECT_POLICY);
    this.reconnectAttempt += 1;
    useWsMetricsStore.getState().setReconnectAttempt(this.reconnectAttempt);
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
        const clientTs = Date.now();
        this.pingSeq += 1;
        this.pendingPings.set(clientTs, this.pingSeq);
        this.socket.send(JSON.stringify({ type: 'ping', client_ts: clientTs }));
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
