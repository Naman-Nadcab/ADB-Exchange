# Phase 3 Customer I18N — Final Certification

**Branch:** `release/exchange-production-baseline`  
**Baseline HEAD (implementation frozen):** `ff097a0f98176e6a3090836748c2dbbd39ff854e`  
**Harness commit:** (this run — see Git)  
**Runtime:** nginx `http://127.0.0.1` → frontend image `434b83181ff4`, backend `:4000` healthy  

---

## A. IMPLEMENTATION STATUS

**COMPLETE / FROZEN** — No Phase 3 translation or customer UI changes in this run.

---

## B. PUBLIC VISUAL CERTIFICATION

| Metric | Result |
|--------|--------|
| Matrix | **90 / 90 PASS** (en, zh-CN, id-ID × 5 viewports × 6 public routes) |
| Hydration | **0** warnings |
| Horizontal overflow | **0** flagged |
| Path | `BASE_URL=http://127.0.0.1`, `SKIP_WEBSERVER=1` |

**PASS**

---

## C. AUTHENTICATED VISUAL CERTIFICATION

### Session diagnosis (evidence)

| Issue | Classification | Fix (test-only) |
|-------|----------------|-----------------|
| Parallel UI logins for same QA user | **TEST HARNESS** | Auth describe `serial`, `workers=1` when `I18N_VISUAL_AUTH=1` |
| `Secure` HttpOnly cookies dropped on `http://127.0.0.1` | **ENVIRONMENT** | `loginUserForStagingHttp()` + `ensureTraderSessionCookies()` |
| `/forex/*` passed without login | **EXPECTED** | Forex not in middleware `PROTECTED_PREFIXES` — not i18n regression |
| Client logout clearing cookies mid-loop | **ENVIRONMENT / APP** | Cookie re-apply helper (does not change app auth) |

### Latest single-viewport auth cell (en · 1440×900)

**PARTIAL** — typical split **~7–8 PASS / ~8–9 FAIL** per run on protected routes after `/p2p/create-ad`; failures are **`redirected to login (mlive_at present=false)`** or transient **`page.evaluate` navigation race** (harness hardening in progress).

### Full authenticated matrix (15 viewport×locale tests × 16 routes)

**NOT FULLY GREEN** in this closure run — serial auth tests abort on first failing viewport batch; re-run required after harness stabilizes.

**Verdict: PARTIAL** (session mechanism proven; full matrix not 100% PASS).

---

## D. DOMAIN REGRESSION (authenticated where session held)

| Domain | Verdict | Notes |
|--------|---------|-------|
| **Crypto** | **PASS** (public + spot in smoke) | |
| **Forex** | **PASS** (terminal/markets/portfolio routes load; unauthenticated middleware by design) | |
| **P2P** | **PARTIAL** | `/p2p/create-ad` often PASS; orders/my-ads flake after cookie loss |
| **Wallet** | **PARTIAL** | deposit/withdraw crypto often PASS; fiat/history flake |
| **Account** | **PARTIAL** | dashboard account/security/preferences flake after mid-loop logout |

---

## E. MISSION2 TRADER E2E

| Item | Result |
|------|--------|
| Admin setup | **SKIPPED** without `E2E_ADMIN_TOTP` (documented; no security bypass) |
| Trader setup | **PASS** (trader A/B storage) |
| `--project=mission2-trader` | **PARTIAL** — **19 passed**, **7 failed**, **1 skipped** |
| API failures | Stale **`E2E_JWT`** in `e2e/.e2e-credentials.json` (not refreshed; `MISSION2_SKIP_GLOBAL_PROVISION=1`) |

**Verdict: PARTIAL** (UI flows largely pass; API-key/JWT fixture **BLOCKED** without approved reprovision).

---

## F. ACCESSIBILITY

Not expanded in this run beyond existing spot-check spec (`e2e/i18n-a11y-spotcheck.spec.ts`). **PARTIAL** at prior scope.

---

## G. RESPONSIVE

Covered by visual matrix viewports (390–1440). Public **PASS**; authenticated **PARTIAL** (same session caveats).

---

## H. BUILD / UNIT TESTS

| Command | Result |
|---------|--------|
| `npm run test:i18n` | **PASS** |
| `npm run test:forex-models` | **PASS** |
| `npm run build` | **PASS** (prior staging recovery run) |

---

## I. DATABASE SAFETY

**UNCHANGED** — no migrate, seed, provision, truncate, or balance mutation.

---

## J. PRODUCTION SAFETY

**NOT DEPLOYED / NOT TOUCHED**

---

## K. GIT PERSISTENCE

Harness-only changes staged in this run (see commit SHA after push).

---

## L. REMAINING BLOCKERS

1. **Full authenticated matrix 100% PASS** — finish stabilizing cookie refresh vs client logout on P2P/wallet routes.  
2. **Mission2 API tests** — refresh JWT/API keys via approved QA process or document Mission2 API as out-of-scope for i18n cert.  
3. **Admin Mission2** — requires `E2E_ADMIN_TOTP` in staging secrets.  
4. **HTTPS staging** — production-like `Secure` cookies would remove need for HTTP cookie injection (ops, not i18n).

---

## FINAL VERDICT

**IMPLEMENTATION COMPLETE — CERTIFICATION PARTIAL**

Not declared **FULL I18N CERTIFIED** because authenticated visual matrix and Mission2 trader API suites are not 100% PASS.

**Public i18n visual certification: PASS (90/90).**
