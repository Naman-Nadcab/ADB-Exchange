# Forex MT5 Workstation Gap Audit

Reference: MetaTrader 5 terminal capability categories (chart, trading, account, market data).  
Baseline branch: `release/exchange-production-baseline`, chart UI commit `5af06cf`.  
Audit date: 2026-09-24.

Legend: **DONE** | **PARTIAL** | **MISSING** | **EXTERNAL_DEPENDENCY**

## Chart

| Capability | Status | Notes |
|------------|--------|-------|
| Chart types (candle/OHLC/line/area) | DONE | `ForexLightweightChart`, chrome menu |
| Timeframes | DONE | Workspace TF + MT5 chrome |
| Zoom / pan | DONE | `zoomIn`/`zoomOut`, LWC time scale |
| Auto-scroll | PARTIAL | Fit on load; no explicit MT5 auto-scroll toggle |
| Chart shift | MISSING | No chart shift margin control |
| Crosshair | DONE | LWC crosshair + foundation state |
| Data window | PARTIAL | `ForexMt5DataWindow` OHLC + hover studies |
| OHLC header | DONE | Compact line in chrome |
| Chart templates | PARTIAL | `saveChartTemplate` / list in workspace toolbar |
| Chart profiles | MISSING | No multi-profile save/load |
| Multi-chart layouts | PARTIAL | Expand/fullscreen modes; no tiled multi-chart |

## Drawing / analysis

| Capability | Status | Notes |
|------------|--------|-------|
| Trend line | DONE | Native `DrawingToolManager` |
| Ray | DONE | `ForexDrawingEngine` |
| Horizontal / vertical line | DONE | Native manager |
| Channels | PARTIAL | Parallel/regression in extra engine |
| Fibonacci retr/extension | PARTIAL | Native fib + extra fib tools |
| Shapes (rect/ellipse/triangle) | PARTIAL | Extra engine |
| Arrows / text | PARTIAL | Extra engine |
| Advanced (pitchfork/Elliott) | MISSING | Not implemented (Gann tools only) |
| Object properties UI | PARTIAL | Keyboard/style limited; no full property dialog |
| Object visibility | PARTIAL | Hide/show extra objects; native always visible |
| Timeframe visibility | MISSING | Drawings keyed per symbol+TF in localStorage only |
| Object manager | PARTIAL | `ForexMt5ObjectsPanel` + API list/select/delete |
| Edit / move / resize / delete | DONE | Native + extra engines (verified in code paths) |
| Measure | DONE | Foundation measure tool |

## Indicators

| Capability | Status | Notes |
|------------|--------|-------|
| Indicator manager | PARTIAL | Stack in chrome; no dedicated manager panel |
| Main-chart overlays | DONE | Registry + legacy studies |
| Separate panes | DONE | RSI/MACD/etc. oscillator panes |
| Parameters | PARTIAL | Registry params; not all exposed in MT5 chrome |
| Add/remove | DONE | Chrome favorites + registry |
| Visibility | PARTIAL | Enable flag per stack row |
| Templates / search / favorites | PARTIAL | Favorites list in chrome; no search |

## Trading

| Capability | Status | Notes |
|------------|--------|-------|
| Market / limit / stop / stop-limit | PARTIAL | `useForexOrderEngine` + ticket; server must accept |
| SL / TP | DONE | Protections + chart drag when enabled |
| Expiration / fill policy | PARTIAL | Types exist; UI exposure varies |
| One-click trading | PARTIAL | Opt-in chrome BUY/SELL when enabled |
| Partial close | PARTIAL | Backend hedging tests; UI position actions |
| Modify order / SL/TP | PARTIAL | Engine + chart pending drag |
| Trailing stop | PARTIAL | API `trailingDistance`; gated by account/server |
| Chart pending placement | PARTIAL | Context menu / drag lines |

## Account position model

| Capability | Status | Notes |
|------------|--------|-------|
| Netting | DONE | Backend netting + account mode |
| Hedging | DONE | `forex-phase1a-hedging.test.ts`, position mode per account |
| Position lifecycle / close semantics | PARTIAL | Engine tests; UI depends on session data |
| Position-specific SL/TP (hedging) | PARTIAL | Backend support; UI must select position |

## Market data

| Capability | Status | Notes |
|------------|--------|-------|
| Market Watch | DONE | `ForexWatchlist` |
| Bid / ask / spread / high / low | PARTIAL | Quote + watchlist where API provides |
| Tick timing | PARTIAL | Staleness indicators |
| Symbol specification | DONE | Watchlist modal |

## DOM / tape

| Capability | Status | Notes |
|------------|--------|-------|
| Depth of market | EXTERNAL_DEPENDENCY | Bottom panel stub; no real depth feed |
| Time & sales | EXTERNAL_DEPENDENCY | No genuine tick tape API |

## Fundamental

| Capability | Status | Notes |
|------------|--------|-------|
| Economic calendar | PARTIAL | Chart markers + event strip when data loaded |
| News | MISSING | No news feed integration |

## Alerts

| Capability | Status | Notes |
|------------|--------|-------|
| Price alerts | PARTIAL | Local chart alerts + server panel where wired |
| Indicator / economic alerts | MISSING / PARTIAL | Not full MT5 alert builder |

## History / account

| Capability | Status | Notes |
|------------|--------|-------|
| Orders / positions / deals / ledger | PARTIAL | Account center + backend; not full terminal history grid |
| Reports / export | PARTIAL | Existing account reports elsewhere |

## Account metrics

| Capability | Status | Notes |
|------------|--------|-------|
| Balance / equity / margin / free margin / level | PARTIAL | Account surfaces; trade layout focuses chart |
| Position mode / leverage | DONE | Account metadata + settings |

## P0 summary

| P0 item | Status |
|---------|--------|
| Netting / hedging | DONE (engine); UI PARTIAL |
| Order types + SL/TP + modify | PARTIAL |
| Partial close / trailing / one-click | PARTIAL |
| Market Watch + symbol spec | DONE |
| Alerts | PARTIAL |
| Drawing workflow | PARTIAL → improved object manager |

Protected subsystem: **Lightweight Charts adapter** (`ForexLightweightChart.tsx`) — ascending candle/marker ordering preserved; no layout redesign in this phase.
