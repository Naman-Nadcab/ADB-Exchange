# Forex account center & detail — surface implementation

**Baseline:** `ccb9b476cc54619235a8487d33e94be4a1ce5740`  
**Branch:** `release/exchange-production-baseline`

## 1. What was already implemented in 4899945 / ccb9b47?

- `ForexAccountManagementHub` with full sections (financial, config, risk, funding, activity, documents).
- `GET /accounts/:accountId` hub bundle via `buildForexCustomerAccountHubBundle`.
- Accounts center with per-account `getAccountById` N+1 fetch and sparse card UI.

## 2. What was not actually visible/surfaced?

- Account **cards** showed minimal fields; non-active accounts often showed **loading** or **no free margin** (active-only store fallback).
- Hub **Manage** sent users to `/forex/account` overview, not account management on the detail page.
- Hero lacked **deposit / withdraw / transfer** affordances (only lower funding block).
- List API did not ship **per-account financial snapshots** → fragile N+1 client fetches.

## 3. What was fixed?

- **`GET /accounts`** now includes `cardSnapshot` (financial + activity + selection) for every owned account.
- New **`ForexAccountCenterCard`** with identity, config, financial, metadata, and four clear actions.
- Removed N+1 hub polling from accounts center; uses list `cardSnapshot`.
- Detail + accounts pages use **`wide`** layout.
- Hub hero: funding actions (gated), **Manage** → `#account-funding`; config shows login/server; credit shown as unavailable (no broker credit field).

## 4. Visible on account cards (when backend returns data)

Demo/Live, status, label, trading login, account ID, server, group, currency, position mode, leverage, created date, balance, equity, used/free margin, margin level, open positions count, View details, Manage, Switch, Open terminal, Demo funding (demo).

## 5. Visible on account detail

Unchanged hub sections, now easier to reach with correct hero actions and wide layout; financial includes explicit **Credit — unavailable**.

## 6. Still genuinely blocked

Live funding, broker trading/investor passwords, account closure, broker credit line, REAL_FOREX live open.

## 7. Runtime URLs tested

- Build verifies routes: `/forex/account/accounts`, `/forex/account/accounts/[accountId]`.
- Full browser QA requires deployed frontend+backend with this commit.

## 8. Tests

- `apps/frontend`: `npm run test:i18n` — PASS  
- `apps/frontend`: `npm run build` — PASS  
- `forex-multi-account.integration.test.ts` — list `cardSnapshot` assertion added (runs when DB available).

## 9. Commit

`978ba02` — `fix(forex): surface complete account management experience`

## 10. Push verification

`HEAD == origin/release/exchange-production-baseline` → `978ba025cc70aa595ead13a015c0bc8820095398`
