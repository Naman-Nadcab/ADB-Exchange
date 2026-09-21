# Phase 3 Customer I18N — Staging Readiness Audit

**Branch:** `release/exchange-production-baseline`  
**Audit HEAD:** `70d283e` (see `git rev-parse HEAD`)  
**Prior checkpoint:** `2b2d31da435aaf41adcc8e01377457f022aad2ed`  
**Production deployed:** NO  
**DB changed:** NO  

---

## Executive summary

Customer Phase 3 presentation work is **implementation-complete** for the scoped product surfaces (wallet, P2P, Forex terminal chrome, account/security/preferences, help, events, transfer shell, fee-rates labels, dashboard toasts). **Locale parity** and **production build** pass. **Automated visual matrix** exists and was executed in **frontend-only mode** (Next.js on `:3000` without API backend): **61/90** public combinations passed with **zero hydration mismatches** and **zero horizontal overflow** flags in the artifact. **Full-stack staging verification** (authenticated routes, Forex quote hydration, spot/P2P API-backed pages) remains **NOT READY** until backend + QA credentials are available in the target environment.

---

## Status matrix

| Layer | Verdict |
|-------|---------|
| **IMPLEMENTATION** | **COMPLETE** (scoped Phase 3 customer UI) |
| **LOCALE PARITY** | **PASS** (`npm run test:i18n`) |
| **BUILD** | **PASS** (`apps/frontend` `npm run build`) |
| **AUTOMATED TESTS** | **PARTIAL** (i18n + forex model tests PASS; Playwright smoke/forex foundation need full stack) |
| **VISUAL** | **PARTIAL** (public matrix 61/90 frontend-only; auth matrix skipped) |
| **HYDRATION** | **PASS** (no hydration warnings in visual artifact rows) |
| **RESPONSIVE / OVERFLOW** | **PARTIAL** (automated overflow scan: 0 flagged; manual overflow audit not performed) |
| **ACCESSIBILITY** | **PARTIAL** (aria-label/i18n pass continued; no WCAG audit) |
| **FOREX REGRESSION** | **PARTIAL** (unit tests PASS; E2E needs API on `:4000`) |
| **CRYPTO REGRESSION** | **PARTIAL** (spot route loads body; spot grid toasts frozen Phase 1) |
| **P2P REGRESSION** | **PARTIAL** (public `/p2p` in matrix; order detail needs auth) |
| **WALLET / ACCOUNT** | **PARTIAL** (localized; auth routes not matrix-tested) |
| **GIT** | **PASS** (`HEAD` == `origin/release/exchange-production-baseline`) |
| **PROTECTED PATHS** | **UNCHANGED** (0-line diff on backend/matching-engine/DB/migrations since `2b2d31d`) |
| **STAGING READINESS** | **NOT READY** for full authenticated visual sign-off; **READY** for staging deploy *smoke* of i18n catalogs + frontend build |

---

## Commits this master run (implementation)

| SHA | Summary |
|-----|---------|
| `d12c0c0fcc8480781609deea2e5e495126b6e1fd` | Remaining static surfaces (events, fee-rates labels, transfer, forex widgets, etc.) |
| `f698a05cc06824647f26a211d956b60802122c55` | Customer help center (`account.help`) |
| `57d0e1dbf78f622c52895a3926b4c4c4a5bc16d4` | I18n visual matrix harness, smoke/forex e2e relaxations, gap/release docs + matrix artifact |

## Prior closure chain (reference)

`2b2d31d` → `26aec3e` → `1b10e23` → `d3021d3` → … (P2P, wallet, account, Forex phases)

---

## Visual QA evidence

**Harness:** `e2e/i18n-customer-visual.spec.ts`, `e2e/helpers/i18n-locale.ts`, `npm run e2e:i18n-visual`  
**Artifact:** `.build/i18n-visual-matrix/results.json` (+ PNG screenshots per cell)  
**Mode:** `SKIP_WEBSERVER=1`, `BASE_URL=http://127.0.0.1:3000` (frontend `next start` only)  
**Locales:** en, zh-CN, id-ID  
**Viewports:** 1440×900, 1280×800, 1024×768, 768×1024, 390×844  
**Public routes:** `/login`, `/p2p`, `/forex`, `/forex/trade`, `/forex/markets`, `/trade/spot`  

**Results (2026-09-21 run):** 90 cells — **61 PASS**, **29 FAIL**  
- Failures primarily: Forex routes without backend (page/error state), mobile `/p2p` layout (no visible `h1` in some viewports), strict page assertions under API 500 noise.  
- **Hydration warnings:** 0 across all rows  
- **documentElement overflow:** 0 flagged  

**Authenticated matrix:** **BLOCKED** — set `I18N_VISUAL_AUTH=1` with running backend + `QA_TRADER_A_EMAIL` / `QA_PASSWORD` (see `e2e/mission2/helpers/credentials.ts`).

---

## Playwright infrastructure reused

- Root `playwright.config.ts` (Chromium, `BASE_URL`, optional `dev:fb` webServer)  
- `e2e/mission2/helpers/login.ts` for optional auth smoke  
- Existing `e2e/smoke.spec.ts`, `e2e/forex-terminal-foundation.spec.ts` (updated for localized UI labels)

---

## Remaining documented gaps (not silent)

See `.build/I18N_PHASE3_FINAL_GAP_AUDIT.md`:

| Class | Examples |
|-------|----------|
| **C** | API `error.message` in toasts/forms |
| **D** | Spot `SpotTradingGrid` toasts (Phase 1 frozen), `lib/api.ts` notifyError English |
| **D** | Wallet convert/history/support/fee-rates notifyError strings (partial) |
| **E** | Full authenticated visual matrix, WCAG audit, full-stack Forex E2E |

---

## Staging verification checklist (human/CI)

1. Deploy frontend + backend to staging with Redis/DB as usual (not part of this run).  
2. `npm run test:i18n` + `npm run build` in CI.  
3. `SKIP_WEBSERVER=1 BASE_URL=<staging-fe> I18N_VISUAL_AUTH=1 npm run e2e:i18n-visual`  
4. `npm run e2e:smoke` + `npx playwright test e2e/forex-terminal-foundation.spec.ts` against staging.  
5. Manual spot check: wallet withdraw warnings, P2P RELEASE token, Forex ticket layout (no redesign).

---

## Safety attestation

- No changes to financial logic, API contracts, or DB in Phase 3 i18n commits.  
- Crypto matching/execution **not modified**.  
- Production **not** deployed from this run.
