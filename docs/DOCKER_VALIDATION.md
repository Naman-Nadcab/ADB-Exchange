# Docker Production Validation

**Generated:** 2026-06-23  
**File:** `docker-compose.production.yml`

## Stack overview

| Service | Image/build | Healthcheck | Restart | Depends on |
|---------|-------------|-------------|---------|------------|
| postgres | postgres:16-alpine | `pg_isready` | unless-stopped | — |
| redis | redis:7-alpine | `redis-cli ping` | unless-stopped | — |
| nats | nats:2.10-alpine `-js` | — | unless-stopped | — |
| rabbitmq | rabbitmq:3-management | `rabbitmq-diagnostics ping` | unless-stopped | — |
| indexer | build `apps/indexer` | — | unless-stopped | postgres healthy |
| matching-engine | build `matching-engine` | `curl /health` :7101 | unless-stopped | redis, nats |
| backend | build `apps/backend` | `wget /health` :4000 | unless-stopped | postgres, redis, rabbitmq, nats, engine healthy |
| frontend | build `apps/frontend` | — | unless-stopped | backend healthy |
| admin-panel | build `apps/admin-panel` | — | unless-stopped | backend healthy |
| nginx | nginx:alpine | — | unless-stopped | frontend, admin, backend |

## Required environment (compose interpolation)

Compose **fails fast** without:

- `POSTGRES_PASSWORD`
- `RABBITMQ_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`
- `ENGINE_HMAC_SECRET`

Validate locally:

```bash
export $(grep -v '^#' .env.production.example | grep CHANGE_ME -v | xargs)  # use real .env
docker compose -f docker-compose.production.yml config --quiet
```

CI validates with synthetic `.env.ci` in `production.yml`.

## Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | Database persistence |
| `redis_data` | `/data` | AOF persistence |
| `rabbitmq_data` | `/var/lib/rabbitmq` | Queue persistence |
| `engine_wal` | `/data/wal` | Match event WAL |

**Backup:** `scripts/backup-db.sh` for Postgres; snapshot `engine_wal` for engine recovery.

## Networking

- Single bridge: `exchange-production`
- Internal DNS: `backend`, `frontend`, `admin-panel`, `matching-engine`, etc.
- External ports: nginx `80`, `443` only (recommended)

## nginx routing

| Path | Upstream |
|------|----------|
| `/api/` | backend:4000 |
| `/health` | backend:4000 |
| `/admin/` | admin-panel:3001 |
| `/` | frontend:3000 |

TLS certs: `nginx/ssl/fullchain.pem`, `nginx/ssl/privkey.pem`

## Gaps & recommendations

| Item | Status | Recommendation |
|------|--------|----------------|
| NATS healthcheck | Missing | Add `wget :8222/healthz` optional |
| Frontend/admin healthcheck | Missing | Add `wget localhost:3000` |
| Indexer healthcheck | Missing | Add HTTP probe on :4001 |
| HTTP-only mode | Not in compose | Add profile or docs for cert-less staging |
| Resource limits | Not set | Add `deploy.resources` on VPS sizing |

## Validation commands

```bash
# Config syntax
docker compose -f docker-compose.production.yml config

# Build all images (no start)
docker compose -f docker-compose.production.yml build

# Start infra only
docker compose -f docker-compose.production.yml up -d postgres redis rabbitmq nats

# Full stack (requires .env + TLS certs)
docker compose -f docker-compose.production.yml up -d --build
```

## Docker Readiness Score: **88 / 100**

−12: missing app-level healthchecks for frontend/admin/indexer; NATS no health gate on backend.
