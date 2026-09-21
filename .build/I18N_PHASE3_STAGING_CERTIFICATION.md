# Phase 3 I18N — Staging Recovery & Certification (Final)

**Branch:** `release/exchange-production-baseline`  
**HEAD:** `440680d4fe3da6aca77132d74a120955a8064801`  
**Run:** 2026-09-21 (recovery + verification)  
**Implementation:** FROZEN (no Phase 3 code changes)

---

## 1. Runtime diagnosis

| Finding | Detail |
|---------|--------|
| Root cause A | `exchange-backend` / `exchange-postgres` **not attached** to `exchange-production` → Redis **ETIMEDOUT** |
| Root cause B | Merged `docker-compose.yml` + `docker-compose.production.yml` **duplicate host port binds** (`4000`, `5432`) → `docker network connect` / `start` failed with “address already in use” |
| Root cause C | `exchange-frontend` **Created**, not running; host **next-server** held **:3000** |
| Root cause D | **nginx** cached stale upstream IPs → **502** until nginx restart |
| DB | Volume **`m-live_postgres_data`** preserved; **no migrations/seeds** |

---

## 2. Exact recovery actions

1. **Recorded** container IDs/images (backend `cac008aabfec…`, postgres `ce77a4deb761…`, frontend `a2e0ade7c85c…`, new frontend image `434b83181ff4`).
2. **Stopped** host `next-server` on **:3000** (freed port for compose frontend publish policy).
3. **Removed** only broken containers: `exchange-backend`, `exchange-postgres`, `exchange-frontend` (volumes **not** removed).
4. **Recreated** those three services with **`docker-compose.production.yml` + `.build/docker-recovery-override.yml`** (`ports: !override` single bind for backend; postgres internal-only; frontend no host ports).
5. **`docker restart exchange-nginx`** only — refresh upstream DNS to new backend/frontend IPs.

**Not run:** `docker compose up` (full stack), `down`, `down -v`, force-recreate of healthy services.

---

## 3. Services changed / untouched

| Changed | Untouched |
|---------|-----------|
| `exchange-postgres`, `exchange-backend`, `exchange-frontend` (recreated) | `exchange-matching-engine`, `exchange-admin`, `exchange-indexer`, `exchange-redis`, `exchange-nats`, `exchange-rabbitmq`, `forex-cert-backend`, monitoring |
| `exchange-nginx` (restart only) | Production deploy, DB schema/data |

---

## 4. Health results (Phase 6)

| Gate | Result |
|------|--------|
| `curl http://127.0.0.1:4000/health` | **PASS** (DB, Redis, NATS, matching-engine up) |
| `curl http://127.0.0.1/` / `/login` | **PASS** **200**, `html lang="en"`, **no** `__next_error__` |
| `curl http://127.0.0.1/api/v1/spot/markets` | **PASS** **200** |
| Frontend image | **`434b83181ff4`** (current i18n build via nginx) |

---

## 5. Authentication

| Check | Result |
|-------|--------|
| QA trader UI login (`BASE_URL=http://127.0.0.1`) | **PASS** |
| `I18N_VISUAL_AUTH=1` matrix login | **PASS** (initial routes) |
| Session on later auth routes | **PARTIAL** — many cells **`redirected to login`** after first navigations (session/cookie fixture — **not** i18n strings) |

---

## 6. I18n visual matrix (`results-fullstack.json`)

**Command:** `BASE_URL=http://127.0.0.1 I18N_VISUAL_AUTH=1 E2E_BASE_URL=http://127.0.0.1:4000 SKIP_WEBSERVER=1 npm run e2e:i18n-visual`

| Segment | PASS | FAIL | Notes |
|---------|------|------|-------|
| **Public** (90 cells) | **90** | **0** | 3 locales × 5 viewports × 6 routes |
| **Authenticated** (224 cells) | **54** | **170** | Mostly **redirected to login** on wallet withdraw, P2P, account after session loss |
| **Hydration** | — | **0 issues** | |
| **Overflow** | — | **0 flagged** | |

Playwright summary: **90 passed**, **15 failed** (one failed test per auth viewport batch).

---

## 7. Domain regression

| Domain | Verdict | Evidence |
|--------|---------|----------|
| **Crypto (spot)** | **PASS** (public visual) | `/trade/spot` in public matrix |
| **Forex** | **PARTIAL** | Public `/forex/*` **PASS**; authenticated portfolio/orders need stable session |
| **P2P** | **PARTIAL** | Public `/p2p` **PASS**; auth P2P routes fail on session drop |
| **Wallet** | **PARTIAL** | Overview/deposit **PASS**; withdraw/history fail on session drop |
| **Account** | **PARTIAL** | Same session pattern |
| **Mission2 trader suite** | **BLOCKED** | Setup project **admin session** fails (2FA); trader specs **did not run** |

---

## 8. Build / static tests

| Command | Result |
|---------|--------|
| `npm run test:i18n` | **PASS** |
| `npm run test:forex-models` | **PASS** |
| `npm run build` (apps/frontend) | **PASS** |

---

## 9. Git / safety

| Item | Status |
|------|--------|
| **HEAD / remote** | `440680d` == `origin/release/exchange-production-baseline` |
| **Source commits this run** | **None** (recovery ops only) |
| **Untracked ops file** | `.build/docker-recovery-override.yml` (local recovery, not committed) |
| **Protected paths (committed)** | **UNCHANGED** |
| **Financial/backend logic** | **UNCHANGED** |
| **DB** | **UNCHANGED** (no migrations/provision) |
| **Production** | **NOT DEPLOYED** |

---

## 10. Remaining blockers

1. **Playwright auth matrix session persistence** — investigate cookie/`auth-storage` across long multi-route loops (harness/env, not Phase 3 copy).
2. **Mission2** — admin setup failure blocks `--project=mission2-trader`; run trader specs with trader-only setup or prebuilt `e2e/.auth/trader-a.json` without admin dependency.
3. **Compose port merge** — permanent fix belongs in **ops** (single port definition in compose merge), not i18n implementation.

---

## FINAL STAGING VERDICT

| | |
|--|--|
| **STAGING RUNTIME** | **HEALTHY** (post-recovery) |
| **CURRENT I18N FRONTEND (nginx)** | **SERVING** |
| **BACKEND :4000** | **HEALTHY** |
| **STAGING VERIFICATION** | **PARTIAL** |
| **FULL AUTHENTICATED VISUAL** | **PARTIAL** (public **PASS**; auth session **FAIL**) |
| **LOCALE / BUILD** | **PASS** |
| **PRODUCTION** | **NOT TOUCHED** |

**Not certified:** full authenticated 3×5×all-routes matrix until session fixture is stable. **Public i18n visual matrix is certified PASS** on recovered stack.
