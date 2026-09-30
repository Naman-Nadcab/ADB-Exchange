# FDA Beta — Repository Architecture

## Top-level inventory

| Path | Role |
|------|------|
| `apps/frontend` | Customer Next.js (Crypto + Forex + P2P + wallet) |
| `apps/admin-panel` | Ops/admin Next.js |
| `apps/backend` | Fastify API (crypto, forex, admin, wallet, P2P) |
| `apps/indexer` | EVM deposit indexer |
| `apps/mobile` | Mobile app (separate from web terminal) |
| `packages/mobile-types` | Shared mobile types |
| `matching-engine/` | Rust spot matching engine |
| `deployment/` | VPS deploy/health/rollback scripts |
| `infra/` | NATS build, Prometheus/Grafana compose |
| `docker-compose.yml` | Base stack |
| `docker-compose.production.yml` | Production overlay (ME, workers, TLS nginx profile) |
| `nginx/` | Reverse proxy configs |
| `scripts/` | Ops SQL and tooling |
| `apps/backend/src/database/migrate.ts` | **Canonical** schema (874 inline SQL steps) |
| `apps/backend/src/database/migrations/*.sql` | Reference/manual SQL (duplicated in migrate.ts) |

**Not present:** `services/`, `crates/` (except `matching-engine/`), Prisma/Drizzle.

## Customer flow

```
USER (browser)
  → nginx (:80/443) / frontend (:3000)
  → Next.js routes (apps/frontend/src/app/**)
  → REST/WS → backend (:4000) /api/v1/*
  → services (wallet, spot, forex/*, auth, kyc)
  → PostgreSQL (exchange)
  → Redis (cache, orderbook, rate limits)
  → NATS (spot match pipeline)
  → matching-engine (Rust)
  → RabbitMQ (events)
  → indexer (chain deposits)
```

## Admin flow

```
ADMIN (browser)
  → exchange-admin (internal :3001, via nginx)
  → /api/v1/admin/*
  → admin.fastify.ts + admin-forex*.fastify.ts + domain modules
  → PostgreSQL / Redis
  → maker-checker approval queue (when enabled)
```

## Domain separation (code-level)

| Domain | Backend namespace | Ledger authority |
|--------|-------------------|------------------|
| Crypto spot/wallet | `services/wallet`, `settlement`, `spot` | `user_balances`, `balance_ledger`, `settlement_ledger_entries` |
| Forex | `services/forex/**` | `forex_ledger_*`, `forex_accounts` |
| Fiat INR rail | `fiat-*` services | `fiat_balances`, `fiat_ledger` |

Boundary doc: `apps/backend/src/services/forex/accounting/boundary.ts`.

## Forex execution (declared)

- Runtime API: `GET /api/v1/forex/capabilities` → `executionMode: MOCK`, `realForex: false`, `source: SIMULATED`
- Venues: `createMockExecutionVenues()` in `services/forex/execution/service.ts`
