# Phase 5 preflight — customer Forex terminal

**Status:** **BLOCKED_BY_PHASE_4** (Phase 4 not GREEN)

## Shell

Route `/forex/trade` uses `ForexTerminalLayout` with chart workspace, watchlist, ticket, account/risk bars, bottom toolbox (positions, orders, history, alerts).

## Classification summary

| Area | Status |
|------|--------|
| Order / position workspaces | IMPLEMENTED |
| Chart, multi-chart, drawings, workspace persist | IMPLEMENTED |
| Market watch, history, alerts | PARTIAL |
| Risk display | PARTIAL → Account bar full; risk bar slim + API fields |
| WS private channels | PARTIAL → cookie upgrade fix in workspace (needs deploy) |

## This pass (safe prep)

- Forensic gap register: `.build/forex-phase5-gap-register.json`
- WS auth alignment with `forexAuthenticate` (Forex-only)
- Risk bar shows server `marginLevel`, `freeMargin`, `unrealizedPnl`

## Cannot claim Phase 5 GREEN until

1. Phase 4 live GREEN (open session)
2. Browser certification on `/forex/trade`
3. Deploy if backend/frontend changes applied
