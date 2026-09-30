# ADB-Exchange Exact Clone — Forensic Report

**Generated:** 2026-09-30  
**Clone workspace:** `/opt/adb-exchange-clone` (SOURCE `/opt/m-live` untouched)

---

## A. SOURCE

| Field | Value |
|-------|--------|
| Repository | `/opt/m-live` |
| GitHub (origin) | `git@github.com:Naman-Nadcab/m-live.git` |
| Branch | `release/exchange-production-baseline` |
| Commit (unchanged) | `effd130cb716f3646600f6324beaf4ec6a32c47e` |
| Working tree | **834** dirty paths (same as pre-clone) |
| Runtime | VPS `109.123.254.30` — **not modified** by this task |
| SOURCE new commits | **NO** |

---

## B. TARGET

| Field | Value |
|-------|--------|
| Repository | `https://github.com/Naman-Nadcab/ADB-Exchange` |
| Remote name | `target` |
| Branch | `release/exchange-production-baseline` |
| Commit | `bd864de0730dadb42440ce70b8012f1c813dea4f` |
| Parent history | Full ancestry through `effd130` + sync commit |
| Local clone | `/opt/adb-exchange-clone` |

---

## C. COPY RESULT

| Check | Status | Evidence |
|-------|--------|----------|
| Git history transferred | **PASS** | Branches + tags pushed to `target` |
| Working tree parity (filesystem) | **PASS** | SHA256 walk: **10355** files; **0** missing; **2** log diffs only |
| Git tracked+sync commit | **PASS** | Sync commit adds **2183** paths vs `effd130` |
| Configuration file names | **PASS** | `.env.example`, `.env.production.example` copied; rsync overlay |
| Docker files | **PASS** | Byte-identical except runtime logs |
| `migrate.ts` | **PASS** | In sync commit under `apps/backend/src/database/` |
| Lockfiles | **PASS** | `package-lock.json` in repo |
| npm ci | **PASS** | Completed in clone |
| Backend build | **PASS** | `npm run build --workspace=@exchange/backend` |
| docker compose config | **BLOCKED** | `DOCKER_GID` not set in `.env` (same class of issue on SOURCE without env) |

**SECRET/ENVIRONMENT-SPECIFIC VALUE DETECTED — PRESERVED ON DISK, EXCLUDED FROM GIT:** `.env` (gitignored, rsync copied to clone workspace only, not pushed).

---

## D. VPS RESULT

| Item | Status |
|------|--------|
| TARGET deploy to staging VPS | **NOT RUN** |
| Reason | Only production host available; deploy would risk SOURCE stack |
| SOURCE production | **Untouched** (no compose down, no migrations) |

---

## E. DIFFERENCES

### 1. Intentional / environment

- `.env` — present on disk in SOURCE and clone; **not in Git** (`.gitignore`)
- `node_modules/` — generated in clone via `npm ci`; not committed
- `apps/backend/logs/*.log` — **2 files** differ (live runtime append)

### 2. Source vs target Git

- TARGET tip **`bd864de`** = SOURCE **`effd130`** + 1 sync commit (uncommitted SOURCE files now committed on TARGET only)
- SOURCE still shows **834** uncommitted paths relative to **`effd130`**

### 3. Infrastructure

- None introduced by clone operation

### 4. Unresolved

- Full `npm run build` (all workspaces) — **NOT RUN** (time); backend only verified
- Frontend/admin Docker image build — **NOT RUN**
- End-to-end VPS parity — **NOT RUN**

---

## F. BLOCKERS

- No isolated staging VPS for TARGET deploy verification
- `DOCKER_GID` / full `.env` required for `docker compose config` without placeholders
- GitHub CLI not authenticated on host (`gh auth login`) — push used SSH to `target` only

---

## G. GIT PERSISTENCE

```text
TARGET BRANCH: release/exchange-production-baseline
TARGET COMMIT: bd864de0730dadb42440ce70b8012f1c813dea4f
TARGET REMOTE: git@github.com:Naman-Nadcab/ADB-Exchange.git
PUSH STATUS: SUCCESS (branch, all legacy branches, tags); accidental branch source-readonly deleted on remote
WORKTREE STATUS: clean (in /opt/adb-exchange-clone)
SOURCE MODIFIED: NO (no new commits on /opt/m-live)
UNTRACKED FILES: SOURCE still has 834 dirty entries vs effd130; TARGET clean at bd864de
REMAINING DIFFERENCES: SOURCE uncommitted state vs TARGET committed in bd864de; .env disk-only; 2 log files
```

**Remotes in clone:** `source-readonly` fetch-only from `/opt/m-live`, push disabled; `target` → ADB-Exchange.

---

## H. FINAL VERDICT

**EXACT COPY — RUNTIME VERIFICATION BLOCKED**

Repository and working-tree content are replicated on GitHub with history and sync commit; production VPS deploy and full compose/build matrix were not executed to avoid impacting SOURCE.
