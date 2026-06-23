# Dead Code Report

**Generated:** 2026-06-23  
**Policy:** Flag only — no aggressive deletion (feature-complete release)

## Summary

| Category | Flagged | Risk if removed |
|----------|---------|-----------------|
| Removed routes (git) | 2 | Low |
| Possibly unused components | ~40 | Medium — verify imports |
| Duplicate admin paths | 3 | Low — redirects exist |
| Legacy env aliases | several | Low — keep for compat |
| Dev-only scripts | ~15 | Low — gitignored audit scripts |

## Safe removal candidates (post-launch)

### Deleted pages (already removed in working tree)

| Path | Notes |
|------|-------|
| `apps/frontend/src/app/dashboard/copy-trading/page.tsx` | Feature removed; verify nav has no links |
| `apps/frontend/src/app/dashboard/demo-trading/page.tsx` | Demo mode removed |

**Action:** Confirm no `routes.ts` / sidebar entries reference these paths.

### Admin components flagged unused (from COMPONENT_COVERAGE)

Examples in `audit/ui-forensic/COMPONENT_COVERAGE.md`:

- `apps/frontend/src/components/TransferModal.tsx` — ≤1 reference
- `apps/frontend/src/components/DockerUserAppHint.tsx` — dev-only hint
- Various `api/API*.tsx` summary widgets — may be lazy-loaded

**Action:** Do not delete before verifying dynamic imports and Storybook/docs references.

### Duplicate / legacy routes

| Legacy | Canonical | Mechanism |
|--------|-----------|-----------|
| `/dashboard/trade/spot` | `/trade/spot` | middleware 308 |
| `/dashboard/spot` | `/trade/spot` | middleware redirect |
| Embedded `/admin` in frontend | `admin-panel:3001` | banner link |

**Action:** Keep redirects for bookmarked URLs.

### Backend services (review only)

| Area | Note |
|------|------|
| `apps/backend/src/routes/trading.fastify.ts` | Legacy trading routes — spot uses `spot.fastify.ts` |
| Node in-process matcher | Removed; Rust engine only |
| Synthetic candles | Off by default (`ALLOW_SYNTHETIC_CANDLES=false`) |

### Config duplicates

- `JWT_SECRET` vs session tokens — both required  
- `ENGINE_HMAC_SECRET` vs `ENGINE_HMAC_SECRET_ACTIVE` — use active in prod  
- `SMTP_PASSWORD` vs `SMTP_PASS` — either accepted  

**Action:** Standardize in `.env` docs only; do not remove code paths.

### Scripts safe to exclude from m-live (gitignored)

- `scripts/interactive-*.mjs`
- `scripts/ui-forensic-*.mjs`
- `scripts/go-live-validation.mjs`

### Not dead — required for production

- `matching-engine/` — core trading  
- `apps/indexer/` — deposits (optional but compose includes it)  
- `infra/docker-compose.monitoring.yml` — optional observability  
- `edge-auth-gateway/`, `session-core/` — referenced by env; disable if unused  

## Recommended post-push cleanup (human review)

1. Run `npm run verify:routes` in frontend after any nav change  
2. Search for `copy-trading` / `demo-trading` string refs  
3. Archive root-level `*_AUDIT*.md` into `docs/archive/` if desired  
4. Prune `docs/reports/*.png` from UI simulation audits (~50 MB potential)

## Deletion policy for m-live

**Do not delete** without explicit approval:

- Any `apps/backend/src/routes/*.fastify.ts`  
- Admin modals (treasury, withdrawals, MM control)  
- P2P v1 + v2 routes (both may be in use)
