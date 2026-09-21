# i18n Phase 3 — Customer domain localization (implementation report)

**Status:** Partial PASS — foundation + high-traffic surfaces wired; large form pages deferred (see §29).  
**Branch:** `release/exchange-production-baseline`  
**Baseline HEAD (start):** `92363dc067144e5c44ff8e9cdf90ff4809857b76`  
**Safe point (unchanged):** `e07b4ecf18912e9c098f27e12027cdffb46ed1fc` (`safe-point/pre-i18n-20260921-125800`)

---

## 1. Baseline

| Item | Value |
|------|--------|
| Local HEAD (start) | `92363dc067144e5c44ff8e9cdf90ff4809857b76` |
| Remote HEAD (start) | `92363dc067144e5c44ff8e9cdf90ff4809857b76` |
| Dirty files (pre-existing) | 481 (`.build/_PHASE3_BEFORE_status.txt`) |
| Manifest | `.build/I18N_PHASE3_BASELINE_MANIFEST.txt` |

---

## 2. Phase 2 verification

- Reused `next-intl`, locale resolver, catalogs, error resolver, formatters — no duplicate infrastructure.
- Phase 2 namespaces (`common`, `navigation`, `auth`, `errors`) unchanged in behavior.

---

## 3. Domain inventory

See `.build/I18N_PHASE3_DOMAIN_INVENTORY.md` (UI vs PROTECTED).

---

## 4–8. Domain scope (implemented)

### Crypto

- Catalog: `messages/*/crypto.json` (trading, bottom panel tabs, order status presentation).
- Wired: `SpotOrderEntryPanel` (buy/sell, limit/market tabs), `SpotBottomPanel` (tabs, status pills, guest hint).

### Forex

- Catalog: `messages/*/forex.json` (nav, pages, markets filters, ticket strings, sign-in prompts, account sub-nav).
- Wired: `FOREX_NAV` / mobile nav (`labelKey`), `ForexTopNav`, `ForexMobileNav`, `ForexPageFrame`, `ForexSignInPrompt`, `ForexAccountNav`, secondary pages (markets, portfolio, orders, account, funds, ledger, accounts, alerts, analysis title), `ForexOrderTicket` (primary actions + localized error presentation), `useForexErrorMessage`.

### P2P

- Catalog: `messages/*/p2p.json`.
- Wired: `P2PHeader` navigation.

### Wallet

- Catalog: `messages/*/wallet.json`.
- Wired: `WalletOperationsShell` sub-nav.

### Account

- New namespace: `account` in `MESSAGE_NAMESPACES` + `messages/*/account.json` (profile/security/preferences shell keys).
- **Not wired** to full dashboard account/preferences pages in this pass (deferred).

---

## 9. Error coverage

- Extended `messages/*/errors.json` for `forex`, `crypto`, `p2p`, `wallet`, `account` codes.
- Extended `error-catalog.ts` stable code → key mappings.
- Forex UI errors: `useForexErrorMessage` (presentation); `lib/forex/models/errors.ts` untouched.

---

## 10. Terminology

- Contextual keys per domain (`forex.nav.*`, `crypto.orders.status.*`, `p2p.order.*`).
- Enums/API values (e.g. `BUY`, `OPEN`) remain unchanged in logic; only display layers translate.

---

## 11. Formatter coverage

- No changes to calculation formatters; existing Phase 1 display formatters reused where already integrated.

---

## 12. Catalog parity

- `npm run test:i18n` — **PASS** (includes new `account` namespace and populated domain JSON).

---

## 13–15. Accessibility / hydration / visual regression

- **Accessibility:** Localized `aria-label` on Forex nav, P2P nav, wallet ops nav.
- **Hydration:** Not fully exercised in CI this pass; build + static generation **PASS**.
- **Visual regression:** Not run via Playwright in this session — **manual QA required** for Forex terminal densities (en / zh-CN / id-ID) per master prompt §34.

---

## 16–21. Domain regression (coverage)

| Domain | Coverage this pass |
|--------|-------------------|
| Forex terminal | Nav + ticket primary buttons + secondary pages — **representative** |
| Crypto spot | Order entry buy/sell + bottom panel — **representative** |
| P2P | Header nav only |
| Wallet | Operations shell nav only |
| Account | Catalog only |

---

## 22–25. Financial invariants / API / DB / production

- **No** matching engine, ledger, wallet accounting, Forex execution, P2P escrow, or auth logic changes.
- **No** API payload or schema changes.
- **No** DB migrations.
- **No** production deploy or container changes.

---

## 26. Tests

| Test | Result |
|------|--------|
| `npm run test:i18n` | PASS |
| `npm run build` (frontend) | PASS |

---

## 27–28. Commits / remote

| Item | SHA |
|------|-----|
| Phase 3 commit | `6e597522f46bc168dd51919a22e6b6d691238a21` |
| Remote `release/exchange-production-baseline` | `6e597522f46bc168dd51919a22e6b6d691238a21` |
| Local HEAD == remote | YES |

---

## 29. Deferred gaps (honest)

- Full `dashboard/preferences` (~800 labels).
- Wallet overview / deposit / withdraw page bodies.
- P2P marketplace table, modals, order detail flows.
- Crypto markets global pages, full order entry (TIF, advanced types, dialogs).
- Forex ticket field labels (margin grid), bottom panels, terminal chrome beyond nav.
- Account profile/security page wiring to `account.*` catalog.
- Playwright visual journeys (desktop + mobile) for all locales.
- Full Phase 3 PASS checklist in master prompt §65 — **not all boxes certifiable** until deferred UI wired and visual QA completed.

---

## 30. Next phase recommendation

1. Wire `account.json` into dashboard account + security shells.
2. Incremental P2P and wallet page passes (deposit warnings reviewed by compliance copy owner).
3. Forex ticket + bottom panel label pass without layout changes.
4. Add Playwright smoke per locale for `/forex/trade`, `/trade/spot`, `/p2p`, `/wallet/deposit/crypto`.
5. Domain-isolated commits + push after each slice passes `test:i18n` + `build`.

---

## 31. Slice B completion (wallet withdraw + overview)

**Checkpoint:** `3702fbdb013d62fe9a472d5a7f975d0c254128d0`  
**Commit:** `2c5a53416033330e85f6e6726a31975444567b12`  
**Remote:** `2c5a53416033330e85f6e6726a31975444567b12`  
**Status:** Slice B customer wallet surfaces — **PASS** (Phase 3 overall still **PARTIAL / NOT CERTIFIED**)

### Wired UI

| Surface | Files |
|---------|--------|
| Withdraw crypto | `dashboard/withdraw/crypto/page.tsx`, `WalletWithdrawNav.tsx` |
| Assets overview | `dashboard/assets/overview/page.tsx` |
| Status labels | `lib/i18n/wallet-transaction-status.ts` |
| Catalogs | `messages/{en,zh-CN,id-ID}/wallet.json` |

### Withdrawal safety copy

- Irreversibility banner, review/confirm step labels, fee/receive/min rows, memo/address **labels** (values unchanged).
- Client validation + known API error codes → `wallet.withdraw.errors.*`; unknown/backend `error.message` shown as returned (boundary documented in gap audit).

### Deposit (from prior partial B)

- Remains localized via `wallet.deposit.*` — not regressed.

### Tests (Slice B)

| Test | Result |
|------|--------|
| `npm run test:i18n` | PASS |
| `npm run build` | PASS |

### Visual verification

**NOT VERIFIED** (Playwright wallet matrix not run this slice).

### DB / production / financial

- No schema, production, or business-logic changes in staged diff.
