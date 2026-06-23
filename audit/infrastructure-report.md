# Phase 2 — Infrastructure Validation

**Generated:** 2026-06-22  
**Sources:** `docker-compose.yml`, `scripts/dev-stack.sh`, `scripts/start-matching-engine.sh`, `package.json`, `.env`

---

## Docker Compose Services

File: `/Users/namansingh/Desktop/Exchange/docker-compose.yml`

| Service | Image/Build | Ports | Healthcheck |
|---------|-------------|-------|-------------|
| postgres | postgres:16-alpine | 5432 | `pg_isready` |
| redis | redis:7-alpine | 6379 | `redis-cli ping` |
| nats | nats:2.10-alpine | 4222, 8222 | — |
| rabbitmq | rabbitmq:3-management | 5672, 15672 | `rabbitmq-diagnostics ping` |
| indexer | build `./apps/indexer` | 4001 | HTTP health |

**NOT in docker-compose:** matching-engine, backend, frontend, admin-panel.

---

## Startup Scripts

| Script | What it starts | RUN_MODE |
|--------|----------------|----------|
| `scripts/dev-stack.sh` | `infra:up` + turbo dev (backend+frontend+admin) | backend uses `dev` → **`RUN_MODE=api`** |
| `npm run p0:infra` | postgres, redis, rabbitmq, nats, indexer | — |
| `scripts/start-matching-engine.sh` | Rust engine with WAL + JetStream | — |
| `apps/backend/package.json` `dev:all` | backend with workers | **`RUN_MODE=all`** |

**Evidence:** `apps/backend/package.json` lines 9–10:
```
"dev": "RUN_MODE=api ..."
"dev:all": "RUN_MODE=all ..."
```

---

## Environment (`.env` excerpts — verified on disk)

| Key | Value (snapshot) | File line |
|-----|------------------|-----------|
| `DATABASE_URL` | `postgresql://exchange:...@127.0.0.1:5432/exchange` | ~15 |
| `REDIS_URL` | `redis://localhost:6379` | ~28 |
| `PORT` | `4000` | ~181 |
| `PRICE_ORACLE_ENABLED` | `true` | 241 |
| `USE_RUST_MATCHING_ENGINE` | `true` | 253 |
| `MATCHING_ENGINE_URL` | `http://localhost:7101` | 254 |
| `USE_EVENT_STREAM` | `true` | 259 |
| `LIQUIDITY_BOT_ENABLED` | `false` | 268 (comment documents intentional disable) |
| `KMS_TYPE` | `local` (from LAUNCH_CHECKLIST / .env.example) | — |

---

## Infrastructure Dependency Graph

```mermaid
flowchart TD
    PG[(PostgreSQL)] --> BE[Backend :4000]
    PG --> IDX[Indexer :4001]
    RD[(Redis)] --> BE
    RD --> ENG[Matching Engine :7101]
    NT[(NATS)] --> BE
    NT --> ENG
    RQ[(RabbitMQ)] --> BE
    ENG --> BE
    IDX --> PG
    BE --> FE[Frontend :3000]
    BE --> AD[Admin :3001]
```

### Startup order (required)

1. **Docker Desktop** (host — not automated)
2. `docker compose up -d postgres redis rabbitmq nats` (indexer needs postgres healthy)
3. `npm run db:migrate` (backend schema)
4. **Matching engine** (NATS + Redis must be up for HMAC nonce)
5. **Backend** (`RUN_MODE=all` for full workers)
6. Frontend + Admin (need backend API)

---

## Startup Blockers (evidence-based)

| Blocker | Evidence |
|---------|----------|
| Docker not running | Runtime attempt 2026-06-22T16:00Z: all ports DOWN, `DOCKER_UNAVAILABLE` |
| Matching engine not in compose | Must run `scripts/start-matching-engine.sh` manually |
| `dev:stack` uses `RUN_MODE=api` | Deposit sweep + signing queue **skipped** (`server.ts` line 1230: `runWorkers = runMode !== 'api'`) |
| Engine strict startup | `server.ts` can `process.exit(1)` if engine unreachable without `EXCHANGE_VERIFY_STACK=1` |
| `packages/` workspace missing | Root `package.json` workspaces include `packages/*` but dir absent — turbo may warn |
| No nginx/TLS in repo | Production reverse proxy not defined in codebase |

---

## Reverse Proxy / systemd

| Item | Status | Evidence |
|------|--------|----------|
| nginx configs in repo | **NOT FOUND** (grep `nginx.conf`) |
| systemd units | **NOT FOUND** |
| PM2 ecosystem | **NOT FOUND** |

Deployment is developer-script driven (`dev-stack.sh`, `start-matching-engine.sh`, `LAUNCH_CHECKLIST.md`).
