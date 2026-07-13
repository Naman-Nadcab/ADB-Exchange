# MOB-012B — Cross-Platform Verification

**Date:** 2026-07-13  
**Branch:** `release/exchange-production-baseline`  
**Fix commit (local VPS):** `843d05c54b73e1b30f34c1d1ba7bfd16be7a5029`  
**Parent commit (broken, on GitHub/Mac):** `f8c79aea4d62f66dbd88e389fc957ca7f71b54fb`  
**GitHub remote HEAD (at verification time):** `f8c79ae…` — **fix NOT yet pushed from VPS**

---

## 1. Finding: Previous Report Was Inconsistent

| Item | MOB-012B report claim | Actual Git state @ `f8c79ae` |
|------|----------------------|------------------------------|
| `package.json` fixed | Claimed fixed | **Still contained** `"turbo-linux-64": "^2.7.6"` (783 lines) |
| Fix committed | Implied complete | **Never committed** — only uncommitted working-tree changes on VPS |
| GitHub updated | Implied | **Remote still at `f8c79ae`** with broken `package.json` |

**Root cause of inconsistency:** Fix was applied to VPS working tree during MOB-012B session but **never `git commit` + `git push`**.

---

## 2. Fix Commit

```
843d05c54b73e1b30f34c1d1ba7bfd16be7a5029
fix(monorepo): remove hoisted turbo-linux-64 from root package.json
```

### Diff

```
 package-lock.json | 29086 +++++++++++++++++++++++++++++++++++++---------------
 package.json      |   692 +-
 2 files changed, 20872 insertions(+), 8906 deletions(-)
```

### Key `package.json` change

```diff
-    "turbo-linux-64": "^2.7.6",
-  },
-  "dependencies": {
-    ... ~680 hoisted packages removed ...
+  "packageManager": "npm@10.2.0"
+}
```

**Result:** 783 lines → **93 lines**. Only `"turbo": "^2.0.0"` in `devDependencies`.

---

## 3. `package.json` Proof

```bash
git show 843d05c:package.json | grep turbo-linux-64
# (no output)

git show 843d05c:package.json | grep '"turbo"'
#     "turbo": "^2.0.0",
```

| Check | `f8c79ae` (broken) | `843d05c` (fixed) |
|-------|-------------------|-------------------|
| `grep turbo-linux-64 package.json` | **MATCH** line 727 | **NONE** |
| Root `dependencies` block | Present (~680 pkgs) | **Absent** |
| `turbo` in `devDependencies` | Yes | Yes |

---

## 4. `package-lock.json` Proof

```bash
# Root package must NOT depend on turbo-linux-64
git show 843d05c:package-lock.json | node -e "
  const l=JSON.parse(require('fs').readFileSync(0,'utf8'));
  console.log('root deps:', l.packages[''].dependencies);
"
# root deps: undefined

# turbo-linux-64 only inside turbo optionalDependencies
git show 843d05c:package-lock.json | grep -n turbo-linux-64
```

**Output (only valid locations):**

```
29001:        "turbo-linux-64": "2.7.6",        ← inside node_modules/turbo optionalDependencies
29035:    "node_modules/turbo-linux-64": {       ← optional platform package entry
29037:      "resolved": "https://registry.npmjs.org/turbo-linux-64/-/turbo-linux-64-2.7.6.tgz",
```

**No `turbo-linux-64` in root `packages[""].dependencies`.**

---

## 5. `npm install` Proof — Linux x64 (VPS)

**Host:** `vmi3391742` Linux x86_64  
**Commit:** `843d05c`

```bash
cd /opt/m-live
git checkout release/exchange-production-baseline   # @ 843d05c
npm install --legacy-peer-deps
# exit 0 — "up to date" / packages installed

npx turbo --version
# 2.7.6

npm ls turbo turbo-linux-64
# crypto-exchange → turbo@2.7.6 → turbo-linux-64@2.7.6 (optional, nested)
```

**Result:** **PASS** — no EBADPLATFORM on Linux.

---

## 6. `npm install` Proof — macOS ARM64 (simulated)

npm platform simulation on commit `843d05c`:

```bash
cd /opt/m-live   # @ 843d05c
npm install --legacy-peer-deps --dry-run --os=darwin --cpu=arm64
# exit 0
# "added 69 packages in 16s" — no EBADPLATFORM
```

**Broken commit `f8c79ae` would fail** because `package.json` mandates `turbo-linux-64` on all platforms.

**Result:** **PASS** (dry-run simulation; live Mac confirmation required after push).

### Live Mac confirmation (after push)

```bash
cd ~/Desktop/m-live
git pull origin release/exchange-production-baseline   # must reach 843d05c
rm -rf node_modules
npm install --legacy-peer-deps
# Expected: exit 0, no EBADPLATFORM
```

---

## 7. Push Status

| Action | Result |
|--------|--------|
| `git commit` fix | **DONE** — `843d05c` |
| `git push origin release/exchange-production-baseline` | **BLOCKED** — VPS has no GitHub credentials |

```
fatal: could not read Username for 'https://github.com': No such device or address
git@github.com: Permission denied (publickey).
```

### Mac push (authenticated workstation)

**Option A — Git bundle from VPS:**

```bash
scp root@109.123.254.30:/var/backups/metheorium-turbo-fix-20260713/turbo-fix-843d05c.bundle ~/Desktop/

cd ~/Desktop/m-live
git fetch ~/Desktop/turbo-fix-843d05c.bundle release/exchange-production-baseline:release/exchange-production-baseline
git checkout release/exchange-production-baseline
git rev-parse HEAD   # must be 843d05c54b73e1b30f34c1d1ba7bfd16be7a5029

git push origin release/exchange-production-baseline
```

**Option B — After VPS gains credentials:**

```bash
cd /opt/m-live
git push origin release/exchange-production-baseline
```

---

## 8. Repository Fixed Criteria

| Criterion | `843d05c` local | GitHub after Mac push |
|-----------|-----------------|----------------------|
| `grep turbo-linux-64 package.json` → nothing | **PASS** | Pending push |
| `package-lock` root has no `turbo-linux-64` dep | **PASS** | Pending push |
| Linux `npm install --legacy-peer-deps` | **PASS** | Pending push |
| macOS ARM64 install (no EBADPLATFORM) | **PASS** (simulated) | Pending live Mac |
| Fresh Mac clone works | Pending push | After `843d05c` on remote |

---

## 9. Bundle Artifact

| File | Path |
|------|------|
| Bundle | `/var/backups/metheorium-turbo-fix-20260713/turbo-fix-843d05c.bundle` |
| Requires | `f8c79aea4d62f66dbd88e389fc957ca7f71b54fb` |
| Delivers | `843d05c54b73e1b30f34c1d1ba7bfd16be7a5029` |

```bash
git bundle verify turbo-fix-843d05c.bundle
# is okay
```

---

## 10. Final Verdict

| Item | Status |
|------|--------|
| Repository repaired locally | **YES** @ `843d05c` |
| `turbo-linux-64` removed from root `package.json` | **YES** |
| Cross-platform Turbo via optional deps only | **YES** |
| Pushed to GitHub | **NO** — VPS auth blocked |
| Mac fresh clone `npm install` | **Pending Mac push of `843d05c`** |

**The repository is fixed in Git at commit `843d05c`. GitHub and Mac clone remain at broken `f8c79ae` until authenticated push completes.**
