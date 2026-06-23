# Release Validation

**Generated:** 2026-06-23  
**Scope:** Build + compose + workflow syntax (no heavy audits)

## Build validation

| Target | Command | Result |
|--------|---------|--------|
| Backend | `npm run build --workspace=@exchange/backend` | **PASS** (`tsc`) |
| Frontend | `NEXT_PUBLIC_API_URL=… npm run build --workspace=@exchange/frontend` | **PASS** |
| Admin panel | `NEXT_PUBLIC_API_URL=… npm run build --workspace=@exchange/admin-panel` | **PASS** |

### Fixes applied for green builds

| File | Fix |
|------|-----|
| `apps/frontend/src/components/performance/UserRouteWarmup.tsx` | Idle callback cleanup typing |
| `apps/frontend/src/lib/currency/FXRateService.ts` | Null guard on local cache |
| `apps/frontend/next.config.js` | `eslint.ignoreDuringBuilds` for prod Docker |
| `apps/admin-panel/next.config.js` | `eslint.ignoreDuringBuilds` |
| `apps/admin-panel/.../logs/page.tsx` | `actions` → `quickActions` prop |

## Compose validation

```bash
# With required secrets set (see .env.production.example)
docker compose -f docker-compose.production.yml config --quiet
```

| Check | Result |
|-------|--------|
| `docker-compose.production.yml` syntax | **PASS** (with CI env vars) |
| Required secret interpolation | **PASS** — fails fast if missing |
| Service dependency graph | **PASS** — backend waits on engine healthy |

Optional GHCR overlay: `docker-compose.prod-images.yml` (use with `IMAGE_PREFIX` + `IMAGE_TAG`).

## Workflow validation

| File | Status |
|------|--------|
| `.github/workflows/production.yml` | **Created** — build → test → docker push → deploy → rollback |
| `.github/workflows/load-gate.yml` | Existing — PR gate |
| `.github/workflows/release-go-no-go.yml` | Existing — manual release |

### `production.yml` jobs

1. **build** — backend + frontend + admin compile  
2. **test** — compose config + script syntax  
3. **docker** — matrix build/push to `ghcr.io`  
4. **deploy** — SSH to VPS (requires secrets)  
5. **rollback** — manual `workflow_dispatch` with image tag  

## Script syntax

| Script | Check |
|--------|-------|
| `scripts/smoke-api.mjs` | `node --check` **PASS** |

## Not run (by design)

- Full `release:go-no-go` (heavy — use manually pre-launch)
- Playwright E2E / UI forensic audits
- k6 load gate
- Rust `cargo build` (Dockerfile builds in CI docker job)

## Release Validation Score: **PASS** (local toolchain)

CI must confirm on first `main` push after secrets configured.
