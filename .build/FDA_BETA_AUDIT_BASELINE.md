# FDA Beta Audit — Safety Baseline

**Audit mode:** READ-ONLY  
**Timestamp:** 2026-09-30 (UTC)  
**Repository:** `/opt/m-live`

## Git

| Field | Value |
|--------|--------|
| Branch | `release/exchange-production-baseline` |
| HEAD | `effd130cb716f3646600f6324beaf4ec6a32c47e` |
| Remote | `origin` → `github.com:Naman-Nadcab/m-live.git` |

## Working tree (not modified by audit)

| Category | Count / note |
|----------|----------------|
| Modified + untracked (approx.) | **808** paths (`git status --short`) |
| Staged | **0** (audit did not stage) |
| Notable dirty areas | `.build/*`, `apps/admin-panel/*`, `apps/backend/*`, docs, scripts — **large divergence from clean HEAD** |

## Deploy tracking file (historical)

| File | SHA |
|------|-----|
| `.deploy-rev` | `8ef599983974e84679bf44010ca3d8154785665a` (**≠ current HEAD `effd130`**) |

## Audit constraints observed

- No source/config/DB/Docker changes
- No deploy, commit, push, migrations, or service restarts
- DB: **read-only** `SELECT` only (sample counts)

## Runtime host (observed, not restarted)

| Service | Status (docker ps) |
|---------|---------------------|
| exchange-frontend | Up, healthy |
| exchange-backend | Up, healthy |
| exchange-nginx | Up, healthy |
| exchange-postgres | Up, healthy |
| exchange-matching-engine | Up, healthy |
| exchange-nats | Up, healthy |
| exchange-admin | Up, healthy |
| exchange-indexer | Up, healthy |

**Public URL probed:** `http://109.123.254.30`
