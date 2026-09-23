# Forex account detail — CXM gap audit

**Baseline:** `a8d2188` · **Route:** `/forex/account/accounts/[accountId]`

## Matrix

| Feature | Backend | API | UI (pre) | Implement now | Gate / reason |
|---------|---------|-----|----------|---------------|---------------|
| Account metadata (kind, status, currency, mode, leverage) | A | `GET /accounts/:id` | Partial | Yes | — |
| updatedAt | A | Same (row) | No | Yes | Expose in response |
| Financial snapshot (balance, equity, margin) | A | `accountView` via active APIs | Active only | Yes | Extend `GET /accounts/:id` read-only bundle |
| Risk state | A | `/risk/status` (active) | Partial | Yes | Bundle per owned accountId |
| Open positions / pending orders count | A | positions/orders stores | Active store | Yes | Bundle |
| Recent fills/orders/positions preview | A | listOwned + public mappers | Links only | Yes | Bundle (top N) |
| Server (MT5/broker) | D | — | No | Label | Simulated server label only |
| Trading login | C | accountId | Partial | Yes | Login = account number in MOCK |
| Investor/read-only password | D | — | No | Gate | Not supported |
| Password reset (Forex-specific) | D | — | No | Link platform security | No MT credentials |
| Account group | B | DB `group_id` | No | Optional | Not in customer list API today |
| Live account create | D | POST rejects non-DEMO | Gated UI | Yes | `realForex` false |
| Real deposit/withdraw/transfer | D | No customer rails | Gated pages | Yes | Product gates |
| Demo funding | A | `POST /funding/demo` | Funds page | Yes | Demo-only CTA |
| KYC readiness | B | `/api/v1/wallet/kyc-status` | Overview banner | Yes | Integrate on detail |
| Close/suspend account (customer) | D | Admin only | No | Gate | Not customer-exposed |
| Per-inactive-card balances | A | After bundle | No | Yes | Parallel `GET /accounts/:id` |

**Legend:** A = supported · B = other endpoint · C = safe presentation · D = missing · E = compliance

## Decision

Extend **`GET /accounts/:accountId`** with IDOR-safe read-only **`hub`** payload (financial + risk + activity preview). Rebuild portal UI as account-management hub; no fake live flows.
