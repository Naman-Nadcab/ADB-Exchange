# UI Baseline Snapshot Status

**Created:** 2026-06-25  
**Snapshot commit:** `770cc8910d623433e2b7d6487faf5a1ec4170620`  
**Parent branch:** `deployment/vps-first-boot`  
**Backup branch:** `backup/ui-before-tier1-polish-20260625`  
**Annotated tag:** `ui-stable-before-tier1-polish`

## Working tree at snapshot time

Git reported **uncommitted changes** when this snapshot was taken. The tag and backup branch point to the **last committed** state (`770cc891`), not local modifications.

### Modified (not in tag)

- `apps/frontend/src/**` — auth, home, headers, trade grid (session fixes)
- `apps/backend/src/lib/auth-cookies.ts`, `auth.fastify.ts`
- Various report/checklist markdown files

### Untracked (not in tag)

- `apps/frontend/src/lib/authLogout.ts`
- Multiple `*_REPORT.md` files
- `docs/ui-baseline/` (this documentation set)

To include current working-tree files in a future snapshot, commit or stash first, then re-tag.

## Rollback scope

| Target | Restores |
|--------|----------|
| `ui-stable-before-tier1-polish` | Committed code at `770cc891` |
| `backup/ui-before-tier1-polish-20260625` | Same commit on a named branch |

Local uncommitted edits are **not** reverted by checkout; use `git stash` or `git restore` separately.
