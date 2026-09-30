# Forex Final Completion — Phase 0 Baseline

Generated: 2026-09-19 · Git: `7f0bf68e753969778683e04b19d43bc78014d02d`

## Constraints

- Crypto frozen (SHA256 unchanged on `spot.fastify.ts`, `spot-ticker-db-load.ts`)
- REAL_FOREX off · MOCK execution
- No fabricated market data

## Production DB (verified)

| Object | Status |
|--------|--------|
| `forex_orders.expire_at` | Present |
| `idx_forex_orders_gtd_expire` | Present |
| `forex_customer_alerts` | Present |
| `forex_customer_alert_events` | Present |

**Note:** DDL exists in `migrate.ts`; production schema confirmed via `psql`. Automated `docker compose run migrate` did not apply these changes before manual SQL — fix migrate runner/index before next deploy.

## Capability snapshot

See `.build/forex-final-completion-baseline.json` for per-capability `IMPLEMENTED | PARTIAL | PROVIDER_DEPENDENT | MARKET_DEPENDENT`.
