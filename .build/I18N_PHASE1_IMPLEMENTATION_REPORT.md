# i18n Phase 1 — Implementation Report

**Date:** 2026-09-21  
**Branch:** `release/exchange-production-baseline`  
**Safe point:** `safe-point/pre-i18n-20260921-125800` → `e07b4ecf18912e9c098f27e12027cdffb46ed1fc`

---

## 1. Baseline

| Item | Value |
|------|--------|
| HEAD (start) | `e07b4ecf18912e9c098f27e12027cdffb46ed1fc` |
| Dirty paths (start) | 475 (pre-existing workstream + safe-point artifacts) |
| Production frontend (unchanged) | `sha256:06af39659d07f5a22935352f9e927dc95031d0fbf4d2736f848eb2966b14d80a |

---

## 2. Safe-point verification

`git rev-parse safe-point/pre-i18n-20260921-125800^{commit}` = `e07b4ecf…` — **PASS**

---

## 3. Framework

**Selected:** `next-intl` **3.26.5** (App Router, cookie-based locale — **no URL prefix**).

---

## 4. Dependencies

| Package | Version | Reason |
|---------|---------|--------|
| `next-intl` | ^3.26.5 | App Router i18n provider, server `getRequestConfig`, client hooks |

Lockfile: `apps/frontend/package-lock.json` (next-intl subtree only).

---

## 5. Locale architecture

| Locale | HTML lang |
|--------|-----------|
| `en` | `en` |
| `zh-CN` | `zh-CN` |
| `id-ID` | `id` |

Namespaces (stubs + sample copy): `common`, `navigation`, `auth`, `security`, `crypto`, `forex`, `p2p`, `wallet`, `orders`, `errors`, `notifications`.

Catalog path: `apps/frontend/messages/{locale}/{namespace}.json`

---

## 6. Locale resolver

Pure function: `src/i18n/locale-resolver.ts`

Priority:

1. Account preference cookie (`mlive_locale_pref`) / `notificationLanguage` mapping  
2. Explicit manual selection (`mlive_locale_explicit=1` + `mlive_locale`)  
3. Existing locale cookie (incl. first-visit bootstrap)  
4. Coarse region (`cf-ipcountry`, `x-vercel-ip-country`, `x-country-code`, `x-app-region`)  
5. `Accept-Language`  
6. `en`

Region **never** applied when `mlive_locale_explicit=1`.

---

## 7. Geolocation strategy

- **Optional** coarse region headers only — no GPS, no new external geo API.  
- If no region signal: falls back to browser / English.  
- Does **not** affect KYC, compliance, trading, or account country.

---

## 8. Language selector

Component: `src/components/i18n/LocaleLanguageSelector.tsx`

Mounted in:

- `ExchangeHeader` (top-right, desktop/mobile header)  
- `PublicHeader` (sm+)  
- `ForexTopNav` (compact variant — layout unchanged)

Globe icon + native language names; keyboard/focus/ARIA listbox pattern.

---

## 9. Preference persistence

| Mechanism | Cookie | Purpose |
|-----------|--------|---------|
| Active locale | `mlive_locale` | Effective UI locale |
| Manual override | `mlive_locale_explicit=1` | Blocks region re-suggestion |
| Account sync | `mlive_locale_pref` | From `notificationLanguage` via `LocalePreferenceSync` |

**DB:** No migration. Reuses existing `users.preferences.notificationLanguage` read-only sync.

**Limitation:** Header selection does not yet write back to `notificationLanguage` (Phase 2).

---

## 10–13. Catalog / terminology / formatting / errors

- Terminology registry: `src/i18n/terminology/registry.ts` (Forex vs Crypto keys)  
- Error catalog: `src/i18n/errors/error-catalog.ts` (stable code → message key)  
- Presentation formatters: `src/lib/format/presentation.ts` (locale-aware **display only**)  
- No global `en-US` migration in Phase 1

---

## 14. Tests

`npm run test:i18n` — 13 assertions (locales, fallback, explicit vs region, formatting isolation).

---

## 15. Build

`npm run build` in `apps/frontend` — **PASS** (Next.js 14.0.4).

---

## 16. Visual regression

**Not automated in CI this phase.** Manual expectation: English UI unchanged except language control in header/Forex top bar. Forex terminal layout/density preserved.

---

## 17–20. Impact

| Area | Impact |
|------|--------|
| Crypto | **Frozen** — no string extraction or trading changes |
| Forex | **Presentation only** — compact language control in `ForexTopNav` |
| Admin | **None** — architecture reusable later |
| Database | **Zero** |
| Production | **No deploy / no container restart** |

---

## 21. Git files (Phase 1 commit scope)

55 files in commit `6b8d6f2` — frontend i18n only (no backend/Crypto/Forex logic).

---

## 22–24. SHAs

| | SHA |
|--|-----|
| **Commit** | `6b8d6f2f7ef2bf1c4af3796c6065f381ec47ad6c` |
| **Local HEAD** | `6b8d6f2f7ef2bf1c4af3796c6065f381ec47ad6c` |
| **Remote HEAD** | `6b8d6f2f7ef2bf1c4af3796c6065f381ec47ad6c` |
| **Safe point (unchanged)** | `e07b4ecf18912e9c098f27e12027cdffb46ed1fc` |

---

## 25. Phase 1 limitations

- Majority of UI strings remain English  
- `notificationLanguage` lacks `id-ID` in preferences page (pre-existing)  
- Account preference cookie outranks manual header per resolver priority #1  
- No email/SMS template locale  
- Admin not wired

---

## 26. Recommended Phase 2

- Unify `notificationLanguage` ↔ platform locale (incl. `id-ID`)  
- Auth + common + errors string extraction  
- Wire error codes in Forex/Crypto UI  
- Gradual formatter adoption  
- Visual regression matrix en / zh-CN / id-ID
