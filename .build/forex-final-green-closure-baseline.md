# Forex final green closure — baseline

Recorded: 2026-09-19 (UTC)

## Git

- Branch: `release/exchange-production-baseline`
- HEAD: `7f0bf68e753969778683e04b19d43bc78014d02d`
- Working tree: dirty (Forex closure WIP on top of certified baseline)

## Deployed digests (pre-recreate)

| Component | Digest |
|-----------|--------|
| Backend | `sha256:4a269b848…` |
| Frontend | `sha256:69b83bbb…` |

## Crypto fingerprints (must remain stable)

| File | SHA-256 |
|------|---------|
| `apps/backend/src/routes/spot.fastify.ts` | `925ceffc…` |
| `apps/backend/src/lib/spot-ticker-db-load.ts` | `3d128d47…` |

## REAL_FOREX

OFF (mock/simulated execution only).

## Confirmed architecture

- Indicator registry + studies (single canonical registry)
- `ForexOscillatorPaneStack` + scoped persistence (`indicator-state.ts`)
- `ForexDrawingEngine` + shared `DrawingToolManager` (Crypto file read-only)
- Customer alerts: `alert-engine.ts`, tables `forex_customer_alerts` / `forex_customer_alert_events`

## Current-scope gaps at baseline capture

1. Oscillator pane wiring in `ForexChartFoundation`
2. Drawing catalog completion in `forex-drawings.ts` / toolbar
3. SESSION_OPEN / SESSION_CLOSE / DRAWDOWN evaluators on server
