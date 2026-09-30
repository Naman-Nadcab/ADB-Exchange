# Dirty Worktree Forensic Classification

**Audit date:** 2026-09-30  
**Git HEAD:** `effd130cb716f3646600f6324beaf4ec6a32c47e`  
**Status lines:** **821** (`git status --short`)  
**Decomposition:**

| Bucket | Count | Command |
|--------|-------|---------|
| Modified tracked vs HEAD | **80** | `git diff --name-only HEAD` |
| Staged | **0** | `git diff --cached --name-only` |
| Untracked (not ignored) | **2090** | `git ls-files --others --exclude-standard` |
| **Total classified rows** | **2170** | modified + untracked lists |

---

## Summary by classification

Automated rules applied to every path (see script logic in audit session). **Full per-path rows:**

- **JSON:** `.build/dirty-path-classification.json`  
- **CSV:** `.build/dirty-path-classification.csv`  

| Classification | Count | Migration implication |
|----------------|-------|------------------------|
| `OPTIONAL` | 1935 | Mostly untracked `.build/` audit artifacts — skip unless archiving history |
| `REQUIRED_BUT_NOT_COMMITTED` | **228** | **Must overlay** on fresh repo snapshot |
| `DEPLOYMENT_ONLY` | 7 | `.deploy-rev`, deploy backup/rollback helpers — do not copy |
| `SECRET/SENSITIVE` | 0 in lists | `.env` is gitignored — not in status; still on disk |
| `UNKNOWN` | 0 | Prefix heuristics covered all rows — **manual review still advised** for 228 REQUIRED |

---

## REQUIRED_BUT_NOT_COMMITTED breakdown

| Prefix | Count |
|--------|-------|
| `apps/backend` | 129 |
| `apps/frontend` | 47 |
| `apps/admin-panel` | 20 |
| `scripts/` (forex cert, vps migrate, sql) | 30 |
| `infra/docker-compose.monitoring.yml` | 1 |

**Evidence these are application code (not docs):** paths under `apps/*/src`, `apps/backend/package.json`, forex services, admin forex panels, frontend forex/chart files.

**Why required:**

1. **Not in any single commit** that matches both HEAD and live images.  
2. **Backend container** bind-mounts host `/opt/m-live` read-only — compose paths and scripts on disk are **runtime inputs** for infra actions.  
3. **Frontend live image** built from **`a5156ff`**; working tree includes **`effd130`** drawing commit **plus** 47 frontend dirty paths — migration must pick explicit policy (see main audit).

---

## Modified tracked files (80) — groups

- **`.build/*` (16):** certification markdown/json — `OPTIONAL` for product runtime.  
- **`apps/admin-panel` forex UI (~19):** admin operational UI — **REQUIRED** if admin behavior must match host.  
- **`apps/backend` forex, spot, admin (~40+):** execution, market data, compliance routes — **REQUIRED**.  
- **`apps/frontend`:** chart/forex customer — **REQUIRED**.  
- **`scripts/vps-migrate.sh`, `vps-backup-db.sh`:** ops — **REQUIRED**.  
- **`.deploy-rev`:** **DEPLOYMENT_ONLY** — stale `8ef5999`.

---

## Untracked highlights (2090)

| Top-level | Count | Classification |
|-----------|-------|----------------|
| `.build/` | 1902 | OPTIONAL (audit output) |
| `apps/` | 135 | Mostly REQUIRED_BUT_NOT_COMMITTED |
| `scripts/` | 29 | Mix REQUIRED + cert scripts |
| Root `FOREX_*.md` | many | OPTIONAL certification reports |
| `.deploy-*` untracked | 6 | DEPLOYMENT_ONLY |

---

## Items that look safe but are not

| Path | Risk |
|------|------|
| `.env` on VPS (ignored, not in status) | Full production secrets |
| `nginx/ssl/*.pem` if added later | TLS private keys |
| `apps/backend/data/p2p-payment-proofs/` | User PII/payment evidence |
| `release-freeze-backup-*.bundle` | Full old git history + possibly secrets in tree |
| `.build/i18n-*` json with screenshot paths | May reference local absolute paths |

---

## Migration actions by classification

| Classification | `migration_action` in CSV |
|----------------|---------------------------|
| REQUIRED_* | `include_in_snapshot` |
| OPTIONAL | `optional` |
| DEPLOYMENT_ONLY / GENERATED / DO_NOT_COPY | `exclude` |
| SECRET/SENSITIVE | `recreate_secrets` |

**Do not guess** on individual forex cert scripts under `scripts/` — default **include** if referenced by ops runbooks; exclude if purely historical cert runners.
