import { create } from 'zustand';
import type { SpotWsStreamPhase } from '@core/domain/trade/marketPulse';

export type { SpotWsStreamPhase };

type WsMetricsState = {
  streamPhase: SpotWsStreamPhase;
  lastRttMs: number | null;
  reconnectAttempt: number;
  liteMode: boolean;
  liteHint?: string;
  setStreamPhase: (phase: SpotWsStreamPhase) => void;
  setLastRttMs: (ms: number | null) => void;
  setReconnectAttempt: (n: number) => void;
  setLiteMode: (lite: boolean, hint?: string) => void;
};

export const useWsMetricsStore = create<WsMetricsState>((set) => ({
  streamPhase: 'connecting',
  lastRttMs: null,
  reconnectAttempt: 0,
  liteMode: false,
  setStreamPhase: (streamPhase) => set({ streamPhase }),
  setLastRttMs: (lastRttMs) => set({ lastRttMs }),
  setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),
  setLiteMode: (liteMode, liteHint) => set({ liteMode, liteHint }),
}));
