# Phase 1 — Complete Codebase Discovery

**Generated:** 2026-06-22  
**Method:** Repository scan, `package.json`, `server.ts`, `docker-compose.yml`, grep — no assumptions.

---

## 1. Directory Map (top level)

| Path | Evidence | Role |
|------|----------|------|
| `apps/backend/` | `apps/backend/package.json` | Fastify API + workers (`src/server.ts`) |
| `apps/frontend/` | `apps/frontend/package.json` | User Next.js app (:3000) |
| `apps/admin-panel/` | `apps/admin-panel/package.json` | Admin Next.js app (:3001) |
| `apps/indexer/` | `apps/indexer/package.json` | EVM/BTC/TRON deposit indexer (:4001) |
| `matching-engine/` | `matching-engine/Cargo.toml` | Rust spot matcher (:7101) |
| `edge-auth-gateway/` | `edge-auth-gateway/go.mod` | Go edge auth (optional) |
| `scripts/` | 39 files | `dev-stack.sh`, `start-matching-engine.sh`, audits |
| `docs/` | ~187 files | Architecture, audits, runbooks |
| `e2e/`, `security/`, `load/` | Present | Playwright, pen tests, k6 |
| `infra/` | `infra/docker-compose.monitoring.yml` | Prometheus/Grafana |
| `packages/` | **NOT FOUND** | Declared in root `package.json` workspaces but directory missing |

---

## 2. Service Map

| Service | Process | Port | Start command |
|---------|---------|------|---------------|
| Backend API+Workers | Node `RUN_MODE=all\|api\|workers` | 4000 | `apps/backend`: `npm run dev:all` |
| User frontend | Next.js | 3000 | `apps/frontend`: `npm run dev` |
| Admin panel | Next.js | 3001 | `apps/admin-panel`: `npm run dev` |
| Deposit indexer | Node (Docker) | 4001 | `docker compose` service `indexer` |
| Matching engine | Rust binary | 7101 | `scripts/start-matching-engine.sh` |
| PostgreSQL | Docker | 5432 | `docker-compose.yml` |
| Redis | Docker | 6379 | `docker-compose.yml` |
| NATS JetStream | Docker | 4222 | `docker-compose.yml` |
| RabbitMQ | Docker | 5672 | `docker-compose.yml` |
| Signing HTTP (optional) | Node | env | `npm run start:signing-service` |

**Legacy:** `apps/backend/src/index.ts` (Express) — deprecated.

---

## 3. Infrastructure Map

Source: `docker-compose.yml`

```
postgres:5432 ──┬── backend (DATABASE_URL)
redis:6379 ───┼── backend, matching-engine (HMAC nonce)
rabbitmq:5672 ┼── backend (OTP consumer when RUN_MODE≠api)
nats:4222 ────┼── backend, matching-engine (JetStream)
indexer:4001 ─┘── shares postgres with backend
matching-engine:7101 — NOT in docker-compose; host process
frontend:3000, admin:3001 — host processes
```

---

## 4. Trading Architecture

- **User orders:** `POST /api/v1/spot/order` → `spot.fastify.ts`
- **Matching:** Rust engine `POST /engine/place` via `engine-client.ts` (`config.rustMatchingEngine.enabled: true` always — `config/index.ts`)
- **Settlement:** `settlement-worker.ts` (250ms) + optional JetStream consumer
- **Match ingress:** inline engine events, match poller (2s), NATS `MATCH_EVENTS` stream
- **Node in-process matching:** disabled (`spot-matching.service.ts` header states non-production)

---

## 5. Wallet Architecture

- **Deposit detect:** `apps/indexer` → `deposits` table
- **Credit:** `ConfirmationTracker` (indexer) + `deposit-credit.service.ts` (backend repair)
- **Ledger:** `user_balances` + `balance_ledger` (`readUserBalances.ts` canonical read)
- **Sweep:** `deposit-sweep.service.ts` (user address → hot wallet)
- **Withdraw:** `wallet.fastify.ts` → `withdrawal-signing.service.ts` (hot wallet sign)
- **Cold:** `hot-wallet-sweep.service.ts` (excess → `cold_wallet_address`)

---

## 6. Market Making Architecture

- **Liquidity bot:** `liquidity-bot.service.ts` — places orders via internal `POST /spot/order` with bot API key
- **MM desk:** `mm-risk.service.ts`, `admin-mm-control.fastify.ts`, admin `/admin/mm-control`
- **MM health:** `mm-health.service.ts`, oracle vs external price divergence
- **Default:** `LIQUIDITY_BOT_ENABLED=false` in `.env` (line 268 comment: orderbook corruption)

---

## 7. Settlement Architecture

- Tables: `settlement_events`, `settlement_ledger_entries`, `settlement_trades`
- Worker: `settlement/settlement-worker.ts` — ledger-first, updates `user_balances` (spot/trading)
- Integrity: `global-balance-auditor.ts`, `settlement-replay-validator.ts`, `tier1-reconciliation.service.ts`

---

## 8. External Liquidity (Binance) Architecture

- **Prices:** `price-oracle.service.ts`, `external-price-feed.service.ts` (public Binance ticker API)
- **Hybrid decision:** `hybrid-decision.service.ts` (read-only routing plan)
- **Hedge execution:** `hedge-engine.service.ts` — signed `POST /api/v3/order` **post-fill only**, not user routing
- **Admin:** `admin-hybrid.fastify.ts`, liquidity page `apps/admin-panel/.../liquidity/page.tsx`
- **Defaults:** `HYBRID_ENABLED=false`, `HEDGE_ENABLED=false` (`config/index.ts`)

---

## 9. Admin Architecture

- 59 protected pages under `apps/admin-panel/src/app/(protected)/`
- Nav: `lib/admin/nav-sections.ts` (52 sidebar links)
- APIs: 12+ `admin*.fastify.ts` files mounted at `/api/v1/admin` (`server.ts` ~876–897)
- RBAC: `lib/admin-rbac-routes.ts` + `admin-zero-trust.middleware.ts`

---

## 10. Frontend Architecture

- 115+ `page.tsx` routes under `apps/frontend/src/app/`
- Canonical spot: `/trade/spot` (`SpotTradingGrid.tsx`)
- Wallet: `/wallet/*`, dashboard assets under `/dashboard/*`
- P2P: `/p2p`, `/p2p-v2` (parallel implementations)
- Auth: password login default (`(auth)/login/page.tsx`)

---

## Workers / Cron / Queues / WebSockets

| Category | Finding | Evidence |
|----------|---------|----------|
| Cron library | **NOT FOUND** | No `node-cron` in repo |
| Job hub | `server.ts` | 30+ `setInterval` jobs |
| RabbitMQ consumer | OTP only | `rabbitmq.ts`, `server.ts` ~1140 |
| NATS streams | SPOT_MATCH, MATCH_EVENTS, SPOT_ORDERBOOK, DLQ | `nats.service.ts` |
| Redis pub/sub | spot WS, cache invalidation | `spot-ws.service.ts`, `cache-invalidation.service.ts` |
| WebSockets | `/api/v1/spot/ws`, `/api/v1/admin/ws/*` | `spot.fastify.ts`, `admin.fastify.ts` |
| BullMQ | **NOT FOUND** | — |

---

## Database

- **ORM:** Raw `pg` only; Prisma dir empty
- **Migrations:** `apps/backend/src/database/migrate.ts` (~132 `CREATE TABLE` statements)
- **Validation:** `lib/validate-migrations.ts` at boot
