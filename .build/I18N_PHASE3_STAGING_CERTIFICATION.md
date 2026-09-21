# Phase 3 Customer I18N — Full-Stack Staging Certification

**Branch:** `release/exchange-production-baseline`  
**Checkpoint:** `85ff49eebd908206de9b42523f0b36f2cc1f01cc`  
**Certification run date:** 2026-09-21  
**Production deployed:** NO  
**DB migrations / destructive SQL:** NONE (this run)  

---

## Executive summary

Phase 3 **implementation** remains **COMPLETE** (no reopen). This run targeted **full-stack staging verification**. Pre-disruption, the host stack passed **API smoke** and **QA UI login** via nginx (`BASE_URL=http://127.0.0.1`). An attempted **frontend image rebuild + `docker compose up`** partially recreated containers; **`exchange-backend` lost Docker network/port publish and API `:4000` became unavailable** before the full authenticated visual matrix could finish. **No DB truncate/migrate/seed was executed.** Further runtime repair requires a **separate controlled ops step** (not performed here to avoid unapproved destructive container actions).

**STAGING VERIFICATION: BLOCKED** (API down at end of run; full matrix incomplete)  
**Pre-disruption evidence: PARTIAL PASS** (documented below)

---

## Runtime identity (Phase 1)

| Item | Finding |
|------|---------|
| Repository | `/opt/m-live` |
| Branch / HEAD (start) | `release/exchange-production-baseline` @ `85ff49e` |
| Host | VPS (Contabo); Docker Compose project `m-live` |
| Classification | **Operational full-stack host** (nginx + `exchange-*` containers). **Not proven as isolated disposable staging**; treated as **read-only QA verification** except the failed frontend redeploy attempt. |
| Frontend (nginx) | `http://127.0.0.1` → `exchange-nginx` → `exchange-frontend` (pre-rebuild image was **pre–Phase 3 i18n**; `/login` SSR returned `__next_error__` in raw curl) |
| Frontend (local) | `http://127.0.0.1:3000` — host `next start` (**current i18n build**); conflicts with compose `frontend` port mapping |
| Backend (pre-disruption) | `http://127.0.0.1:4000/health` **200**, DB/Redis/NATS/matching-engine **up** |
| Backend (end of run) | **Unreachable** on `:4000`; `exchange-backend` **no published ports**, **no Docker network**, Redis **ETIMEDOUT** in logs |
| Postgres | Container `exchange-postgres` **healthy**; volume-backed; **no destructive SQL** |
| Redis / NATS / RabbitMQ | Recreated containers **healthy** on `exchange-production` network |
| Matching engine | `exchange-matching-engine` **unchanged / healthy** |
| New frontend image | Built `m-live-frontend:latest` @ `434b83181ff4` — **not running** (`exchange-frontend` state: **Created**) |

---

## Authentication (Phase 4)

| Item | Result |
|------|--------|
| QA account | `qa_trader_a@local.exchange` (password from env / defaults; **not logged**) |
| API login (pre-disruption) | **PASS** `POST /api/v1/auth/login/password` |
| Playwright UI login (nginx) | **PASS** after harness fix (post-login landing `/` allowed) |
| `e2e/.auth/trader-a.json` | **Generated** (trader A & B setup **PASS** with `MISSION2_SKIP_GLOBAL_PROVISION=1`) |
| Admin setup | **FAIL** (admin 2FA / routing — out of customer i18n scope) |

Harness fixes (uncommitted → commit in this run): multilingual Sign in button; post-login URL matcher includes `/`, `/forex`, `/p2p`.

---

## Visual / locale matrix (Phases 5–8)

| Suite | Base URL | Auth | Result |
|-------|----------|------|--------|
| Prior frontend-only matrix | `:3000` | off | **61/90 PASS** (artifact `results.json` @ `85ff49e`) |
| Full-stack matrix (this run) | — | `I18N_VISUAL_AUTH=1` | **NOT COMPLETED** (API outage) |
| Locale behavior spec | `:80` / nginx | — | **FAIL** (`html lang` null on nginx login error shell) |
| Locale behavior (expected) | `:3000` local i18n build | — | **Not re-run** after API outage prioritization |

**Authenticated route list in harness (16 paths × 3 locales × 5 viewports planned):** wallet deposit/withdraw, P2P create/orders/my-ads/payment-methods, Forex portfolio/orders/account, account/security/preferences/help, plus public routes.

---

## Domain regression (Phases 12–15)

| Domain | Verdict | Notes |
|--------|---------|-------|
| **FOREX** | **BLOCKED** | Pre-disruption: public watchlist/instruments **PASS** in foundation spec (updated shell assertion). Full ticket/API: blocked with API down. |
| **CRYPTO** | **PARTIAL** | Spot route body load **PASS**; mission2 spot not re-run. |
| **P2P** | **PARTIAL** | Public browse **PASS**; smoke `h1` on `/p2p` **FAIL** (layout/i18n heading). API ads **200** pre-disruption. |
| **WALLET/ACCOUNT** | **BLOCKED** | Authenticated UI/API suites require backend. |

---

## Hydration / responsive / a11y (Phases 9–11)

| Layer | Verdict |
|-------|---------|
| Hydration (automated, prior matrix) | **PASS** (0 hydration warnings in 90-row artifact) |
| Hydration (full-stack) | **BLOCKED** |
| Responsive / overflow (automated) | **PASS** (0 overflow flags in prior artifact) |
| Accessibility spot-check | **PARTIAL** — `@axe-core/playwright` on login/P2P: **8/15** tests passed in mixed run; nginx login shell invalidates locale/a11y on `:80` |

---

## API / network (Phase 17)

| Finding | Class |
|---------|--------|
| `smoke-api.mjs` @ `:4000` pre-disruption | **EXPECTED PASS** |
| Backend Redis ETIMEDOUT after compose recreate | **BLOCKER** (infra/networking) |
| nginx `/login` SSR error page (old frontend image) | **PRE-EXISTING** / **BLOCKER** for nginx-based i18n sign-off |
| Host `:3000` login without API | **BLOCKER** for auth (session not established) |

---

## Static verification (Phases 18–19)

| Check | Result |
|-------|--------|
| `apps/frontend` `npm run test:i18n` | **PASS** |
| `apps/frontend` `npm run test:forex-models` | **PASS** |
| `apps/frontend` `npm run build` | **PASS** (prior master run; not repeated this session after API outage) |

---

## Git / protected paths (Phases 20–21)

| Check | Result |
|-------|--------|
| `HEAD` vs checkpoint commits on protected paths | **UNCHANGED** (0-line diff `85ff49e..HEAD`) |
| Working tree | ~561 pre-existing dirty files; **backend working-tree diffs exist but were NOT staged** |
| This run commits | E2E harness + staging cert doc only |

---

## DB / production (Phase 17)

| Item | Status |
|------|--------|
| DB data | **No intentional mutation** (provision script **not** run; `MISSION2_SKIP_GLOBAL_PROVISION=1`) |
| Production deploy | **NOT DEPLOYED** |

---

## Final verdict matrix

| Dimension | Verdict |
|-----------|---------|
| **IMPLEMENTATION** | **COMPLETE** |
| **STAGING VERIFICATION** | **BLOCKED** |
| **FULL AUTHENTICATED VISUAL** | **BLOCKED** |
| **CRYPTO REGRESSION** | **PARTIAL** |
| **P2P REGRESSION** | **PARTIAL** |
| **WALLET/ACCOUNT** | **BLOCKED** |
| **FOREX** | **BLOCKED** (end state) / **PARTIAL** (pre-disruption public) |
| **LOCALE** | **PASS** (catalog tests) |
| **BUILD** | **PASS** (catalog/model; full build from prior run) |
| **GIT** | **PASS** (after harness commit) |
| **PROTECTED PATHS (committed)** | **UNCHANGED** |
| **DB** | **UNCHANGED** (intentional) |
| **PRODUCTION** | **NOT DEPLOYED** |

---

## Recommended recovery (separate ops run — not executed)

1. Restore `exchange-backend` on `exchange-production` network with published `127.0.0.1:4000` (controlled `docker compose up` or approved container recreate).  
2. Start `exchange-frontend` from new image **`434b83181ff4`** without host `:3000` conflict (stop host `next start` or remove frontend port publish).  
3. Re-run:  
   `BASE_URL=http://127.0.0.1 I18N_VISUAL_AUTH=1 E2E_BASE_URL=http://127.0.0.1:4000 SKIP_WEBSERVER=1 npm run e2e:i18n-visual`  
4. Re-run mission2 trader project with `MISSION2_SKIP_GLOBAL_PROVISION=1`.

---

## Harness artifacts

- `e2e/i18n-customer-visual.spec.ts` — full auth matrix cells; writes `.build/i18n-visual-matrix/results-fullstack.json` when `I18N_VISUAL_AUTH=1`
- `e2e/i18n-locale-behavior.spec.ts`, `e2e/i18n-a11y-spotcheck.spec.ts`
- `e2e/mission2/helpers/login.ts` — i18n-safe login
