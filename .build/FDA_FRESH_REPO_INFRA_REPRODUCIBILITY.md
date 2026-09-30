# Infrastructure Reproducibility — Fresh VPS

**Question:** What does a new VPS need besides the Git repository?

---

## AUTOMATICALLY REPRODUCIBLE (from repo + Docker)

| Layer | Mechanism |
|-------|-----------|
| Service topology | `docker-compose.production.yml` |
| App images | `docker compose build` (contexts: `apps/frontend`, `apps/backend`, `apps/admin-panel`, `apps/indexer`, `matching-engine`) |
| NATS custom image | `infra/nats/Dockerfile` |
| DB schema | `migrate` profile → `dist/database/migrate.js` |
| Admin bootstrap | `seed-admin` profile → `seed-admin.ts` |
| HTTP routing | `nginx/` config in repo |
| Monitoring stack | `infra/docker-compose.monitoring.yml` (optional compose merge) |
| Health gates | `/health`, container healthchecks |

**Documented first boot:** `scripts/vps-first-boot.sh` — validates env, TLS optional, build, up, migrate, seed.

---

## MANUALLY CONFIGURED

| Item | Notes |
|------|--------|
| `.env` | From `.env.production.example` — **all secrets new or rotated** |
| TLS certificates | `nginx/ssl/` or `scripts/generate-self-signed-tls.sh` |
| `VPS_PUBLIC_IP` / `PUBLIC_*_URL` | IP-first boot documented in compose header |
| `DOCKER_GID` | Host docker group for backend socket |
| `ADMIN_IP_WHITELIST` | Admin access control |
| Firewall / ufw | Not in repo — ops |
| SSH keys / deploy access | Not in repo |
| Compose project name | Affects volume names (`m-live_*` today) |

---

## EXTERNAL PROVIDER DEPENDENCY

| Provider | Without it |
|----------|------------|
| AWS KMS (or configured KMS) | Backend may fail startup probe |
| Chain RPC | Indexer/deposits degraded |
| Email/SMS | OTP delivery fails |
| OAuth providers | Social login disabled |

Forex **live** broker: **not required** for current MOCK runtime.

---

## Networks & dependencies (from compose)

- **Networks:** `exchange-production` (default), `exchange_network` — backend, frontend, nginx, postgres, redis, rabbitmq on shared network.  
- **Startup order:** postgres/redis/rabbitmq/nats healthy → matching-engine → backend → frontend/admin → nginx.  
- **Persistent volumes:** `postgres_data`, `redis_data`, `rabbitmq_data`, `engine_wal`.

---

## Undocumented manual steps (evidence-based)

1. **Ensure Docker + compose v2** on VPS (assumed by scripts, not installed by repo).  
2. **Instance IAM role** alternative to `AWS_ACCESS_KEY_ID` — warned in `vps-first-boot.sh`.  
3. **Image naming:** local builds tag `m-live-*` by project directory name — changing clone path/project name **changes default image tags**.  
4. **Backend bind-mount** expects repo at `COMPOSE_PROJECT_DIR` — clone path must match env.  
5. **Monitoring:** Grafana/Prometheus containers run but not wired in main production compose file excerpt — may be separate compose invocation.  
6. **Hot wallet provision:** `scripts/provision-hot-wallets.sh` — separate from first-boot.  
7. **Pre-live scripts:** `prelive:verify`, tier1 release checks — optional gates, not auto on boot.

---

## Can the entire stack boot on a fresh VPS?

**Yes**, given:

- Curated **source tree** (not HEAD-only — see migration audit)  
- Complete **`.env`**  
- **KMS** reachable  
- Accept **empty DB** OR restore dump  
- Run `bash scripts/vps-first-boot.sh`

**No**, if expecting **identical user/ledger data** without **pg_dump restore**.

---

## CI/CD reproducibility

`.github/workflows/production.yml`:

- Triggers on **`main`** branch — current prod branch **`release/exchange-production-baseline`** may **not** auto-deploy via this workflow.  
- Uses **`ghcr.io/${{ github.repository_owner }}/exchange`** — VPS uses **local `m-live-*` tags** → **CI and VPS diverge**.

Fresh repo must **rewrite workflows** to match branch strategy and registry.
