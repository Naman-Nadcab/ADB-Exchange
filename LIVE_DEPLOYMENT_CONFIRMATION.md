# Live Deployment Confirmation

**Audit date:** 2026-06-24T13:16Z  
**Method:** Read-only inspection (git, docker, HTTP). No code changes, deploys, or rebuilds performed.

---

## Phase 1 — Git Verification

| Item | Value | Evidence |
|------|-------|----------|
| **Local HEAD** | `3042cbb7bff8891403b814f141b8f2793598c36c` | `git rev-parse HEAD` |
| **Local HEAD message** | `Ship user frontend finalization: cookie auth, live APIs, and production validation.` | `git log -1 --oneline` |
| **Deployment git tag** | `deploy-2026-06-24-user-frontend-finalization` → `3042cbb7bff8891403b814f141b8f2793598c36c` | `git show deploy-2026-06-24-user-frontend-finalization --no-patch` |
| **Production commit (inferred)** | **Tag commit `3042cbb`** for frontend; **backend image built after tag** with uncommitted local changes | See Phase 2 + uncommitted diff below |
| **Match local HEAD (commit SHA)** | **YES** for committed SHA | HEAD = tag = `3042cbb` |
| **Match local HEAD (full tree)** | **NO** | `git status` shows modified files not committed; running backend includes those modifications |

### Uncommitted local changes (not in `3042cbb`)

```
apps/backend/src/routes/wallet.fastify.ts  (deposit/tokens route, debug log removal)
apps/backend/src/server.ts                 (empty JSON body parser)
apps/backend/src/database/migrate.ts
apps/frontend/src/components/providers.tsx
apps/frontend/src/app/dashboard/referral/page.tsx
```

**Note:** Docker image labels contain **no git SHA**. Production commit is inferred from tag + image build times + runtime file checks.

---

## Phase 2 — Container Verification

| Container | Image name | Image tag | Image digest | Container started (UTC) |
|-----------|------------|-----------|--------------|-------------------------|
| **exchange-backend** | `m-live-backend` | `latest` | `sha256:fb3027f8f565d9ba8e8fe48c8da984fe79d849591795353d549f38750c7ac89a` | `2026-06-24T13:05:43Z` |
| **exchange-frontend** | `m-live-frontend` | `latest` | `sha256:c9dc894d3bdc2ac564821252cc444aa678cddac7e675df83625a046002fc3cf0` | `2026-06-24T12:50:55Z` |
| **exchange-nginx** | `nginx` | `alpine` | `sha256:1a8724a52d432501548a8d8681bb1554c2d09778f8b9ed0882fc3442549980b7` | `2026-06-23T12:43:18Z` |

### Deploy tag on containers?

| Container | Includes `deploy-2026-06-24-user-frontend-finalization` as Docker tag? |
|-----------|-----------------------------------------------------------------------|
| backend | **NO** — only `m-live-backend:latest` |
| frontend | **NO** — only `m-live-frontend:latest` |
| nginx | **NO** — stock `nginx:alpine` |

Git tag `deploy-2026-06-24-user-frontend-finalization` exists locally on commit `3042cbb` but is **not** applied as a Docker image tag.

### Runtime vs tag commit

| Service | Built from tag `3042cbb` only? | Evidence |
|---------|-------------------------------|----------|
| Frontend | **Likely YES** (deploy ~12:50Z, no rebuild after closeout) | Image created 2026-06-24T12:50:13Z; `middleware.js` contains `mlive_at` |
| Backend | **NO** — includes post-tag closeout changes | `deposit/tokens` route + empty JSON parser present in `/app/dist/` but absent from `3042cbb` diff base |

---

## Phase 3 — Feature Verification (Live)

| # | Feature | LIVE | Evidence |
|---|---------|------|----------|
| 1 | Cookie auth | **YES** | Login `Set-Cookie: mlive_at` + `mlive_rt` (HttpOnly, Secure, SameSite=Lax); `/dashboard` → 307 without cookie |
| 2 | Refresh token flow | **YES** | `POST /auth/refresh` with empty JSON body → **200**; logout → `/me` **401** |
| 3 | Referral leaderboard API | **YES** | `GET /api/v1/user/referrals/leaderboard` → **200** (auth); **401** without auth |
| 4 | Referral analytics API | **YES** | `GET /api/v1/user/referrals/analytics` → **200** |
| 5 | Markets intelligence API | **YES** | `GET /api/v1/spot/markets/intelligence` → **200** |
| 6 | Platform metrics API | **YES** | `GET /api/v1/public/platform-metrics` → **200** |
| 7 | BTC live price fix | **YES** | `BTC_USDT` `last_price`: `62108.00`; `/public/home-sparkline/BTC_USDT` → 7 closes; `btc-price.service.js` in backend image |
| 8 | Deposit route collision fix | **YES** | `GET /api/v1/wallet/deposit/tokens` → **200** (was 500 pre-fix); route string in live `wallet.fastify.js` |
| 9 | Error state improvements | **YES** | Frontend image contains `/app/.next/static/chunks/app/wallet/error-*.js`; protected pages return **200** with auth (not blank shell) |
| 10 | Dead button remediation | **YES** | New services in live backend (`referral-leaderboard`, `public.fastify`, `btc-price`); referral/leaderboard routes **200**; `/dashboard/referral` **200** with cookie |

**Caveat:** Items 9–10 UI behavior (every button, every error boundary) not exhaustively browser-tested; evidence is runtime artifacts + HTTP responses.

---

## Phase 4 — Route Verification

| Route | HTTP | Response sample | Route live |
|-------|------|-----------------|------------|
| `GET /api/v1/public/platform-metrics` | **200** | `{"success":true,"data":{"matching_latency_p99_ms":4617,...}}` | **YES** |
| `GET /api/v1/spot/markets/intelligence` | **200** | `{"success":true,"data":{"symbols":{"AAVE_USDT":{...}}}}` | **YES** |
| `GET /api/v1/user/referrals/analytics` | **200** | `{"success":true,"data":{"dailyEarnings":[],"funnel":{...}}}` (authenticated) | **YES** |
| `GET /api/v1/user/referrals/leaderboard` | **200** | `{"success":true,"data":{"entries":[]}}` (authenticated) | **YES** |

Routes also reachable via nginx `:80` (e.g. `/api/v1/public/platform-metrics` → **200**).

---

## Phase 5 — Auth Verification

| Check | Result | Evidence |
|-------|--------|----------|
| Login sets `mlive_at` | **YES** | `set-cookie: mlive_at=...; HttpOnly; Secure; SameSite=Lax` |
| Login sets `mlive_rt` | **YES** | `set-cookie: mlive_rt=...; HttpOnly; Secure; SameSite=Lax` |
| `/auth/me` works | **YES** | **200** with user payload after login |
| Logout clears session | **YES** | `POST /auth/logout` → **200**; subsequent `/auth/me` → **401** |
| Refresh (empty body) | **YES** | **200** with new tokens in body |

Test account: `preprod-validate@test.invalid` (password login via `POST /api/v1/auth/login/password`).

---

## Phase 6 — Final Answer

### 1. Exactly what is live

- **Git tag (local):** `deploy-2026-06-24-user-frontend-finalization` at `3042cbb7bff8891403b814f141b8f2793598c36c`
- **Backend container:** `m-live-backend:latest` digest `fb3027f8f565…`, started **2026-06-24T13:05:43Z**, includes tag commit features **plus** uncommitted closeout fixes (deposit/tokens route, empty JSON refresh parser)
- **Frontend container:** `m-live-frontend:latest` digest `c9dc894d3bdc…`, started **2026-06-24T12:50:55Z**, aligned with tag commit build
- **Nginx:** `nginx:alpine` digest `1a8724a52d432…`, started **2026-06-23T12:43:18Z** (unchanged since prior day)
- **Live APIs:** platform-metrics, markets/intelligence, referral analytics/leaderboard, cookie auth, refresh, deposit/tokens alias, BTC pricing/sparkline
- **Health:** `GET /health/live` → **200** `{"status":"alive",...}`

### 2. Exactly what is not live

- **Docker image tag** `deploy-2026-06-24-user-frontend-finalization` (only git tag exists; images use `:latest`)
- **Committed closeout changes** in git (wallet/server/migrate/frontend debug removals) — **running on backend** but **not committed** to `3042cbb`
- **Frontend closeout file edits** (providers/referral debug log removal) — **not verified** in running frontend image (frontend not rebuilt after closeout)
- **Git SHA in container labels** — not present
- **Full browser UAT** (WebAuthn, P2P sanctions-gated flows) — not part of this audit; not verified here

### 3. Production commit SHA

**Tagged deployment commit:** `3042cbb7bff8891403b814f141b8f2793598c36c`  
**Running backend effective source:** `3042cbb` + **uncommitted** post-tag patches (verified in container `/app/dist/`).

### 4. Production tag

**Git:** `deploy-2026-06-24-user-frontend-finalization`  
**Docker:** `m-live-backend:latest`, `m-live-frontend:latest` (no deploy-named image tag)

### 5. Does production match latest remediation work?

| Layer | Match |
|-------|-------|
| Git HEAD commit `3042cbb` | **YES** (same SHA) |
| Full local working tree | **NO** (uncommitted changes) |
| Backend runtime | **Partial YES** — includes closeout fixes **not yet committed** |
| Frontend runtime | **Mostly YES** — matches tag deploy; closeout frontend edits **may not** be included |

### 6. Is rollback currently possible?

**YES, with caveats.**

- Prior local images exist: `m-live-backend-verify:local` (`ba6881f5c598`), `m-live-frontend-verify:local` (`3daf5e1b069d`)
- Rollback requires `docker compose` pointing to a specific image digest/tag and `up -d` (not performed in this audit)
- Only one `latest` tag per app image; no immutable deploy tag on registry
- Nginx config is volume-mounted; rollback of app containers does not require nginx rebuild

### 7. Risk level

**MEDIUM**

| Factor | Reason |
|--------|--------|
| Git/image drift | Backend running code ≠ committed `3042cbb`; uncommitted closeout on production |
| Stale nginx | Container up since 2026-06-23; app containers newer |
| No immutable deploy tags | `:latest` only — harder to prove exact artifact |
| Ops gaps | `SANCTIONS_PROVIDER` unset (observed in prior audits); P2P blocked in prod |

---

*Audit complete. No infrastructure modified.*
