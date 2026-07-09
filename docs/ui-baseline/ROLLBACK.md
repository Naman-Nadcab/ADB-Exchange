# Rollback Instructions — UI Baseline (pre Tier-1 polish)

**Snapshot date:** 2026-06-25  
**Commit:** `770cc8910d623433e2b7d6487faf5a1ec4170620`  
**Tag:** `ui-stable-before-tier1-polish`  
**Branch:** `backup/ui-before-tier1-polish-20260625`

Everything below is **local only** (not pushed).

---

## Option A — Checkout backup branch

```bash
cd /opt/m-live

# Save current work (recommended)
git stash push -u -m "WIP before UI rollback"

git checkout backup/ui-before-tier1-polish-20260625
```

Return to active development branch:

```bash
git checkout deployment/vps-first-boot
git stash pop   # if you stashed
```

---

## Option B — Checkout annotated tag (detached HEAD)

```bash
cd /opt/m-live
git stash push -u -m "WIP before UI rollback"
git checkout ui-stable-before-tier1-polish
```

Create a recovery branch from tag (optional):

```bash
git checkout -b restore/ui-from-baseline ui-stable-before-tier1-polish
```

---

## Option C — Reset current branch to baseline (destructive)

**Warning:** Discards commits after `770cc891` on the current branch.

```bash
cd /opt/m-live
git stash push -u -m "WIP before hard reset"
git reset --hard ui-stable-before-tier1-polish
```

---

## Rebuild frontend after rollback

If Docker images were built from newer code:

```bash
cd /opt/m-live
docker compose -f docker-compose.production.yml build frontend
docker compose -f docker-compose.production.yml up -d frontend
```

---

## Verify rollback

```bash
git rev-parse HEAD
# Expected: 770cc8910d623433e2b7d6487faf5a1ec4170620

git log -1 --oneline
# Expected: Sync production stabilization fixes into git for launch readiness.
```

---

## Tag metadata

```bash
git show ui-stable-before-tier1-polish --no-patch
```

---

## Notes

- Uncommitted files at snapshot time are documented in `SNAPSHOT-STATUS.md`.
- Tag does **not** include `docs/ui-baseline/` unless you commit this folder separately.
- Do not force-push tags unless you explicitly intend to rewrite remote history.
