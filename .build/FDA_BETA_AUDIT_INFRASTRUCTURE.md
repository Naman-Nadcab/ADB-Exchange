# FDA Beta — Infrastructure Audit

## Runtime (observed 2026-09-30)

| Container | Status |
|-----------|--------|
| exchange-nginx | healthy |
| exchange-frontend | healthy |
| exchange-backend | healthy |
| exchange-admin | healthy |
| exchange-postgres | healthy |
| exchange-redis | healthy |
| exchange-rabbitmq | healthy |
| exchange-nats | healthy |
| exchange-matching-engine | healthy |
| exchange-indexer | healthy |
| prometheus / grafana | up (localhost-bound ports) |

## Health endpoints

| URL | Result |
|-----|--------|
| `http://109.123.254.30/health` | **200** — DB, Redis, NATS, ME, indexer **up** |
| `http://109.123.254.30/api/v1/health` | **404** (route not mounted; use `/health`) |
| `http://109.123.254.30/forex/trade` | **200** |

## Compose / networks

- Base: `docker-compose.yml` — external networks `exchange-network`, `exchange-production`.
- Production overlay: `docker-compose.production.yml` — also references `exchange_network` (naming inconsistency — **P2**).
- Backend attached to **both** networks (comment documents ME/NATS on production network).

## Deployment vs git

| Signal | Value |
|--------|--------|
| HEAD | `effd130` |
| `.deploy-rev` | `8ef5999` (**stale**) |
| Working tree | ~808 dirty files |
| Frontend BUILD_ID in container | `.next` layout **static/** only in probe (standalone image) |

**Classification:** **MISMATCHED / UNKNOWN** image↔git alignment without digest pin recorded at deploy time.

## Infra readiness

**READY** for continued internal beta ops; **BLOCKED** for reproducible audited releases until deploy provenance fixed.
