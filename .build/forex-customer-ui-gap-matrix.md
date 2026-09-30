# Forex customer UI — gap matrix (Phase 0–1)

Read-only discovery against current source. **Crypto not inspected for changes.**

## Summary

| Verdict | Meaning |
|---------|---------|
| **Most domains GREEN** | Trade terminal, ticket, positions, orders, chart, indicators, drawings, risk, session, DOM/tape honesty |
| **Primary gap** | **Alerts UX** — server contract is richer than customer UI exposes |

## P0 — fix now

1. **`/forex/alerts` page** — Presents “local only” as the product alerts surface while the terminal has **server-backed** alerts. Misleading and disconnected from `/alerts` API.

## P1 — wire existing backend

1. **Alert type selector** — Backend allows 15+ types (`SESSION_OPEN`, `DRAWDOWN`, `MARGIN`, …); UI create flow hardcodes `BID`.
2. **Alert events** — `GET /api/v1/forex/alerts/events` not shown.
3. **Delivery status** — `GET /api/v1/forex/alerts/delivery-status` not shown (PUSH/EMAIL/WEBHOOK NOT_CONFIGURED).

## P2 — optional / data-dependent

- **VWAP**, **Standard Deviation** — Not in `indicator-registry`; no separate authoritative volume series on Forex candles.
- **Alert PATCH** for condition edit — Backend supports; UI only enable/disable/delete.

## P3 — polish

- Legacy “study” dropdown vs registry overlap (HMA, Supertrend).
- Heikin Ashi / Renko — not supported without new data pipeline.

## Shared Crypto imports (read-only)

Forex chart imports `DrawingToolManager` and chart colors from `@/components/trade/chart/*` **without modifying those files**. Safe path: keep Forex-only wrappers.

## Workspace model

**LOCAL_WORKSPACE** — indicators/drawings/layout in `localStorage`; not server sync.
