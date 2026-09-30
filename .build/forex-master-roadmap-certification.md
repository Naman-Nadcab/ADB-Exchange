# Forex master roadmap — certification

## Summary

| Layer | Verdict |
|-------|---------|
| **Engineering / terminal** | **GREEN** |
| **Natural-market runtime** | **MARKET_DEPENDENT** |
| **FINAL platform green** | **No** (runtime + providers honestly open) |

## Current-scope engineering (Phase 1)

### 1A Indicators

- Canonical registry (18 indicators), overlay vs oscillator classification
- Multi-oscillator pane stack with sync to main chart
- **Parameter editing** on active indicator chips
- Registry-driven overlays (+ `overlayExtras` for multi-line overlays e.g. Ichimoku)
- Scoped persistence per symbol/timeframe

### 1B Drawings

- Native tools: H/V, trend, fib (`DrawingToolManager`)
- Extended catalog: fib/reg/Gann/shapes/annotations in `ForexDrawingEngine`
- Hide/lock, persist, undo/redo (extra engine + **Forex-host native undo**)

### 1C Alerts

- `SESSION_OPEN` / `SESSION_CLOSE` via session eligibility transitions
- `DRAWDOWN` via ledger cash peak + equity reference
- Dedupe/cooldown in `alert-engine`; session `dedupeKey`
- WEB delivery; PUSH/EMAIL/WEBHOOK **NOT_CONFIGURED**

## Verification

- Targeted unit tests + FE/BE production builds: pass
- `forex-pre-market-browser.mjs`: **pass** (desktop/tablet/mobile, `/forex/trade`)
- Deploy: backend `dfa20e3…`, frontend `78a0589…`
- Crypto fingerprints: **unchanged**

## Remaining (non-engineering)

- **MARKET_DEPENDENT:** full execution matrix (all order types, TIF, pending lifecycle, netting/hedging ops) when session is naturally open
- **PROVIDER_DEPENDENT:** DOM, tape, news, calendar, external liquidity
- **NOT_CONFIGURED:** alert PUSH/EMAIL/WEBHOOK, DR certification, REAL_FOREX go-live

## Workspace

**LOCAL_WORKSPACE** — chart layout, indicators, and drawings persist in browser storage; not advertised as cross-device server sync.
