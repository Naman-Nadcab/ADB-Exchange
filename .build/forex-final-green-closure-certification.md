# Forex final green closure — certification

## Verdict

**ENGINEERING GREEN** — the three current-scope engineering gaps are implemented, built, deployed, and spot-checked in the live customer terminal.

**FINAL GREEN** is **not** claimed: full mock execution runtime matrix remains **MARKET_DEPENDENT** (natural session required; no clock manipulation).

## Deployment identity

| | Digest |
|---|--------|
| Backend | `sha256:f32d7c7415aa9e2081360bea55be250cbf2d399d97db9616f720d36ef18c4fe2` |
| Frontend | `sha256:468f89021bd001b00f4d235906a6d1989e283561154bedd9fe01f3c0c54c400b` |

Migration run inside `exchange-backend`: **Forex customer schema markers verified (GTD + alerts)**.

## Crypto isolation

UNCHANGED — `spot.fastify.ts` and committed `spot-ticker-db-load.ts` hashes match baseline.

## Gap closure evidence

### A. Oscillator indicator panes

- Registry classifies overlay vs oscillator (`indicator-registry.test.ts` pass).
- `ForexChartFoundation` loads/saves scoped stack, builds `oscillatorPanes`, passes to `ForexLightweightChart`.
- Live UI: `/forex/trade` → Add indicator **RSI** → `rsi ×` chip + additional chart pane (oscillator stack).

### B. Drawing catalog

- Native: H/V line, trend, fib (`DrawingToolManager`).
- Extended: ray, channel, regression channel, fib retr/ext/exp/time/channel, Gann fan/grid/line, rect/ellipse/tri/poly, text/callout/price label, arrow; hide (**H**), lock (**L**), undo/redo in `ForexDrawingEngine`.

### C. Alerts

- `session-alert-watch.ts` fires SESSION_OPEN/CLOSE on authoritative eligibility transitions.
- `drawdown-metrics.ts` uses ledger cash peak + equity reference; wired into risk alert evaluation.
- Existing delivery remains WEB-only; PUSH/EMAIL/WEBHOOK **NOT_CONFIGURED**.

## Tests

- `indicator-registry.test.ts` — pass
- `forex-drawings.test.ts` — pass
- `forex-alert-engine.test.ts` — pass
- `session-alert-watch.test.ts` — pass
- Frontend/backend production builds — pass

## Browser

- `forex-pre-market-browser.mjs` — **pass** (desktop/tablet/mobile, `/forex/trade`)
- Manual: RSI oscillator pane on deployed frontend

## Remaining non-GREEN (honest)

| Area | State |
|------|--------|
| Full order/TIF/position runtime matrix | MARKET_DEPENDENT |
| DOM / Tape | PROVIDER_DEPENDENT |
| News / Calendar | PROVIDER_DEPENDENT |
| PUSH / EMAIL / WEBHOOK alerts | NOT_CONFIGURED |

## REAL_FOREX

OFF.
