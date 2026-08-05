# Release Engineering Audit

**Date:** 2026-08-04  
**Repository:** Enterprise Digital Asset Exchange (monorepo)  
**Purpose:** Assess readiness for clean production distribution via a **new Git repository** independent of the current development VPS.

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| Application code | **Ready** | Functionally complete; 1 TODO (OTP email integration comment) |
| Docker production stack | **Ready** | `docker-compose.production.yml` — 12 services, health checks, volumes |
| Migrations | **Ready** | Inline runner in `migrate.ts` (~700 steps) + 6 supplemental SQL files |
| Environment templates | **Needs normalization** | VPS-specific placeholders (`VPS_PUBLIC_IP`, hardcoded IPs in scripts) |
| Deployment automation | **Partial** | VPS scripts exist under `scripts/`; unified `deployment/` package created |
| CI/CD | **Needs path fix** | Default deploy path `/opt/exchange` vs common `/opt/exchange-product` |
| Release artifacts on disk | **Exclude from product repo** | ~524 MB backups, bundles, audit logs on dev VPS |
| Documentation | **Fragmented** | 64+ root-level audit MD files; consolidate for client handover |

**Verdict:** Suitable for productization after env normalization, deployment package, and new-repo scrub (see `NEW-REPOSITORY-CHECKLIST.md`).

---

## 2. Project Structure

```
/
├── apps/
│   ├── admin-panel/     Next.js 14 — operator console (:3001)
│   ├── backend/         Fastify API + workers + migrations
│   ├── frontend/        Next.js 14 — user exchange (:3000)
│   ├── indexer/         EVM deposit indexer (:4001)
│   └── mobile/          Expo/React Native (optional product module)
├── matching-engine/     Rust spot matching engine (:7101)
├── session-core/        Rust session helper crate
├── edge-auth-gateway/   Go edge stub
├── packages/mobile-types/
├── infra/               Prometheus, Grafana, NATS Dockerfile
├── nginx/               TLS reverse proxy configs
├── e2e/                 Playwright + API E2E (dev/CI only)
├── scripts/             90 operational/certification scripts
├── deployment/          Client install/deploy package (release engineering)
└── docs/                Runbooks, inventory, verification reports
```

**Turbo monorepo:** root `package.json` + workspaces for frontend, admin, backend, mobile.

---

## 3. Applications & Services

| Component | Technology | Production container |
|-----------|------------|---------------------|
| User frontend | Next.js 14 | `exchange-frontend` |
| Admin panel | Next.js 14 | `exchange-admin` |
| API + workers | Fastify / Node 20 | `exchange-backend` (`RUN_MODE=all`) |
| Matching engine | Rust / Axum | `exchange-matching-engine` |
| Deposit indexer | Node / TS | `exchange-indexer` |
| PostgreSQL 16 | Alpine | `exchange-postgres` |
| Redis 7 | Alpine | `exchange-redis` |
| RabbitMQ 3 | Management | `exchange-rabbitmq` |
| NATS JetStream | Custom 2.10 | `exchange-nats` |
| Reverse proxy | Nginx Alpine | `exchange-nginx` |
| Prometheus | v2.51 | `exchange-prometheus` (monitoring compose) |
| Grafana | 10.4 | `exchange-grafana` (monitoring compose) |

---

## 4. Docker Compose Files

| File | Role | Ship in product repo? |
|------|------|----------------------|
| `docker-compose.yml` | Local development | Yes |
| `docker-compose.production.yml` | **Primary production stack** | Yes |
| `docker-compose.prod-images.yml` | GHCR image overlay for CI | Yes |
| `infra/docker-compose.monitoring.yml` | Prometheus + Grafana | Yes |
| `release-backup/docker-compose*.yml` | Frozen VPS snapshot duplicates | **No** |

---

## 5. Environment Configuration

| File | Purpose |
|------|---------|
| `.env.example` | Full variable catalog (dev + optional production) |
| `.env.production.example` | **Production template** — categorized, no VPS-specific values |
| `apps/admin-panel/.env.example` | Admin `NEXT_PUBLIC_*` overrides |
| `apps/mobile/.env.example` | Mobile Expo variables |
| `e2e/.env.e2e.example` | E2E runner (CI/dev only) |

**Live secrets:** `.env` on VPS only — never committed.

---

## 6. Migrations

| Location | Count | Notes |
|----------|-------|-------|
| `apps/backend/src/database/migrate.ts` | ~700 inline steps | Primary — `docker compose --profile tools run migrate` |
| `apps/backend/src/database/migrations/*.sql` | 6 files | Supplemental/manual (document in ops guide) |
| `apps/backend/src/database/full-schema.sql` | Reference snapshot | Not auto-applied |

---

## 7. CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/production.yml` | Push `main`, dispatch | Build images → GHCR → SSH deploy |
| `.github/workflows/release-go-no-go.yml` | Manual | Full stack certification gate |
| `.github/workflows/load-gate.yml` | PR | Load gate SLO |
| `.github/workflows/mobile.yml` | PR/push mobile paths | Mobile CI |

**Release risk:** `production.yml` default `VPS_DEPLOY_PATH=/opt/exchange` — set secret explicitly for each client.

---

## 8. Scripts Inventory (90 files)

Grouped by purpose — full list in `scripts/`:

- **Client deployment:** `vps-first-boot.sh`, `vps-migrate.sh`, `vps-health-check.sh`, `vps-backup-db.sh`, `vps-restore-db.sh`, `vps-rollback.sh`, `vps-seed-admin.sh`, `generate-self-signed-tls.sh`
- **Verification:** `verify-*.mjs`, `load-gate.mjs`, trading/financial invariant scripts
- **Certification:** `run-final-release-certification.sh`, RC-005, mission2/3 scripts
- **Development:** `dev-stack.sh`, `local-stack-up.sh`, `chaos-test.sh`

**Product repo recommendation:** Ship `deployment/*` + production-critical `scripts/`; move certification-only scripts to `tools/certification/` or document as optional.

---

## 9. Code Quality Scan

| Path | TODO | FIXME | Unguarded `console.log` |
|------|------|-------|-------------------------|
| `apps/backend/src` | 1 | 0 | 0 |
| `apps/frontend/src` | 0 | 0 | 0 (8 dev-gated) |
| `apps/admin-panel/src` | 0 | 0 | 0 |

**TODO:** `auth.service.ts:568` — comment placeholder for email/SMS OTP (integration may exist elsewhere).

---

## 10. Release Garbage & Exclusions

### Do NOT include in product repository

| Item | Size / risk | Action |
|------|-------------|--------|
| `release-backup/` | ~314 MB — DB dump, git bundle, `.env.production.backup` | Archive off-site; **never commit** |
| `release-freeze-*.bundle` | ~210 MB | Exclude |
| `audit/*.log`, `audit/final-cert-*` | Certification runtime | Exclude (keep sample reports optional) |
| `playwright-report/`, `test-results/` | Generated | `.gitignore` ✓ |
| `e2e/.e2e-credentials.json` | Generated secrets | `.gitignore` ✓ |
| Root `*AUDIT*.md` (64 files) | Superseded reports | Consolidate into `docs/` or exclude |
| `.deploy-rev`, `.deploy-rev.prev` | Machine state | `.gitignore` |
| `backups/*.sql.gz` | Runtime backups | `.gitignore` |

### Confirmed safe for Phase 2 cleanup (repository hygiene only)

- Extend `.gitignore` for bundles, release-backup, deploy rev files
- No automatic deletion of VPS disk artifacts (operator archives separately)

---

## 11. Duplicate / Obsolete Configurations

| Issue | Recommendation |
|-------|----------------|
| `release-backup/docker-compose*.yml` | Identical to root — delete from product repo |
| `.env.example` vs `.env.production.example` overlap | Normalized in Phase 3 |
| Nginx: `nginx.http-only.conf`, `nginx.tls.conf`, `nginx.conf` | All required — entrypoint selects mode |
| Dev compose hardcoded secrets | Acceptable for local dev only |

---

## 12. VPS-Specific / Hardcoded Values

| Location | Value | Remediation |
|----------|-------|-------------|
| `scripts/incident-drill.sh` | Example IP in comments | Use `PUBLIC_HOST` env |
| `scripts/run-production-closure.sh` | Hardcoded admin URL | Parameterize |
| `docs/verification-admin-sweep/` | Captured VPS URLs | Exclude from product repo |
| `apps/backend/.../infrastructure-executor.service.ts` | Default `COMPOSE_PROJECT_DIR=/opt/m-live` | Set via env `COMPOSE_PROJECT_DIR` |
| `.github/workflows/production.yml` | `/opt/exchange` default path | Document in client guide |

**No runtime business logic changes required** — env-driven configuration sufficient.

---

## 13. Health Checks & Monitoring

| Service | Endpoint / probe |
|---------|------------------|
| Nginx | `GET /healthz` |
| Backend | `GET /health/live`, `/health`, `/health/deep` |
| Matching engine | `GET /health` (:7101) |
| Indexer | `GET /health` (:4001) |
| NATS | `GET /healthz` (:8222) |
| Postgres / Redis / RabbitMQ | Docker healthcheck commands |
| Prometheus | Scrapes `exchange-backend:4000/metrics` (requires shared Docker network) |

---

## 14. Documentation State

| Category | Location | Client-ready? |
|----------|----------|---------------|
| Installation | `deployment/` + `CLIENT-INSTALLATION-GUIDE.md` | **Created** |
| Operations | `CLIENT-OPERATIONS-GUIDE.md` | **Created** |
| Architecture diagrams | `docs/architecture-diagrams/` | Yes |
| Inventory / blueprint | Root MD files | Move to `docs/` or exclude |
| Internal audits | `audit/`, root `*AUDIT*.md` | Exclude from product repo |

---

## 15. Recommended Actions (Priority)

| P | Action |
|---|--------|
| P0 | Use `deployment/install.sh` + `deploy.sh` on fresh Ubuntu VPS |
| P0 | Copy `.env.production.example` → `.env`; fill all `CHANGE_ME` values |
| P0 | New repo: no git history, no secrets, no backup bundles |
| P1 | Set `COMPOSE_PROJECT_DIR` and `PUBLIC_HOST` in client `.env` |
| P1 | Configure `ADMIN_IP_WHITELIST`, KMS, engine HMAC secrets |
| P2 | Optional: move certification scripts to `tools/certification/` |
| P2 | Consolidate root audit markdown into `docs/internal/` or exclude |

---

## 16. Sign-Off

This audit confirms the exchange is **functionally complete** and **deployable via Docker Compose**. Release engineering work focuses on **packaging, configuration normalization, and documentation** — not feature or architecture changes.

**Next artifacts:** `deployment/`, normalized env templates, client guides, `NEW-REPOSITORY-CHECKLIST.md`, `RELEASE-CERTIFICATION.md`.
