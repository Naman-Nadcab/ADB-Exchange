'use client';

import {
  createChart,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { ChartAdapter, ChartTheme, CandleData, TradeMarker } from './ChartAdapter';
import { getDomChartCrosshairColors, getDomChartThemeOptions, getTradingChartColors } from './cssTradingColors';
import { formatFixedTrim } from '../terminalFormat';
import type { ChartExtensionsConfig, DrawingToolMode, SerializedDrawing } from './extension/types';
import { throttleLeading } from './utils/throttle';
import { DrawingToolManager } from './tools/DrawingToolManager';
import { ModularEmaVwapPlugin } from './indicators/plugins/ModularEmaVwapPlugin';
import { OverlayStudyPlugin } from './indicators/plugins/OverlayStudyPlugin';
import { RsiPanePlugin } from './indicators/plugins/RsiPanePlugin';
import { VolumeMaPlugin } from './indicators/plugins/VolumeMaPlugin';
import type { OverlayStudyId } from './indicators';
import {
  candlestickDataFromSanitized,
  histogramSeriesDataFromCandles,
  sanitizeCandles,
  sanitizeTradeMarkersForChart,
} from './lightweightChartsData';

const toTs = (t: number) => t as UTCTimestamp;
// P0 reliability guard: keep trading terminal stable by default.
// Trade markers are informational only; disable until marker pipeline is fully monotonic in all runtime paths.
const ENABLE_TRADE_MARKERS = true;

export class LightweightChartsAdapter implements ChartAdapter {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private volumeMaEnabled = true;
  private priceScaleMode: 'normal' | 'log' | 'percent' = 'normal';
  private lastBar: CandleData | null = null;
  private intervalSeconds = 60;
  private nextCandleTime = 0;
  private allCandles: CandleData[] = [];
  private theme: ChartTheme = 'dark';
  private pricePrecision = 6;
  private legendPrecision = 6;
  private legendCallback: ((text: string) => void) | null = null;
  private overlayStudy: OverlayStudyId = 'none';
  private rsiEnabled = false;
  private throttledLightRefresh = throttleLeading<void>(100, () => this.refreshStudies('light'));

  /** Phase 2–4 — modular toggles (defaults off except volume on). */
  private extensions: ChartExtensionsConfig = { volumeHistogram: true };

  /** Legend / crosshair labels for line series (modular EMA/VWAP + overlay + BB). */
  private lineSeriesLegendLabel = new Map<ISeriesApi<'Line'>, string>();

  /** Phase B — modular EMA 7/20/50/200 + VWAP² (plugin). */
  private modularPlugin: ModularEmaVwapPlugin | null = null;

  private overlayPlugin: OverlayStudyPlugin | null = null;

  private rsiPlugin: RsiPanePlugin | null = null;

  private volumeMaPlugin: VolumeMaPlugin | null = null;

  private drawingTools: DrawingToolManager | null = null;

  private drawingMutateListener: (() => void) | null = null;

  private drawingMode: DrawingToolMode = 'none';

  private crosshairThrottled: ((p: MouseEventParams) => void) | null = null;
  private disposed = false;
  private lastSeriesTime = -1;
  private lastMarkerDiagnosticsAtMs = 0;
  private lastHardResyncAtMs = 0;
  private applyingSetData = false;
  private holdRealtimeUntilMs = 0;

  private getHistoryTailTime(): number {
    const tail = this.allCandles[this.allCandles.length - 1];
    return tail ? tail.time : -1;
  }

  /**
   * Reconcile live state against the rendered/history tail.
   * Guards against races where realtime state drifts behind chart tail after async reload/resync.
   */
  private reconcileRealtimeState(seedPrice: number): void {
    const floor = Math.max(this.lastSeriesTime, this.getHistoryTailTime());
    if (floor < 0) return;

    const histTail = this.allCandles[this.allCandles.length - 1];
    if (!this.lastBar) {
      const px =
        histTail?.close ??
        (Number.isFinite(seedPrice) && seedPrice > 0 ? seedPrice : 0);
      if (!Number.isFinite(px) || px <= 0) return;
      this.lastBar = {
        time: floor,
        open: px,
        high: px,
        low: px,
        close: px,
        volume: histTail?.volume ?? 0,
      };
    } else if (this.lastBar.time < floor) {
      if (histTail && histTail.time === floor) {
        this.lastBar = { ...histTail };
      } else {
        const px = Number.isFinite(this.lastBar.close) && this.lastBar.close > 0
          ? this.lastBar.close
          : Number.isFinite(seedPrice) && seedPrice > 0
            ? seedPrice
            : this.lastBar.open;
        this.lastBar = {
          time: floor,
          open: px,
          high: px,
          low: px,
          close: px,
          volume: this.lastBar.volume ?? 0,
        };
      }
    }

    if (this.lastBar && this.nextCandleTime <= this.lastBar.time) {
      this.nextCandleTime = this.lastBar.time + Math.max(1, this.intervalSeconds);
    }
  }

  private hardResyncSeries(reason: string): void {
    const now = Date.now();
    if (now - this.lastHardResyncAtMs < 600) return;
    this.lastHardResyncAtMs = now;
    try {
      const merged = this.workingCandles();
      this.setCandles(merged);
      this.refreshStudies('full');
    } catch {
      /* never throw from safety path */
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[chart] hard resync after monotonicity fault', { reason });
    }
  }

  private buildStrictAscCandles(candles: CandleData[]): CandleData[] {
    const sanitized = sanitizeCandles(candles);
    if (sanitized.length <= 1) return sanitized;
    const out: CandleData[] = [];
    let prev = -1;
    for (const row of sanitized) {
      const t = Math.floor(Number(row.time));
      if (!Number.isFinite(t) || t < 0 || t <= prev) continue;
      out.push({ ...row, time: t });
      prev = t;
    }
    return out;
  }

  private getContainerSize(container: HTMLElement): { w: number; h: number } {
    const rect = container.getBoundingClientRect();
    const w = Math.max(0, Math.floor(rect.width)) || container.clientWidth || 0;
    const h = Math.max(0, Math.floor(rect.height)) || container.clientHeight || 0;
    return { w, h };
  }

  /** Merge live `lastBar` into copy of history for accurate indicators. */
  private workingCandles(): CandleData[] {
    if (this.allCandles.length === 0) return [];
    if (!this.lastBar) return this.allCandles;
    const lastStored = this.allCandles[this.allCandles.length - 1]!;
    let merged: CandleData[];
    if (lastStored.time === this.lastBar.time) {
      merged = [...this.allCandles.slice(0, -1), { ...this.lastBar }];
    } else if (this.lastBar.time > lastStored.time) {
      merged = [...this.allCandles, { ...this.lastBar }];
    } else {
      merged = this.allCandles;
    }
    return sanitizeCandles(merged);
  }

  private syncLastBarIntoHistory(): void {
    if (!this.lastBar) return;
    const last = this.allCandles[this.allCandles.length - 1];
    if (!last) {
      this.allCandles = [{ ...this.lastBar }];
      return;
    }
    if (last.time === this.lastBar.time) {
      this.allCandles = [...this.allCandles.slice(0, -1), { ...this.lastBar }];
      return;
    }
    if (last.time < this.lastBar.time) {
      this.allCandles = [...this.allCandles, { ...this.lastBar }];
    }
  }

  /** Drop stale runtime state before symbol/timeframe reload to prevent cross-market bleed. */
  clearRealtimeState(): void {
    this.lastBar = null;
    this.nextCandleTime = 0;
    this.lastSeriesTime = this.allCandles.length > 0 ? this.allCandles[this.allCandles.length - 1]!.time : -1;
    try {
      this.series?.setMarkers([]);
    } catch {
      /* ignore */
    }
    this.emitLegend(null);
  }

  /**
   * Chart interval is authoritative from UI selection.
   * Avoid inferring from sparse history to prevent timeframe drift (e.g. 1W/1M).
   */
  setIntervalSeconds(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.intervalSeconds = Math.max(1, Math.floor(seconds));
    this.nextCandleTime = this.lastBar ? this.lastBar.time + this.intervalSeconds : 0;
  }

  private applyLayout(): void {
    if (!this.chart || !this.series || !this.volumeSeries) return;
    const rsiOn = this.rsiEnabled && (this.rsiPlugin?.isActive() ?? false);
    if (rsiOn) {
      this.series.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.36 } });
      this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.68, bottom: 0.2 } });
      this.chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.84, bottom: 0.02 } });
    } else {
      this.series.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
      this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    }
  }

  init(container: HTMLElement, theme: ChartTheme): void {
    if (this.chart) this.destroy();
    this.disposed = false;
    this.theme = theme;
    const { w, h } = this.getContainerSize(container);
    if (w <= 0 || h <= 0) return;
    const opts = getDomChartThemeOptions(theme);
    const cx = getDomChartCrosshairColors();
    const colors = getTradingChartColors();
    this.chart = createChart(container, {
      ...opts,
      layout: {
        ...opts.layout,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 11,
      },
      grid: { ...opts.grid },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: cx.line,
          style: 2,
          labelBackgroundColor: cx.labelBg,
        },
        horzLine: {
          width: 1,
          color: cx.line,
          style: 2,
          labelBackgroundColor: cx.labelBg,
        },
      },
      rightPriceScale: {
        ...opts.rightPriceScale,
        scaleMargins: { top: 0.08, bottom: 0.22 },
        borderVisible: true,
        alignLabels: true,
        minimumWidth: 64,
      },
      timeScale: {
        ...opts.timeScale,
        rightOffset: 10,
        barSpacing: 9,
        minBarSpacing: 2.8,
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        lockVisibleTimeRangeOnResize: false,
        shiftVisibleRangeOnNewBar: true,
        allowShiftVisibleRangeOnWhitespaceReplacement: true,
        borderColor: opts.timeScale.borderColor,
      },
      handleScroll: true,
      handleScale: true,
      kineticScroll: { mouse: true, touch: true },
      autoSize: true,
      width: w,
      height: h,
      localization: {
        locale: 'en-US',
        timeFormatter: (t: number) => {
          const d = new Date(t * 1000);
          return d.toLocaleString('en-GB', {
            timeZone: 'UTC',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
      },
    });
    const lineCtx = {
      getChart: () => this.chart,
      getLineFormatOptions: () => this.priceFormatOptions() as Record<string, unknown>,
      legendLabels: this.lineSeriesLegendLabel,
    };
    this.modularPlugin = new ModularEmaVwapPlugin(lineCtx);
    this.overlayPlugin = new OverlayStudyPlugin(lineCtx);
    this.rsiPlugin = new RsiPanePlugin(() => this.chart);
    this.volumeMaPlugin = new VolumeMaPlugin(() => this.chart);
    this.volumeMaPlugin.setUserVisible(this.volumeMaEnabled);
    this.series = this.chart.addCandlestickSeries({
      upColor: colors.up,
      downColor: colors.down,
      // Solid body, no border — Binance/Bybit style
      borderVisible: false,
      // Wicks slightly dimmed so the body stays visually dominant
      wickUpColor: colors.upVolume,
      wickDownColor: colors.downVolume,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineWidth: 1,
      priceLineColor: colors.up,
      ...this.priceFormatOptions(),
    });
    this.volumeSeries = this.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      // Per-bar color set in setCandles/applyTick via volColor()
      color: 'rgba(156, 163, 175, 0.2)',
    });
    this.volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    this.wireCrosshair();
    this.overlayPlugin.rebuildForStudy(this.overlayStudy);
    this.rsiPlugin.syncEnabled(this.rsiEnabled);
    this.syncExtensionSeries();
    this.applyLayout();
    this.applyPriceScaleMode();
  }

  private priceFormatOptions() {
    const p = Math.min(12, Math.max(0, Math.floor(this.pricePrecision)));
    const minMove = 10 ** -p;
    return {
      priceFormat: {
        type: 'price' as const,
        precision: p,
        minMove,
      },
    };
  }

  setLegendCallback(cb: ((text: string) => void) | null): void {
    this.legendCallback = cb;
    this.emitLegend(this.lastBar);
  }

  setLegendPrecision(decimals: number): void {
    this.legendPrecision = Math.min(12, Math.max(0, Math.floor(decimals)));
  }

  setPricePrecision(decimals: number): void {
    this.pricePrecision = Math.min(12, Math.max(0, Math.floor(decimals)));
    this.series?.applyOptions(this.priceFormatOptions());
  }

  /** Seconds until current candle closes (UTC bar time). */
  getSecondsToBarClose(): number | null {
    if (this.nextCandleTime <= 0) return null;
    const now = Math.floor(Date.now() / 1000);
    const d = this.nextCandleTime - now;
    return d < 0 ? 0 : d;
  }

  setOverlayStudy(id: OverlayStudyId | string): void {
    const next = (id === 'none' || !id ? 'none' : id) as OverlayStudyId;
    this.overlayStudy = next;
    if (!this.chart) return;
    this.overlayPlugin?.rebuildForStudy(this.overlayStudy);
    this.refreshStudies('full');
  }

  setRsiEnabled(on: boolean): void {
    this.rsiEnabled = on;
    if (!this.chart) return;
    this.rsiPlugin?.syncEnabled(on);
    this.applyLayout();
    this.refreshStudies('full');
  }

  setVolumeMaEnabled(on: boolean): void {
    this.volumeMaEnabled = on;
    this.volumeMaPlugin?.setUserVisible(on);
    this.volumeMaPlugin?.refresh(this.workingCandles());
  }

  setPriceScaleMode(mode: 'normal' | 'log' | 'percent'): void {
    this.priceScaleMode = mode;
    this.applyPriceScaleMode();
  }

  private applyPriceScaleMode(): void {
    if (!this.series) return;
    const mode =
      this.priceScaleMode === 'log'
        ? PriceScaleMode.Logarithmic
        : this.priceScaleMode === 'percent'
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal;
    try {
      this.series.priceScale().applyOptions({ mode });
    } catch {
      try {
        this.series.priceScale().applyOptions({ mode: PriceScaleMode.Normal });
      } catch {
        /* ignore */
      }
    }
  }

  /** Save chart as PNG (no TradingView; uses library screenshot). */
  exportChartPng(filenameBase: string): void {
    if (!this.chart) return;
    try {
      const canvas = this.chart.takeScreenshot();
      const safe = filenameBase.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'chart';
      const a = document.createElement('a');
      a.download = `${safe}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch {
      // ignore
    }
  }

  /** Legacy MA dropdown → overlay study. */
  setMaOverlay(period: number | null): void {
    if (period == null) {
      this.setOverlayStudy('none');
      return;
    }
    const map: Record<number, OverlayStudyId> = {
      7: 'sma_7',
      9: 'sma_9',
      25: 'sma_25',
      99: 'sma_99',
    };
    const id = map[period];
    if (id) this.setOverlayStudy(id);
    else this.setOverlayStudy('none');
  }

  private fmtPrice(n: number): string {
    return formatFixedTrim(n, this.legendPrecision);
  }

  private fmtVol(v: number | undefined): string {
    if (v == null || !Number.isFinite(v)) return '—';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
    return formatFixedTrim(v, 2);
  }

  /** Matches chart `timeFormatter` (UTC, en-GB) for legend consistency. */
  private fmtBarTimeUtc(sec: number): string {
    const d = new Date(sec * 1000);
    return d.toLocaleString('en-GB', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private emitLegend(bar: CandleData | null): void {
    if (!this.legendCallback) return;
    if (!bar) {
      this.legendCallback('');
      return;
    }
    const ch = bar.close >= bar.open ? '▲' : '▼';
    const change = bar.close - bar.open;
    const pct = bar.open !== 0 ? (change / bar.open) * 100 : 0;
    const sign = change >= 0 ? '+' : '';
    this.legendCallback(
      `T ${this.fmtBarTimeUtc(bar.time)} UTC  ${ch} O ${this.fmtPrice(bar.open)}  H ${this.fmtPrice(bar.high)}  L ${this.fmtPrice(bar.low)}  C ${this.fmtPrice(bar.close)}  ${sign}${pct.toFixed(2)}%  Vol ${this.fmtVol(bar.volume)}`
    );
  }

  /** Crosshair row + optional modular EMA / overlay / RSI from `seriesData` (throttled). */
  private emitCrosshairLegend(param: MouseEventParams): void {
    if (!this.legendCallback || !this.series) return;
    const t = param.time as UTCTimestamp | undefined;
    if (t == null || param.point === undefined) {
      this.emitLegend(this.lastBar);
      return;
    }
    const timeNum = typeof t === 'number' ? t : Number(t);
    const bar = this.allCandles.find((c) => c.time === timeNum) ?? this.lastBar;
    if (!bar) {
      this.legendCallback('');
      return;
    }
    const ch = bar.close >= bar.open ? '▲' : '▼';
    const change = bar.close - bar.open;
    const pct = bar.open !== 0 ? (change / bar.open) * 100 : 0;
    const sign = change >= 0 ? '+' : '';
    let text = `T ${this.fmtBarTimeUtc(timeNum)} UTC  ${ch} O ${this.fmtPrice(bar.open)}  H ${this.fmtPrice(bar.high)}  L ${this.fmtPrice(
      bar.low
    )}  C ${this.fmtPrice(bar.close)}  ${sign}${pct.toFixed(2)}%  Vol ${this.fmtVol(bar.volume)}`;

    const appendLine = (series: ISeriesApi<'Line'> | null, fallbackLabel: string) => {
      if (!series) return;
      const d = param.seriesData.get(series);
      if (!d || typeof d !== 'object' || !('value' in d)) return;
      const v = (d as { value: number }).value;
      if (!Number.isFinite(v)) return;
      const label = this.lineSeriesLegendLabel.get(series) ?? fallbackLabel;
      text += `  ${label} ${this.fmtPrice(v)}`;
    };

    this.modularPlugin?.forEachLineSeries((line) => appendLine(line, 'EMA'));
    appendLine(this.overlayPlugin?.getOverlayLine() ?? null, 'Ovl');
    appendLine(this.overlayPlugin?.getBbUpper() ?? null, 'BB up');
    appendLine(this.overlayPlugin?.getBbMid() ?? null, 'BB mid');
    appendLine(this.overlayPlugin?.getBbLower() ?? null, 'BB lo');

    const rsiSeries = this.rsiPlugin?.getSeries() ?? null;
    if (rsiSeries) {
      const d = param.seriesData.get(rsiSeries);
      if (d && typeof d === 'object' && 'value' in d) {
        const v = (d as { value: number }).value;
        if (Number.isFinite(v)) text += `  RSI ${v.toFixed(2)}`;
      }
    }

    this.legendCallback(text);
  }

  private wireCrosshair(): void {
    if (!this.chart || !this.series) return;
    this.crosshairThrottled = throttleLeading(50, (param: MouseEventParams) => {
      this.emitCrosshairLegend(param);
    });
    this.chart.subscribeCrosshairMove((param: MouseEventParams) => {
      const t = param.time as UTCTimestamp | undefined;
      if (t == null || param.point === undefined) {
        this.emitLegend(this.lastBar);
        return;
      }
      this.crosshairThrottled?.(param);
    });
  }

  /** Phase 9 — UI: merge toggles; safe to call often. */
  applyExtensions(patch: Partial<ChartExtensionsConfig>): void {
    this.extensions = { ...this.extensions, ...patch };
    this.syncExtensionSeries();
    this.refreshStudies('full');
  }

  private syncExtensionSeries(): void {
    if (!this.chart || !this.series) return;
    const cfg = this.extensions;

    this.modularPlugin?.syncSeriesFromConfig({
      ema7: cfg.ema7,
      ema20: cfg.ema20,
      ema50: cfg.ema50,
      ema200: cfg.ema200,
      modularVwap: cfg.modularVwap,
    });

    if (this.volumeSeries) {
      const vis = cfg.volumeHistogram !== false;
      this.volumeSeries.applyOptions({ visible: vis });
    }
  }

  private refreshModularForKind(kind: 'full' | 'light'): void {
    const p = this.modularPlugin;
    if (!p?.isActive()) return;
    const candles = this.workingCandles();
    if (kind === 'full') {
      p.onCandlesFull(candles);
    } else {
      p.onCandlesLight(this.lastBar, candles);
    }
  }

  attachDrawingOverlay(overlayRoot: HTMLElement): void {
    if (!this.chart || !this.series) return;
    this.detachDrawingOverlay();
    this.drawingTools = new DrawingToolManager(this.chart, this.series, overlayRoot);
    this.drawingTools.setMode(this.drawingMode);
    this.drawingTools.setMutateCallback(this.drawingMutateListener);
  }

  /** Optional: persist drawings (e.g. localStorage) when user edits annotations. */
  setDrawingMutateListener(cb: (() => void) | null): void {
    this.drawingMutateListener = cb;
    this.drawingTools?.setMutateCallback(cb);
  }

  detachDrawingOverlay(): void {
    this.drawingTools?.destroy();
    this.drawingTools = null;
  }

  setDrawingToolMode(mode: DrawingToolMode): void {
    this.drawingMode = mode;
    this.drawingTools?.setMode(mode);
  }

  clearDrawings(): void {
    this.drawingTools?.clearAll();
  }

  /** Phase A — JSON-serializable drawings for persistence / workspace restore. */
  exportDrawings(): SerializedDrawing[] {
    return this.drawingTools?.serializeDrawings() ?? [];
  }

  importDrawings(payload: SerializedDrawing[]): void {
    this.drawingTools?.loadSerializedDrawings(payload);
  }

  updateTheme(theme: ChartTheme): void {
    if (!this.chart) return;
    this.theme = theme;
    const opts = getDomChartThemeOptions(theme);
    const cx = getDomChartCrosshairColors();
    const colors = getTradingChartColors();
    this.chart.applyOptions({
      layout: opts.layout,
      grid: opts.grid,
      crosshair: {
        vertLine: { color: cx.line, labelBackgroundColor: cx.labelBg },
        horzLine: { color: cx.line, labelBackgroundColor: cx.labelBg },
      },
      rightPriceScale: {
        ...opts.rightPriceScale,
        borderVisible: true,
        alignLabels: true,
      },
      timeScale: opts.timeScale,
    });
    this.series?.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      wickUpColor: colors.upVolume,
      wickDownColor: colors.downVolume,
      ...this.priceFormatOptions(),
    });
    this.updatePriceLineColor();
    this.applyLayout();
    this.applyPriceScaleMode();
  }

  private refreshStudies(kind: 'full' | 'light' = 'full'): void {
    try {
      this.refreshStudiesInner(kind);
    } catch {
      /* indicators must not break candle rendering */
    }
  }

  private refreshStudiesInner(kind: 'full' | 'light'): void {
    const candles = this.workingCandles();
    this.overlayPlugin?.refreshForStudy(this.overlayStudy, candles);
    this.rsiPlugin?.refresh(this.rsiEnabled, candles);
    this.volumeMaPlugin?.refresh(candles);
    this.refreshModularForKind(kind);
  }

  private volColor(up: boolean): string {
    const c = getTradingChartColors();
    return up ? c.upVolume : c.downVolume;
  }

  /** `update()` throws if time is not strictly after the last committed bar in some edge cases. */
  private tryCandleUpdate(data: {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
  }): void {
    if (!this.series) return;
    const t = Number(data.time);
    if (!Number.isFinite(t) || t < 0) return;
    if (this.lastSeriesTime >= 0 && t < this.lastSeriesTime) return;
    try {
      this.series.update(data);
      this.lastSeriesTime = t;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('asc ordered by time') || msg.includes('ordered by time')) {
        this.lastSeriesTime = Math.max(this.lastSeriesTime, this.getHistoryTailTime());
        this.hardResyncSeries(msg);
      }
    }
  }

  private tryVolumeUpdate(data: { time: UTCTimestamp; value: number; color: string }): void {
    if (!this.volumeSeries) return;
    try {
      this.volumeSeries.update(data);
    } catch {
      /* ignore */
    }
  }

  private updatePriceLineColor(): void {
    if (!this.series || !this.lastBar) return;
    const colors = getTradingChartColors();
    const up = this.lastBar.close >= this.lastBar.open;
    this.series.applyOptions({
      priceLineColor: up ? colors.up : colors.down,
    });
  }

  setCandles(data: CandleData[]): void {
    if (!this.series || this.disposed) return;
    this.holdRealtimeUntilMs = Date.now() + 750;
    this.applyingSetData = true;
    try {
      const normalized = this.buildStrictAscCandles(data);
      this.allCandles = normalized;
      const formatted = candlestickDataFromSanitized(normalized);
      let seriesApplied = false;
      try {
        this.series.setData(formatted);
        seriesApplied = true;
      } catch {
        try {
          this.series.setData([]);
          seriesApplied = true;
        } catch {
          /* ignore */
        }
      }
      if (this.volumeSeries) {
        const vol = histogramSeriesDataFromCandles(normalized, (up) => this.volColor(up));
        try {
          this.volumeSeries.setData(vol);
        } catch {
          try {
            this.volumeSeries.setData([]);
          } catch {
            /* ignore */
          }
        }
      }
      const last = normalized[normalized.length - 1];
      this.lastBar = last ? { ...last } : null;
      if (!Number.isFinite(this.intervalSeconds) || this.intervalSeconds <= 0) this.intervalSeconds = 60;
      this.nextCandleTime = this.lastBar ? this.lastBar.time + this.intervalSeconds : 0;
      if (seriesApplied) {
        this.lastSeriesTime = this.lastBar?.time ?? -1;
      }
      this.refreshStudies('full');
      this.updatePriceLineColor();
      this.emitLegend(this.lastBar);
    } finally {
      this.applyingSetData = false;
    }
  }

  prependCandles(data: CandleData[]): void {
    if (!this.series || this.disposed) return;
    if (data.length === 0) return;
    const merged = sanitizeCandles([...data, ...this.allCandles]);
    this.setCandles(merged);
  }

  private applyTick(tickTime: number, price: number, volumeDelta?: number): void {
    if (!this.series || this.disposed) return;
    if (this.applyingSetData) return;
    if (Date.now() < this.holdRealtimeUntilMs) return;
    let tt = Math.floor(Number(tickTime));
    if (!Number.isFinite(tt) || tt < 0) return;
    if (!Number.isFinite(this.intervalSeconds) || this.intervalSeconds <= 0) this.intervalSeconds = 60;
    // Keep realtime bars on candle boundaries; raw trade seconds can cause cross-path ordering drift.
    tt = Math.floor(tt / this.intervalSeconds) * this.intervalSeconds;
    this.reconcileRealtimeState(price);
    /** Never move backwards in chart time — library update() rejects it. */
    if (this.lastBar && tt < this.lastBar.time) {
      tt = this.lastBar.time;
    }
    const floor = Math.max(this.lastSeriesTime, this.getHistoryTailTime());
    if (floor >= 0 && tt < floor) {
      tt = floor;
    }
    const volAdd = volumeDelta != null && Number.isFinite(volumeDelta) && volumeDelta > 0 ? volumeDelta : 0;

    if (!this.lastBar) {
      const bar: CandleData = { time: tt, open: price, high: price, low: price, close: price, volume: volAdd };
      this.lastBar = { ...bar };
      this.nextCandleTime = this.lastBar.time + this.intervalSeconds;
      this.tryCandleUpdate({ time: toTs(bar.time), open: bar.open, high: bar.high, low: bar.low, close: bar.close });
      this.tryVolumeUpdate({
        time: toTs(bar.time),
        value: bar.volume ?? 0,
        color: this.volColor(true),
      });
      this.syncLastBarIntoHistory();
      this.updatePriceLineColor();
      this.emitLegend(this.lastBar);
      this.refreshStudies('full');
      return;
    }

    if (tt < this.nextCandleTime) {
      this.lastBar.close = price;
      this.lastBar.high = Math.max(this.lastBar.high, price);
      this.lastBar.low = Math.min(this.lastBar.low, price);
      this.lastBar.volume = (this.lastBar.volume ?? 0) + volAdd;
      this.tryCandleUpdate({
        time: toTs(this.lastBar.time),
        open: this.lastBar.open,
        high: this.lastBar.high,
        low: this.lastBar.low,
        close: this.lastBar.close,
      });
      this.tryVolumeUpdate({
        time: toTs(this.lastBar.time),
        value: this.lastBar.volume ?? 0,
        color: this.volColor(this.lastBar.close >= this.lastBar.open),
      });
      this.syncLastBarIntoHistory();
      this.updatePriceLineColor();
      this.emitLegend(this.lastBar);
      this.throttledLightRefresh();
      return;
    }

    if (this.nextCandleTime <= this.lastBar.time) {
      this.nextCandleTime = this.lastBar.time + Math.max(1, this.intervalSeconds);
    }
    let safety = 0;
    while (tt >= this.nextCandleTime) {
      safety += 1;
      if (safety > 4096) {
        // Bad external timestamp should not spin/poison chart state.
        tt = this.nextCandleTime;
        break;
      }
      const prevClose: number = this.lastBar.close;
      this.lastBar = {
        time: this.nextCandleTime,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: 0,
      };
      this.tryCandleUpdate({
        time: toTs(this.lastBar.time),
        open: this.lastBar.open,
        high: this.lastBar.high,
        low: this.lastBar.low,
        close: this.lastBar.close,
      });
      this.tryVolumeUpdate({
        time: toTs(this.lastBar.time),
        value: this.lastBar.volume ?? 0,
        color: 'rgba(156, 163, 175, 0.2)',
      });
      this.nextCandleTime += this.intervalSeconds;
    }

    this.lastBar.close = price;
    this.lastBar.high = Math.max(this.lastBar.high, price);
    this.lastBar.low = Math.min(this.lastBar.low, price);
    this.lastBar.volume = (this.lastBar.volume ?? 0) + volAdd;
    this.tryCandleUpdate({
      time: toTs(this.lastBar.time),
      open: this.lastBar.open,
      high: this.lastBar.high,
      low: this.lastBar.low,
      close: this.lastBar.close,
    });
    this.tryVolumeUpdate({
      time: toTs(this.lastBar.time),
      value: this.lastBar.volume ?? 0,
      color: this.volColor(this.lastBar.close >= this.lastBar.open),
    });
    this.syncLastBarIntoHistory();
    this.updatePriceLineColor();
    this.emitLegend(this.lastBar);
    this.refreshStudies('full');
  }

  updatePrice(tickTime: number, price: number): void {
    try {
      this.applyTick(tickTime, price);
    } catch (err) {
      console.warn('[chart] updatePrice failed; attempting recovery', err);
      try {
        this.setCandles(this.allCandles);
      } catch {
        /* ignore */
      }
    }
  }

  updateTrade(tickTime: number, price: number, volumeDelta: number): void {
    try {
      this.applyTick(tickTime, price, volumeDelta);
    } catch (err) {
      console.warn('[chart] updateTrade failed; attempting recovery', err);
      try {
        this.setCandles(this.allCandles);
      } catch {
        /* ignore */
      }
    }
  }

  fitContent(): void {
    this.chart?.timeScale().fitContent();
  }

  private sanitizeMarkers(
    markers: Array<{
      time: number;
      position: 'belowBar' | 'aboveBar';
      color: string;
      shape: 'arrowUp' | 'arrowDown';
      text: string;
    }>
  ): Array<{
    time: UTCTimestamp;
    position: 'belowBar' | 'aboveBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown';
    text: string;
  }> {
    const sorted = markers
      .map((m) => ({ ...m, time: Math.floor(Number(m.time)) }))
      .filter((m) => Number.isFinite(m.time) && m.time >= 0)
      .sort((a, b) => a.time - b.time);

    const out: Array<{
      time: UTCTimestamp;
      position: 'belowBar' | 'aboveBar';
      color: string;
      shape: 'arrowUp' | 'arrowDown';
      text: string;
    }> = [];
    let prev = -1;
    for (const m of sorted) {
      if (m.time <= prev) continue;
      out.push({ ...m, time: toTs(m.time) });
      prev = m.time;
    }
    return out;
  }

  private emitMarkerDiagnostics(
    symbol: string,
    invalidCount: number,
    duplicateCount: number,
    markersBeforeSanitize: Array<{ time: number; position: 'belowBar' | 'aboveBar' }>,
    markersAfterSanitizeCount: number
  ): void {
    const droppedByFinalSanitizer = Math.max(0, markersBeforeSanitize.length - markersAfterSanitizeCount);
    if (invalidCount <= 0 && duplicateCount <= 0 && droppedByFinalSanitizer <= 0) return;
    const now = Date.now();
    if (now - this.lastMarkerDiagnosticsAtMs < 30_000) return;
    this.lastMarkerDiagnosticsAtMs = now;
    console.warn('[chart] dropped/normalized trade markers', {
      symbol,
      intervalSeconds: this.intervalSeconds,
      invalidMarkerCount: invalidCount,
      duplicateMarkerCount: duplicateCount,
      droppedByFinalSanitizer,
    });
    console.table(
      markersBeforeSanitize.map((m) => ({
        time: m.time,
        position: m.position,
      }))
    );
  }

  setTradeMarkers(trades: TradeMarker[]): void {
    if (!this.series || this.disposed) return;
    if (!ENABLE_TRADE_MARKERS) return;
    if (this.applyingSetData) return;
    if (Date.now() < this.holdRealtimeUntilMs) return;
    try {
      const colors = getTradingChartColors();
      const markerSanitized = sanitizeTradeMarkersForChart(trades);
      const validTimes = new Set(this.workingCandles().map((c) => c.time));
      const markersBeforeSanitize = markerSanitized.markers
        .map((t) => ({
          ...t,
          time: Math.floor(t.time / Math.max(1, this.intervalSeconds)) * Math.max(1, this.intervalSeconds),
        }))
        .filter((t) => validTimes.has(t.time))
        .map((t) => ({
          time: t.time,
          position: (t.side === 'buy' ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
          color: t.side === 'buy' ? colors.up : colors.down,
          shape: (t.side === 'buy' ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
          text: '',
        }));
      const markers = this.sanitizeMarkers(markersBeforeSanitize);
      this.emitMarkerDiagnostics(
        markerSanitized.symbol,
        markerSanitized.invalidCount,
        markerSanitized.duplicateCount,
        markersBeforeSanitize.map((m) => ({ time: m.time, position: m.position })),
        markers.length
      );
      this.series.setMarkers(markers);
    } catch {
      try {
        this.series.setMarkers([]);
      } catch {
        /* ignore */
      }
    }
  }

  destroy(): void {
    this.disposed = true;
    this.detachDrawingOverlay();
    this.modularPlugin?.disposeState();
    this.modularPlugin = null;
    this.overlayPlugin?.disposeState();
    this.overlayPlugin = null;
    this.rsiPlugin?.disposeState();
    this.rsiPlugin = null;
    this.volumeMaPlugin?.disposeState();
    this.volumeMaPlugin = null;
    this.legendCallback = null;
    this.crosshairThrottled = null;
    this.lineSeriesLegendLabel.clear();
    this.lastBar = null;
    this.nextCandleTime = 0;
    this.lastSeriesTime = -1;
    this.allCandles = [];
    const c = this.chart;
    this.chart = null;
    this.series = null;
    this.volumeSeries = null;
    try {
      c?.remove();
    } catch {
      // ignore
    }
  }
}
