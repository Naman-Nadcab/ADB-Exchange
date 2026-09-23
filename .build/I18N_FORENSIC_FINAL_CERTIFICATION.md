# I18n forensic final certification

**Branch:** `release/exchange-production-baseline`  
**Served BUILD_ID:** `3imlR-LRnrfJQVc44Z-gu`  
**Verdict:** **NOT FULLY VERIFIED**

## Gates (Phase 18)

Platform-wide certification **not** granted. Evidence below.

| Gate | Status |
| --- | --- |
| All customer surfaces discovered | **PARTIAL** — `I18N_CUSTOMER_SURFACE_MASTER.json` (129 routes + 10 shared) |
| All routes processed | **NO** — 54 surfaces `NEEDS_AUDIT` |
| Re-exports resolved | **YES** (inventory + test) |
| API toast localization | **IMPROVED** — `client-notify-api-error.ts` wired in `api.ts` |
| Hardcoded scan zero customer English | **NO** — 612 heuristic hits remain |
| Full 113×3 browser crawl | **NOT COMPLETE** |
| Interaction crawl all domains | **NOT COMPLETE** |
| Dynamic routes | **15 BLOCKED** (fixtures) |
| test:i18n / build / forex-models | **PASS** |
| Wallet + locale e2e (served) | **PASS** |

## This execution (summary)

- Phase 0 baseline recorded at `d8d915c`
- Surface master + forensic scan tooling
- Localized API `notifyOnError` via error catalog + locale cookies
- Cookie policy page (`auth.cookies`) en/zh-CN/id-ID
- Prior wallet re-export fixes remain verified on served build

## Blockers to FULL

1. **612** classified-but-unfixed heuristic customer literals (see `i18n-hardcoded-forensic-scan.json`)
2. **54** route/shared surfaces without `useTranslations` at source
3. **~15** dynamic URL patterns without safe staging fixtures
4. Incomplete interaction/toast/modal/responsive/a11y matrix across P2P, Forex terminal strings, account security standalone pages (e.g. `/dashboard/security/2fa`)

**Do not label:** FULL PLATFORM-WIDE I18N VERIFIED
