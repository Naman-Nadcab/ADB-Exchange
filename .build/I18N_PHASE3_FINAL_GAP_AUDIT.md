# Phase 3 — Final gap audit (in progress)

**Status:** PHASE 3 — **PARTIAL / NOT CERTIFIED**  
**Branch:** `release/exchange-production-baseline`  
**Latest HEAD:** `93c2d9e544775cc5b9c3f3b292ee23ef23812ee3` (local == remote)

## Commits (Phase 3)

| SHA | Description |
|-----|-------------|
| `6e597522…` | Partial customer domains (crypto/forex/p2p/wallet nav) |
| `1734350b…` | Slice A — account / security hub / preferences |
| `3702fbd…` | Slice B (partial) — wallet deposit + overview shell |
| `2c5a534…` | Slice B (complete) — wallet withdraw + overview customer copy |
| `f2430d7` | Wallet fiat (INR) withdrawal |
| `4910ade` | P2P marketplace (filters, ads table, modal, page) |
| `3fa4a56` | P2P order flows (orders list, summary, timer) — partial |
| `93c2d9e` | Forex ticket panel + bottom tabs — partial |

---

## CLOSED (this continuation)

| Item | Evidence |
|------|----------|
| Account page shell + profile sections | `dashboard/account/page.tsx` + `account.*` |
| Security Center hub (cards, tabs, withdrawal toggles) | `dashboard/security/page.tsx` |
| Preferences (tabs, general/trade/deposit, notifications, email toggles) | `dashboard/preferences/page.tsx` |
| Wallet deposit crypto (steps, FAQ, **network/memo warnings**) | `dashboard/deposit/crypto/page.tsx` + `wallet.deposit.*` |
| Wallet overview customer copy (balance, accounts, asset table, sidebar, activity) | `dashboard/assets/overview/page.tsx` + `wallet.overview.*` |
| Wallet withdraw crypto (form, **irreversibility banner**, confirm step, limits, recent records) | `dashboard/withdraw/crypto/page.tsx` + `wallet.withdraw.*` |
| Wallet withdraw nav tabs | `WalletWithdrawNav.tsx` + `wallet.nav.withdrawCrypto` / `withdrawFiatInr` |
| Withdrawal status presentation (enum → label) | `wallet-transaction-status.ts` + `wallet.transactions.*` |
| Wallet fiat (INR) withdrawal | `dashboard/withdraw/fiat/page.tsx` + `wallet.withdrawFiat.*` |
| P2P marketplace core | `p2p-v2/page`, `P2PFilters`, `P2PAdsTable` |
| P2P orders list + summary + timer (partial order flow) | `orders/page`, `P2POrderSummary`, `P2PTimer` |
| Forex ticket panel + bottom tab labels (partial) | `ForexOrderTicket`, `ForexBottomPanels` |
| Catalog parity | `npm run test:i18n` PASS after each slice |
| Build | `npm run build` PASS after each slice |
| Git isolation | Exact-path staging; dirty tree not committed |

---

## DEFERRED (still in Phase 3 scope)

| # | Gap |
|---|-----|
| 1 | Preferences: push/Telegram section headers, browser push button labels |
| 2 | Security: modal titles and sub-page flows (2FA, sessions, passkeys, etc.) |
| 3 | Account: delete modal body, toast strings |
| 4 | 5 | Wallet history / transfer / convert pages |
| 6 | P2P create-ad, payment-methods, my-ads, order `[id]`, action buttons, chat, disputes |
| 7 | Forex bottom panel bodies, TIF/kind help text, remaining terminal chrome |
| 8 | Global customer-domain error wiring on all surfaces |
| 9 | Full preferences/security modal localization |
| 10 | Overview chart Start/End labels (mini chart footer) |

---

## NOT VERIFIED

| # | Item |
|---|------|
| 1 | Playwright visual QA (all routes × locales × viewports) |
| 2 | Hydration manual matrix (account/preferences/security × 3 locales) |
| 3 | Forex terminal visual regression (en/zh-CN/id-ID) |
| 4 | Mobile/desktop overflow audit on localized account/wallet deposit |
| 5 | Accessibility audit beyond added aria-labels |

---

## Financial safety (continuation slices A–B)

- **No** matching engine, ledger, wallet accounting, Forex execution, P2P escrow, auth logic, API, or DB changes observed in staged diffs.
- Deposit **backend notice** text (`depositAddress.notice`) still server-provided — UI label “Important” localized; notice body unchanged (correct).

---

## Backend localization boundary (Slice B)

- API `error.message` and optional `displayStatus` on withdrawal rows remain **server-provided English** when present; UI uses localized catalog for known codes and falls back to backend text (not rewritten).
- Cancel errors may show backend message verbatim.

---

## Next recommended slices

1. **Slice C:** P2P marketplace + order detail + modals  
3. **Slice D:** Forex ticket + panels  
4. **Slice E:** error toasts / mutations  
5. **Slice F:** Playwright (or document NOT VERIFIED with reason)  
6. **Slice G:** zero-gap string search + update this file to PASS or remain PARTIAL
