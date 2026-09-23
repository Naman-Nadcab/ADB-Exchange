# I18n forensic final certification (evidence-based)

**Branch:** `release/exchange-production-baseline`  
**Date:** 2026-09-23  
**Served BUILD_ID:** `UOuJrdXr6tSuuzgJ3gimC` (Docker `exchange-frontend` rebuilt after wallet fixes)

## Executive verdict

**Wallet critical regression (user-reported screenshots): PASS** — `/wallet/convert` and `/wallet/history` render localized UI for **zh-CN** and **id-ID** with **zero** detected English leakage from the curated wallet vocabulary list.

**Wallet re-export extensions (funding, PnL): SOURCE PASS** — `/wallet/funding` and `/wallet/pnl` dashboard sources wired to `wallet.fundingPage` / `wallet.pnlPage`; runtime e2e extended in spec; **awaiting frontend redeploy** for served BUILD_ID verification.

**Full customer platform (every modal/toast/interaction surface): NOT YET CLOSED** — heuristic scan still lists ~241 classified-but-unremediated literals outside wallet; authenticated interaction crawl beyond wallet sample is incomplete.

Do **not** interpret prior route-matrix PASS as proof of rendered wallet UI (this audit confirms that gap).

## Metrics (requested)

| # | Metric | Value |
| --- | --- | --- |
| 1 | Discovered routes (`page.tsx`) | **129** |
| 2 | Customer-facing components (tsx under `src/components`) | **130** |
| 3 | Interactive UI surfaces inventoried (wallet convert/history) | **16** rows PASS |
| 4 | Modals (wallet scope) | **0** standalone modals on these pages |
| 5 | Toasts (wallet scope) | via shared `notifyError` / API — not expanded this pass |
| 6 | Notifications | NotificationCenter prior pass; not re-crawled |
| 7 | Alerts | page-level only |
| 8 | API error presentation paths touched | convert/history load + form errors partially mapped |
| 9 | Status/enum display mappings touched | `wallet.transactions.*` on history + convert status |
| 10 | Hardcoded strings (heuristic before) | ~241 candidates (second scan artifact) |
| 11 | Hardcoded strings (wallet convert/history after) | **0** user-visible English on zh-CN/id-ID critical e2e |
| 12 | EN PASS (wallet critical e2e) | **2/2 routes** |
| 13 | zh-CN PASS (wallet critical e2e) | **2/2 routes** |
| 14 | id-ID PASS (wallet critical e2e) | **2/2 routes** |
| 15 | First-paint | locale cookie + `html lang` (prior `i18n-locale-behavior.spec.ts`) |
| 16 | Hydration | no new MISSING_MESSAGE on wallet pages in manual run |
| 17 | Responsive | not re-run for wallet-only fix |
| 18 | A11y | aria on convert swap control localized |
| 19 | Dynamic routes | **15 BLOCKED** |
| 20 | Rendered English leakage (wallet critical) | **0** |
| 21 | Missing translation keys (catalog parity) | **0** (`npm run test:i18n`) |
| 22 | Catalog parity | **PASS** |
| 23 | Tests | `test:i18n` PASS (+ re-export guard), `npm run build` PASS, wallet e2e **4/4 PASS** convert/history; funding/pnl e2e pending deploy |
| 24 | BUILD_ID | `UOuJrdXr6tSuuzgJ3gimC` |
| 25 | Commit SHA | *(pending commit)* |
| 26 | Remaining blockers | Platform-wide interaction crawl + ~241 heuristic literals triage; 15 dynamic URL patterns |

## Tests run (this pass)

- `npm run test:i18n` — PASS  
- `npm run build` (frontend) — PASS  
- `e2e/wallet-convert-history-i18n.spec.ts` — **4/4 PASS** (authenticated, zh-CN + id-ID)

## Files changed (wallet forensic fix)

- `apps/frontend/messages/{en,zh-CN,id-ID}/wallet.json` — `convertPage`, `historyPage` namespaces  
- `apps/frontend/src/app/dashboard/assets/convert/page.tsx` — full `useTranslations`  
- `apps/frontend/src/app/dashboard/assets/history/page.tsx` — full `useTranslations`  
- `apps/frontend/src/app/dashboard/assets/unified/page.tsx` — convert link + hide small balances  
- `e2e/wallet-convert-history-i18n.spec.ts` — regression guard (+ funding/pnl routes)  
- `apps/frontend/src/i18n/wallet-route-reexport.test.ts` — re-export target guard  
- `dashboard/assets/funding/page.tsx`, `dashboard/assets/pnl/page.tsx` — `wallet.fundingPage`, `wallet.pnlPage`  
- `e2e/i18n-deep-forensic-rendered.spec.ts` — wallet vocabulary in forbidden list  

## Gate status

| Gate | Status |
| --- | --- |
| User-reported wallet convert zh-CN | **PASS** |
| User-reported wallet history zh-CN | **PASS** |
| Entire platform every toast/modal/dropdown | **INCOMPLETE** |
| Dynamic deep links | **BLOCKED** (15) |

**Final label:** **WALLET CRITICAL I18N VERIFIED** — **FULL PLATFORM INTERACTION I18N NOT YET VERIFIED**
