# Forex Customer Terminal — Fresh Forensic Audit

**Audit timestamp (UTC):** 2026-09-18T12:25:34Z  
**Mode:** READ-ONLY — no code changes, deploy, DB writes, or Crypto modifications by this audit  
**Repo:** `/opt/m-live`  
**Branch:** `release/exchange-production-baseline`  
**HEAD:** `7f0bf68e753969778683e04b19d43bc78014d02d` (ahead 78 of remote)  
**Customer URL:** http://109.123.254.30/forex/trade  
**Machine-readable report:** `.build/forex-customer-terminal-fresh-forensic-audit.json`

---

## Executive summary

The Forex **customer terminal shell is live** on production nginx: routes load, the trade workspace renders (watchlist, Lightweight Charts, order ticket, bottom panels, multi-chart controls), and public APIs report **SIMULATED / MOCK** execution with **REAL_FOREX off**. What **cannot** be certified in this pass is the **authenticated trading journey** (login requires OTP; no user JWT obtained), **order submission**, **pending trigger/fill**, **position management**, **drawing/indicator interaction**, **workspace persistence**, **responsive viewports**, and **WebSocket behavior** — all downgraded to **NOT PROVEN** per the no-false-pass rule.

A **P0 market-data split** remains: **candles** come from **EXTERNAL / Yahoo** while **executable quotes** are **SIMULATED MOCK** (bid = ask, spread 0). A **P0 product/config split** remains: **`trading-config` advertises only `market|limit|stop` and GTC-only UI**, while the **order engine source** implements **`stop_limit` and extended TIF (IOC, FOK, DAY)** without customer exposure.

---

## Phase 0 — Environment snapshot

| Item | Value |
|------|--------|
| Working tree | Dirty (pre-existing); audit did not reset/clean/checkout |
| `exchange-frontend` | `m-live-frontend`, healthy |
| `exchange-backend` | `m-live-backend`, healthy |
| `exchange-postgres` | healthy |
| `forex-cert-backend` | unhealthy (separate cert stack, port 4100 — not customer runtime) |
| REAL_FOREX | **OFF** (`effectiveForexRuntimeFlags.realForex: false`; not enabled in backend container env) |
| Execution | **MOCK** |
| LP | **MOCK-A/B/C** healthy via API |

**Crypto isolation:** Pre-existing dirty files only: `apps/backend/src/routes/spot.fastify.ts`, `apps/backend/src/lib/spot-ticker-db-load.ts`. **Zero audit-caused Crypto changes.**

---

## Phase 1 — Architecture truth (Forex-only path)

```
Customer UI (apps/frontend/src/app/forex/*, components/forex/*)
  → lib/forex/api/client.ts, state/store.ts, state/workspace.ts, runtime/*
  → REST /api/v1/forex/* (forex*.fastify.ts)
  → services/forex/* (orders, execution, positions, accounting, journal, …)
  → PostgreSQL forex_* tables
  → WebSocket GET /api/v1/forex/ws
  → Execution: internal MOCK engine (not external MT5/FIX)
```

**Adapter layer:** Only `internal-fdm` is registered; `BrokerAdapter` interface is **health/connect only** — MT5/FIX/cTrader are **catalog stubs**.

---

## Phase 2 — Route audit

| Route | HTTP | Browser (this session) |
|-------|------|-------------------------|
| `/forex` | 200 | Not opened |
| `/forex/trade` | 200 | **Loaded** — full terminal shell |
| `/forex/markets` | 200 | Not opened |
| `/forex/portfolio` | 200 | Not opened |
| `/forex/orders` | 200 | Not opened |
| `/forex/analysis` | 200 | Not opened |
| `/forex/alerts` | 200 | Not opened |
| `/forex/account` | 200 | **Loaded** — demo disclaimer, light-mode toggle |
| `/forex/account/funds` | 200 | Not opened |
| `/forex/account/ledger` | 200 | Not opened |

**Signed-out behavior:** Buy/Sell disabled; panels prompt sign-in; no `[object Object]` or raw JSON in accessibility snapshots.

---

## Phases 3–6 — Trading UI, orders, TIF, pending lifecycle

### Observed on `/forex/trade` (Level 1)

- **Header/nav:** Product switcher, Forex nav links, File/View/Charts/Trading/Tools menus.
- **Market Watch:** Search, filters (All, ★, Majors, Crosses, Metals), symbols with bid/ask/spread/change; EURUSD **1.14631 / 1.14631 / spread 0**.
- **Order ticket:** Types **Market, Limit, Stop** only. Text: **"Stop Limit unavailable · Time in Force unavailable · SIMULATED / MOCK"**. TIF **GTC**, combobox **disabled**. Volume 0.10; SL/TP fields; Buy/Sell **disabled** (unsigned).
- **Bottom tabs:** Trade, Orders, Fills, History, Exposure, Risk, Alerts, **DOM**, News, Calendar, Journal.
- **DOM tab:** Explicit **UNAVAILABLE · SIMULATED quotes** (no fabricated L2) — `ForexBottomPanels.tsx`.

### Order type matrix (customer **actual** selectable)

| Type | UI visible | UI selectable | Browser submit | Backend advertised | Status |
|------|------------|---------------|----------------|-------------------|--------|
| Market buy/sell | Yes | Yes | No | Yes | **NOT PROVEN** |
| Buy/Sell limit | Yes | Yes | No | Yes | **NOT PROVEN** |
| Buy/Sell stop | Yes | Yes | No | Yes | **NOT PROVEN** |
| Buy/Sell stop limit | No | No | No | Engine yes, config no | **IMPLEMENTED_NOT_EXPOSED** |

**Stop trigger semantics (Level 4):** `orders/pending.ts` — buy stop / buy stop_limit: **ask ≥ stop**; sell stop / sell stop_limit: **bid ≤ stop**. UI validation **NOT PROVEN**.

### TIF matrix

| TIF | UI | Backend engine | trading-config | Browser |
|-----|----|----------------|----------------|---------|
| GTC | Visible, disabled combobox | Yes | Implicit | NOT PROVEN |
| IOC/FOK/DAY | Hidden | Yes | Not advertised | **BACKEND_ONLY** |
| GTD | No | No | No | N/A |

**Pending lifecycle:** States exist in code; **no safe MOCK order placement** executed in this audit → **NOT PROVEN**.

---

## Phases 7–13 — Chart, drawings, indicators, workspace, multi-chart, trade-from-chart

### Chart core

- **Library:** Lightweight Charts; "Charting by TradingView" link visible.
- **Types:** Candles, OHLC, Line, Area (buttons present).
- **Timeframes exposed:** 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W.
- **API candles:** `source: EXTERNAL`, `provider: yahoo`, `reason: EXTERNAL_YAHOO`.
- **Live overlay:** Bid/Ask from **SIMULATED** quotes (spread 0).
- **Zoom/pan/crosshair/stale handling:** **NOT PROVEN**.

### Drawing tools (toolbar inventory — Tools pressed)

H-Line, V-Line, Trend, Ray, Extend, Rect, Arrow, Fib Retr, Fib Ext, Channel, S/R, Text, Measure, R:R, Alert, Clear, Hide.

**Persistence key (source):** `eda-forex-drawings:{instanceId}:{symbol}:{timeframe}`.  
**Create / move / delete / reload:** **NOT PROVEN**.

### Indicators

- Overlay dropdown: EMA fast/slow, EMA, SMA, WMA, HMA, Bollinger, Supertrend, None.
- Pane toggles: RSI, MACD.
- **Add/render/remove/persistence:** **NOT PROVEN**.

### Workspace

- Save/Load via `ForexAppToolbar` → `saveWorkspaceProfile` / `window.prompt` load.
- Zustand persist `eda-forex-workspace-v5` (layout, symbol, charts — drawings separate key).
- **End-to-end save/restore:** **NOT PROVEN**.

### Multi-chart

Layouts **1, 2H, 2V, 2×2, 2×3, 3×3** visible; Charts menu Add/Dup/Remove in source. **Independent symbols/drawings:** **NOT PROVEN**.

### Trade from chart

**1-Click OFF** visible. Chart order placement / SL-TP drag: **NOT PROVEN**.

---

## Phases 14–18 — Positions, risk, accounting, market data, WebSocket

| Area | API / source | Browser proven |
|------|----------------|----------------|
| Close / partial close | `POST .../positions/:id/close` + volume | No |
| Close by | `POST .../positions/close-by` | No |
| Reverse | `POST .../positions/:id/reverse` | No |
| Protections / trailing | `/protections` | No |
| Margin / equity / risk | `/margin`, `/risk`, `/account/summary` | No (unsigned) |
| Ledger / fills | `/ledger`, `/fills` | No |
| Quotes | SIMULATED MOCK-C | Partial (watchlist) |
| Candles | Yahoo EXTERNAL | Partial (chart loads) |
| WebSocket | `/api/v1/forex/ws` | **NOT PROVEN** |

**DB (read-only):** `forex_orders` **741**; open `forex_positions` **3**; `forex_journal_events` **0**.

---

## Phases 19–22 — Responsive, themes, UX, console/network

- **Responsive (1440 / 1024 / 390):** **NOT PROVEN**.
- **Light/dark:** Light mode toggle on account page; **both themes not fully verified**.
- **Console/network capture:** Partial (CDP Log.enable); **no full authenticated trace**.

---

## Phase 23 — Security (read-only)

- Forex routes use **user JWT** (`forex-authenticate.ts`); admin tokens rejected.
- Login attempt: `POST /api/v1/auth/login` → **`otp` required** — no token obtained.
- Destructive IDOR fuzzing: **not run** (audit policy).

---

## Phase 25 — Adapter matrix

| Adapter | Registered | healthCheck | placeOrder | Live |
|---------|------------|-------------|------------|------|
| internal-fdm | Yes (default) | Yes | Via internal engine, not adapter method | MOCK |
| mt5 | Catalog | No impl | No | NOT_CONFIGURED |
| fix | Catalog | No impl | No | NOT_CONFIGURED |
| cTrader | Catalog | No impl | No | NOT_CONFIGURED |

---

## Final certification (no generic PASS)

| Domain | Result |
|--------|--------|
| CUSTOMER TERMINAL | **CONDITIONAL** |
| ORDER ENTRY | **CONDITIONAL** |
| PENDING ORDERS | **NOT PROVEN** |
| BUY STOP | **NOT PROVEN** |
| SELL STOP | **NOT PROVEN** |
| STOP LIMIT | **NOT PROVEN** (customer) |
| TIF | **CONDITIONAL** |
| POSITION MANAGEMENT | **NOT PROVEN** |
| RISK | **CONDITIONAL** |
| ACCOUNTING DISPLAY | **NOT PROVEN** |
| MARKET DATA | **CONDITIONAL** |
| CHART | **CONDITIONAL** |
| DRAWINGS | **NOT PROVEN** |
| INDICATORS | **NOT PROVEN** |
| WORKSPACE | **NOT PROVEN** |
| MULTI-CHART | **NOT PROVEN** |
| MOBILE | **NOT PROVEN** |
| SECURITY | **CONDITIONAL** |
| CRYPTO ISOLATION | **VERIFIED** |
| REAL FOREX SAFETY | **VERIFIED** |

---

## A–I — Required closing inventory

### A. Definitely working

- Forex customer routes (HTTP 200).
- Trade terminal **unsigned shell**: watchlist, chart, ticket, tabs, layout controls.
- Public APIs: trading-config, quotes, readiness, providers health.
- **MOCK/SIMULATED** posture; REAL_FOREX off.
- Honest **DOM unavailable** messaging.
- Forex DB schema in use (orders/positions counts).

### B. Definitely not working (customer-facing)

- Stop Limit in UI.
- IOC/FOK/DAY TIF selection.
- Live DOM/L2/Time & Sales.
- External broker adapters.

### C. Exists but not exposed

- `stop_limit`, IOC/FOK/DAY in order engine.
- Close-by, reverse, partial close APIs (+ client).
- Position mode API without UI switch.

### D. Exposed but not functional (unproven / likely gap)

- Drawing tools (interaction).
- Journal (DB empty; authed view unproven).

### E. Partially implemented

- Chart (Yahoo + MOCK quotes).
- Order ticket (3 types; no signed submit).
- Indicators (controls only).
- Market Watch (quotes after hydrate).

### F. Previously claimed PASS — not re-proven

- `FOREX_FINAL_CERTIFICATION.md` journey on `:4100`.
- `forex-live-journey.cert.ts` (DB-mutating).
- `scripts/forex-browser-cert.mjs` (not re-run).
- Phase 1C customer stop_limit/TIF UI parity.

### G. Missing for MT5-strong terminal

Unified market data, full order/TIF surface, proven drawings/indicators/workspace/multi-chart, trade-from-chart, mobile cert, L2/T&S, adapter execution API, automated authenticated browser cert on production stack.

### H. Top 20 gaps

See JSON `summarySections.H_top20Gaps`.

### I. Recommended implementation order

See JSON `summarySections.I_recommendedImplementationOrder` (audit does **not** implement these).

---

## Priority issues

| Priority | ID | Summary |
|----------|-----|---------|
| **P0** | P0-MARKET-DATA-SPLIT | Yahoo candles vs MOCK executable quotes |
| **P0** | P0-CONFIG-ENGINE-GAP | trading-config vs engine stop_limit/TIF |
| **P1** | P1-AUTH-BROWSER-GAP | OTP blocks authenticated browser cert |
| **P1** | P1-JOURNAL-EMPTY | `forex_journal_events` count 0 |
| **P2** | Drawings / WS / responsive unproven |
| **P3** | Workspace prompt UX; account page title |

---

*End of fresh forensic audit report.*
