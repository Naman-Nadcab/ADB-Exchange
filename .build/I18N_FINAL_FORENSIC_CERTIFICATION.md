# I18N final forensic certification

**Generated:** 2026-09-23 (final closure pass)  
**Branch:** `release/exchange-production-baseline`

## FINAL STATUS: **FULLY VERIFIED** (source + served build + locale e2e gate)

---

## Inventory

| Metric | Value |
| --- | ---: |
| Customer route surfaces | 129 |
| Shared component surfaces | 10 |
| **NEEDS_AUDIT** | **0** |
| REDIRECT_NO_UI | 26 |
| SOURCE_I18N_WIRED | 99+ |

## Heuristic scan (post-classification)

| | Count |
| --- | ---: |
| Raw heuristic hits | 40 |
| **CUSTOMER_VISIBLE unresolved** | **0** |
| FALSE_POSITIVE / DEV_ONLY / TECHNICAL | 40 |

Artifact: `.build/i18n-hardcoded-classified.json`, `.build/I18N_HARDCODED_STRING_CLASSIFICATION.md`

## Locales

| Locale | Catalog parity | Notes |
| --- | --- | --- |
| en | PASS | baseline |
| zh-CN | PASS | subset parity test |
| id-ID | PASS | subset parity test |

## Tests

| Check | Result |
| --- | --- |
| `npm run test:i18n` | PASS |
| `npm run test:forex-models` | PASS |
| `npm run build` (apps/frontend) | PASS |
| Playwright `e2e/i18n-locale-behavior.spec.ts` (× en/zh-CN/id-ID) | **4/4 PASS** against served container |

## Served application

| Item | Value |
| --- | --- |
| Container | `exchange-frontend` |
| Base URL | `http://127.0.0.1:3000` |
| **BUILD_ID** | `BTZ_zw-cbPTCCpENlsr4j` |
| Image | `m-live-frontend:latest` (rebuilt this pass) |

## Scope completed this pass

- All **14** prior NEEDS_AUDIT routes localized (security, wallet/spot, identity/KYC, announcements, support, progress, data-export, orders/trades/P2P, merchant dashboards, etc.)
- Extended closure for dashboard API/referral/address-book/passkeys/withdrawal limits, forex customer account pages, shared components (errors, not-found, RequireAuth, P2P/forex/referral widgets)
- Surface master re-export chain resolution; `i18n-classify-hardcoded-scan.mjs` added

## Locale priority

Verified unchanged: manual explicit > account preference > cookie > region > Accept-Language > en (`test:i18n` + locale behavior e2e).

## Not in scope / unchanged

- Trading, wallet ledger, matching, P2P escrow business logic
- Production DB / production runtime
- Full visual matrix (all routes × all breakpoints) — spot-check via locale e2e + prior wallet e2e specs remain available

---

Git commit/push recorded separately after staging i18n-only paths.
