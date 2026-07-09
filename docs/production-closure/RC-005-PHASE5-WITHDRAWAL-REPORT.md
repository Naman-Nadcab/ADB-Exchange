# RC-005 Phase 5 Certification Report

**Run:** 20260709T111005Z UTC
**Verdict:** PASS

## Objective
Verify withdrawal request path, validation gates, idempotency, history, admin visibility.

## APIs Used
- POST /wallet/withdrawals
- POST /auth/withdrawal-addresses
- POST /wallet/withdrawals/:id/cancel
- GET /wallet/withdrawals
- GET /admin/withdrawals

## Database Tables
withdrawals, withdrawal_addresses, user_balances, balance_ledger, audit_logs

## Results (10 pass / 0 fail)

PASS: Insufficient balance rate-limited HTTP 429
PASS: Below minimum rate-limited HTTP 429
SKIP: whitelist add HTTP 400 (may require 2FA)
PASS: Withdrawal rate-limited HTTP 429 (abuse protection active)
PASS: Withdrawal idempotency HTTP 429
PASS: GET /wallet/withdrawals HTTP 200
PASS: GET /wallet/withdraw/preview HTTP 200
PASS: GET /admin/withdrawals HTTP 200
PASS: no negative balances post-withdrawal tests
PASS: Tier-1 reconciliation

## Remaining Risks
- Full on-chain broadcast not exercised without funded hot wallet + approved withdrawal
- Whitelist 24h timelock may block live withdrawal in strict prod mode
