# GO-LIVE VALIDATION

**Generated:** 2026-06-23T03:31:09.348Z  
**Environment:** http://localhost:4000 | http://localhost:3000 | http://localhost:3001  
**Method:** API + page reachability (no route crawls, no coverage scans)

## Final decision

# ❌ NO GO LIVE

22 FAIL · 4 WARNING · 3 PASS


---

## USER FLOW

| # | Flow | Status | Detail |
|---|------|--------|--------|
| Signup | 1. Signup | **WARNING** | Endpoint reachable; Redis rate-limit backend unavailable |
| Login | 2. Login | **FAIL** | Provisioned token fallback |
| KYC | 3. KYC | **FAIL** | 500: {"code":"FETCH_FAILED","message":"Failed to fetch KYC status"} |
| Deposit | 4. Deposit | **WARNING** | Deposit gated on KYC (expected for non-verified) |
| Spot Buy | 5. Spot Buy | **PASS** | Order OPEN |
| Spot Sell | 6. Spot Sell | **FAIL** | 500: Failed to place order |
| Open Orders | 7. Open Orders | **FAIL** | 401: Session expired |
| Trade History | 8. Trade History | **FAIL** | 401: Session expired |
| Logout | 9. Logout | **WARNING** | 400: Body cannot be empty when content-type is set to 'application/json' |

## WALLET FLOW

| # | Flow | Status | Detail |
|---|------|--------|--------|
| Deposit Address | 1. Deposit Address | **FAIL** | See deposit check |
| Copy Address | 2. Copy Address | **WARNING** | Deposit page loads; clipboard not API-testable |
| Withdraw Screen | 3. Withdraw Screen | **FAIL** | page=0 api=401 |
| Transfer Screen | 4. Transfer Screen | **FAIL** | api=401 page=0 |
| Wallet History | 5. Wallet History | **FAIL** | 401: Session expired |

## ADMIN FLOW

| # | Flow | Status | Detail |
|---|------|--------|--------|
| Admin Login | 1. Admin Login | **FAIL** | Provisioned token fallback |
| Dashboard | 2. Dashboard | **FAIL** | 401 |
| Treasury | 3. Treasury | **FAIL** | 401 |
| Users | 4. Users | **FAIL** | 401 |
| Markets | 5. Markets | **FAIL** | 401 |
| MM Controls | 6. MM Controls | **FAIL** | 401 |
| Liquidity Controls | 7. Liquidity Controls | **FAIL** | bot=401 control=401 |
| Logs | 8. Logs | **FAIL** | 401 |

## EMERGENCY FLOW

| # | Flow | Status | Detail |
|---|------|--------|--------|
| MM Stop | 1. MM Stop | **FAIL** | 401: Invalid or expired token |
| Trading Halt | 2. Trading Halt | **FAIL** | 401: Invalid or expired token |
| Withdraw Freeze | 3. Withdraw Freeze | **FAIL** | 401: Invalid or expired token |
| Liquidity Provider Disable | 4. Liquidity Provider Disable | **FAIL** | 401: Invalid or expired token |

## Blockers

- **infra** — Frontend reachable: http://localhost:3000/login → This operation was aborted
- **USER FLOW** — 2. Login: Provisioned token fallback
- **USER FLOW** — 3. KYC: 500: {"code":"FETCH_FAILED","message":"Failed to fetch KYC status"}
- **USER FLOW** — 6. Spot Sell: 500: Failed to place order
- **USER FLOW** — 7. Open Orders: 401: Session expired
- **USER FLOW** — 8. Trade History: 401: Session expired
- **WALLET FLOW** — 1. Deposit Address: See deposit check
- **WALLET FLOW** — 3. Withdraw Screen: page=0 api=401
- **WALLET FLOW** — 4. Transfer Screen: api=401 page=0
- **WALLET FLOW** — 5. Wallet History: 401: Session expired
- **ADMIN FLOW** — 1. Admin Login: Provisioned token fallback
- **ADMIN FLOW** — 2. Dashboard: 401
- **ADMIN FLOW** — 3. Treasury: 401
- **ADMIN FLOW** — 4. Users: 401
- **ADMIN FLOW** — 5. Markets: 401
- **ADMIN FLOW** — 6. MM Controls: 401
- **ADMIN FLOW** — 7. Liquidity Controls: bot=401 control=401
- **ADMIN FLOW** — 8. Logs: 401
- **EMERGENCY FLOW** — 1. MM Stop: 401: Invalid or expired token
- **EMERGENCY FLOW** — 2. Trading Halt: 401: Invalid or expired token
- **EMERGENCY FLOW** — 3. Withdraw Freeze: 401: Invalid or expired token
- **EMERGENCY FLOW** — 4. Liquidity Provider Disable: 401: Invalid or expired token

## Warnings

- **USER FLOW** — 1. Signup: Endpoint reachable; Redis rate-limit backend unavailable
- **USER FLOW** — 4. Deposit: Deposit gated on KYC (expected for non-verified)
- **USER FLOW** — 9. Logout: 400: Body cannot be empty when content-type is set to 'application/json'
- **WALLET FLOW** — 2. Copy Address: Deposit page loads; clipboard not API-testable
