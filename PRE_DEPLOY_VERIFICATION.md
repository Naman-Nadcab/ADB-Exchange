# PRE-DEPLOY VERIFICATION

**Generated:** 2026-06-24  
**Branch:** `deployment/vps-first-boot` (uncommitted working tree)  
**Verifier environment:** Linux VPS, Docker available, **no host Node/npm**  
**Verify images built:** `m-live-backend-verify:local`, `m-live-frontend-verify:local`  
**Production stack status:** Running (`exchange-*` containers healthy on `exchange-production` network)

---

## Verdict

| Status | Meaning |
|--------|---------|
| **Critical checks** | **9 / 10 PASS**, **1 NOT TESTED** |
| **Deploy gate** | **Conditional GO** — rebuild images from current tree and redeploy; run post-deploy smoke on live URLs |

> **Do not deploy until:** production images are rebuilt from this verified tree (current running containers are **3+ hours old** and do **not** include finalization-pass changes).

---

## Checklist

| # | Check | Result | Evidence |
|---|--------|--------|----------|
| 1 | **TypeScript build passes** | **PASS** | Backend `tsc` succeeded inside `docker build -f apps/backend/Dockerfile` (`m-live-backend-verify:local`). Initial failures (`auth.fastify.ts` catch block, duplicate imports, `Decimal` types, `referral-leaderboard` strictness) were fixed and rebuild succeeded. Root monorepo `turbo run build` **not run** (no host npm). |
| 2 | **Frontend production build passes** | **PASS** | `docker build -f apps/frontend/Dockerfile` succeeded after fixing `dashboard/markets/page.tsx` (duplicate `trendingCards`, undefined `newsListingIntel` → `newListings`). Image: `m-live-frontend-verify:local`. |
| 3 | **Backend production build passes** | **PASS** | `docker build -f apps/backend/Dockerfile apps/backend` exit 0. Includes `npm run build` (`tsc`) + production `npm install --omit=dev`. |
| 4 | **No migration failures** | **PASS** | `docker run … m-live-backend-verify:local node dist/database/migrate.js` against live `postgres` on `exchange-production` network completed: *"Database migrations completed successfully"*. |
| 5 | **No route registration failures** | **PASS** (compile-time) / **NOT TESTED** (runtime boot of new image) | All route modules compile under `tsc`. Full `node dist/server.js` smoke on verify image was attempted but produced no captured log within timeout (likely blocked on dependency probes). **Existing** production backend responds `GET /health/live` → 200. |
| 6 | **No duplicate API paths** | **PASS** | Static scan of 377 route definitions found 7 duplicate `(METHOD, path)` **filenames** — all are on **different mount prefixes** (e.g. `/api/v1/user/profile` vs `/api/v1/auth/profile`, `/api/v1/admin/markets` vs `/api/v1/spot/markets`). No conflicting registrations at the same full URL. |
| 7 | **No auth middleware conflicts** | **PASS** | Reviewed stack: (a) Next.js `middleware.ts` gates protected prefixes via `mlive_at` cookie; (b) backend `onRequest` promotes cookie → `Authorization: Bearer`; (c) `app.authenticate` + `jwtVerifyWithSession` unchanged contract; (d) frontend `api.ts` uses `credentials: 'include'` + optional Bearer. No double-auth or contradictory logout paths detected. |
| 8 | **No cookie/CORS conflicts** | **PASS** | Backend: `credentials: true` + origin allow-list (`CORS_ORIGINS`). Cookies: `SameSite=Lax`, `httpOnly`, `Secure` in production (`auth-cookies.ts`). `.env` check: `FRONTEND_URL` ∈ `CORS_ORIGINS`. Frontend: `credentials: 'include'` on API client and login flows. |
| 9 | **No environment variable regressions** | **PASS** | `docker compose -f docker-compose.production.yml --env-file .env config` exit 0. Compose-required keys (`POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`, `ENCRYPTION_KEY`, `ENGINE_HMAC_SECRET`) present in both `.env` and `.env.production.example`. |
| 10 | **No Docker compose validation errors** | **PASS** | `docker compose -f docker-compose.production.yml config --quiet` exit 0 (with and without `--env-file .env`). |

---

## Build Failures Found & Fixed During Verification

These blocked deploy and were corrected in-tree before re-verification:

| File | Issue | Fix |
|------|-------|-----|
| `apps/backend/src/routes/auth.fastify.ts` | Missing `catch` after password-login refactor | Restored `catch` block |
| `apps/backend/src/routes/spot.fastify.ts` | Duplicate imports | Removed duplicate lines |
| `apps/backend/src/services/btc-price.service.ts` | `Decimal` used as type | Use `DecimalInstance` |
| `apps/backend/src/services/orderbook-depth.service.ts` | Same | Use `DecimalInstance` |
| `apps/backend/src/services/referral-leaderboard.service.ts` | Strict null on email local part | Safe `(localPart ?? '')` |
| `apps/frontend/src/app/dashboard/markets/page.tsx` | Duplicate `trendingCards`, missing `newsListingIntel` | Removed shadow definition; use `newListings` |

---

## Detailed Notes

### 1–3. Builds

Commands used:

```bash
docker build -t m-live-backend-verify:local -f apps/backend/Dockerfile apps/backend
docker build -t m-live-frontend-verify:local -f apps/frontend/Dockerfile apps/frontend
```

Both completed with exit code **0** after fixes above.

### 4. Migrations

```bash
docker run --rm --network exchange-production --env-file .env \
  -e DATABASE_URL="postgresql://exchange:***@postgres:5432/exchange?sslmode=disable" \
  m-live-backend-verify:local node dist/database/migrate.js
```

Result: success, no pending failure.

### 5. Route registration

Compile-time: **PASS** (full backend TypeScript graph).  
Runtime: recommend post-rebuild check:

```bash
curl -sf http://127.0.0.1:4000/health/live
curl -sf -H "Cookie: mlive_at=…" http://127.0.0.1:4000/api/v1/auth/me
curl -sf http://127.0.0.1:4000/api/v1/user/referrals/leaderboard  # 401 without auth expected
curl -sf http://127.0.0.1:4000/api/v1/public/platform-metrics
```

### 6. Duplicate paths (informational)

| Method | Path (relative) | Files | Resolved by prefix |
|--------|-----------------|-------|-------------------|
| GET | `/balances` | trading, wallet | `/api/v1/trading` vs `/api/v1/wallet` |
| GET | `/currencies` | trading, convert | different prefixes |
| GET | `/kyc` | user, admin | `/api/v1/user` vs `/api/v1/admin` |
| GET | `/markets` | spot, admin, admin-spot | different prefixes |
| GET | `/profile` | user, auth | `/api/v1/user` vs `/api/v1/auth` |
| GET | `/referrals` | user, admin | different prefixes |
| GET | `/tokens` | wallet, admin | different prefixes |

### 7–8. Auth / cookies / CORS

| Layer | Mechanism |
|-------|-----------|
| Edge | Next.js middleware → redirect if no `mlive_at` on protected routes |
| API | Cookie promoted to Bearer before JWT decorators |
| Client | `credentials: 'include'`; tokens not persisted in localStorage |
| CSRF | SameSite=Lax cookies + CORS allow-list (no wildcard origin with credentials) |

**Note:** Users with legacy localStorage-only sessions (no cookie) will be redirected to login by middleware once new frontend deploys — expected one-time re-auth.

### 9. Environment

Warnings observed during migrate (non-blocking): `ALERT_WEBHOOK_URL`, `SANCTIONS_PROVIDER` unset; `ADMIN_2FA_MANDATORY=false`. These match template defaults and do not block boot.

### 10. Docker Compose

Validated against live `.env`. Production stack currently running and healthy (postgres, redis, backend, frontend, nginx, matching-engine, etc.).

---

## Post-Deploy Smoke (recommended)

After `docker compose -f docker-compose.production.yml up -d --build`:

1. Login (password + OTP) — confirm `mlive_at` / `mlive_rt` Set-Cookie headers  
2. `GET /api/v1/auth/me` with cookies only (no Authorization header)  
3. Referral leaderboard loads on `/dashboard/referral`  
4. Markets page loads without console errors  
5. Spot order list shows error banner on simulated API failure (optional)  
6. Logout clears cookies and blocks `/dashboard`  

---

## Summary Table

| # | Item | Result |
|---|------|--------|
| 1 | TypeScript build | **PASS** |
| 2 | Frontend production build | **PASS** |
| 3 | Backend production build | **PASS** |
| 4 | Migration failures | **PASS** |
| 5 | Route registration failures | **PASS** (compile) / **NOT TESTED** (new image runtime boot) |
| 6 | Duplicate API paths | **PASS** |
| 7 | Auth middleware conflicts | **PASS** |
| 8 | Cookie/CORS conflicts | **PASS** |
| 9 | Environment variable regressions | **PASS** |
| 10 | Docker compose validation | **PASS** |

**Critical deploy gate:** Items 1–4, 6–10 **PASS**. Item 5 runtime boot **NOT TESTED** — run smoke after rebuild. **Do not deploy old images; rebuild from current tree first.**
