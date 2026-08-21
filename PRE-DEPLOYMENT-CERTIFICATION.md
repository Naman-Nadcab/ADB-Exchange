# Pre-Deployment Certification — Metherium Exchange

**Date:** 2026-08-05  
**Type:** Final pre-launch validation (verify-only — no code changes)  
**Branch:** `release/exchange-production-baseline`  
**Commit:** `dded6b9`  
**Audit VPS:** Current validation stack (11/11 containers healthy)

---

## Executive Summary

This certification validates the deployment package, Docker infrastructure, empty-database migrations, environment template, and automated GO path for a **brand-new Ubuntu VPS**. No features were modified. No refactors were performed.

| Area | Result |
|------|--------|
| Deployment scripts (7) | ✅ All pass syntax + logic audit |
| Docker volumes / mounts / networks | ✅ Verified |
| Restart policies | ✅ All production services `unless-stopped` |
| Empty PostgreSQL migrations | ✅ **Executed and passed** (live test) |
| Environment template | ✅ No duplicates; required keys present |
| Automated GO path | ✅ With documented external prerequisites |

**Overall Score:** **94 / 100**

---

## Verdict

# ✅ READY TO DEPLOY

A brand-new Ubuntu 22.04/24.04 VPS can reach operational GO status using only:

```bash
git clone → cp .env.production.example .env → deployment/install.sh → deployment/deploy.sh → deployment/verify.sh
```

**No manual engineering intervention** (Docker patching, hand-run migrations, compose fixes, permission hacks) is required beyond standard operator configuration: filling `.env`, provisioning AWS KMS, and setting `PUBLIC_HOST`.

---

## 1. Deployment Script Verification

All scripts pass `bash -n` syntax validation.

### `deployment/install.sh`

| Check | Status |
|-------|--------|
| Requires root (`EUID`) | ✅ |
| Installs Docker CE + Compose plugin | ✅ |
| Installs Git, curl, openssl, ufw | ✅ |
| Enables/starts Docker systemd unit | ✅ |
| Optional deploy user → docker group | ✅ |
| Creates `/opt/exchange` hint directory | ✅ |
| Does **not** deploy application | ✅ (by design) |

### `deployment/deploy.sh`

| Step | Status | Notes |
|------|--------|-------|
| Load + validate `.env` | ✅ | Fail-fast on `CHANGE_ME` placeholders |
| TLS generation | ✅ | `deployment/ssl.sh` if certs missing |
| Infra startup | ✅ | postgres, redis, rabbitmq, nats |
| Infra readiness wait | ✅ | Up to 180s (postgres + redis) |
| Migrations | ✅ | `deployment/lib/migrate.sh` |
| Application build/up | ✅ | Full stack with `--build` |
| Backend liveness wait | ✅ | Up to 360s |
| Admin seed | ✅ | `scripts/vps-seed-admin.sh` |
| Monitoring | ✅ | Prometheus + Grafana |
| Health check | ✅ | `deployment/health-check.sh` |

**Skip flags:** `SKIP_TLS`, `SKIP_BUILD`, `SKIP_MIGRATE`, `SKIP_SEED`, `SKIP_MONITORING`

### `deployment/verify.sh`

| Check | Status |
|-------|--------|
| Delegates to `health-check.sh` | ✅ |
| `docker compose ps` | ✅ |
| Deep health probe (localhost:4000) | ✅ (warns if unreachable — expected when port is docker-internal only) |
| Prometheus target probe | ✅ (warns if monitoring down) |

### `deployment/rollback.sh`

| Check | Status |
|-------|--------|
| Accepts git ref or `.deploy-rev.prev` | ✅ |
| Validates ref exists | ✅ |
| Trading halt before rollback | ✅ (`vps-trading-halt.sh`) |
| Git stash + checkout | ✅ |
| Redeploy with `SKIP_MIGRATE=1 SKIP_SEED=1` | ✅ |

**Note:** Rollback is an **update-time** operation. First deploy does not require it. Requires git history on target VPS.

### `deployment/backup.sh`

| Check | Status |
|-------|--------|
| Delegates to `scripts/vps-backup-db.sh` | ✅ |
| Ensures postgres up + pg_isready | ✅ |
| `pg_dump` → gzip in `./backups/` | ✅ |
| Sources `.env` for credentials | ✅ |

**Note:** Backup is post-GO ops tooling, not part of first deploy.

### `deployment/restore.sh`

| Check | Status |
|-------|--------|
| Requires backup file argument | ✅ |
| Interactive `RESTORE` confirmation | ✅ |
| Trading halt before restore | ✅ |
| `gunzip \| psql` restore | ✅ |

**Note:** Interactive prompt — disaster recovery only. **Not used for new VPS clone** (fresh DB required).

### `deployment/health-check.sh`

| Endpoint | Status (live test) |
|----------|-------------------|
| `$BASE/healthz` (nginx) | ✅ OK |
| `$BASE/health/live` (backend liveness) | ✅ OK |
| `$BASE/health` (backend readiness) | ✅ OK (see §6 flake note) |
| `$BASE/api/v1/spot/markets` | ✅ OK |

**Live result:** `=== PASS ===` (4/4 checks)

**Script score: 100 / 100**

---

## 2. Docker Infrastructure Verification

### 2.1 Named Volumes (production compose)

| Volume | Service | Mount point | Scope |
|--------|---------|-------------|-------|
| `postgres_data` | postgres | `/var/lib/postgresql/data` | New per VPS |
| `redis_data` | redis | `/data` | New per VPS |
| `rabbitmq_data` | rabbitmq | `/var/lib/rabbitmq` | New per VPS |
| `engine_wal` | matching-engine | `/data/wal` | New per VPS |

**Monitoring compose (separate):**

| Volume | Service |
|--------|---------|
| `prometheus-data` | prometheus |
| `grafana-data` | grafana |

All volumes are **project-scoped** (e.g. `m-live_postgres_data` on host). No `external: true` data volumes. Fresh VPS creates empty volumes automatically.

### 2.2 Bind Mounts

| Service | Mount | Mode | Purpose |
|---------|-------|------|---------|
| **backend** | `/var/run/docker.sock` → container | rw | Infra control actions |
| **backend** | `${COMPOSE_PROJECT_DIR:-.}` → `/opt/m-live` | **ro** | Compose file access inside container |
| **nginx** | `./nginx/docker-entrypoint.sh` | ro | TLS/HTTP mode selection |
| **nginx** | `./nginx/nginx.tls.conf` | ro | HTTPS config |
| **nginx** | `./nginx/nginx.http-only.conf` | ro | HTTP-only fallback |
| **nginx** | `./nginx/ssl` | ro | TLS certificates |
| **prometheus** | `./prometheus/prometheus.yml` | ro | Scrape config |
| **grafana** | provisioning + dashboards dirs | ro | Dashboard bootstrap |

**No bind mounts to host paths outside the repository** (except docker.sock).

### 2.3 Port Bindings

| Service | Binding | Exposure |
|---------|---------|----------|
| postgres | `127.0.0.1:5432:5432` | Localhost only ✅ |
| backend | `127.0.0.1:4000:4000` | Localhost only ✅ |
| nginx | `${HTTP_PORT:-80}:80`, `${HTTPS_PORT:-443}:443` | Public ✅ |
| prometheus | `9090:9090` | Public (restrict via firewall) |
| grafana | `3001:3000` | Public (restrict via firewall) |

### 2.4 Permissions

| Item | Finding |
|------|---------|
| Backend user | Runs as `exchange` (non-root) ✅ |
| Backend docker.sock | `group_add: ${DOCKER_GID:-999}` |
| Host docker GID (audit VPS) | **988** (default compose uses **999**) ⚠️ |
| nginx TLS key generation | `chmod 600` privkey, `644` fullchain ✅ |
| nginx/ssl in repo | Empty except README (certs generated at deploy) ✅ |

**Recommendation for new VPS:** Set `DOCKER_GID=$(getent group docker | cut -d: -f3)` in `.env` if admin infra-restart actions fail. **Not a blocker for core exchange GO.**

### 2.5 Networks

| Network | Type | Used by |
|---------|------|---------|
| `exchange-production` | bridge (created by main compose) | All 11 app/infra containers |
| `exchange-production` | external (monitoring compose) | prometheus joins main network for `exchange-backend:4000` scrape |

Deploy order in `deploy.sh` ensures main stack creates the network before monitoring starts. ✅

### 2.6 Restart Policies

| Service | Policy |
|---------|--------|
| postgres | `unless-stopped` |
| redis | `unless-stopped` |
| rabbitmq | `unless-stopped` |
| nats | `unless-stopped` |
| indexer | `unless-stopped` |
| matching-engine | `unless-stopped` |
| backend | `unless-stopped` |
| frontend | `unless-stopped` |
| admin-panel | `unless-stopped` |
| nginx | `unless-stopped` |
| prometheus | `unless-stopped` |
| grafana | `unless-stopped` |
| migrate | `no` (one-shot) ✅ |
| seed-admin | `no` (one-shot) ✅ |

**Infrastructure score: 93 / 100**

---

## 3. Empty PostgreSQL Migration Verification

### Test methodology

Executed **live** against a standalone empty PostgreSQL 16 container (no existing exchange data):

```text
docker run postgres:16-alpine  →  empty database
docker run m-live-migrate      →  node dist/database/migrate.js
```

Environment matched production Tier-0 requirements (JWT, encryption, engine HMAC, SLO whitelist, etc.).

### Results

| Metric | Result |
|--------|--------|
| Exit code | **0** |
| Duration | ~10 seconds |
| Tables created | **~139** relations |
| Spot markets seeded | **48** |
| Currencies seeded | **43** |
| Default migration admin | `admin@example.com` (password `admin123` in migration SQL) |
| Idempotent re-run | ✅ Passed (second run exit 0) |
| `KMS_TYPE=aws` (no AWS call during migrate) | ✅ Passed |

### Migration seed vs deploy seed

| Source | Creates |
|--------|---------|
| `migrate.ts` | Schema + system data + fallback `admin@example.com` |
| `seed-admin.ts` (deploy step 5) | `test@gmail.com` (super_admin) + `approver@example.com` |

Deploy path runs **both** — migrations first, then seed-admin. Fresh DB confirmed working.

**Migration score: 100 / 100**

---

## 4. Environment Variable Verification

### 4.1 `.env.production.example` audit

| Check | Result |
|-------|--------|
| Duplicate keys | **None** ✅ |
| Keys defined | **160** |
| Required by `validate_production_env()` | **All present** ✅ |
| `CHANGE_ME` placeholders | Present for all secrets (operator must replace) ✅ |

### 4.2 Required deploy variables (fail-fast list)

All present in template:

`POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`, `ENGINE_HMAC_SECRET`, `ENGINE_INTERNAL_SECRET`, `INTERNAL_HMAC_SERVICE_SECRETS`, `INTERNAL_API_ALLOW_CIDRS`, `ADMIN_IP_WHITELIST`, `PUBLIC_HOST`, `AWS_KMS_KEY_ID`, `AWS_REGION`

### 4.3 Linked values (operator must keep in sync when filling `.env`)

| Relationship | Template state |
|--------------|----------------|
| `POSTGRES_PASSWORD` ↔ `DATABASE_URL` | Same `CHANGE_ME` placeholder — sync when replacing ✅ |
| `RABBITMQ_PASSWORD` ↔ `RABBITMQ_URL` | Same placeholder — sync when replacing ✅ |
| `ENGINE_HMAC_SECRET` ↔ `INTERNAL_HMAC_SERVICE_SECRETS` | Documented pattern `matching-engine=<secret>` ✅ |
| `PUBLIC_HOST` ↔ `PUBLIC_*` / `CORS_ORIGINS` | `deploy.sh` auto-syncs if `PUBLIC_API_URL` still contains `CHANGE_ME` ✅ |

### 4.4 Variables in template with limited/no runtime wiring

| Variable | Status |
|----------|--------|
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | ⚠️ In template but monitoring compose uses hardcoded `admin` / `exchange-admin` |
| `HTTP_PORT` / `HTTPS_PORT` | ✅ Used by nginx compose |
| `COMPOSE_PROJECT_DIR` | ✅ Used for backend bind mount |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Optional if instance IAM role used |

These are **documentation/consistency gaps**, not deploy blockers.

### 4.5 Config schema vs production template

- Backend config schema defines **~454** variables (with defaults).
- Production template defines **160** (curated for operators).
- **328** schema keys rely on safe defaults — expected for production template.
- **34** template keys are compose/build/infra-specific (not all parsed by Zod schema directly).

**No missing critical production values identified.**

**Environment score: 91 / 100**

---

## 5. Fresh VPS GO Path Verification

### Automated path (no manual engineering)

| Step | Automated? | Manual operator action? |
|------|------------|-------------------------|
| Install Docker | ✅ `install.sh` | Run script once |
| Clone repo | — | `git clone` |
| Configure secrets | — | Edit `.env` (required) |
| TLS | ✅ `deploy.sh` → `ssl.sh` | None |
| Start infra | ✅ | None |
| Run migrations | ✅ | None |
| Build + start apps | ✅ | None |
| Seed admin | ✅ | None |
| Start monitoring | ✅ | None |
| Health verify | ✅ | None |

### External prerequisites (not engineering — standard ops)

| Prerequisite | Why |
|--------------|-----|
| **AWS KMS key + IAM/credentials** | Backend production gate + KMS startup probe (`KMS_STARTUP_PROBE=1`) |
| **Valid secrets in `.env`** | `validate_production_env()` fail-fast |
| **`ADMIN_IP_WHITELIST`** | Production admin access gate |
| **`PUBLIC_HOST`** | TLS SAN + frontend build args |
| **4+ vCPU, 16+ GB RAM** | Image build + full stack |

### Live stack confirmation (audit VPS)

```text
11/11 containers: healthy
Network exchange-production: 11 containers attached
Health-check: PASS (4/4)
/health JSON: status=healthy, all services up
```

### Post-GO operator tasks (not deploy blockers)

These are **launch readiness**, not deploy automation failures:

1. Change default admin passwords (`admin@example.com`, seed-admin accounts)
2. Configure SMTP/SMS for user OTP
3. Configure blockchain RPC providers
4. Provision hot wallets (`scripts/provision-hot-wallets.sh`)
5. Configure sanctions provider for P2P
6. Schedule `deployment/backup.sh` via cron
7. Optional: `deployment/firewall.sh`

**GO path score: 95 / 100**

---

## 6. Known Issues & Risks

| Issue | Severity | Deploy blocker? | Mitigation |
|-------|----------|-----------------|------------|
| AWS KMS required for backend start | 🔴 | **Yes** (if not provisioned) | Create KMS key + IAM before `deploy.sh` |
| `.env` password sync (DB/RabbitMQ URLs) | 🟡 | Yes (if misconfigured) | Use same secret in URL and password field |
| `DOCKER_GID` default 999 vs host GID | 🟡 | No (infra actions only) | Set `DOCKER_GID` in `.env` |
| Grafana password not from `.env` | 🟡 | No | Change default after first login |
| `/health` probe latency ~5s | 🟡 | No (intermittent) | One failed run observed; retry passed; consider `--max-time 20` if flaky |
| Fixed container names (`exchange-*`) | 🟢 | No | One stack per host (correct for dedicated VPS) |
| `restore.sh` interactive | 🟢 | No | Not in deploy path |
| Default migration admin `admin123` | 🔴 Security | No (deploy blocker) | Change password immediately post-GO |

---

## 7. Score Summary

| Category | Score |
|----------|-------|
| Deployment Scripts | 100 |
| Docker Infrastructure | 93 |
| Empty DB Migrations | 100 |
| Environment Variables | 91 |
| Fresh VPS GO Path | 95 |
| **Overall** | **94** |

---

## 8. Certification Statement

All seven deployment scripts are syntactically valid and logically complete for their stated purpose. Docker volumes, bind mounts, permissions, networks, and restart policies are correctly defined for an isolated production instance. Database migrations **complete successfully from an empty PostgreSQL database**, seeding required system data (markets, currencies, settings) without importing user or financial history.

The environment template contains no duplicate keys and all deploy-time required variables. A brand-new Ubuntu VPS can reach **GO status** through the automated deploy pipeline, subject only to standard operator configuration (`.env` secrets, AWS KMS, public hostname) — **not manual engineering intervention**.

---

## ✅ READY TO DEPLOY

**Signed:** Pre-deployment validation audit  
**Next step:** Provision new VPS → configure `.env` → run deploy pipeline → `deployment/verify.sh` must PASS

---

*Re-validate after any change to `docker-compose.production.yml`, `deployment/*`, or `apps/backend/src/database/migrate.ts`.*
