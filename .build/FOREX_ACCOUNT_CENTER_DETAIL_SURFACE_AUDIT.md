# Forex account center & detail — surface audit

**Baseline inspected:** `ccb9b476cc54619235a8487d33e94be4a1ce5740`  
**Routes:** `/forex/account/accounts`, `/forex/account/accounts/[accountId]`

## Phase 0 answers

| # | Question | Finding |
|---|----------|---------|
| 1 | Does **Manage** route to account detail? | **Partially.** Cards use **View details** → `FOREX_ROUTES.accountDetail(id)`. There is **no separate Manage** on cards. Hub hero **Manage** links to `/forex/account` (overview), **not** the detail route — misleading. |
| 2 | Does detail render `ForexAccountManagementHub`? | **Yes.** `[accountId]/page.tsx` → `ForexAccountDetailView` → `ForexAccountManagementHub`. |
| 3 | Does hub receive data? | **Yes** when `GET /api/v1/forex/accounts/:accountId` succeeds (`forexApi.getAccountById`). |
| 4 | Does GET return hub payload? | **Yes.** Backend `buildForexCustomerAccountHubBundle` returns financial, risk, activity, previews. |
| 5 | Are hub sections visible in code? | **Yes** (hero, readiness, financial KPIs, config, risk, settings, credentials, funding, activity, documents, management). Not hidden by demo/live gates except funding CTAs. |
| 6 | Correct `accountId` passed? | **Yes** from `useParams()` on detail route. |
| 7 | Account context | List/hub use ownership on server; client sends `X-Forex-Account-Id` for active account only — **does not** change hub `:accountId` resolution. |
| 8 | Runtime errors hiding sections? | If hub load fails, detail shows not-found card. If per-card hub fetch fails, center shows **metrics loading** for non-active cards and **store fallback** (3 metrics, no free margin) for active only. |
| 9 | Conditional hiding | Financial fees/swaps only when **selected** account (store). Cards hide full financials when hub fetch missing. |
| 10 | Stale build? | **Possible in deployed env.** Source at `ccb9b47` already has hub fetch on center but **UI density** still matches user screenshot when `hubs[accountId]` is empty or before fetch completes. |

## Root causes (product gap)

1. **Accounts center** relies on **N parallel `GET /accounts/:id`** calls; failures or slow responses → sparse cards (only active account store metrics).
2. **Card layout** omits trading login label, position mode, group, margin level, and **Manage** action; financial block is easy to miss.
3. **Hub hero** missing deposit/withdraw/transfer actions; **Manage** points away from detail.
4. **`GET /accounts` list** does not include per-account financial snapshots → unnecessary N+1 and weaker index page.

## Intended fix direction

- Extend **`GET /accounts`** with **`cardSnapshot`** per owned account (same hub builder, slim fields).
- Rebuild **account cards** with full identity/config/financial/metadata + **[View Details] [Manage] [Switch] [Terminal]**.
- Fix **hub hero** actions and detail page **wide** layout; align **Manage** with detail/funding anchors.
