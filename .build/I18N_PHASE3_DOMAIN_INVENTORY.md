# i18n Phase 3 — Customer domain inventory

**Branch:** `release/exchange-production-baseline`  
**Baseline HEAD:** `92363dc067144e5c44ff8e9cdf90ff4809857b76`  
**Scope:** Presentation localization only (EN / zh-CN / id-ID).

## Legend

| Class | Meaning |
|-------|---------|
| **UI** | Customer-facing copy — localize via catalogs |
| **PROTECTED** | Financial / security logic — do not change behavior |

---

## A. Crypto

| Area | Representative paths | Class |
|------|---------------------|-------|
| Spot terminal | `apps/frontend/src/app/trade/spot/page.tsx`, `components/trade/*` | UI |
| Order entry | `SpotOrderEntryPanel.tsx` | UI |
| Bottom panel | `SpotBottomPanel.tsx`, `useSpotBottomPanel.ts` | UI (status **display** only) |
| Markets | `app/markets/*` | UI |
| Orders (global) | `app/orders/*` | UI |
| Matching / execution | `services/matching-engine`, order payloads, enums `BUY`/`SELL` | PROTECTED |
| Balances API | `lib/balances*` | PROTECTED |

---

## B. Forex

| Area | Representative paths | Class |
|------|---------------------|-------|
| Terminal layout | `ForexTerminalLayout`, chart, watchlist, toolbox | UI labels only |
| Order ticket | `ForexOrderTicket.tsx` | UI |
| Nav | `ForexTopNav`, `ForexMobileNav`, `lib/forex/routes.ts` (href constants) | UI (labelKey) |
| Secondary pages | `app/forex/{markets,portfolio,orders,analysis,alerts,account/**}` | UI |
| Execution / risk | `lib/forex/models/*`, runtime engines, preview math | PROTECTED |
| Error normalization | `lib/forex/models/errors.ts` | PROTECTED (presentation via `useForexErrorMessage`) |

---

## C. P2P

| Area | Representative paths | Class |
|------|---------------------|-------|
| Shell / nav | `P2PShellLayoutClient.tsx`, `P2PHeader.tsx` | UI |
| Marketplace | `app/p2p-v2/page.tsx`, `P2PFilters`, `P2PAdsTable` | UI |
| Orders / disputes | `app/p2p/orders/*`, `disputes/*` | UI |
| Escrow / settlement | backend P2P services, state enums | PROTECTED |

---

## D. Wallet

| Area | Representative paths | Class |
|------|---------------------|-------|
| Overview | `dashboard/assets/overview/page.tsx` (canonical `/wallet`) | UI |
| Deposit / withdraw | `dashboard/deposit/*`, `dashboard/withdraw/*`, `WalletOperationsShell` | UI |
| Ledger / indexer | wallet services, chain validation | PROTECTED |

---

## E. Account

| Area | Representative paths | Class |
|------|---------------------|-------|
| Profile | `dashboard/account/page.tsx` | UI |
| Security | `dashboard/security/*` | UI |
| Preferences | `dashboard/preferences/page.tsx` (partial — large form) | UI (incremental) |
| Auth / KYC logic | `store/auth`, OTP, session validation | PROTECTED |

---

## F. Global errors

| Area | Path | Class |
|------|------|-------|
| Catalog | `i18n/errors/error-catalog.ts`, `messages/*/errors.json` | UI |
| Resolver | `lib/i18n/localize-api-error.ts`, `hooks/useApiErrorMessage.ts` | UI |

---

## Message namespaces (Phase 3)

- `crypto`, `forex`, `p2p`, `wallet`, `orders`, `account` (+ existing `errors`, `navigation`, `common`, `auth`)
- Catalog parity enforced when `en` namespace non-empty.

## Deferred / partial (document in final report)

- Full `preferences` page (~800 lines of labels)
- Entire wallet overview / deposit copy
- Full P2P modal and table column headers
- All Crypto markets pages
- Forex analysis page body copy
