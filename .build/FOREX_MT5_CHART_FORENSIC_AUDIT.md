# Forex MT5 chart forensic audit

## Reusable stack (unchanged logic)

| Layer | Location | Reuse |
|-------|----------|--------|
| Candle API | `useForexCandles`, `FOREX_CANDLE_RESERVED_TIMEFRAMES` | Yes |
| Chart engine | `ForexLightweightChart.tsx` + Lightweight Charts | Yes (+ zoom API, light canvas) |
| Native drawings | `DrawingToolManager` via chart adapter | Yes |
| Forex extras | `lib/forex/chart/forex-drawings.ts` | Yes |
| Indicators | `indicator-registry.ts`, oscillator panes | Yes |
| Order/SL/TP lines | `pending-order-lines`, protection drag | Yes |
| Calendar | `forexApi.calendar()` | Yes |
| Persistence | scoped drawings + indicators localStorage | Yes |

## Problems in prior UI

1. **Single horizontal chrome strip** mixed symbol, quote, all timeframes, chart types, indicators, legacy study, ATR/MACD, and workspace actions.
2. **Horizontal DRAW toolbar** (`ForexChartToolbar`) with text buttons for every tool — low chart area, unlike MT5 vertical rail.
3. **Calendar strip** as full-width text row above chart.
4. **Workspace bar** always visible even for single-chart layout.
5. **Market strip + session bar** on trade route duplicated watchlist/session context.
6. **Dark canvas only** — MT5 reference uses light chart field.

## MT5 target IA (implemented)

1. Compact top toolbar (icons)
2. Symbol header row (`SYMBOL, TF` + bid/ask/spr)
3. Timeframe bar (primary + More)
4. Left drawing rail (grouped flyouts)
5. Main canvas (light theme option)
6. Indicator panes (existing oscillator stack)
7. Timeline event strip (calendar toggle)
8. Objects panel (serialize list)
9. Bottom toolbox (unchanged `ForexBottomPanels`, collapsible via existing store)
