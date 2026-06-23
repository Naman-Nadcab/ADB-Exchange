# Phase 4 — Chart Forensic Audit

**Generated:** 2026-06-22  
**Stack:** TradingView **Lightweight Charts** (not full TradingView widget)

---

## Component Map

| Layer | File |
|-------|------|
| UI shell | `components/trade/ChartPanel.tsx` |
| Hook | `components/trade/chart/useChartAdapter.ts` |
| Adapter | `components/trade/chart/LightweightChartsAdapter.ts` |
| Data fetch | `components/trade/chart/getChartCandles.ts` |
| Sanitize | `lightweightChartsData.ts` — `sanitizeCandles`, `sanitizeTradeMarkersForChart` |
| Error boundary | `ChartErrorBoundary.tsx` |
| Indicators | `ModularEmaVwapPlugin`, `OverlayStudyPlugin`, `RsiPanePlugin`, `VolumeMaPlugin` |
| Drawing tools | `DrawingToolManager.ts` |

---

## Data Pipeline

```
GET /api/v1/trading/candles/:pairId?interval&from&to&limit
  → useChartAdapter (900 bars initial, backfill up to 300k)
  → sanitizeCandles()
  → LightweightChartsAdapter.setData / update()
  → WS ticker/trades → forming candle (ChartPanel effects)
```

**Resync interval:** `setInterval(..., 15_000)` in `useChartAdapter.ts` (comment says 30s — code is 15s).

---

## Verified Behaviors (code)

| Feature | Status | Evidence |
|---------|--------|----------|
| Candle ordering | ✅ Sanitized | `sanitizeCandles` in adapter init |
| Timestamp monotonicity | ✅ Guards | `lastSeriesTime`, `reconcileRealtimeState` L86–100 |
| Timeframe switch | ✅ | `ChartPanel` toolbar intervals |
| Zoom / pan | ✅ | Lightweight Charts default |
| Resize | ✅ | `ResizeObserver` in adapter |
| Dark mode | ✅ | `getDomChartThemeOptions`, `ChartTheme = 'dark'` default |
| Crosshair | ✅ Throttled | `crosshairThrottled` L73 |
| Volume histogram | ✅ Default on | `extensions.volumeHistogram: true` |
| Trade markers | ❌ **Disabled** | `ENABLE_TRADE_MARKERS = false` L32 — “P0 reliability guard” |
| Log / percent scale | ✅ | `priceScaleMode` |

---

## Runtime (spot page logged in)

- **7 canvas elements** on `/trade/spot?symbol=BTC_USDT` (includes chart + overlays)
- No React crash on chart panel (`PanelErrorBoundary`)

---

## Binance Comparison

| Binance | This exchange |
|---------|---------------|
| Full TradingView | Lightweight Charts subset |
| Trade history markers on chart | **Off** (`ENABLE_TRADE_MARKERS=false`) |
| Rich indicator library | EMA/VWAP/RSI/BB plugins — modular |
| Depth chart tab | Separate depth mode in `ChartPanel` toggle |
| Chart + orderbook sync crosshair | Partial via click on orderbook |

---

## Issues

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Trade markers disabled — users can’t see fills on chart | P2 | `LightweightChartsAdapter.ts:32` |
| 2 | Resync comment/code mismatch (15s vs 30s) | P3 | `useChartAdapter.ts` |
| 3 | Hard resync cooldown — rare stale tail possible | P3 | `lastHardResyncAtMs` |
| 4 | Forming candle depends on WS — chart stale if WS down | P1 | stream banners mitigate |
| 5 | Initial load 900 bars — slower first paint on slow API | P2 | `useChartAdapter.ts` |

---

## Performance

- Throttled study refresh 100ms (`throttledLightRefresh`)
- `holdRealtimeUntilMs` prevents race during `setData`
- Backfill async — may CPU spike on old symbols

---

## Screenshot

`audit/screenshots/spot-logged-in.png` — chart region visible with candlesticks (7 canvases).
