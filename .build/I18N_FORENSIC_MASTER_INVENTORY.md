# I18n forensic master inventory (single source of truth)

**Branch:** `release/exchange-production-baseline`  
**Baseline HEAD (Phase 0):** `7bc80802682bc90543455730c1be51f75dcf6ae5` (LOCAL == REMOTE at session start)  
**Locales:** en, zh-CN, id-ID  
**Architecture:** `next-intl`, cookies `mlive_locale` + `mlive_locale_explicit`, resolver `apps/frontend/src/i18n/locale-resolver.ts`  
**Catalogs:** `apps/frontend/messages/{locale}/{namespace}.json` — namespaces in `src/i18n/config.ts`  
**Automated gates:** `npm run test:i18n` (parity, resolver, wallet re-export guard)

## Phase 0 — discovery totals (2026-09-23)

| Metric | Count | Artifact |
| --- | ---: | --- |
| `page.tsx` routes | **129** | `.build/i18n-customer-route-discovery.json` |
| Re-export wrappers | **23** | same |
| Static e2e route list | **113** | `e2e/helpers/customer-static-routes.json` |
| Heuristic hardcoded scan (BEFORE this batch) | **241** | `.build/i18n-hardcoded-second-scan.json` |
| Heuristic hardcoded scan (current tool) | **640** | `.build/i18n-hardcoded-forensic-scan.json` |
| Dynamic route patterns (fixture-blocked) | **15** | prior certification |
| Shared `src/components` tsx modules | **130+** | repo walk |

**Re-export rule:** audit **source** component (see `wallet-route-reexport.test.ts`).

Discovery scripts (repeatable):

- `node apps/frontend/scripts/i18n-discover-customer-surfaces.mjs`
- `node apps/frontend/scripts/i18n-hardcoded-scan.mjs`

## Wallet domain — verified on served app (prior BUILD_ID `aUBYx-y9oY6QlvdiafjSg`)

| Route | Source | Namespace | zh-CN/id-ID e2e |
| --- | --- | --- | --- |
| /wallet/convert | dashboard/assets/convert | wallet.convertPage | PASS |
| /wallet/history | dashboard/assets/history | wallet.historyPage | PASS |
| /wallet/funding | dashboard/assets/funding | wallet.fundingPage | PASS |
| /wallet/pnl | dashboard/assets/pnl | wallet.pnlPage | PASS |

## Wallet domain — fixed this session (pending redeploy + e2e)

| Surface | Source | Status |
| --- | --- | --- |
| /wallet/[symbol] | dashboard/assets/[symbol] | SOURCE PASS — `wallet.assetDetail` + `wallet.transactions` |
| Transfer modal (interaction) | components/TransferModal.tsx | SOURCE PASS — `wallet.transferPage` |
| /wallet/unified search placeholder | dashboard/assets/unified | SOURCE PASS |

## Shared chrome (prior deep pass — re-verify on full crawl)

PublicHeader, PublicFooter, ExchangeHeader, EdaProductSwitcher, NotificationCenter, crypto/forex terminal chrome — see commit `7a19aa1` / `.build/PLATFORM_WIDE_I18N_DEEP_FORENSIC_CERTIFICATION.md`.

## Remaining platform work (NOT closed)

- **~640** heuristic hits require per-row classification → fix or document intentional universal notation.
- Full **113×3** public + **auth×3** browser crawl with interaction/toast/modal matrix.
- **15** dynamic routes: fixture strategy or explicit BLOCKED rows.
- Domains not exhaustively re-audited this session: P2P, Forex terminal strings, account/security, earn, orders (beyond history re-export), legal/auth long-form pages, `HomePageClient` legacy paths if still reachable.

---

*Coverage metric = customer-visible surfaces verified in browser, not route file count.*
