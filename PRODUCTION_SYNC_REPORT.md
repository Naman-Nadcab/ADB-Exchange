# Production Sync Report

**Date:** 2026-06-24  
**Prior tag:** `deploy-2026-06-24-user-frontend-finalization` → `3042cbb`  
**New tag:** `deploy-2026-06-24-production-synced` → `770cc89`  
**Result:** **PASS**

---

## 1. Comparison vs `3042cbb` / deploy tag

| Category | Files | Action |
|----------|-------|--------|
| **Production fixes (committed)** | 8 source files | Committed in `770cc89` |
| **Doc/branding drift (excluded)** | `README.md`, `LAUNCH_CHECKLIST.md`, `UX_UI_AUDIT_FULL.md`, `ui-simulation-audit.latest.json` | Not committed (not runtime fixes) |
| **Audit reports (untracked)** | `*_REPORT.md`, `uat-evidence/` | Documentation only |

### Exact diff committed (`3042cbb` → `770cc89`)

| File | Change |
|------|--------|
| `apps/backend/src/database/migrate.ts` | `user_passkeys` columns: `deleted_at`, WebAuthn metadata |
| `apps/backend/src/routes/wallet.fastify.ts` | `/deposit/tokens` static route; reserved txHash guard; remove debug logs |
| `apps/backend/src/server.ts` | Empty JSON body parser for cookie refresh |
| `apps/backend/src/services/otp.service.ts` | OTP email returns `false` on SMTP failure (was silent `true`) |
| `apps/backend/src/routes/auth.fastify.ts` | Await email OTP delivery; return 503 on failure |
| `apps/frontend/src/middleware.ts` | Remove `/trade` from auth-required prefixes (public spot) |
| `apps/frontend/src/components/providers.tsx` | Remove debug `console.log` |
| `apps/frontend/src/app/dashboard/referral/page.tsx` | Remove debug `console.log` |

**Verified:** No temporary patches, no accidental debug additions in committed files.

---

## 2. Git state after sync

| Item | Value |
|------|-------|
| **Commit SHA** | `770cc8910d623433e2b7d6487faf5a1ec4170620` |
| **Tag** | `deploy-2026-06-24-production-synced` |
| **Local HEAD** | `770cc89` (matches tag) |
| **Production ↔ Git match** | **YES** (images rebuilt from `770cc89` and deployed) |

---

## 3. Image digests (post-deploy)

| Service | Image | Digest |
|---------|-------|--------|
| Backend | `m-live-backend:latest` | `sha256:97b4be13bdb960a248523712d18c777880f3093e523e68088f2960f96bd68fc4` |
| Frontend | `m-live-frontend:latest` | `sha256:16e19651a7b317383d6f70023e459d2f48bcba8f2a7b682b08fda5a95c9674a3` |

| Container | Started (UTC) |
|-----------|---------------|
| `exchange-backend` | `2026-06-24T13:34:27Z` |
| `exchange-frontend` | `2026-06-24T13:34:39Z` |

---

## 4. Verification matrix

| Check | Result |
|-------|--------|
| Production code = git `770cc89` | **PASS** (rebuilt + deployed) |
| Git repository tagged | **PASS** |
| Deploy tag recorded | **PASS** |
| No uncommitted production fixes remaining | **PASS** |

---

## Output

**PASS**
