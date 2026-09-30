# Live Runtime vs Repository Reconciliation

**Runtime host:** `/opt/m-live` on `109.123.254.30`  
**Probe time:** 2026-09-30  
**Health:** `GET /health` → 200 (database, redis, nats, matching_engine, indexer up)  
**Forex:** `GET /api/v1/forex/capabilities` → `executionMode: MOCK`, `realForex: false`, `source: SIMULATED`

---

## Container inventory

| Container | Image | Image digest (repo) | Container created |
|-----------|--------|---------------------|-------------------|
| exchange-frontend | `m-live-frontend` | `sha256:0f412e5ea4883f3f7f618100ed428ed5c645d4eee71d8c3582492c680e07fdce` | 2026-09-24 |
| exchange-backend | `m-live-backend` | `sha256:cf33d68b2eec76f5a1d8f50289ff942d4a509303cdea5f50df7a0f0786f6569a` | 2026-09-23 |
| exchange-admin | `m-live-admin-panel` | `sha256:3e35a878835c96a9b3adf8169fa5a0f5c373ca50514fd348d89d3ae57b7f8718` | 2026-09-20 |
| exchange-matching-engine | `m-live-matching-engine` | `sha256:35f759eddf433b6301ad35e1e96b28d5a461d424edebef6d5693826c2732c76a` | 2026-09-23 |
| exchange-indexer | `m-live-indexer` | `sha256:e35858621fca2f8e796517a445fafcb39c764eeb391e0c83f7b53cf3e88baf35` | 2026-09-02 |
| exchange-postgres | `postgres:16-alpine` | upstream | long-lived |
| exchange-nginx | `nginx:alpine` | upstream | long-lived |

**Note:** Images use **local Docker names `m-live-*`**, not GHCR tags from CI workflow (CI references `ghcr.io/.../exchange` — may be unused on this VPS).

---

## Frontend build provenance

| Field | Value |
|-------|--------|
| `BUILD_ID` file in container | `pT9nT5gzELwkiypRf9ytpa5156ff934e28c88acfb410279f5cf93b3a4ea63` |
| Embedded git SHA | **`a5156ff934e28c88acfb410279f5cf93b3a4ea63`** |
| Commit message | `feat(forex): finalize mt5 trader workstation` |
| Git HEAD on host | **`effd130`** — **1 commit ahead** (`feat(forex): certify complete chart drawing workflow`, 12 files) |

**Conclusion:** Live customer frontend **does not include** committed drawing-certification delta at `effd130` unless redeployed after 2026-09-24.

---

## Deployment metadata on host

| File | Content | Assessment |
|------|---------|------------|
| `.deploy-rev` | `8ef599983974e84679bf44010ca3d8154785665a` | **Stale** (2026-09-16); 89 commits behind HEAD |
| `.deploy-rev.prev` | older | Stale |
| Untracked `.deploy-backup-point-*` | Sep 16 backup notes | VPS-local |

---

## Host bind mounts vs image code

**Backend** (`docker-compose.production.yml`):

```yaml
volumes:
  - ${COMPOSE_PROJECT_DIR:-.}:/opt/m-live:ro
environment:
  COMPOSE_PROJECT_DIR: /opt/m-live
```

**Implication:** Files on host under `/opt/m-live` (compose, scripts, possibly docs) are **visible inside backend** even when application bytecode comes from the image. **Git dirty state affects infra-executor paths**, not necessarily compiled `dist/` unless image rebuilt.

**Frontend / admin:** No source bind mount — **image-only** runtime.

---

## Docker volumes (not in Git)

| Volume | Purpose |
|--------|---------|
| `m-live_postgres_data` | All application data (221 tables) |
| `m-live_redis_data` | Cache, sessions, rate limits |
| `m-live_rabbitmq_data` | Queues |
| `m-live_engine_wal` | Matching engine WAL (`ENGINE_MATCH_WAL_PATH`) |

---

## Environment

- **`.env`** present on host (6548 bytes) — **not tracked** — holds live secrets and `PUBLIC_*` URLs.  
- **`nginx/ssl/`** — only `README.md` in repo tree; no committed certs at audit time.

---

## What exists in production but NOT in repository

1. **PostgreSQL data** (users, balances, forex accounts, orders, KYC rows).  
2. **Redis / RabbitMQ / WAL** volume contents.  
3. **Production `.env`** values.  
4. **Docker image layers** as built (only reproducible from source snapshot + build args).  
5. **P2P payment proofs** on disk if any (gitignored path).  
6. **KMS-wrapped hot wallet keys** (external to git).

---

## What exists in repository but NOT in deployed images

1. **`effd130` commit** (drawing certification) — not in frontend BUILD_ID.  
2. **228 uncommitted / untracked app paths** on host — may exceed admin image (Sep 20) and partially exceed backend/frontend images depending on last `docker compose build`.  
3. **~1902 untracked `.build/` files** — never deployed.  
4. **3605 tracked files** minus paths excluded from Docker contexts — e.g. most `docs/`, `audit/`, root markdown reports not in containers.

---

## Migration implication

To preserve **live behavior**, migration must copy **forensic source snapshot** + decide whether to **match images** (rebuild from snapshot) or **export/import images** (not documented here — outside git migration). For **data continuity**, require **`pg_dump`** (or vendor backup) — schema-only migration is insufficient for beta users on VPS.
