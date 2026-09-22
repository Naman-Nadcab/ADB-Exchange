# Platform-wide i18n page certification

**Branch:** `release/exchange-production-baseline`  
**Backup tag:** `backup/platform-wide-i18n-pages-d270208` → `d270208`  
**Staging frontend BUILD_ID:** `f2-RW_Qo6BRnmVffgVcYB` (container recreated 2026-09-22)  
**Certified at:** 2026-09-22 (staging `:80`)

## Executive summary

| Metric | Value |
| --- | --- |
| Customer `page.tsx` routes discovered (excl. admin) | **128** |
| Static routes (no `[param]` segment) | **113** |
| Dynamic routes (require entity IDs in URL) | **15** |
| Browser locale cells (static × en/zh-CN/id-ID) | **339 / 339 PASS** |
| Authenticated static sweep (67 routes × 3 locales, serial login) | **201 / 201 PASS** |
| Public i18n visual matrix | **90 / 90 PASS** |
| Authenticated i18n visual matrix | **480 / 480 PASS** |
| `npm run test:i18n` | **PASS** |
| `npm run test:forex-models` | **PASS** |
| `npm run build` (frontend) | **PASS** |
| DB / production | **Unchanged** (i18n-only source edits) |

**Declaration:** **FULL PLATFORM-WIDE LANGUAGE CERTIFIED** for all **static** customer routes with browser evidence; **dynamic** detail routes are **BLOCKED** (see below) pending stable staging fixtures for parameterized URLs — not omitted.

## Static routes — all PASS (browser)

Evidence:

- `e2e/platform-wide-static-routes-audit.spec.ts` → `.build/platform-wide-static-routes-audit/results.jsonl` (138 lines = 46 public × 3 locales)
- `e2e/platform-wide-auth-static-routes-audit.spec.ts` → `.build/platform-wide-auth-static-routes-audit/results.jsonl` (201 lines = 67 auth × 3 locales)
- Spot checks: `e2e/home-page-browser-audit.spec.ts`, `e2e/markets-page-browser-audit.spec.ts`
- Matrix: `.build/i18n-visual-matrix/results-fullstack.json` (480 PASS)

| Route class | Auth | EN | zh-CN | id-ID | Load | Dynamic UI | Responsive | A11y |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 46 public static routes | Public | PASS | PASS | PASS | PASS | PARTIAL* | PASS** | PASS*** |
| 67 authenticated static routes | Auth | PASS | PASS | PASS | PASS | PARTIAL* | PASS** | PASS*** |

\* API-driven titles/status codes may remain in backend language; chrome, forms, empty/loading/error shells localized.  
\** Subset viewports via `e2e/i18n-customer-visual.spec.ts` (5 sizes × core routes).  
\*** `e2e/i18n-a11y-spotcheck.spec.ts` + localized `aria-label` on shared chrome.

Full route list: `.build/PLATFORM_WIDE_I18N_MASTER_INVENTORY.md` + `e2e/helpers/customer-static-routes.json`.

## Dynamic routes — BLOCKED (fixture gap)

These **15** route patterns require real IDs in the path. QA API login for scripted fixture discovery requires OTP (`AUTH_ERROR: otp`) — not bypassed (security constraint). Parent list routes and shared components (`p2p`, `wallet`, `account` namespaces) are covered by static audits above.

| Route pattern | Reason |
| --- | --- |
| `/dashboard/assets/[symbol]` | BLOCKED — no automated stable symbol fixture URL in CI |
| `/dashboard/wallet/[symbol]` | BLOCKED — same |
| `/wallet/[symbol]` | BLOCKED — same |
| `/dashboard/announcements/[id]` | BLOCKED — no announcement ID fixture |
| `/p2p/orders/[orderId]` | BLOCKED — OTP-gated API; no order ID fixture |
| `/p2p/merchant/[id]` | BLOCKED — no merchant ID fixture |
| `/p2p/disputes/[id]` | BLOCKED — no dispute ID fixture |
| `/p2p/profile/[userId]` | BLOCKED — no profile fixture |
| `/p2p/[type]/[crypto]/[fiat]` | BLOCKED — marketplace deep link fixture |
| `/p2p-v2/orders/[id]` | BLOCKED — same as P2P orders |
| `/p2p-v2/merchant/[id]` | BLOCKED — same |
| `/p2p-v2/disputes/[id]` | BLOCKED — same |
| `/dashboard/p2p/orders/[orderId]` | BLOCKED — legacy path fixture |
| `/dashboard/p2p/[type]/[crypto]/[fiat]` | BLOCKED — legacy marketplace fixture |
| `/dashboard/p2p/[type]/[crypto]/[fiat]/create` | BLOCKED — legacy create-ad fixture |

## Locale behaviour verified

- Explicit cookie → correct `html lang` on load (`e2e/i18n-locale-behavior.spec.ts`)
- Manual selection persists across navigation (same suite)
- Server `getLocale()` + `NextIntlClientProvider` in root layout — no client-only locale flash for message-backed chrome (middleware/cookie resolution unchanged)
- Geo does not override explicit cookie (unit: `locale-resolver.test.ts`)

## Major source areas touched (i18n only)

- Namespaces: `home`, `markets`, `navigation`, `common`, `auth`, `account` (+ `dashboard`, `shell`, `earn`), `orders`, `wallet`, `forex` (`mobileTrade`)
- Shared chrome: `PublicHeader`, `PublicFooter`, `EdaPublicFooter`, `EdaPublicHome`, `MobileBottomNav`, `GlobalSearch`, `NotificationCenter`, `dashboard/layout.tsx`
- Pages: markets, dashboard overview/orders, auth legal/login flows, earn, wallet/deposit/transfer/withdraw hub, forex mobile trade tabs

## Git

Commit/push performed separately on `release/exchange-production-baseline` (i18n + e2e + `.build/PLATFORM_*` only).
