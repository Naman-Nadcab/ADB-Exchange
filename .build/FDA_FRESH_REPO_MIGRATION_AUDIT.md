# FDA Exchange — Fresh Git Repository Migration Forensic Audit

**Audit mode:** READ-ONLY (no git writes, no deploy, no code/config/DB changes)  
**Audit date:** 2026-09-30  
**Host inspected:** `/opt/m-live` (same host as live runtime `109.123.254.30`)  
**Branch (unchanged):** `release/exchange-production-baseline`  
**HEAD (unchanged):** `effd130cb716f3646600f6324beaf4ec6a32c47e`  
**Remotes:** `origin` → `Naman-Nadcab/m-live.git`; `product` → `Naman-Nadcab/metherium_final_v.1.git`

---

## Executive conclusion

The **working production stack is not representable by a single clean Git commit**. Runtime proof shows **three different “revisions”** in play:

| Signal | Value | Evidence |
|--------|--------|----------|
| Git HEAD | `effd130` (2026-09-24) | `git rev-parse HEAD` |
| `.deploy-rev` (stale) | `8ef5999` (2026-09-16) | file on disk; 89 commits behind HEAD |
| **Live frontend build** | **`a5156ff`** embedded in BUILD_ID | `docker exec exchange-frontend cat /app/.next/BUILD_ID` → suffix `a5156ff934e28c88…` |
| Host working tree | **821** status entries | 80 modified tracked + **2090** untracked (1902 under `.build/`) |
| **228** app/script paths | `REQUIRED_BUT_NOT_COMMITTED` | see `.build/dirty-path-classification.json` |

**Authoritative application source for migration** (preserve *current working system*):

1. **Minimum for customer UI parity with live containers:** Git tree at commit **`a5156ff`** (`feat(forex): finalize mt5 trader workstation`), **plus** any host-only changes under `apps/` still uncommitted at audit time.  
2. **Minimum for full VPS operational parity (backend bind-mount):** **Forensic working-tree snapshot** of `/opt/m-live` after **merging all `REQUIRED_BUT_NOT_COMMITTED` paths** — backend mounts `${COMPOSE_PROJECT_DIR:-.}:/opt/m-live:ro` (`docker-compose.production.yml`) and `infrastructure-executor.service.ts` defaults to `/opt/m-live`.  
3. **HEAD `effd130` alone is insufficient** for “exact live frontend” (drawing certification commit is **1 commit ahead** of deployed BUILD_ID) and **insufficient for backend/admin** without the 228 uncommitted app paths.

**Recommended migration model:** **Option B — curated working-tree copy** (not `git archive` at HEAD alone). See `FDA_FRESH_REPO_MIGRATION_RISK_MATRIX.json` and checklist.

---

## Section 2 — Authoritative source (answers A–E)

### A. Which commit represents correct application source?

| Goal | Commit / snapshot |
|------|-------------------|
| Match **running frontend image** | **`a5156ff`** (BUILD_ID proof) |
| Match **latest committed branch tip** | `effd130` (1 commit ahead of frontend; includes drawing e2e + chart fixes) |
| Match **`.deploy-rev` file** | **Do not use** — stale (`8ef5999`, 89 commits behind HEAD) |
| Match **live backend image** (Sep 24 build) | **Not byte-proven to a single SHA** — image digest `m-live-backend@sha256:cf33d68…` built 2026-09-24; host tree has **80 modified backend/forex files** vs HEAD |
| Match **live admin image** (Sep 20) | **Older than** current dirty admin forex panels — admin likely **behind** host working tree |

### B. Files only in dirty working tree?

- **2090 untracked** paths (`git ls-files --others --exclude-standard`).  
- **1902** are under **`.build/`** (audit/cert artifacts — not required for app runtime).  
- **135** untracked under **`apps/`** (plus **80 modified** tracked files).

### C. Dirty files required to reproduce working system?

**228 paths** classified `REQUIRED_BUT_NOT_COMMITTED` (129 backend, 47 frontend, 20 admin-panel, scripts, infra).  
Evidence: paths under `apps/`, `scripts/`, `infra/` with status `modified` or `untracked`. Full list: `.build/dirty-path-classification.json`.

**Why required:** Without them, a fresh clone at `effd130` **drops** forex/admin/backend changes that exist on the VPS host and may differ from baked Docker layers; backend **reads host compose tree** via bind mount.

### D. Unrelated / WIP?

- **~1902 `.build/` untracked** + many modified `.build/*` certification markdown/json — **historical audit output**, not build inputs.  
- Root-level `FOREX_*_REPORT.md`, `release-freeze-*.bundle` (219 MB), `release-backup/` — **release engineering / evidence**, excluded by policy.  
- **Cannot classify all 821 rows as WIP vs production** without product owner sign-off on the 228 `REQUIRED` set; treat unlisted `.build` as **OPTIONAL**.

### E. Deployed artifacts vs Git?

| Artifact | Runtime | vs Git |
|----------|---------|--------|
| Frontend image | `m-live-frontend@sha256:0f412e5ea488…` (2026-09-24) | BUILD_ID → **`a5156ff`**, not `effd130` |
| Backend image | `m-live-backend@sha256:cf33d68…` (2026-09-24) | No embedded SHA; host has **80 file delta** vs HEAD |
| Admin image | `m-live-admin-panel@sha256:3e35a878…` (2026-09-20) | **10 days older** than frontend; dirty admin forex UI on host |
| `.deploy-rev` | `8ef5999` | **Wrong** vs images and HEAD |
| PostgreSQL | 221 public tables, **no** `schema_migrations` | Schema from **`migrate.ts`** applies; **data not in repo** |
| Volumes | `m-live_postgres_data`, `redis`, `rabbitmq`, `engine_wal` | **Not in Git** |

---

## Section 3 — Repository inventory (summary)

Full component table lives in **`FDA_FRESH_REPO_COPY_MANIFEST.md`**. Tracked file count: **3605** (`git ls-files`); top roots: `apps/` 2431, `docs/` 649, `scripts/` 95, `e2e/` 77, `matching-engine/` 13, `packages/` 11.

**Dependency flow (unchanged architecture):**

```
USER → nginx → frontend → backend API → postgres / redis / nats / rabbitmq / matching-engine / indexer
ADMIN → nginx → admin-panel → backend (admin routes) → same data plane
Crypto spot → matching-engine + balance_ledger
Forex → mock/sim execution + forex_ledger_* (separate)
```

---

## Section 11 — Migration design (recommendation only — not executed)

**Option A (`git archive` at one commit):** **Rejected as sole method** — fails C/E above (dirty tree + BUILD_ID ≠ HEAD).

**Option B (forensic working-tree copy):** **Recommended.**

1. Freeze snapshot label (e.g. `fda-migration-20260930`).  
2. Export tree: all **`git ls-files`** at chosen base (**`effd130` or `a5156ff`**) **overlay** every path in `REQUIRED_BUT_NOT_COMMITTED`.  
3. Exclude: `.git`, `node_modules`, `.next`, `dist`, `target`, `.env`, volumes, bundles, `release-freeup-*`, default skip `.build/` except optional audit pack.  
4. New repo: `git init`, single root commit `main` or `release/production-baseline`.  
5. Recreate secrets from `.env.production.example` + secure store — **never copy `.env`**.  
6. CI: replace `ghcr.io/${{ github.repository_owner }}/exchange` and local `m-live-*` image names.  
7. DB: **pg_dump** for parity **or** fresh `migrate` + `seed-admin` + manual re-seed (loses users/forex accounts).  
8. Boot: `scripts/vps-first-boot.sh` on new VPS.  
9. Smoke: `/health`, `/forex/trade`, spot smoke, admin login.

---

## Section 18 — Explicit answers (1–19)

| # | Question | Answer |
|---|----------|--------|
| 1 | **Exact source snapshot?** | **Curated host snapshot**: base **`effd130`** (or **`a5156ff`** if strict live-frontend match) **+ all 228 `REQUIRED_BUT_NOT_COMMITTED` paths**. |
| 2 | **Files must copy?** | See **`FDA_FRESH_REPO_COPY_MANIFEST.md`** (`MUST COPY` / `SHOULD COPY`). |
| 3 | **Dirty files recover before copy?** | **228** under `apps/`, `scripts/`, `infra/` — listed in classification JSON. |
| 4 | **Dirty files must NOT copy?** | ~**1902** untracked `.build/*`, modified `.deploy-rev`, deploy backup scripts at root (optional). |
| 5 | **Never copy?** | `.git`, secrets, DB/queue/WAL volumes, `node_modules`, build outputs, `release-freeze-*.bundle`, production `.env`. |
| 6 | **Regenerate?** | `node_modules`, `.next`, `dist`, Rust `target`, `.deploy-rev`, Playwright reports, Docker images after build. |
| 7 | **Secrets recreate?** | **162+** names in `.env.production.example`; **required** set in `scripts/vps-first-boot.sh` (JWT, CSRF, ENGINE_HMAC, KMS, etc.). |
| 8 | **External services reconnect?** | AWS KMS, chain RPC/indexer, email/SMS, KYC/AML providers, webhooks — matrix in **`FDA_FRESH_REPO_EXTERNAL_DEPENDENCIES.md`**. |
| 9 | **DB rebuild from zero?** | **Schema: YES** (`migrate.ts`). **Production parity data: NO** without dump. Details: **`FDA_FRESH_REPO_DATABASE_REBUILD_AUDIT.md`**. |
| 10 | **Stack on fresh VPS?** | **YES** with manual env, TLS, provider keys, migrate, seed — **`FDA_FRESH_REPO_INFRA_REPRODUCIBILITY.md`**. |
| 11 | **Live-only, not in repo?** | `.env`, DB rows, Docker volumes, engine WAL, optional TLS certs, KMS-managed keys, P2P proof uploads (`apps/backend/data/p2p-payment-proofs/`). |
| 12 | **In repo, not needed for deploy?** | Root `*_AUDIT.md` corpus, `audit/`, most `.build/`, `release-backup/`, `*.bundle`, mobile if not shipping. |
| 13 | **Old lineage remove?** | **`FDA_FRESH_REPO_LINEAGE_AUDIT.md`** — `m-live` images, `m-live.git`, `metherium_final_v.1`, `crypto-exchange` package name. |
| 14 | **Copy procedure?** | **Option B** curated rsync/tar from forensic snapshot (documented in checklist). |
| 15 | **Fresh repo structure?** | **`FDA_FRESH_REPO_TARGET_TREE.md`** — largely same layout, minus excluded dirs. |
| 16 | **Blockers?** | Uncommitted app code; no single SHA; stale deploy metadata; external DB/secrets; image/registry rename. |
| 17 | **Copy immediately?** | Tracked tree at `effd130` **minus** exclusions — **incomplete** vs live. |
| 18 | **Resolve before copy?** | Decide frontend base (`a5156ff` vs `effd130`); inventory 228 files; export env var template; plan DB dump. |
| 19 | **After copy only?** | New remote, CI secrets, GHCR namespace, DNS/webhooks, TLS, provider allowlists, production data restore. |

---

## Related artifacts

| File | Purpose |
|------|---------|
| `FDA_FRESH_REPO_COPY_MANIFEST.md` | MUST/SHOULD/DO NOT copy lists |
| `FDA_FRESH_REPO_DIRTY_WORKTREE_CLASSIFICATION.md` | 821-path forensic summary |
| `dirty-path-classification.json` / `.csv` | Per-path classification |
| `FDA_FRESH_REPO_RUNTIME_RECONCILIATION.md` | Git vs containers vs host |
| `FDA_FRESH_REPO_DATABASE_REBUILD_AUDIT.md` | Zero DB reconstruction |
| `FDA_FRESH_REPO_EXTERNAL_DEPENDENCIES.md` | Provider matrix |
| `FDA_FRESH_REPO_INFRA_REPRODUCIBILITY.md` | Fresh VPS requirements |
| `FDA_FRESH_REPO_LINEAGE_AUDIT.md` | Rename vs retain |
| `FDA_FRESH_REPO_TARGET_TREE.md` | Target directory map |
| `FDA_FRESH_REPO_MIGRATION_RISK_MATRIX.json` | Risks and mitigations |
| `FDA_FRESH_REPO_FINAL_CHECKLIST.md` | Operational steps |

**AUDIT COMPLETE:** YES (forensic documentation only; repository state unchanged except new `.build/FDA_FRESH_REPO_*` audit files and classification exports).
