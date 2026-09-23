# Forex customer product — implementation status

**Baseline:** `0c37409` · **Branch:** `release/exchange-production-baseline`  
**Updated:** 2026-09-24 (gap-fill phases A–D + J partial + K partial)

## Summary

| Classification | Count (headline) |
|----------------|------------------|
| FULLY IMPLEMENTED (demo/MOCK scope) | Account detail, accounts directory, demo funding UX, trade history page, portal account context, product gates |
| IMPLEMENTED — PROVIDER/COMPLIANCE BLOCKED | Live account, deposit, withdraw, transfer, payment methods |
| IMPLEMENTED — BACKEND BLOCKED | Customer withdrawal API, live account create |
| PARTIAL | Overview (guidance added), statements (CSV only) |

## Capability matrix (selected)

| Capability | Status | Route | Notes |
|------------|--------|-------|-------|
| Account detail | FULLY IMPLEMENTED | `/forex/account/accounts/[accountId]` | `GET /accounts/:id` + switch + active metrics |
| Accounts directory | PARTIAL → improved | `/forex/account/accounts` | Cards + table; live CTA gated |
| Demo create/switch | FULLY IMPLEMENTED | Accounts + switcher | Unchanged engine |
| Demo claim funds | FULLY IMPLEMENTED | `/forex/account/funds` | Simulated only |
| Real deposit | IMPLEMENTED — BLOCKED | `/forex/account/funds/deposit` | Truthful unavailable UI |
| Real withdraw | IMPLEMENTED — BLOCKED | `/forex/account/funds/withdraw` | No customer API |
| Internal transfer | IMPLEMENTED — BLOCKED | `/forex/account/funds/transfer` | Gated |
| Payment methods | IMPLEMENTED — BLOCKED | `/forex/account/funds/payment-methods` | Gated |
| Trade history | FULLY IMPLEMENTED (data-bound) | `/forex/history` | Fills + CSV export |
| KYC integration | PARTIAL | Overview checklist | Links `/dashboard/identity` |
| Security/support | PARTIAL | `ForexPortalUserMenu` | Existing platform links |
| Terminal | FROZEN | `/forex`, `/forex/trade` | No changes |

## Product gates

Derived from `GET /forex/accounts` (`realForex`, `executionMode`, `source`).  
When `realForex === true`, live funding routes would unlock UI shells only — provider/compliance still required before live flows.

## Tests

| Check | Result |
|-------|--------|
| `npm run test:i18n` | Run at commit |
| `npm run build` | Run at commit |

## Remaining gaps

- Live account application + provisioning (backend rejects non-DEMO create)
- Customer withdrawal/transfer/deposit APIs and PSP integration
- Per-account balance on inactive cards (policy: metrics after switch only)
- Broker PDF statements (not fabricated)
- Research/tools phases L–M polish pass across all portal pages
