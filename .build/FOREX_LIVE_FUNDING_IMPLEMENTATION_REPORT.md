# Forex live account + funding core — implementation report

**Baseline:** `978ba025cc70aa595ead13a015c0bc8820095398`  
**Branch:** `release/exchange-production-baseline`

## IMPLEMENTED (honest / wired)

| Area | Deliverable |
|------|-------------|
| Readiness | `GET /live/readiness` — `liveForexReady: false` + explicit `blockers` |
| Live application | `POST /live/applications` with KYC check, idempotency, statuses PENDING/UNDER_REVIEW/FAILED (no fake ACTIVE without provider) |
| Provider contracts | `ForexLiveAccountProvider`, `ForexBrokerCredentialsProvider`, unconfigured registry |
| Identity hub | `platformCustomerId`, `tradingLogin`, `server`, `brokerTradingLogin` (null until provisioned) |
| Credentials state | `GET /accounts/:accountId/credentials` — availability + reason, no secrets |
| Internal transfer | `POST /funding/transfers` — demo accounts, same owner, ledger `TRANSFER`, atomic double-entry |
| Deposit / withdraw live | `POST /funding/deposits` / withdrawals → **503** with blockers (no fake success) |
| Payment methods | `GET /funding/payment-methods` — empty, `available: false` + blockers |
| Eligibility | Extended `GET /accounts/live-opening/eligibility` with KYC + blockers |
| UI | Open-live application submit, internal transfer form, readiness-driven product gates, credential panel API state |

## GATED

- Live broker provisioning, live deposit/withdraw, Forex payment methods, trading/investor password change, account closure.

## BROKER DEPENDENCY

- MT5/MT4/cTrader/FIX adapters catalog-only; `ForexLiveAccountProvider` unconfigured.

## PAYMENT PROVIDER DEPENDENCY

- No PSP webhook/reconciliation for Forex deposits.

## COMPLIANCE DEPENDENCY

- KYC via existing `kyc_applications` / wallet `kyc-status`.

## NOT SAFE TO ENABLE

- **REAL_FOREX** remains off; readiness never reports `liveForexReady: true` in this release.

## Tests

- `apps/frontend`: `npm run test:i18n`, `npm run build`
- `product-gates.test.ts`
- `forex-customer-live-funding.integration.test.ts` (readiness + deposit gate; IDOR when DB up)

## Git

**Commit:** `a960274` — `feat(forex): complete live account and funding core`  
**Push:** `HEAD == origin/release/exchange-production-baseline` (`a960274fa2ecf13cedc59188cf60d98c4d8587c8`)
