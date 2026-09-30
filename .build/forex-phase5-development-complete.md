# Phase 5 — Development complete

**Status:** DEVELOPMENT COMPLETE  
**Runtime certification:** PENDING MARKET-DEPENDENT CHECKS (not GREEN)

Terminal route: **`/forex/trade`**

## Implemented (authoritative backend)

- Market watch, ticket (all customer order types + TIF except GTD), pending/positions workspaces, chart + multi-chart, indicators (except full ATR overlay), drawings (session-local), workspace persistence, history panels, ForexAccountBar + ForexRiskBar metrics.

## Intentional gaps (no fake UI)

| Gap | Reason |
|-----|--------|
| High/Low columns | No authoritative session H/L on quote API |
| Modify TIF in UI | Backend `ForexOrderModifyRequest` excludes `timeInForce` |
| GTD | Engine/customer contract: not exposed |
| CSV export | Only if backend export endpoint exists |

## Non-market tests passed

`forex-workstation-ui`, `forex-preview`, `forex-foundation`, `forex-phase11`, backend `forex-phase2-customer-terminal`.

## Remaining runtime

See `.build/forex-phase5-market-runtime-checkpoint.md` — browser, cookie WS, live order/chart flows when session open.
