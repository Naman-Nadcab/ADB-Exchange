import { create } from 'zustand';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import type { OrderSide } from '@exchange/mobile-types';
import type { ChartStudiesState, ChartViewMode, OverlayStudyId } from '@core/domain/trade/indicators';

const LAST_PAIR_KEY = 'trade.lastPair';
const LAST_SIDE_KEY = 'trade.side';
const CHART_INTERVAL_KEY = 'trade.chartInterval';
const CHART_VIEW_KEY = 'trade.chartViewMode';
const CHART_STUDIES_KEY = 'trade.chartStudies';
const DEFAULT_CHART_INTERVAL = 300;

const DEFAULT_STUDIES: ChartStudiesState = {
  overlay: 'none',
  rsi: false,
  volumeSma: false,
};

type TradeStore = {
  symbol: string;
  side: OrderSide;
  chartInterval: number;
  chartViewMode: ChartViewMode;
  chartStudies: ChartStudiesState;
  wsAuthenticated: boolean;
  setSymbol: (symbol: string) => void;
  setSide: (side: OrderSide) => void;
  setChartInterval: (interval: number) => void;
  setChartViewMode: (mode: ChartViewMode) => void;
  setChartStudies: (studies: ChartStudiesState) => void;
  setWsAuthenticated: (v: boolean) => void;
  hydrate: () => void;
};

const VALID_OVERLAYS = new Set<OverlayStudyId>([
  'none',
  'sma_7',
  'sma_9',
  'sma_25',
  'sma_99',
  'ema_12',
  'ema_26',
  'vwap',
  'bb_20',
]);

function parseStudies(raw: string | undefined): ChartStudiesState {
  if (!raw) return DEFAULT_STUDIES;
  try {
    const parsed = JSON.parse(raw) as Partial<ChartStudiesState>;
    const overlay = VALID_OVERLAYS.has(parsed.overlay as OverlayStudyId)
      ? (parsed.overlay as OverlayStudyId)
      : DEFAULT_STUDIES.overlay;
    return {
      overlay,
      rsi: Boolean(parsed.rsi),
      volumeSma: Boolean(parsed.volumeSma),
    };
  } catch {
    return DEFAULT_STUDIES;
  }
}

function parseViewMode(raw: string | undefined): ChartViewMode {
  return raw === 'depth' ? 'depth' : 'candle';
}

export const useTradeStore = create<TradeStore>((set) => ({
  symbol: 'BTC_USDT',
  side: 'buy',
  chartInterval: DEFAULT_CHART_INTERVAL,
  chartViewMode: 'candle',
  chartStudies: DEFAULT_STUDIES,
  wsAuthenticated: false,
  setSymbol: (symbol) => {
    mmkvStorage.set(LAST_PAIR_KEY, symbol);
    set({ symbol });
  },
  setSide: (side) => {
    mmkvStorage.set(LAST_SIDE_KEY, side);
    set({ side });
  },
  setChartInterval: (chartInterval) => {
    mmkvStorage.set(CHART_INTERVAL_KEY, String(chartInterval));
    set({ chartInterval });
  },
  setChartViewMode: (chartViewMode) => {
    mmkvStorage.set(CHART_VIEW_KEY, chartViewMode);
    set({ chartViewMode });
  },
  setChartStudies: (chartStudies) => {
    mmkvStorage.set(CHART_STUDIES_KEY, JSON.stringify(chartStudies));
    set({ chartStudies });
  },
  setWsAuthenticated: (wsAuthenticated) => set({ wsAuthenticated }),
  hydrate: () => {
    const symbol = mmkvStorage.getString(LAST_PAIR_KEY) ?? 'BTC_USDT';
    const side = (mmkvStorage.getString(LAST_SIDE_KEY) as OrderSide) ?? 'buy';
    const stored = Number(mmkvStorage.getString(CHART_INTERVAL_KEY));
    const chartInterval = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_CHART_INTERVAL;
    const chartViewMode = parseViewMode(mmkvStorage.getString(CHART_VIEW_KEY));
    const chartStudies = parseStudies(mmkvStorage.getString(CHART_STUDIES_KEY));
    set({ symbol, side, chartInterval, chartViewMode, chartStudies });
  },
}));
