# METHErium Exchange — Release Freeze & Baseline Verification Report

**Timestamp (UTC):** 2026-07-09T12:20:00Z  
**Auditor:** Release Engineering (verification only — no system changes)  
**Repository path:** `/opt/m-live` (VPS)

---

## 1. Executive Summary

The Exchange **cannot be frozen** as a trusted production baseline for Mobile App development.

**Verdict: NOT READY**

The running production system contains RC-certified implementations that are **not committed to Git**. The VPS working tree has **595 dirty paths** (198 modified tracked + 397 untracked). GitHub `origin/main` is **8 commits behind** the VPS HEAD and on a **different branch lineage**. The recorded deploy revision (`.deploy-rev`) does not match HEAD or the running backend image (rebuilt 2026-07-09 from uncommitted sources).

Runtime financial systems are healthy, but **source ↔ deployment ↔ Git synchronization fails** every freeze criterion.

---

## 2. Git Audit (Phase 1)

| Item | Value |
|------|-------|
| Current branch | `deployment/vps-first-boot` |
| Detached HEAD | No |
| HEAD SHA | `65aae93156af9df2bedee296753c8e791a6163d3` |
| Latest commit | `65aae93` — *Freeze admin panel UX for reproducible production deployment.* (2026-06-28) |
| Upstream tracking | **None** (branch not on remote) |
| Working tree | **DIRTY** |
| Modified (tracked, unstaged) | **198 files** |
| Staged | **0 files** |
| Untracked | **397 files** |
| Total status entries | **337+** |
| Stash | Empty |
| Rebase / merge / cherry-pick | None in progress |
| Local tag on HEAD | `release/admin-ux-20260628` |

### Remote sync

| Remote | SHA | Branch |
|--------|-----|--------|
| `origin/main` | `af55da7765eb856829f1cdf5929dc2edca53c549` | Only remote branch |
| VPS HEAD | `65aae93156af9df2bedee296753c8e791a6163d3` | **8 commits ahead** of origin/main, not pushed |

### Tags

`release/admin-ux-20260628`, `tier1-production-20260626`, `ui-stable-before-tier1-polish`, `deploy-2026-06-24-production-synced`, `deploy-2026-06-24-user-frontend-finalization`

---

## 3. VPS Audit (Phase 2)

VPS repository **is** the Git repository at `/opt/m-live`. No separate clone detected.

| Item | Status |
|------|--------|
| Path | `/opt/m-live` |
| Branch | `deployment/vps-first-boot` |
| HEAD | `65aae93` |
| Working tree | **DIRTY** (same as Phase 1) |
| Matches GitHub | **NO** — 8 unpushed commits; branch absent from remote |

---

## 4. Deployment Audit (Phase 3)

### Production containers (exchange-*)

| Container | Image | Image SHA prefix | Created | Uptime | Health |
|-----------|-------|------------------|---------|--------|--------|
| exchange-backend | m-live-backend | `4e1ed0278f74` | 2026-07-09 | ~2 hours | healthy |
| exchange-frontend | m-live-frontend | `03e052c72299` | 2026-06-30 | 9 days | healthy |
| exchange-admin | m-live-admin-panel | `1a0663df4be5` | 2026-07-02 | 7 days | healthy |
| exchange-matching-engine | m-live-matching-engine | `a3ec52d3a4fe` | 2026-07-01 | ~1 hour | healthy |
| exchange-indexer | m-live-indexer | `db0b82fa3d2a` | 2026-06-30 | 9 days | healthy |
| exchange-nginx | nginx:alpine | `1a8724a52d43` | 2026-06-23 | 11 days | healthy |
| exchange-postgres | postgres:16-alpine | healthy | 2 weeks | healthy |
| exchange-redis | redis:7-alpine | healthy | 3 hours | healthy |
| exchange-nats | exchange-nats:2.10-alpine | healthy | 3 hours | healthy |

### Version metadata in containers

All services report `GIT_SHA=unset`, `BUILD_SHA=unset`, `VERSION=unset`. **No commit SHA embedded in images.**

### Recorded deploy revision

| File | SHA | Notes |
|------|-----|-------|
| `.deploy-rev` | `94d0d8e` | Tier-1 production release (2026-06-26) |
| `.deploy-rev.prev` | `23361148` | Previous deploy |
| Git HEAD | `65aae93` | **2 commits ahead** of deploy-rev |

---

## 5. Container Audit — Git vs VPS vs Running (Phase 4)

### SHA comparison chain

```
GitHub origin/main     af55da7  ← 8 commits BEHIND VPS HEAD
        ↓ MISMATCH
VPS Git HEAD           65aae93  ← tagged release/admin-ux-20260628
        ↓ MISMATCH
.deploy-rev            94d0d8e  ← stale deploy marker
        ↓ MISMATCH
Running backend image  (built 2026-07-09 from dirty tree — no SHA)
        ↓ UNVERIFIABLE
Running APIs           healthy (200 /health)
```

| Layer | Expected (for freeze) | Actual | Match |
|-------|----------------------|--------|-------|
| GitHub ↔ VPS HEAD | Same SHA | `af55da7` vs `65aae93` | **FAIL** |
| VPS HEAD ↔ .deploy-rev | Same SHA | `65aae93` vs `94d0d8e` | **FAIL** |
| VPS HEAD ↔ running image | Traceable SHA | No SHA in image; backend rebuilt today from uncommitted sources | **FAIL** |
| Working tree | Clean | 198 modified + 397 untracked | **FAIL** |

### File-level drift evidence

| File | In Git (HEAD) | In working tree | In running container |
|------|---------------|-----------------|----------------------|
| `spot-lock-reconcile.service.ts` | **ABSENT** | untracked `??` | **PRESENT** (dist, 4967 bytes) |
| `settlement-quarantine.service.ts` | **ABSENT** | untracked `??` | **PRESENT** (dist, 6729 bytes) |
| `compliance-policy.service.ts` | **ABSENT** | untracked `??` | **PRESENT** (dist, 11895 bytes) |
| `sanctions-screening.service.ts` | 5270 bytes @ `94d0d8e` | **10004 bytes** (modified) | **9810 bytes** (dist) |
| `docker-compose.production.yml` | committed | **modified** (+docker.sock, +volume mounts) | running with mounts |

**Impact:** Mobile App development against Git would **miss** all RC-003/004/005/006 runtime fixes present in production. Rollback to any Git SHA would **remove** certified behaviour.

---

## 6. RC Verification (Phase 5)

### Runtime (deployed system) — implementations **present**

| RC | Component | Runtime evidence |
|----|-----------|------------------|
| RC-003 | Settlement quarantine | `settlement-quarantine.service.js` loaded; exports `quarantineSettlementBatch`; DB: 2237 quarantined events |
| RC-004 | Financial reconciliation | `tier1-reconciliation.service.js` present; Tier-1 PASS in prior cert |
| RC-005 | Spot lock reconcile | `spot-lock-reconcile.service.js` present; exports `reconcileUserSpotLocks` |
| RC-005 | WebSocket / admin cancel | Container dist contains `PARTIALLY_FILLED` in admin-control |
| RC-005 | Deposit / Withdraw / Transfer | Certified in RC-005 reports (runtime) |
| RC-006 | Compliance policy | `compliance-policy.service.js` present (11895 bytes) |
| RC-006 | Sanctions fail-closed | `sanctions-screening.service.js` present; P2P returns 403 without key |

### Git repository — implementations **incomplete**

| RC | In Git HEAD (`65aae93`) | In working tree | Committed & pushed |
|----|-------------------------|-----------------|-------------------|
| RC-003 quarantine service | **NO** | untracked | **NO** |
| RC-004 reconciliation | partial (base) | modified services | **NO** (post-cert changes uncommitted) |
| RC-005 spot-lock-reconcile | **NO** | untracked | **NO** |
| RC-005 e2e cross-match helper | **NO** | untracked | **NO** |
| RC-005 cert scripts | **NO** | untracked | **NO** |
| RC-006 cert reports (16 files) | **NO** | untracked dir | **NO** |

**RC Git verification: FAIL** — certified code exists at runtime but is **not baselined in Git**.

---

## 7. Configuration Audit (Phase 6)

| Item | Status |
|------|--------|
| Database (PostgreSQL) | **Configured** |
| Redis | **Configured** |
| NATS | **Configured** |
| RPC (ETH/BSC/BASE/POLYGON/TRON) | **Configured** |
| Indexer API URL | **Configured** |
| JWT / session / CSRF secrets | **Configured** (length verified, values redacted) |
| KMS (AWS) | **Configured** |
| Email (SMTP/Resend) | **Configured** |
| SMS (Twilio) | **Missing** |
| KYC (Hyperverge) | **Placeholder** (provider set, credentials missing) |
| Sanctions (Chainalysis) | **Placeholder** (URL set, API key missing) |
| Cloud storage (S3 etc.) | **Missing** (api_settings inactive) |
| Monitoring (Sentry) | **Missing** |
| Alerts (webhook/Slack) | **Missing** |
| Prometheus | **Configured** |
| TLS | **Missing** (nginx listen 80 only; HTTPS :443 unreachable) |
| Domains | **Placeholder** (IP `109.123.254.30`, HTTP only) |
| MASTER_SEED_ENCRYPTED | **Missing** |
| HEDGE_DRY_RUN | **Invalid** (`true` in production) |

---

## 8. Deployment Integrity (Phase 7)

| Item | Status |
|------|--------|
| Compose file | `docker-compose.production.yml` — **modified** vs HEAD |
| Networks | `exchange-network`, `exchange-production` — OK |
| Volumes | `m-live_postgres_data`, `m-live_redis_data`, `m-live_rabbitmq_data`, `m-live_engine_wal` — OK |
| Restart policies | `unless-stopped` on all core services — OK |
| Health checks | Present on all application services — OK |
| Backend mounts | `/var/run/docker.sock`, `/opt/m-live:ro` — **not in committed compose** |
| Ports | 80 (HTTP OK), 443 (TLS not serving), 4000 backend localhost — OK |
| Nginx reverse proxy | HTTP proxy to backend/frontend/admin — OK |
| SSL | **Not configured** (empty `/etc/nginx/ssl/`) |
| Env consistency | `.env` present (modified Jul 9); not in Git (correct) |

---

## 9. Backup Verification (Phase 9)

| Item | Status |
|------|--------|
| Repository backup | **NOT FOUND** (no git bundle / archive) |
| Database backup artifacts | **NOT FOUND** (no `.sql.gz` / `.dump` in repo or `/opt/m-live/backups`) |
| Docker compose backup | Present in repo (committed version; working copy modified) |
| Environment backup | `.env` exists on VPS only — no separate backup file found |
| Release documentation | **16 RC reports** in `docs/production-closure/` — **all untracked** |
| Rollback documentation | `docs/BACKUP_AND_RECOVERY.md` tracked; `docs/production-closure/REMEDIATION.md` untracked |
| Backup cron | **NOT CONFIGURED** (no entry in user crontab) |

---

## 10. Freeze Readiness (Phase 8)

| Criterion | Result |
|-----------|--------|
| Git repository clean | **FAIL** — 198 modified, 397 untracked |
| VPS repository clean | **FAIL** (same repo) |
| Running containers match repository | **FAIL** — backend rebuilt from dirty tree; no SHA |
| No uncommitted code | **FAIL** |
| No deployment drift | **FAIL** — `.deploy-rev` stale; compose modified |
| RC implementations in Git | **FAIL** |
| No accidental debug code | **PASS** (no DEBUG env; no rebase in progress) |
| No dev flags | **FAIL** — `HEDGE_DRY_RUN=true` |
| Release docs in Git | **FAIL** — entire `docs/production-closure/` untracked |
| Rollback docs present | **PARTIAL** |

---

## 11. Remaining Risks

1. **Mobile App against Git will not match production APIs** — RC fixes uncommitted.
2. **Rollback to any Git tag loses certified behaviour** — quarantine, spot-lock-reconcile, compliance policy absent from Git.
3. **GitHub is stale** — 8 commits unpushed; production branch not on remote.
4. **No database backup** — freeze without backup violates operational readiness.
5. **No commit SHA in images** — future drift undetectable.
6. **Stale `.deploy-rev`** — operators may rollback to wrong SHA (`94d0d8e`).

---

## 12. Recommended Release Tag

**Do not create a tag now.**

When blockers are resolved, recommended tag:

```
release/exchange-baseline-20260709
```

Anchor commit must include **all** RC implementations and certification docs, after clean tree verification.

---

## 13. Recommended Branch Name

```
release/exchange-production-baseline
```

Created from a single commit that squashes or includes all RC-003→RC-006 changes, pushed to `origin`.

---

## 14. Rollback Baseline

| Baseline | SHA | Suitability |
|----------|-----|-------------|
| Current `.deploy-rev` | `94d0d8e` | **Unsafe** — missing RC-005/006 runtime code |
| Git tag `release/admin-ux-20260628` | `65aae93` | **Incomplete** — missing all post-tag uncommitted RC work |
| `origin/main` | `af55da7` | **Stale** — 8 commits behind production branch |
| Running backend image | `4e1ed0278f74` (2026-07-09) | **Current production** — not reproducible from Git |

**Effective rollback baseline today:** Docker image `m-live-backend:4e1ed0278f74` (local only, not in registry). **Not acceptable for a frozen release.**

---

## 15. Final Verdict

# NOT READY

The Exchange cannot be frozen. Source code, Git repository, VPS deployment, and running containers are **not synchronized**. Certified RC implementations run in production but are **not baselined in version control**. GitHub does not contain the production branch.

### Blockers (must resolve before freeze)

| ID | Blocker |
|----|---------|
| FRZ-001 | 198 modified + 397 untracked files — dirty working tree |
| FRZ-002 | RC-003/004/005/006 implementation files not committed to Git |
| FRZ-003 | 8 commits on `deployment/vps-first-boot` not pushed to GitHub |
| FRZ-004 | GitHub `origin/main` (`af55da7`) ≠ VPS HEAD (`65aae93`) |
| FRZ-005 | `.deploy-rev` (`94d0d8e`) ≠ HEAD ≠ running backend build |
| FRZ-006 | No commit SHA in container images — deployment not auditable |
| FRZ-007 | All `docs/production-closure/` certification reports untracked |
| FRZ-008 | No database backup artifacts found |
| FRZ-009 | `docker-compose.production.yml` modified but uncommitted |
| FRZ-010 | `HEDGE_DRY_RUN=true` — development flag in production |

### Required actions (operator — not performed by this audit)

1. Commit all RC implementations, cert scripts, e2e helpers, and certification docs.
2. Commit or revert 198 modified tracked files to reach clean tree.
3. Push `deployment/vps-first-boot` (or merge to `main`) to GitHub.
4. Align `.deploy-rev` with new HEAD; rebuild images from clean commit.
5. Embed `GIT_COMMIT` in Docker builds.
6. Create verified database backup.
7. Re-run this freeze verification.

Only after all blockers are cleared and re-verification passes:

```
Create Release Branch → Create Git Tag → Archive Documentation → Backup → Begin Mobile Development
```

---

*Verification only. No code, configuration, containers, or Git state was modified during this audit.*
