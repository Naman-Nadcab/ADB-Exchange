# Phase 3 Customer I18N — Final Certification

**Branch:** `release/exchange-production-baseline`  
**HEAD (harness closure):** `ddbcf2826695d5df5c14fb9f925a9009a03490c5`  
**Runtime:** nginx `http://127.0.0.1` → frontend image `434b83181ff4`, backend `:4000` healthy  

---

## 1. Runtime

| Check | Result |
|--------|--------|
| `exchange-nginx`, `exchange-frontend`, `exchange-backend`, `exchange-postgres`, `exchange-redis` | Up / healthy |
| `curl http://127.0.0.1/` | 200 |
| `curl http://127.0.0.1/login` | 200 |
| `curl http://127.0.0.1:4000/health` | healthy |
| Frontend image | `434b83181ff4` |

---

## 2. Auth session root cause

| Finding | Classification |
|---------|----------------|
| HttpOnly `mlive_at` is **not** visible to `document.cookie`; `AuthProvider.hasLikelySession()` requires **localStorage bearer** (or non-HttpOnly cookie) before `/me` runs. Cookie-only bootstrap without storage → immediate `setUnauthenticated()` → `revokeServerSession()` → **`mlive_at` cleared** → middleware redirect to `/login` on later protected routes. | **Expected app behavior** (not i18n); **test harness gap** |
| Prior `ensureTraderSessionCookies()` re-login masked mid-loop loss; per-route repair **removed** from visual matrix. | **Harness fix** |
| Stale `authResolved` assertion in wait helper (Zustand `partialize` does not persist `authResolved`) caused false negatives. | **Harness fix** |
| Nginx `/api` login Set-Cookie omits `Secure` on HTTP staging (verified). | **Environment OK** |

---

## 3. Test-harness / application changes (this run)

**Application:** none (auth/financial/P2P/crypto/forex logic untouched).

**Harness only:**

- `loginUserForStagingHttp`: same-origin `http://127.0.0.1/api/…` login; HttpOnly cookies via `url:`; `addInitScript` seeds bearer for `/me`; wait for `/auth/me` 200; `waitForAuthenticatedRoute`.
- `e2e/i18n-customer-visual.spec.ts`: removed `ensureTraderSessionCookies`; post-`goto` session wait; auth describe no longer serial-bails sibling viewports.
- `e2e/i18n-auth-session.spec.ts`: Phase 4 smoke (full 16-route loop × 3 sequential runs × 4 locale hops).
- `e2e/mission2/global-setup.ts`: optional JWT refresh via staging login when `MISSION2_SKIP_GLOBAL_PROVISION=1` (no DB provision).

---

## 4. Auth session smoke

| Run | Result |
|-----|--------|
| `I18N_VISUAL_AUTH=1` × 3 sequential runs, locale en → zh-CN → id-ID → en, full auth route loop | **3 / 3 PASS** |
| Logout API calls during smoke | **0** |

---

## 5. Authenticated i18n visual matrix

**Command:** `BASE_URL=http://127.0.0.1 I18N_VISUAL_AUTH=1 E2E_BASE_URL=http://127.0.0.1:4000 SKIP_WEBSERVER=1 npm run e2e:i18n-visual` (auth slice re-run with harness fixes)

| Metric | Result |
|--------|--------|
| Viewport×locale buckets (15) | **9 PASS** / **6 FAIL** |
| Route cells (15×16 = 240) | **225 PASS** / **15 FAIL** (all failures **horizontal overflow**; **0** `/login` redirects) |
| Locales | en, zh-CN, id-ID |
| Viewports | 1440×900, 1280×800, 1024×768, 768×1024, 390×844 |

**Overflow failures (responsive, not session):**

- **1024×768** (en, zh-CN, id-ID): `/p2p/create-ad`, `/p2p/orders`, `/p2p/my-ads`, `/p2p/payment-methods` (4 routes × 3 locales = 12 cells)
- **390×844** (en, zh-CN, id-ID): `/dashboard/assets/overview` (1 route × 3 locales = 3 cells)

**Verdict:** Session + i18n on authenticated routes **stable**; full matrix **not 100%** due to pre-existing layout overflow (UI redesign out of scope).

---

## 6. Public matrix

**90 / 90 PASS** (unchanged).

---

## 7–10. Domain (authenticated, session-held routes)

| Domain | Verdict | Notes |
|--------|---------|-------|
| **Crypto** | **PASS** | Spot + wallet crypto routes in matrix |
| **Forex** | **PASS** | Portfolio/orders/account routes; public forex ungated by middleware (expected) |
| **P2P** | **PASS** (session) / **PARTIAL** (1024 overflow) | No auth loss after create-ad / orders |
| **Wallet** | **PASS** (session) / **PARTIAL** (390 overflow on overview) | |
| **Account** | **PASS** | security, preferences, account |

---

## 11. Mission2

| Item | Result |
|------|--------|
| Admin setup | **SKIPPED** — `E2E_ADMIN_TOTP` unset (no bypass) |
| JWT refresh | Staging login refresh in `globalSetup` when `MISSION2_SKIP_GLOBAL_PROVISION=1` |
| `--project=mission2-trader` | **26 PASS** / **0 FAIL** / **1 SKIP** (admin setup) |

---

## 12. Accessibility

`e2e/i18n-a11y-spotcheck.spec.ts`: **2 / 2 PASS** (login + P2P marketplace axe critical).

---

## 13. Responsive

Certified viewports exercised in visual matrix. **Blockers:** horizontal overflow on P2P authenticated pages at **1024×768** and wallet overview at **390×844** (see §5).

---

## 14. Build / static tests

| Command | Result |
|---------|--------|
| `apps/frontend` `npm run test:i18n` | **PASS** |
| `apps/frontend` `npm run test:forex-models` | **PASS** |
| `apps/frontend` `npm run build` | **PASS** |

---

## 15. DB safety

No migration, seed, provision, truncate, or balance mutation in this run.

---

## 16. Production safety

Production untouched; no production deploy or container changes.

---

## 17. Git

Harness commit intended on `release/exchange-production-baseline` (stage only e2e harness + this doc).

---

## 18. Remaining blockers

1. Authenticated visual matrix **15 overflow cells** (responsive layout; not auth/i18n copy).
2. Mission2 **admin** E2E blocked without approved `E2E_ADMIN_TOTP`.
3. Optional HTTPS staging (not required for HTTP cookie behavior on nginx path).

---

## Final verdict

**IMPLEMENTATION COMPLETE — CERTIFICATION PARTIAL**

Not declared **FULL I18N CERTIFIED** because authenticated visual matrix ≠ 100% PASS (overflow) and Mission2 admin remains out of scope without TOTP.
