# Phase 4 predeploy

**Date (UTC):** 2026-09-18T21:52:00Z

## Decision

**No Forex backend/frontend redeploy required** for Phase 4 runtime certification pass.

Runtime evidence was collected against the **Phase 3 certified backend image**:

- `sha256:1f04a223afccf729a8573866e7ef8cb7b216d911e22f1860c52934fad33e0e5b`

## Workspace-only changes (not in running container)

Targeted test harness fixes for **24x5 session gate** (unit tests only):

- `forex-phase104-preview.test.ts`
- `forex-phase5.test.ts`
- `forex-phase7.test.ts`
- `forex-phase8.test.ts`

These do not alter production risk logic; they align in-memory tests with Phase 3 session validation.

## Checks

| Check | Result |
|--------|--------|
| DB migration required | No |
| Seed required | No |
| Crypto services changed | No (SHA match Phase 3) |
| REAL_FOREX | OFF |
| Execution | MOCK / SIMULATED |
| Container health | healthy |

## When to redeploy

Redeploy only if Phase 4 **implementation** fixes (outside test harness) are merged and need runtime proof on a new digest.
