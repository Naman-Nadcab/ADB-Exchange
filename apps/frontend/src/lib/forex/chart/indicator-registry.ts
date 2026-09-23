/**
 * Canonical Forex chart indicator registry (customer terminal).
 * Calculations use authoritative OHLC from the candle API — never quotes for history.
 */
import {
  atrSeries,
  bollinger,
  ema,
  ichimoku,
  macdSeries,
  rsi,
  sma,
  type StudyBar,
  type StudyPoint,
  wma,
} from './studies';
import {
  cci,
  mfi,
  momentum,
  obv,
  parabolicSar,
  roc,
  smma,
  stochasticSeries,
  stdDevSeries,
  williamsR,
  adxSeries,
} from './studies-extended';

export type IndicatorPane = 'overlay' | 'oscillator';

export type IndicatorParamDef = { key: string; label: string; default: number; min: number; max: number };

export type IndicatorDefinition = {
  id: string;
  name: string;
  category: 'moving_average' | 'momentum' | 'trend' | 'volatility' | 'volume';
  pane: IndicatorPane;
  params: IndicatorParamDef[];
  version: 1;
  compute: (bars: StudyBar[], params: Record<string, number>) => { lines: Array<{ id: string; points: StudyPoint[] }> };
};

function p(params: Record<string, number>, key: string, def: number): number {
  const v = params[key];
  return Number.isFinite(v) && v > 0 ? v : def;
}

function pf(params: Record<string, number>, key: string, def: number): number {
  const v = params[key];
  return Number.isFinite(v) && v > 0 ? v : def;
}

export const FOREX_INDICATOR_REGISTRY: IndicatorDefinition[] = [
  {
    id: 'sma',
    name: 'SMA',
    category: 'moving_average',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 400 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'sma', points: sma(bars, p(params, 'period', 20)) }] }),
  },
  {
    id: 'ema',
    name: 'EMA',
    category: 'moving_average',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 400 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'ema', points: ema(bars, p(params, 'period', 20)) }] }),
  },
  {
    id: 'wma',
    name: 'WMA',
    category: 'moving_average',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 400 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'wma', points: wma(bars, p(params, 'period', 20)) }] }),
  },
  {
    id: 'smma',
    name: 'SMMA',
    category: 'moving_average',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 400 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'smma', points: smma(bars, p(params, 'period', 20)) }] }),
  },
  {
    id: 'rsi',
    name: 'RSI',
    category: 'momentum',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'rsi', points: rsi(bars, p(params, 'period', 14)) }] }),
  },
  {
    id: 'macd',
    name: 'MACD',
    category: 'momentum',
    pane: 'oscillator',
    params: [
      { key: 'fast', label: 'Fast', default: 12, min: 2, max: 100 },
      { key: 'slow', label: 'Slow', default: 26, min: 2, max: 200 },
      { key: 'signal', label: 'Signal', default: 9, min: 2, max: 50 },
    ],
    version: 1,
    compute: (bars, params) => {
      const s = macdSeries(bars, p(params, 'fast', 12), p(params, 'slow', 26), p(params, 'signal', 9));
      return {
        lines: [
          { id: 'macd', points: s.macd },
          { id: 'signal', points: s.signal },
          { id: 'hist', points: s.hist },
        ],
      };
    },
  },
  {
    id: 'stochastic',
    name: 'Stochastic',
    category: 'momentum',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
    version: 1,
    compute: (bars, params) => {
      const s = stochasticSeries(bars, p(params, 'period', 14));
      return {
        lines: [
          { id: 'k', points: s.k },
          { id: 'd', points: s.d },
        ],
      };
    },
  },
  {
    id: 'cci',
    name: 'CCI',
    category: 'momentum',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'cci', points: cci(bars, p(params, 'period', 20)) }] }),
  },
  {
    id: 'momentum',
    name: 'Momentum',
    category: 'momentum',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 10, min: 1, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'mom', points: momentum(bars, p(params, 'period', 10)) }] }),
  },
  {
    id: 'roc',
    name: 'ROC',
    category: 'momentum',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 10, min: 1, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'roc', points: roc(bars, p(params, 'period', 10)) }] }),
  },
  {
    id: 'williams_r',
    name: 'Williams %R',
    category: 'momentum',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'wr', points: williamsR(bars, p(params, 'period', 14)) }] }),
  },
  {
    id: 'adx',
    name: 'ADX',
    category: 'trend',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 50 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'adx', points: adxSeries(bars, p(params, 'period', 14)) }] }),
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku',
    category: 'trend',
    pane: 'overlay',
    params: [],
    version: 1,
    compute: (bars) => {
      const c = ichimoku(bars);
      return {
        lines: [
          { id: 'tenkan', points: c.tenkan },
          { id: 'kijun', points: c.kijun },
          { id: 'spanA', points: c.spanA },
          { id: 'spanB', points: c.spanB },
        ],
      };
    },
  },
  {
    id: 'psar',
    name: 'Parabolic SAR',
    category: 'trend',
    pane: 'overlay',
    params: [
      { key: 'step', label: 'Step', default: 0.02, min: 0.01, max: 0.2 },
      { key: 'max', label: 'Max', default: 0.2, min: 0.05, max: 0.5 },
    ],
    version: 1,
    compute: (bars, params) => ({
      lines: [{ id: 'psar', points: parabolicSar(bars, pf(params, 'step', 0.02), pf(params, 'max', 0.2)) }],
    }),
  },
  {
    id: 'atr',
    name: 'ATR',
    category: 'volatility',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'atr', points: atrSeries(bars, p(params, 'period', 14)) }] }),
  },
  {
    id: 'std_dev',
    name: 'Std Dev',
    category: 'volatility',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 400 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'std_dev', points: stdDevSeries(bars, p(params, 'period', 20)) }] }),
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    category: 'volatility',
    pane: 'overlay',
    params: [
      { key: 'period', label: 'Period', default: 20, min: 2, max: 200 },
      { key: 'mult', label: 'Mult', default: 2, min: 0.5, max: 4 },
    ],
    version: 1,
    compute: (bars, params) => {
      const b = bollinger(bars, p(params, 'period', 20), p(params, 'mult', 2));
      return {
        lines: [
          { id: 'mid', points: b.mid },
          { id: 'upper', points: b.upper },
          { id: 'lower', points: b.lower },
        ],
      };
    },
  },
  {
    id: 'obv',
    name: 'OBV',
    category: 'volume',
    pane: 'oscillator',
    params: [],
    version: 1,
    compute: (bars) => ({ lines: [{ id: 'obv', points: obv(bars) }] }),
  },
  {
    id: 'mfi',
    name: 'MFI',
    category: 'volume',
    pane: 'oscillator',
    params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }],
    version: 1,
    compute: (bars, params) => ({ lines: [{ id: 'mfi', points: mfi(bars, p(params, 'period', 14)) }] }),
  },
];

export function getForexIndicatorDefinition(id: string): IndicatorDefinition | undefined {
  return FOREX_INDICATOR_REGISTRY.find((d) => d.id === id);
}

export const FOREX_INDICATOR_STORAGE_KEY = 'eda-forex-chart-indicators-v1';

export type StoredForexIndicator = { id: string; enabled: boolean; params: Record<string, number> };

export function loadStoredForexIndicators(): StoredForexIndicator[] {
  if (typeof window === 'undefined') return [{ id: 'ema', enabled: true, params: { period: 20 } }];
  try {
    const raw = localStorage.getItem(FOREX_INDICATOR_STORAGE_KEY);
    if (!raw) return [{ id: 'ema', enabled: true, params: { period: 20 } }];
    const parsed = JSON.parse(raw) as StoredForexIndicator[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredForexIndicators(rows: StoredForexIndicator[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FOREX_INDICATOR_STORAGE_KEY, JSON.stringify(rows));
}
