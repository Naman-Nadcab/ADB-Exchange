# Forex MT5 Workstation Implementation Status

Branch: `release/exchange-production-baseline`  
Chart baseline: `5af06cf` (layout preserved)  
This pass: gap audit, object-manager API, data window, i18n `objectsToolbar` fix.

| Capability | Status | Evidence | Blocker |
|------------|--------|----------|---------|
| MT5 chart layout | DONE | `ForexMt5ChartChrome`, rail, no horizontal draw strip | — |
| Chart types / TF / zoom | DONE | LWC + chrome | — |
| Drawing core tools | PARTIAL | `DrawingToolManager` + `ForexDrawingEngine` | Native hide/lock; property dialog |
| Object manager | PARTIAL | `listDrawingObjects`, panel select/delete/hide/lock | Deploy + manual smoke |
| Data window | PARTIAL | `ForexMt5DataWindow` | Toggle in toolbar |
| Indicators | PARTIAL | Registry + chrome | Full manager UI |
| Netting | DONE | Backend accounting + account mode | — |
| Hedging | DONE | `forex-phase1a-hedging.test.ts`, position mode | UI position picker PARTIAL |
| Order types | PARTIAL | market/limit/stop in ticket; stop_limit gated | Server TIF/stop-limit flags |
| SL/TP / modify | PARTIAL | Protections API + chart drag | Auth session on trade |
| One-click | PARTIAL | Chrome BUY/SELL when enabled | Opt-in + validation |
| Trailing stop | PARTIAL | `trailingDistance` API | Server + UI exposure |
| Partial close | PARTIAL | Hedging engine tests | UI wiring |
| Market Watch | DONE | `ForexWatchlist` | Live quotes need session |
| Symbol spec | DONE | Watchlist modal | — |
| DOM | EXTERNAL_DEPENDENCY | Stub copy in bottom panels | No depth feed |
| Time & Sales | EXTERNAL_DEPENDENCY | Not implemented | No tick tape API |
| Alerts | PARTIAL | Local + server panels | Full MT5 alert matrix |
| Templates | PARTIAL | Workspace template save/list | Not in MT5 chrome |
| Economic calendar | PARTIAL | Event strip + markers | Data availability |
| News | NOT_IMPLEMENTED | — | No feed |
| Chart data safety | DONE | `toBars` dedupe/sort unchanged | — |

## Build / tests (this pass)

- `apps/frontend` `npm run build`: **PASS**
- `apps/frontend` `npm run test:i18n`: run in CI/local (root has no `test:i18n` script)
- `forex-drawing-objects.test.ts`, `forex-drawings.test.ts`: **PASS**

## Smoke (production VPS pre-deploy)

- URL `http://109.123.254.30/forex/trade`: chart region loads, EURUSD 15M, drawing rail present, order ticket present.
- Raw key `forex.mt5Chart.objects` on toolbar **until frontend redeploy** with `objectsToolbar` fix.

## Final classification (honest)

| Area | Verdict |
|------|---------|
| MT5 WORKSTATION | **PARTIAL** |
| CHART | **PASS** (layout + build; production i18n pending deploy) |
| DRAWING SYSTEM | **PARTIAL** (implementation + tests; full manual certification pending post-deploy) |
| NETTING | **DONE** |
| HEDGING | **DONE** (engine); UI **PARTIAL** |
| ORDER TYPES | **PARTIAL** |
| ONE CLICK | **PARTIAL** |
| TRAILING STOP | **PARTIAL** |
| PARTIAL CLOSE | **PARTIAL** |
| DOM | **EXTERNAL_DEPENDENCY** |
| TIME & SALES | **EXTERNAL_DEPENDENCY** |
| SYMBOL SPEC | **DONE** |
| ALERTS | **PARTIAL** |
| TEMPLATES | **PARTIAL** |
| DATA WINDOW | **PARTIAL** |
| ECONOMIC CALENDAR | **PARTIAL** |
