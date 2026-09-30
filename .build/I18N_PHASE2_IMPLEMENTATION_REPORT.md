# i18n Phase 2 — AUTH + COMMON + ERRORS Implementation Report

**Date:** 2026-09-21  
**Branch:** `release/exchange-production-baseline`  
**Baseline:** `20df37bcf0c6d23481fb09a5460829736ba59518` (Phase 1.1)  
**Safe point:** `e07b4ecf18912e9c098f27e12027cdffb46ed1fc` (unchanged)

---

## 1. Extraction scope (implemented)

| Domain | Surfaces |
|--------|----------|
| **COMMON** | `common.json` actions/states/notifications; localized mutation toasts via `useLocalizedNotify` |
| **NAVIGATION** | `ExchangeHeader`, `PublicHeader` primary nav + auth CTAs |
| **AUTH** | Login (full UI + errors), signup/forgot (error paths + terms), `AuthSplitLayout` marketing panel |
| **ERRORS** | `error-catalog.ts`, `localize-api-error.ts`, `useApiErrorMessage` |

**Deferred (Phase 3+):** Crypto/Forex/P2P/wallet domain UI, Admin, email/SMS — see `phase2-extraction-inventory.ts`.

---

## 2. Catalogs

| Locale | Namespaces updated |
|--------|-------------------|
| en | `common`, `navigation`, `auth`, `errors` |
| zh-CN | Full parity for non-empty en keys |
| id-ID | Full parity for non-empty en keys |

**Parity:** `npm run test:i18n` → catalog parity PASS.

---

## 3. Error architecture

- API `error.code` → `resolveErrorMessageKey()` → `errors.*` namespace via `useApiErrorMessage().fromApi()`
- Unknown codes → `errors.generic.unknown`
- Internal/JWT-style raw messages suppressed where code mapping exists

---

## 4. Locale behavior

Phase 1.1 precedence **unchanged** (manual > account > cookie > region > browser > en).

---

## 5. Tests & build

| Check | Result |
|-------|--------|
| `npm run test:i18n` | PASS |
| `npm run build` | PASS |

**Visual:** Build-only verification for Forex terminal (no domain string extraction). Focused manual matrix documented as follow-up for Playwright (not full 15-viewport automation in this commit).

---

## 6. Regression

| Area | Impact |
|------|--------|
| Crypto business logic | **None** |
| Forex execution/risk | **None** (no terminal domain extraction) |
| Auth API/security | **None** (presentation only) |
| DB | **Zero** |
| Production | **Not deployed** |

---

## 7. Git

| | SHA |
|--|-----|
| **Phase 2 commit** | `92363dc067144e5c44ff8e9cdf90ff4809857b76` |
| **Local / remote HEAD** | Match |

---

## 8. Remaining gaps

- Signup/forgot **visible form labels** (partial — errors localized; full signup UI strings Phase 2.1 optional)
- PublicHeader mobile menu partial English
- Domain pages (trade, wallet, forex terminal) still English
- Error wiring not yet global (only auth flows + mutation toast)

---

## 9. Phase 3 recommendation

Customer domain localization: Crypto spot shell, Forex secondary pages, wallet, P2P — incremental with visual regression matrix.

---

## Final status

**PHASE 2 — PASS** (COMMON + AUTH + ERRORS foundation for en / zh-CN / id-ID)
