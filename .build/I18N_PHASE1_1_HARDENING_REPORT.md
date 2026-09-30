# i18n Phase 1.1 — Hardening & Phase 2 Readiness Report

**Date:** 2026-09-21  
**Branch:** `release/exchange-production-baseline`  
**Phase 1 baseline commit:** `6b8d6f2f7ef2bf1c4af3796c6065f381ec47ad6c`  
**Safe point:** `safe-point/pre-i18n-20260921-125800` → `e07b4ecf18912e9c098f27e12027cdffb46ed1fc` (unchanged)

---

## 1. Baseline

| Check | Result |
|-------|--------|
| HEAD at start | `6b8d6f2…` |
| Local == remote | Verified before work |
| Dirty paths | ~477 (protected) |
| Production frontend | `sha256:06af39659d07…` — not deployed |

---

## 2. Locale precedence (before → after)

| Priority | Before (Phase 1) | After (Phase 1.1) |
|----------|------------------|-------------------|
| 1 | Account preference | **Manual header selection** |
| 2 | Manual selection | **Account preference** |
| 3 | Locale cookie | Locale cookie |
| 4 | Region | Region |
| 5 | Accept-Language | Accept-Language |
| 6 | English | English |

**Evidence:** `resolveLocaleWithSource()` in `locale-resolver.ts`; test `manual selection wins over account preference`.

---

## 3. Explicit vs implicit state

| Field | Meaning |
|-------|---------|
| `effectiveLocale` | Authoritative UI locale |
| `localeSource` | `manual` \| `account` \| `cookie` \| `region` \| `browser` \| `default` |
| `isExplicit` | `true` when `mlive_locale_explicit=1` |

Not exposed in customer UI.

---

## 4. notificationLanguage analysis

| Finding | Detail |
|---------|--------|
| Storage | `users.preferences` JSONB via `GET/POST /api/v1/auth/preferences` |
| Sanitizer | Pass-through (no dedicated validation) — **compatible** |
| Backend email/SMS | **NOT FOUND** consuming `notificationLanguage` at send time |
| Semantics | **Dual-use safe:** notification language + platform locale hint |
| Bridge | `preference-bridge.ts` maps `en`↔`en`, `zh`↔`zh-CN`, `id`↔`id-ID` |
| Header write-back | `persistPlatformLocalePreference()` POST on manual select (authenticated) |
| DB migration | **None** |

---

## 5. Cookie behavior

| Cookie | Hardening |
|--------|-----------|
| `mlive_locale` | Parsed via `parseLocaleCookieValue()` — max 16 chars, whitelist |
| `mlive_locale_explicit` | Only `1` treated as explicit |
| `mlive_locale_pref` | Same parser; skipped when explicit |

Explicit manual set also updates `mlive_locale_pref` for consistency.

---

## 6. Region / Accept-Language

- Region map: CN/HK/MO/SG/TW → `zh-CN`, ID → `id-ID` (conservative)
- Unknown region → browser → `en`
- Never applied when `explicit=1`
- `de-DE` → English fallback

---

## 7. HTML `lang`

| Locale | `lang` |
|--------|--------|
| en | `en` |
| zh-CN | `zh-CN` |
| id-ID | `id` |

Via `localeToHtmlLang()` + root layout.

---

## 8. Language selector

- Single component: `LocaleLanguageSelector`
- Mounts: `ExchangeHeader`, `PublicHeader`, `ForexTopNav` (Forex routes use terminal nav only — **no duplicate** on same viewport)
- A11y: listbox, `aria-expanded`, keyboard ↑/↓, Enter, Escape

---

## 9. Formatter / terminology / errors

- `presentation.ts`: null-safe display formatters
- Tests: en / zh-CN / id-ID sample formatting
- Terminology: domain-split + contextual `closeModal` vs `closePosition`
- Errors: `resolveErrorMessageKey()` → generic fallback

---

## 10. Phase 2 inventory

`src/i18n/phase2-extraction-inventory.ts` — COMMON, AUTH, ERROR surfaces + key conventions.

---

## 11. Tests

```
npm run test:i18n  → PASS (resolver + catalog parity + formatter/error checks)
npm run build      → PASS
```

---

## 12. Visual regression

**Method:** Code review + build; Forex uses `ForexTopNav` only (no `ExchangeHeader` on `/forex/trade`). Selector compact variant preserves terminal density.

**Not claimed:** Full 3-locale visual certification matrix (Phase 2).

---

## 13. Crypto / Auth / Production

| Area | Result |
|------|--------|
| Crypto business logic | Unchanged |
| Forex execution/risk | Unchanged |
| Auth middleware | Extended locale cookies only |
| Production | No deploy/restart |

---

## 14. Commit / remote

| | SHA |
|--|-----|
| **Phase 1.1 commit** | `20df37bcf0c6d23481fb09a5460829736ba59518` |
| **Local HEAD** | `20df37bcf0c6d23481fb09a5460829736ba59518` |
| **Remote HEAD** | `20df37bcf0c6d23481fb09a5460829736ba59518` |
| **Phase 1 commit** | `6b8d6f2f7ef2bf1c4af3796c6065f381ec47ad6c` |

---

## 15. Remaining Phase 2 scope

- Mass COMMON/AUTH/ERROR string extraction (English canonical)
- Wire error codes in customer UI
- Full formatter migration (no global en-US sweep yet)
- Email/SMS locale dimension
- Admin i18n
- Visual regression automation (Playwright matrix)

---

## 16. Known limitations

- Logged-out users: locale cookies only (no account persistence)
- `notificationLanguage` not yet unified in preferences UI copy with header (id added to preferences list)
- Most UI strings remain English
