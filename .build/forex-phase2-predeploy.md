# Forex Phase 2 — Pre-deploy record

**Branch:** `release/exchange-production-baseline` · **HEAD:** `7f0bf68e753969778683e04b19d43bc78014d02d`

## Scope delivered in source

- Extended Phase 0 capability contract: customer exposure for `stop_limit` and TIF `GTC` / `IOC` / `FOK` / `DAY` (GTD remains absent).
- Backend order engine, validation, pending lifecycle, journal paths unchanged (already implemented in Phase A / 1C).
- Frontend ticket and pending panels already supported Phase A shapes; exposure was config-gated until contract update.
- Minor ticket copy fix: pending-order TIF help text no longer mentions IOC/FOK.

## Targeted tests (all PASS)

- `apps/backend/src/services/forex/capabilities/customer-contract.test.ts`
- `apps/backend/src/services/forex/forex-phase2-customer-terminal.test.ts`
- `apps/backend/src/services/forex/forex-phase1c-stoplimit-tif.test.ts`
- `apps/backend/src/services/forex/forex-phase-a-orders.test.ts`
- `apps/frontend/src/lib/forex/models/forex-phase-a-ui.test.ts`

## Safety

| Check | Result |
|-------|--------|
| DB migration | NO |
| Seed | NO |
| REAL_FOREX | OFF |
| Crypto files modified by Phase 2 | NO (pre-existing dirty on spot paths only) |

## Deploy plan

`docker compose -f docker-compose.production.yml build backend frontend`  
`docker compose -f docker-compose.production.yml up -d --no-deps backend frontend`
