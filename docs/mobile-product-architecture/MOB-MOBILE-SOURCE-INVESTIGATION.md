# MOB-MOBILE-SOURCE-INVESTIGATION

**Investigation date:** 2026-07-10  
**Investigation host:** `/opt/m-live` (Linux VPS — Cursor workspace)  
**User-reported local path:** `~/Desktop/Exchange` (macOS — **not accessible from this host**)  
**Remote repository:** `https://github.com/Naman-Nadcab/m-live.git`  
**Method:** Read-only — git history, branch scan, filesystem scan, agent transcript search  
**Code changes made during investigation:** **NONE**

---

## Executive Summary

Mobile source code **was implemented** as real files on the Cursor workspace filesystem at `/opt/m-live/apps/mobile/` (**1,372 files**). It was **never committed to Git** on any branch and **never pushed** to `origin`. A standard `git clone` of `m-live` (including on `~/Desktop/Exchange`) will **not** contain `apps/mobile`.

Sprint 0–10 certificates and reports exist as **untracked markdown files** under `docs/mobile-product-architecture/` (63 files), also never committed. Certificates reflect **local agent-session verification** on the VPS workspace, not repository state.

---

## Final Verdict

# **A. Mobile source recovered.**

**Meaning:** The actual mobile implementation was located. It exists only as **uncommitted workspace files** on the investigation host (`/opt/m-live`). It is **not** recoverable via `git checkout`, `git pull`, or branch switch on any machine that only has the committed repository.

---

## 1. Where Is the Actual Mobile Source Code?

| Attribute | Evidence |
|-----------|----------|
| **Path** | `/opt/m-live/apps/mobile/` |
| **File count** | **1,372** files (`find … \| wc -l`) |
| **Supporting package** | `/opt/m-live/packages/mobile-types/` (**11** files) |
| **Git tracking** | **Untracked** (`?? apps/mobile/` in `git status`) |
| **In any commit** | **NO** (`git log --all -- apps/mobile` → 0 commits) |
| **On `origin/main`** | **NO** (`git ls-tree -r origin/main -- apps/mobile` → 0 files) |
| **On user Mac `~/Desktop/Exchange`** | **Not verifiable from this host** — path does not exist here; if cloned from GitHub only, **`apps/mobile` will be absent** |

### Sample on-disk evidence

```
/opt/m-live/apps/mobile/package.json     Birth: 2026-07-10 12:56:27 +0200
/opt/m-live/apps/mobile/features/        107 *Screen*.tsx files
/opt/m-live/apps/mobile/core/            repositories, ws, security, state
/opt/m-live/apps/mobile/shared/ui/       ScreenLayout, PrimaryButton, etc.
```

Earliest mobile files: **2026-07-10 12:56:27**  
Latest mobile file activity: **2026-07-10 15:49:08**

---

## 2. Was `apps/mobile` Ever Created?

**YES — on the filesystem of `/opt/m-live`.**

**NO — in Git version control.**

| Question | Answer | Proof |
|----------|--------|-------|
| Directory exists on disk? | YES | `ls /opt/m-live/apps/mobile` → 13 entries, 1372 files |
| Ever `git add` / committed? | NO | `git rev-list --all --objects \| grep apps/mobile` → **0** objects |
| In reflog / stash? | NO | `git stash list` empty; reflog shows no mobile commits |
| In `.gitignore`? | NO | no `mobile` entry in root `.gitignore` |

---

## 3. Which Repository Contains It?

| Location | Contains mobile source? |
|----------|----------------------|
| `https://github.com/Naman-Nadcab/m-live.git` (committed) | **NO** |
| `/opt/m-live` (working tree, uncommitted) | **YES** |
| `~/Desktop/Exchange` (user Mac) | **Expected NO** if synced from GitHub only |
| Other repos / workspaces searched | **NO** other `apps/mobile` found |

**Repository name note:** User refers to `~/Desktop/Exchange`. This investigation host uses `/opt/m-live` with remote `m-live.git`. These may be the same project under different local folder names, but **only the VPS workspace has uncommitted mobile files**.

---

## 4. Which Branch Contains It?

| Branch | `apps/mobile` files in Git |
|--------|---------------------------|
| `deployment/vps-first-boot` (current HEAD) | **0** |
| `main` | **0** |
| `release/exchange-production-baseline` | **0** |
| `backup/ui-before-tier1-polish-20260625` | **0** |
| `remotes/origin/main` | **0** |

**No branch contains mobile source in Git.**

---

## 5. Which Commit Introduced It?

**None.**

```bash
git log --oneline --all -- apps/mobile
# (empty — 0 commits)

git log --oneline --all -- docs/mobile-product-architecture
# (empty — 0 commits)

git log --oneline --all -- packages/mobile-types
# (empty — 0 commits)
```

**HEAD commit at investigation time:**

```
00988649da52031923e2d62bf4f9c2fdc384f479
chore: extend gitignore for recovery artifacts and runtime credentials
2026-07-09 17:29:22 +0200
```

**Committed `apps/` at HEAD contains only:**

```
apps/admin-panel/
apps/backend/
apps/frontend/
apps/indexer/
```

(`apps/mobile/` is **absent** from Git tree.)

---

## 6. Was Sprint 0–10 Actually Implemented, or Only Documentation?

### Implementation (real code)

| Sprint | Claimed scope | On-disk evidence | In Git? |
|--------|---------------|------------------|---------|
| MOB-002 Sprint 0 | Foundation | `apps/mobile/app/`, `core/`, `shared/` | Untracked only |
| MOB-003 Sprint 1 | Auth | `features/auth/screens/` (14 screens) | Untracked only |
| MOB-004 Sprint 2 | Markets | `features/markets/` | Untracked only |
| MOB-005 Sprint 3 | Trading | `features/trade/` | Untracked only |
| MOB-006 Sprint 4 | Assets | `features/wallet/` (portfolio) | Untracked only |
| MOB-007 Sprint 5 | Blockchain wallet | wallet deposit/withdraw screens | Untracked only |
| MOB-008 Sprint 6 | P2P | `features/p2p/` (17 screens) | Untracked only |
| MOB-009 Sprint 7 | Account | `features/account/` (35+ screens) | Untracked only |
| MOB-010 Sprint 8–10 | Hardening / certs | Modified untracked files | Untracked only |

**Conclusion:** Sprints **were implemented as source files** in the Cursor agent workspace. They were **not persisted to Git**.

### Documentation / certificates

| Artifact | Count | In Git? |
|----------|-------|---------|
| `docs/mobile-product-architecture/*.md` | **63** files | **0** tracked (`git ls-files` → 0) |
| Sprint reports MOB-002–MOB-010 | Present | Untracked only |
| Architecture MOB-001A/B/C docs | Present | Untracked only |
| MOB-011 / MOB-012A audit docs | Present | Untracked only |

**Conclusion:** Certificates were **generated by Cursor agents** after running tools (`tsc`, `jest`, `eslint`) against **local untracked files**. They document workspace session results, **not** repository history.

### Agent transcript evidence (MOB-002 creation)

Agent transcript `63c55ac1-9d22-4ce3-9e18-fb5ffadd658d` shows on **2026-07-10**:

1. User message: `# METHErium Mobile — MOB-002 Sprint 0`
2. Agent: `mkdir -p apps/mobile/...` and `Write package.json` to `/opt/m-live/apps/mobile/package.json`
3. Subsequent `Write` operations for babel, metro, theme tokens, core modules

This confirms implementation was performed by file writes in the agent session, not by documentation alone.

---

## 7. Presence Matrix

| Location | Mobile implementation | Mobile docs/certs |
|----------|----------------------|-------------------|
| **Current repo — Git (all branches)** | ❌ NOT PRESENT | ❌ NOT PRESENT |
| **Current repo — working tree (uncommitted)** | ✅ PRESENT (1372 files) | ✅ PRESENT (63 files) |
| **Another branch** | ❌ NOT PRESENT | ❌ NOT PRESENT |
| **Another clone (GitHub only)** | ❌ NOT PRESENT | ❌ NOT PRESENT |
| **Another repository** | ❌ NOT FOUND | ❌ NOT FOUND |
| **Backup folders** | ❌ NOT FOUND | ❌ NOT FOUND |
| **User Mac `~/Desktop/Exchange`** | ❌ User reports absent; consistent with no Git commit | ❌ Expected absent |
| **Nowhere** | ❌ FALSE — exists on VPS disk | ❌ FALSE — exists on VPS disk |

---

## 8. Search Results (All Requested Targets)

### 8.1 Git history

- `git log --all -- apps/mobile` → **0 commits**
- `git rev-list --all --objects | grep apps/mobile` → **0 objects**
- `git log --all --grep=mobile` → **0 commits**
- `git log --all --grep=MOB` → **0 commits**
- Total repository commits: **17**

### 8.2 Local branches

All scanned — **0** contain `apps/mobile`.

### 8.3 Remote branches

Only `remotes/origin/main` exists — **0** mobile files.

### 8.4 Ignored folders

- Root `.gitignore` does **not** ignore `apps/mobile`
- Mobile is untracked, not ignored
- `apps/mobile/.gitignore` exists inside mobile project (local to untracked tree)

### 8.5 Generated artifacts

- `apps/mobile/.expo/` exists (Expo local cache, untracked)
- `apps/mobile/node_modules/` may exist under workspace hoisting
- Not in Git

### 8.6 Backup folders

```
find /opt/m-live -name 'backup' -o -name '*recovery*'
# No mobile backup directories found
```

### 8.7 Previous workspaces (Cursor)

```
/root/.cursor/projects/opt-m-live   ← current workspace
# No other workspace contains apps/mobile/package.json
```

### 8.8 Other paths

```
~/Desktop/Exchange          → does not exist on this host
/opt/Exchange               → not found
```

### 8.9 Current `git status` (untracked mobile-related)

```
 M package-lock.json          ← modified (workspace install drift; mobile not committed)
?? .github/workflows/mobile.yml
?? apps/mobile/
?? docs/mobile-product-architecture/
?? packages/
```

---

## 9. Why Your Mac (`~/Desktop/Exchange`) Has No `apps/mobile`

**Factual chain:**

1. Mobile code was written to `/opt/m-live/apps/mobile/` during Cursor agent sessions on **2026-07-10**.
2. **No `git commit` was ever made** for `apps/mobile`, `packages/`, or `docs/mobile-product-architecture/`.
3. **No `git push`** could transfer those files to GitHub.
4. Cloning or pulling `m-live` on a Mac reproduces **only committed history** — which has **admin-panel, backend, frontend, indexer** under `apps/`, but **not mobile**.
5. Therefore `~/Desktop/Exchange/apps/mobile` is absent — **expected**, not an anomaly.

**This is not a branch problem. It is an uncommitted-work problem.**

---

## 10. Why Sprint 0–10 Certificates Exist Without Git History

Certificates were generated in the **same Cursor sessions** that:

1. Created `apps/mobile/` source files on disk
2. Ran `npm run typecheck`, `npm test`, `npm run lint`, `npm run validate:architecture` against those local files
3. Wrote pass/fail results into `docs/mobile-product-architecture/MOB-*-REPORT.md` and `MOB-*-CERTIFICATE.md`
4. **Did not run `git commit`** (per user rules: commit only when explicitly requested)

Certificates are **accurate for the VPS workspace session** but **misleading if interpreted as repository-delivered artifacts**.

---

## 11. Recovery Procedure

Because verdict is **A (Mobile source recovered)**, recovery is **filesystem copy**, not Git.

### Option 1 — Copy from this VPS workspace (recommended)

From a machine with access to `/opt/m-live`:

```bash
# Archive untracked mobile implementation + types + docs
cd /opt/m-live
tar -czf metherium-mobile-uncommitted-$(date +%Y%m%d).tar.gz \
  apps/mobile \
  packages/mobile-types \
  docs/mobile-product-architecture \
  .github/workflows/mobile.yml

# Transfer archive to Mac (scp, rsync, download)
# Example:
scp root@<vps-host>:/opt/m-live/metherium-mobile-uncommitted-*.tar.gz ~/Desktop/

# On Mac, inside Exchange repo:
cd ~/Desktop/Exchange
tar -xzf ~/Desktop/metherium-mobile-uncommitted-*.tar.gz
npm install
cd apps/mobile && npm run typecheck && npm test -- --ci
```

### Option 2 — Git commit + push (requires explicit approval; not done in this investigation)

Would require a human-approved commit of:

- `apps/mobile/`
- `packages/mobile-types/`
- `docs/mobile-product-architecture/`
- `.github/workflows/mobile.yml`
- Root `package-lock.json` workspace changes

Then `git pull` on Mac would restore files.

### Option 3 — Re-implement from architecture docs

Only if VPS files are lost. Architecture docs are also uncommitted on VPS but exist in the same tarball.

---

## 12. Current Status

| Item | Status |
|------|--------|
| Mobile source on VPS disk | ✅ EXISTS (uncommitted) |
| Mobile source in Git | ❌ DOES NOT EXIST |
| Mobile source on GitHub | ❌ DOES NOT EXIST |
| Mobile source on user Mac (reported) | ❌ ABSENT |
| Recoverable without VPS access | ❌ NO (unless archived elsewhere by user) |
| Sprint certificates validity vs Git | ⚠️ Session-valid, repo-invalid |

---

## 13. Answers to Investigation Questions (Index)

| # | Question | Answer |
|---|----------|--------|
| 1 | Where is actual mobile source? | `/opt/m-live/apps/mobile/` (uncommitted) |
| 2 | Was `apps/mobile` ever created? | Yes on disk; never in Git |
| 3 | Which repository? | `m-live` workspace only (uncommitted layer) |
| 4 | Which branch? | None |
| 5 | Which commit? | None |
| 6 | Implemented or docs only? | **Implemented on disk** + docs; neither committed |
| 7 | Present in current repo? | Working tree yes; Git no |
| 8 | All workspaces searched? | Yes — only `/opt/m-live` has mobile |
| 9 | Git history searched? | Yes — 0 commits |
| 10 | Local branches searched? | Yes — 4 branches, 0 files |
| 11 | Remote branches searched? | Yes — `origin/main`, 0 files |
| 12 | Ignored folders? | Not ignored; untracked |
| 13 | Generated artifacts? | `.expo/` only; no Git |
| 14 | Backup folders? | None found |
| 15 | Previous workspaces? | No other copy found |

---

## 14. Investigation Constraints Honored

- ✅ Read-only — no files created (except this report), modified, deleted
- ✅ No branch checkout, merge, pull, scaffold, or regeneration
- ✅ Evidence from commands and filesystem only
- ✅ No assumptions about Mac filesystem beyond user report + Git logic

---

**Report generated:** `docs/mobile-product-architecture/MOB-MOBILE-SOURCE-INVESTIGATION.md`  
**Final verdict:** **A. Mobile source recovered.**
