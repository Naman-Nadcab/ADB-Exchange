# Forex core customer lifecycle — implementation report

**Baseline:** `4899945d007505e997f3153f47bffed2bb17a005`  
**Branch:** `release/exchange-production-baseline`  
**Commit:** _(filled after commit)_  
**Remote sync:** _(filled after push)_

## A. Implemented now

- **Phase 0:** `.build/FOREX_CORE_CUSTOMER_LIFECYCLE_GAP_AUDIT.md` capability matrix.
- **Customer identity:** `ForexCustomerIdentityStrip` on accounts center; profile deep links.
- **Account relationship / read model:** Account list and hub expose `groupCode` / `groupLabel` via `forex_account_groups` JOIN.
- **Account hub:** Settings panel (position mode when active), credentials panel (platform security links; trading/investor gated), funding history preview + CTA, account group field.
- **Demo lifecycle UI:** `/forex/account/accounts/open-demo` — real `POST` demo create + activate (existing API).
- **Live lifecycle UI:** `/forex/account/accounts/open-live` — `GET /accounts/live-opening/eligibility`, KYC checklist, no fake application submit.
- **Funding history:** `/forex/account/funds/history` + `GET /accounts/:accountId/funding-history` (ownership enforced).
- **Portal nav:** Funds sub-nav “Funding history”; accounts center links for open demo/live flows.
- **i18n:** New strings in `en`, `zh-CN`, `id-ID` for lifecycle surfaces.

## B. Reused existing backend

- `accounts-service` list/create/demo provisioning paths.
- `buildForexCustomerAccountHubBundle` + `userOwnsForexAccount`.
- `getForexAccountingService().listFunding` + `publicLedgerRow`.
- Wallet KYC status on open-live page (existing client hook).
- Product gates / `realForex` admin config for live opening eligibility.

## C. New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/accounts/live-opening/eligibility` | Truthful live opening gate from `realForex` |
| GET | `/accounts/:accountId/funding-history` | IDOR-safe funding ledger rows for one account |

## D. New services

None (extensions only in existing customer bundle and accounts service).

## E. New DB / model work

None (no migrations). Read-only JOIN to existing `forex_account_groups`.

## F. Provider dependencies

- **Live account provisioning / broker credentials:** Requires REAL_FOREX + LP/broker adapter (not present for customer flows).
- **Live deposit / withdraw / transfer / payment methods:** Requires PSP / payout rails (not wired to Forex customer API).

## G. Compliance dependencies

- KYC state from existing wallet/identity stack for live readiness messaging.
- Leverage change remains admin/compliance — no self-service customer mutation.

## H. Features still gated

- Live account creation (POST LIVE).
- Real-money deposit, withdrawal, internal Forex transfer.
- Forex payment methods.
- Trading / investor password change on broker.
- Account close/suspend from customer portal.
- Broker PDF statements.

## I. Security / IDOR tests

- Extended `forex-multi-account.integration.test.ts`: cross-user `GET .../funding-history` → 404; owner → 200.
- Existing hub/detail ownership tests unchanged in scope.

## J. i18n tests

```
cd apps/frontend && npm run test:i18n
```
**Result:** PASS (catalog parity en / zh-CN / id-ID).

## K. Build result

```
cd apps/frontend && npm run build
```
**Result:** PASS (Next.js production build).

Additional: `npx tsx src/lib/forex/capabilities/product-gates.test.ts` — PASS.

## L. Files changed

See commit `feat(forex): complete core customer account lifecycle` (staged paths only):

- `.build/FOREX_CORE_CUSTOMER_LIFECYCLE_GAP_AUDIT.md`
- `.build/FOREX_CORE_CUSTOMER_LIFECYCLE_IMPLEMENTATION_REPORT.md`
- Backend: `forex-customer-accounts.fastify.ts`, `account-detail-bundle.ts`, `accounts-service.ts`, `forex-multi-account.integration.test.ts`
- Frontend: hub/center/funds nav, API client, routes, new pages and panels, i18n forex.json (3 locales), `product-gates.test.ts`

## M–O. Git

_(Updated after commit and push.)_

## Separation summary

| IMPLEMENTED | GATED | EXTERNAL DEPENDENCY |
|-------------|-------|---------------------|
| Demo create flow, hub sections, funding history API/UI, group metadata, eligibility GET, IDOR tests | Live open, real funding, transfers, payment methods, trading passwords, account close | REAL_FOREX, broker/LP, PSP/payout for live money |

**Optional CXM modules (future):** Copy trading, PAMM, VPS, promotions — not in this phase.
