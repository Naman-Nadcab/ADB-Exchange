# Phase 3 — Final gap audit (customer toasts slice)

**Status:** **IMPLEMENTATION COMPLETE — VISUAL VERIFICATION INCOMPLETE** (not certified)  
**Branch:** `release/exchange-production-baseline`  
**Closure HEAD:** `26aec3e23e3477880a141c8c9b6503b204b81d15`  
**Checkpoint (pre-closure pass):** `d3021d37193e85d1e0e3afa4fcb2fc500f58ff08`

---

## Summary counts (in-scope customer frontend)

| Class | Count | Meaning |
|-------|------:|---------|
| **A — localized (static)** | **~120** | Hardcoded toast titles/descriptions and `notifyError` fallbacks wired to `common.notifications.*` + `account.toasts.*` (+ existing `wallet.*` / `p2p.*` toast keys) |
| **B — static UI (non-toast) remaining** | **~45** | Visible English outside toast layer (help articles, events cards, identity success steps, fee-rates labels, transfer/history banners, security sub-page body copy) |
| **C — dynamic / server-provided** | **~35** | Toast/`notifyError` paths that intentionally show `error.message`, `err.message`, or P2P `e.message` when API returns text (not rewritten) |
| **D — deferred / out of slice** | **~12** | Spot trading grid order toasts (Phase 1 frozen), global `api.ts` notifyError, admin/support bulk copy |
| **E — not verified** | **5** | Playwright visual matrix, hydration manual pass, forex regression, overflow audit, a11y beyond aria-labels |

---

## CLOSED — customer error & toast architecture (BLOCK 2)

**Single architecture:** static copy → `account.toasts` + generic titles → `common.notifications`; stable codes → `errors.*` via `useApiErrorMessage` / `localizeApiError` (auth pages + API consumers); dynamic backend text → category **C** (unchanged).

| Domain | Evidence |
|--------|----------|
| Security Center hub + flows | `dashboard/security/page.tsx` — all `toast()` use `tn`/`tt` |
| Security sub-pages | `security/passkeys`, `withdrawal-limits`, `sessions`, `anti-phishing` |
| Account | `dashboard/account/page.tsx` |
| Address book | `dashboard/address-book/page.tsx`, `add-batches/page.tsx` |
| Preferences load/save errors | `preferences/page.tsx` → `useLocalizedNotify` + `account.toasts` |
| Wallet deposit notifyError | `deposit/crypto/page.tsx` → `useLocalizedNotify` + `account.toasts` |
| Wallet overview error toasts | `assets/overview/page.tsx` |
| Wallet withdraw fiat | Already `wallet.withdrawFiat.toast*` (unchanged) |
| Dashboard shell | `dashboard/layout.tsx` notification/copy toasts |
| Events push toggles | `dashboard/events/page.tsx` |
| Referral copy/claim | `referral/page.tsx`, `referral/my-referrals/page.tsx` |
| API keys | `dashboard/api/page.tsx`, `api/create/page.tsx` |
| P2P marketplace toasts | `p2p-v2/page.tsx`, `payment-methods`, `my-ads`, `P2PPaymentInstructions` (pre-existing `p2p.*` keys) |
| Catalog | `messages/{en,zh-CN,id-ID}/account.json` → `toasts`; `common.json` → extended `notifications` |
| Central notify helper | `notifyError.ts` documents `useLocalizedNotify` for localized titles |
| Tests | `npm run test:i18n` **PASS** |

---

## REMAINING — category B (static, not toast)

| # | Item | File evidence |
|---|------|----------------|
| 1 | Help center article titles/bodies | `dashboard/help/page.tsx` (~20 FAQ entries) |
| 2 | Events marketing cards | `dashboard/events/page.tsx` `EVENTS` array titles/desc |
| 3 | Identity success next steps | `dashboard/identity/success/page.tsx` |
| 4 | Fee tier metric labels | `dashboard/fee-rates/page.tsx` |
| 5 | Transfer / asset history unavailable banners | `dashboard/transfer/page.tsx`, `assets/[symbol]/page.tsx` |
| 6 | Security sessions / anti-phishing page body (non-toast) | `security/sessions/page.tsx`, `anti-phishing/page.tsx` sign-in prompts |
| 7 | Preferences / security modal chrome (titles already partial) | `preferences/page.tsx`, `security/page.tsx` modals |
| 8 | Overview chart footer Start/End | `assets/overview/page.tsx` mini chart (if still English) |

---

## REMAINING — category C (dynamic — intentional)

| Pattern | Example files |
|---------|----------------|
| `result.error?.message \|\| tt('…')` | Security, account, address-book, API keys |
| `sessionsRes.error.message` / `activityRes.error.message` | `security/sessions/page.tsx` |
| `e.message` / `err.message` on P2P mutations | `p2p-v2/my-ads/page.tsx`, `payment-methods/page.tsx` |
| Fiat withdraw `onError` uses `Error.message` | `withdraw/fiat/page.tsx` |
| Support ticket API messages | `dashboard/support/page.tsx` |

---

## REMAINING — category D (deferred)

| # | Item | Evidence |
|---|------|----------|
| 1 | Spot order toasts (frozen Phase 1) | `components/trade/SpotTradingGrid.tsx` |
| 2 | Global API client notifyError English | `lib/api.ts` |
| 3 | Fee-rates / P&L / support notifyError strings | `fee-rates/page.tsx`, `assets/pnl/page.tsx`, `support/page.tsx` |
| 4 | Wallet convert / transfer / history pages (shell) | `assets/convert`, `transfer`, `history` |
| 5 | P2P create-ad, order `[id]`, chat, disputes (non-toast UI) | `p2p-v2/create-ad`, `orders/[id]`, etc. |
| 6 | Forex terminal body copy | `ForexBottomPanels`, ticket help |

---

## NOT VERIFIED (category E)

| # | Item |
|---|------|
| 1 | Playwright visual QA (routes × locales × viewports) |
| 2 | Hydration manual matrix (account/preferences/security × 3 locales) |
| 3 | Forex terminal visual regression |
| 4 | Mobile/desktop overflow on localized wallet/account |
| 5 | Accessibility audit beyond added aria-labels |

---

## Financial safety

- Presentation-only changes; no ledger, matching, escrow, auth logic, or API contract changes in staged toast slice.

---

## Backend localization boundary

- API `error.message` remains **server-provided English** when returned; UI uses localized catalog for static fallbacks and known codes only.

---

## Next recommended slices

1. **B-static:** Help center + events cards + fee-rates labels  
2. **D-supporting:** Fee-rates / P&L / support `notifyError` → `account.toasts`  
3. **D-trading:** Spot grid toasts (when Phase 1 unfrozen) or forex order errors  
4. **E:** Playwright locale matrix or document blockers
