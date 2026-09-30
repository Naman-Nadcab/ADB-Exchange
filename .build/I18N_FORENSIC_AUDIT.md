# Multilingual / i18n Forensic Audit — Unified Trading Platform

**Mode:** READ-ONLY (zero-change)  
**Date:** 2026-09-21  
**Repository:** `/opt/m-live`  
**Branch:** `release/exchange-production-baseline`  
**HEAD:** `e07b4ecf18912e9c098f27e12027cdffb46ed1fc`  
**Origin:** `e07b4ecf18912e9c098f27e12027cdffb46ed1fc`  
**Pre-existing dirty files:** ~470 (unchanged by this audit)  
**Production frontend (reference only, not modified):** `m-live-frontend@sha256:06af39659d07f5a22935352f9e927dc95031d0fbf4d2736f848eb2966b14d80a`

**Target languages (future):** English (`en`), Chinese (`zh` / evaluate `zh-CN`), Bahasa Indonesia (`id` only — not Malay `ms`).

---

## 1. Executive Summary

The unified platform is **English-first with no operational i18n on customer web (`apps/frontend`) or admin web (`apps/admin-panel`)**. User-visible copy is overwhelmingly **hardcoded in components**. There is **no** `next-intl`, `i18next`, or `react-intl` in the customer or admin Next.js apps.

Evidence found:

| Area | State |
|------|--------|
| Customer web i18n runtime | **NOT FOUND** |
| Admin web i18n runtime | **NOT FOUND** |
| Translation JSON / message catalogs (web) | **NOT FOUND** |
| Locale routing / middleware | **NOT FOUND** (middleware = auth + canonical redirects only) |
| User DB locale column | **NOT FOUND** (generic `users.preferences` JSONB exists) |
| Mobile app (`apps/mobile`) | **PARTIALLY IMPLEMENTED** — `i18next` stub, English-only resources |
| Language UI (web) | **PARTIALLY IMPLEMENTED** — cosmetic selectors, no i18n wiring |
| Email/SMS templates (DB) | **FOUND** — single-locale rows (no `locale` column) |
| Financial formatting | **locale-independent** — hardcoded `en-US` in shared formatters |
| Backend customer errors | **FOUND** — English messages + stable `code` (Forex improved for auth copy) |

**Overall readiness for en + zh + id:** **NOT READY** — requires greenfield i18n architecture on web, template model extension, preference plumbing, and phased migration.

**Recommended future strategy (document only):** Hybrid **user preference + cookie**, optional **`Accept-Language` fallback**, **no breaking URL prefix** on existing routes (`/forex/trade`, `/trade/spot`, `/p2p`, `/wallet` remain canonical). Use **stable error codes** client-side for message lookup. Chinese: evaluate **`zh-CN` (Simplified)** as primary with `zh` alias; document Traditional (`zh-TW`) as future, not in scope.

---

## 2. Git Baseline

Recorded at audit start:

```
branch: release/exchange-production-baseline
HEAD:   e07b4ecf18912e9c098f27e12027cdffb46ed1fc
origin: e07b4ecf18912e9c098f27e12027cdffb46ed1fc
dirty:  ~470 paths (pre-existing workstream)
```

**Audit artifact:** `.build/I18N_FORENSIC_AUDIT.md` (this file) only.

---

## 3. Current i18n State (by application)

### 3.1 `apps/frontend` (customer)

| Check | Result |
|-------|--------|
| i18n dependencies in `package.json` | **NOT FOUND** |
| `next-intl` / middleware locale | **NOT FOUND** |
| `<html lang>` | **FOUND** — fixed `lang="en"` in `app/layout.tsx` |
| Translation files | **NOT FOUND** |
| Route count (`page.tsx`) | **129** customer routes (App Router) — all English copy in source |

### 3.2 `apps/admin-panel`

| Check | Result |
|-------|--------|
| i18n dependencies | **NOT FOUND** |
| Navigation labels | **FOUND** — hardcoded English in `lib/commandRegistry.ts` and Forex admin panels |
| Permission IDs | **FOUND** — stable technical IDs (must not be translated) |

### 3.3 `apps/backend`

| Check | Result |
|-------|--------|
| User-facing errors | **FOUND** — JSON `{ code, message }`, English `message` strings |
| Forex `describeForexError` (FE) | **FOUND** — maps codes to English user copy |
| Locale on API | **NOT FOUND** |
| `users.preferences` JSONB | **FOUND** — stores display currency etc.; **no backend reference to `notificationLanguage`** |

### 3.4 `apps/mobile`

| Check | Result |
|-------|--------|
| `i18next` + `react-i18next` | **FOUND** in `package.json` |
| `initI18n.ts` | **FOUND** — `lng: 'en'`, single key `app_name` |
| Locale resource files | **NOT FOUND** |

### 3.5 Other packages

| Path | i18n |
|------|------|
| `matching-engine/` | **NOT VERIFIED** (no customer UI strings expected) |
| `indexer/` | **NOT VERIFIED** |
| `packages/*` | **NOT FOUND** (no shared i18n package) |

---

## 4. Dependency Inventory

| Package | App | Version | Usage status |
|---------|-----|---------|--------------|
| `i18next` | mobile | ^23.16.0 | **PARTIAL** — init only |
| `react-i18next` | mobile | ^15.1.0 | **PARTIAL** |
| `next-intl` | — | — | **NOT FOUND** |
| `next-i18next` | — | — | **NOT FOUND** |
| `react-intl` / `@formatjs/*` | — | — | **NOT FOUND** |
| `antd` | frontend | ^5.12.0 | **UNUSED** in `src/` imports (**NOT FOUND** `from 'antd'`) — dead dependency for i18n |

**Lockfiles:** Not modified (audit read-only).

---

## 5. Customer Frontend Inventory

### 5.1 Routing & Next.js

- **App Router** — **FOUND**
- **`middleware.ts`** — auth gate + canonical 308 redirects; **no locale** — **FOUND**
- Protected prefixes: `/dashboard`, `/wallet`, `/orders`, `/p2p` — **FOUND**
- Forex routes under `/forex/*` — **FOUND** (11+ pages; see forensic UI audit list)

### 5.2 Cosmetic language UI (not i18n)

| ID | Sev | Path | Evidence | Impact |
|----|-----|------|----------|--------|
| I18N-F001 | P2 | `components/auth/LanguageSelector.tsx` | Lists 18 languages incl. `zh-cn`, `id`; comment: "store in localStorage/cookie and trigger i18n change" | **Misleading UX** — selection does nothing |
| I18N-F002 | P2 | `components/auth/LanguageSelector.tsx` | **NOT FOUND** any import of `LanguageSelector` outside its own file (repo grep) | **Orphan UI** — no auth page wiring |
| I18N-F003 | P1 | `app/dashboard/preferences/page.tsx` | `notificationLanguage` in UI; languages list has `zh` but **NOT `id`** | Target **id** missing from preferences picker |
| I18N-F004 | P2 | Same | Persists via `/preferences` API into `users.preferences` JSONB | **NOT FOUND** backend/mobile/email use of `notificationLanguage` |

### 5.3 Domain surfaces (all English hardcoded)

| Domain | Key paths | i18n state |
|--------|-----------|------------|
| Auth | `app/(auth)/login`, `signup`, `forgot-password`, OTP flows | **NOT FOUND** i18n |
| Crypto spot | `app/trade/spot`, `components/trade/*` | **NOT FOUND** |
| Markets/orders/wallet | `app/markets`, `app/wallet/*`, `app/orders/*`, dashboard mirrors | **NOT FOUND** |
| P2P | `app/p2p-v2/*`, `app/p2p/*` | **NOT FOUND** |
| Forex | `app/forex/*`, `components/forex/*` (~8.5k LOC in forex components) | **NOT FOUND** — dense terminal strings |
| Profile/security | `app/dashboard/security/*`, `preferences` | **NOT FOUND** |

Strings include: titles, nav, buttons, empty states, toasts (`notifyError`), validation (Zod messages in forms — **PARTIALLY VERIFIED** per form), `aria-label`, table headers, status badges.

### 5.4 Technical / API copy exposure

| ID | Sev | Path | Evidence |
|----|-----|------|----------|
| I18N-F005 | P2 | `lib/forex/models/errors.ts` | User-facing auth messages English; uses stable `code` — suitable for future catalog |
| I18N-F006 | P2 | Various | Raw `error.message` from API rendered in UI — **FOUND** pattern in orders, ticket, P2P — risk if backend returns English internal text |

---

## 6. Admin Inventory

- **Control Center / Crypto / Forex** IA — English labels in `commandRegistry.ts`, Forex panels, RBAC UI.
- **Permission IDs** (e.g. `forex.orders.read`) — **must remain untranslated** — **FOUND** in admin-domain / capability maps.
- **Display labels** — English hardcoded — **FOUND**.
- i18n library — **NOT FOUND**.

---

## 7. Backend / API Message Inventory

- Fastify routes return structured errors — **FOUND** widely.
- Forex errors — frontend normalization — **FOUND** (`describeForexError`).
- Validation — typically English strings in route schemas — **PARTIALLY IMPLEMENTED** (spot-check; full inventory NOT VERIFIED).
- **Recommendation (future):** expose `code` + optional `message` fallback; client translates by code; never rely on English `message` for zh/id.

**OTP / auth routes** (`auth.fastify.ts`) — English messages — **FOUND** (grep sample; full enum NOT VERIFIED).

---

## 8. Email / SMS / Notification Inventory

| Artifact | Schema | Locale support |
|----------|--------|----------------|
| `email_templates` | slug, subject, body_html, body_text | **NOT FOUND** — no `locale` column |
| `sms_templates` | slug, body | **NOT FOUND** — no `locale` column |
| Admin CRUD | `admin.fastify.ts` SMS template routes | **FOUND** |
| Push | `push.fastify.ts` | English paths/messages — **PARTIALLY VERIFIED** |

**Event → template → language → channel:** Currently **single-language template per slug**. Multilingual would need `(slug, locale)` uniqueness or JSONB per locale.

`notificationLanguage` in user preferences — **NOT FOUND** in backend grep — **disconnected**.

---

## 9–12. Crypto / Forex / P2P / Wallet Localization Surfaces

| Product | UI location | String density | Shared formatters |
|---------|-------------|----------------|-------------------|
| **Crypto** | `components/trade`, spot terminal, wallet pages | High | `lib/utils.ts` (`en-US`), `terminalFormat.ts` |
| **Forex** | `components/forex/*`, `/forex/*` pages | Very high (terminal) | `components/forex/format.ts` (`en-US`) |
| **P2P** | `p2p-v2`, escrow/dispute copy | High | `lib/p2p-v2-utils.ts` |
| **Wallet** | deposit/withdraw flows | High (compliance copy) | shared utils |

**Crypto/Forex isolation for future i18n:**

| Class | Examples |
|-------|----------|
| **DOMAIN-SPECIFIC** | Forex ticket labels, P2P escrow, spot order types |
| **HIGH-RISK SHARED** | `lib/utils.ts` formatNumber, `app/layout.tsx`, toast/error helpers, design system buttons |
| **SAFE SHARED** | New `packages/i18n` or `lib/i18n` (does not exist today) |

---

## 13. Financial Formatting Audit

| Location | Mechanism | Locale-aware? |
|----------|-----------|---------------|
| `apps/frontend/src/lib/utils.ts` | `Intl.NumberFormat('en-US')` | **NO** |
| `apps/frontend/src/components/forex/format.ts` | `toLocaleString('en-US', …)` | **NO** |
| `components/trade/chart/LightweightChartsAdapter.ts` | `locale: 'en-US'` | **NO** |
| Dashboard/markets pages | Multiple `en-US` | **NO** |
| CSS `tabular-nums` / `font-mono` (Forex) | Display only | **YES** (typographic, not locale) |

**P0 note:** Display locale must **not** alter calculation precision (Decimal.js / backend decimals) — **FOUND** separation today; preserve in implementation.

---

## 14. Error / Validation Audit

- Forex: code-first mapping — **GOOD** pattern for i18n.
- Generic API failures: often shown as English `message` — **P1** for zh/id.
- Form validation: react-hook-form + zod — English messages in schema definitions — **FOUND** pattern (representative: auth forms — **PARTIALLY VERIFIED**).

---

## 15. User Preference Audit (READ-ONLY DB schema)

| Field | Location | Purpose |
|-------|----------|---------|
| `users.preferences` JSONB | `migrate.ts` | displayCurrency, notification toggles, **`notificationLanguage`** (FE only) |
| Dedicated `locale` / `language` column | — | **NOT FOUND** |
| `country_code` | users | **FOUND** — not language |

**Reuse assessment:** JSONB can store `locale: 'id'` without migration — **PARTIALLY SAFE** if schema documented; dedicated column cleaner for indexing/reporting — **future migration optional**.

---

## 16. Routing Audit

| Strategy | Compatible with current prod? |
|----------|------------------------------|
| A. URL prefix `/en/forex` | **Breaking** — conflicts with frozen routes |
| B. Cookie + user preference | **YES** — recommended primary |
| C. `Accept-Language` fallback | **YES** — secondary |
| D. Hybrid B+C | **YES** — recommended |

**Middleware:** extend only after explicit design; today **no locale handling**.

---

## 17. RTL Readiness

- Initial targets (en, zh, id) are LTR — RTL not required day one.
- **Forex terminal** uses many directional utilities (`ml-auto`, `text-left`, `left-`, `right-`, chart overlays) — **FOUND** ~20+ forex component files with directional classes.
- **LanguageSelector** includes Arabic — **cosmetic only**; no `dir=rtl` — **NOT FOUND** global RTL.
- **Risk:** Future Arabic/Hebrew would need logical properties (`ms`/`me`, `ps`/`pe`) — **P3** readiness gap.

---

## 18. Chinese Readiness

| Topic | Finding |
|-------|---------|
| Font stack | Inter + IBM Plex Mono (Forex) — **FOUND** — CJK fallback depends on system fonts; **NOT VERIFIED** CJK webfont subset |
| Locale codes | `LanguageSelector`: `zh-cn`, `zh-tw`; preferences: `zh` only — **INCONSISTENT** |
| Recommendation | Standardize on **`zh-CN`** (Simplified) for production target; map `zh` → `zh-CN`; defer `zh-TW` |
| Text expansion | Terminal compact UI (9–13px labels) — **P1** layout risk for longer Chinese strings |
| Number/date | Currently `en-US` — zh-CN uses different grouping; use `Intl` with resolved locale |

---

## 19. Bahasa Indonesia Readiness

| Topic | Finding |
|-------|---------|
| `id` in LanguageSelector | **FOUND** |
| `id` in preferences languages | **NOT FOUND** — **GAP** vs production target |
| Terminology | Financial terms (margin, leverage, P2P) need glossary — **NOT STARTED** |
| Mobile width | Indonesian often longer than English — **P1** for buttons/tabs in Forex mobile nav |

---

## 20. Translation Terminology Inventory (sample — not exhaustive)

### Crypto (hardcoded examples to centralize later)

Buy, Sell, Market, Limit, Stop, Order, Filled, Cancelled, Pending, Balance, Available, Deposit, Withdrawal, P2P, Escrow, Fee, Price, Quantity — **FOUND** across spot/wallet/P2P components.

### Forex (hardcoded examples)

Bid, Ask, Spread, Stop Loss, Take Profit, Margin, Equity, Free Margin, Used Margin, Lot, Position, Market Order, 1-Click, DEMO, SIMULATED — **FOUND** in `ForexOrderTicket`, `ForexBottomPanels`, `ForexAppToolbar`, etc.

### Inconsistencies (examples)

| Concept | Variants seen | Domain |
|---------|---------------|--------|
| Sign in | "Sign in", "Log in", "Login" | Auth |
| Order states | API enums vs display labels | Crypto/Forex |

Full glossary extraction — **NOT VERIFIED** (automated string extraction not run).

---

## 21. Critical Financial Action Inventory

| Action class | Examples | Localization risk |
|--------------|----------|-------------------|
| **CRITICAL** | Buy, Sell, Submit Order, Cancel Order, Close Position, Withdraw, Confirm, Liquidate | **P0** — requires reviewed translations, no MT at runtime |
| **WARNING** | Insufficient margin, session closed, stale quote | **P1** |
| **INFORMATION** | Demo/Simulated disclaimers | **P1** (regulatory clarity) |
| **DECORATIVE** | Section headers, marketing home | **P2** |

Safeguards (future): centralized keys, translation review workflow, context metadata (`action.confirm.withdraw`).

---

## 22. Shared-Code Risk Map (future implementation)

| File / area | Risk | Notes |
|-------------|------|-------|
| `apps/frontend/src/app/layout.tsx` | HIGH | `lang`, providers |
| `apps/frontend/src/lib/utils.ts` | HIGH | Crypto + wallet formatting |
| `apps/frontend/src/components/forex/format.ts` | MEDIUM | Forex-only wrapper possible |
| `apps/frontend/src/middleware.ts` | HIGH | Auth + future locale cookie |
| `apps/frontend/src/lib/forex/models/errors.ts` | MEDIUM | Already code-oriented |
| `components/auth/LanguageSelector.tsx` | MEDIUM | Wire or remove to avoid false UX |
| Admin `commandRegistry.ts` | LOW-MED | Admin-only |
| Backend template tables | HIGH | Schema + admin UI |

**Crypto frozen rule:** Prefer **Forex-only message namespaces** and **Crypto-specific catalogs** over changing shared formatters without dual-locale tests.

---

## 23. Existing Test Coverage

| Test area | Multilingual coverage |
|-----------|------------------------|
| Playwright e2e (`e2e/*`) | English assertions only — **NOT FOUND** locale tests |
| Forex unit tests | English string asserts — **FOUND** |
| Mobile intl polyfill test | **FOUND** — PluralRules for i18next |
| Visual regression | English only — **NOT VERIFIED** |

**Future gates:** en baseline + zh-CN + id screenshots; mobile 390px; financial action dialogs; error code mapping tests.

---

## 24. Gaps (summary)

1. No web i18n runtime or message catalogs (**NOT FOUND**).
2. Language selectors are **decorative / partial** (**PARTIALLY IMPLEMENTED**).
3. **`id` missing** from preferences language list (**FOUND** gap).
4. **`zh-cn` vs `zh` inconsistency** (**FOUND**).
5. Email/SMS templates **single-locale** (**FOUND**).
6. **`notificationLanguage` not consumed** by backend (**NOT FOUND**).
7. **~129 routes** × hardcoded strings — large migration scope.
8. Forex terminal **density** — Chinese/Indonesian layout risk (**P1**).
9. **en-US** formatting everywhere (**FOUND** — ~31 literal `en-US` in `apps/frontend/src`; ~51 files with `Intl.*` / `toLocaleString`).
10. No shared `packages/i18n` (**NOT FOUND**).

---

## 15b. Forex Terminal Special Audit (localization readiness)

Visual source of truth — **no redesign**. Components **FOUND** under `apps/frontend/src/components/forex/` (33 `Forex*.tsx` files).

| Component | Localization risk | Notes |
|-----------|---------------------|-------|
| `ForexTerminalLayout` | P1 | Shell grid, fixed chrome |
| `ForexChartWorkspace` / `ForexLightweightChart` / `ForexChartFoundation` / `ForexChartToolbar` | P1 | Chart adapter uses `locale: 'en-US'` |
| `ForexOrderTicket` | P0/P1 | Buy/Sell, SL/TP — critical actions |
| `ForexBottomPanels` | P1 | Tabs, tables, empty states |
| `ForexTopNav` / `ForexAppToolbar` / `ForexMobileNav` | P1 | Truncation risk at 390px |
| `ForexMarketStrip` / `ForexSessionBar` | P2 | Session/market status |
| `ForexAccountBar` / `ForexRiskBar` / `ForexAccountSwitcher` / `ForexAccountCenter` | P1 | Margin/equity labels |
| `ForexWatchlist` / `ForexSymbolSearch` | P2 | Symbols dynamic; UI labels static |

**Width expansion:** Chinese and Bahasa Indonesia both stress compact terminal typography. **NOT VERIFIED** with translated copy (no files created).

---

## 17b. Dynamic Content Audit

| Class | Examples | Future strategy |
|-------|----------|-----------------|
| STATIC | Buttons, nav, disclaimers | JSON namespaces |
| DYNAMIC | Prices, balances, P&L, timestamps | `Intl` + locale; do not alter precision |
| USER-GENERATED | Usernames | Display as-is |
| MARKET-GENERATED | `EURUSD`, instrument names | Keep symbols; optional localized descriptions |
| SYSTEM-GENERATED | Order/tx IDs, error params | Interpolate into templates; do not translate IDs |

CMS i18n — **NOT FOUND** in customer app (**NOT VERIFIED** external help).

---

## 20b. SEO / Public Page Audit

- `apps/frontend/src/lib/seo/pageMetadata.ts` — **FOUND** English `PAGE_METADATA` (login, trade, markets, wallet, p2p, earn, …).
- Root and Forex layouts export English `metadata` — **FOUND**.
- **hreflang / locale sitemap** — **NOT FOUND**.
- Trading surfaces = **CUSTOMER APP**; auth/register metadata = **PUBLIC/SEO** (future `hreflang` candidate).

---

## 24. Proposed Translation Domain Map (logical only — no files)

| Namespace | Repo evidence |
|-----------|-----------------|
| `common` | Shared UI patterns |
| `auth` | `(auth)/*` |
| `security` | `dashboard/security/*` |
| `navigation` | Dashboard / Forex hub / tier1 routes |
| `crypto` | `trade/spot`, `components/trade/*` |
| `forex` | `app/forex/*`, `components/forex/*` |
| `p2p` | `p2p-v2`, `p2p` |
| `wallet` | `app/wallet/*` |
| `orders` | `app/orders/*` |
| `notifications` | preferences, toasts |
| `errors` | `lib/forex/models/errors.ts`, API codes |
| `admin` / `controlCenter` / `compliance` | `apps/admin-panel`, compliance pages |

---

## 26b. Business Logic Isolation

Backend execution, wallet ledger, P2P escrow, and Forex risk remain **presentation-independent** today. Future i18n = UI, template selection, client error maps only. Full backend string inventory — **NOT VERIFIED** (spot-check).

---

## 25. Risk Classification (top findings)

| ID | Sev | Summary |
|----|-----|---------|
| I18N-001 | P0 | No i18n on customer web — all financial actions English-only |
| I18N-002 | P1 | Cosmetic language controls imply support that does not exist |
| I18N-003 | P1 | Target `id` not in preferences language list |
| I18N-004 | P1 | Forex terminal + mobile nav tight layout vs longer translations |
| I18N-005 | P2 | Backend/template layer lacks locale dimension |
| I18N-006 | P2 | Raw API English messages shown to users |
| I18N-007 | P3 | RTL not ready (future) |
| I18N-008 | P4 | Mobile i18next scaffold unused |

---

## 26. Recommended i18n Architecture (proposal only — NOT IMPLEMENTED)

1. **Library:** `next-intl` (App Router) or lightweight custom context + JSON catalogs — **evaluate**; no install in this audit.
2. **Locale resolver:** `users.preferences.locale` → cookie `fdm_locale` → `Accept-Language` → `en`.
3. **Namespaces:** `common`, `auth`, `crypto`, `forex`, `p2p`, `wallet`, `errors`, `admin`, `notifications`.
4. **Keys:** `{domain}.{surface}.{element}` e.g. `forex.ticket.sl.label`.
5. **Errors:** Map `error.code` → `errors.forex.UNAUTHORIZED` (never parse English `message`).
6. **Formatting:** `formatMoney(value, currency, locale)` wrapping `Intl` with explicit locale param; keep Decimal math unchanged.
7. **Templates:** Extend DB with `locale` on templates or separate rows per `(slug, locale)`.
8. **SEO:** Phase 2 for public pages (`/`, terms, privacy) — `hreflang` — **NOT VERIFIED** current SEO i18n.
9. **Review workflow:** CSV/JSON export for professional translation; version tags per release.
10. **Chinese:** **`zh-CN`** primary; font-subsetting strategy for CJK.

---

## 27. Recommended Implementation Phases (proposal only)

| Phase | Scope | Regression gates |
|-------|--------|------------------|
| 0 | Architecture ADR, locale codes, glossary | — |
| 1 | Infrastructure: resolver, `en` parity, error code catalog | Build + e2e en |
| 2 | Auth + common + errors (en/zh/id) | Auth flows, no Crypto trade logic change |
| 3 | Forex secondary pages + hub | Visual + FFX non-regression |
| 4 | Forex terminal (incremental) | Terminal density screenshots 390/1440 |
| 5 | Crypto spot/wallet (frozen until explicit approval) | Spot smoke, no matching engine |
| 6 | P2P + notifications templates | Template DB migration (planned) |
| 7 | Admin (optional / internal) | RBAC unchanged |

---

## 28. Required Regression Gates (future)

- English remains default fallback.
- No change to order/wallet/ledger/matching/Forex execution logic.
- Crypto regression suite on shared formatter changes.
- Forex FFX certification matrix re-run per locale.
- Financial action dialogs: three-locale sign-off.
- Production deploy: frontend-only vs full stack explicit.

---

## 29. Explicit NO-CHANGE Confirmation

At audit completion:

- **No** application source modified by this audit.
- **No** package/lockfile/Docker/env/DB/production changes.
- **No** commit, **no** push.
- **Only** added: `.build/I18N_FORENSIC_AUDIT.md`

Post-audit dirty count: **471** lines (`git status --short | wc -l`) vs **470** pre-audit baseline — **+1** untracked `.build/I18N_FORENSIC_AUDIT.md` only; pre-existing modified paths unchanged by this audit.

---

## 30. Finding Index (representative)

| ID | Sev | Domain | Path / component | Treatment (future) |
|----|-----|--------|------------------|-------------------|
| I18N-F001 | P2 | shared | `LanguageSelector.tsx` | Wire to i18n or remove from UX |
| I18N-F002 | P1 | shared | `LanguageSelector.tsx` | Import audit on auth pages |
| I18N-F003 | P1 | shared | `preferences/page.tsx` | Add `id`; align with `en`,`zh-CN` |
| I18N-F004 | P1 | backend | preferences API | Consume locale for notifications |
| I18N-F005 | P2 | forex | `errors.ts` | Expand code catalog zh/id |
| I18N-F006 | P2 | crypto/p2p | API error display | Code-first UI messages |
| I18N-F007 | P1 | forex | Terminal components | Namespace `forex.*`; layout QA zh/id |
| I18N-F008 | P2 | crypto | `lib/utils.ts` | Locale param; shared risk |
| I18N-F009 | P2 | backend | `email_templates` | Add locale dimension |
| I18N-F010 | P3 | admin | `commandRegistry.ts` | Admin phase / English-only acceptable short-term |

---

## Final Verdict

### **I18N AUDIT COMPLETE — ZERO SOURCE CHANGES**

Multilingual production readiness for **English + Chinese + Bahasa Indonesia** is **not implemented** on the customer web platform. Evidence supports a **phased, code-first, preference-based** approach without breaking existing URLs. Mobile contains the only **partial** i18n dependency (`i18next` stub). Implementation must not proceed until product signs off architecture, glossary, and Crypto/Forex phase boundaries.
