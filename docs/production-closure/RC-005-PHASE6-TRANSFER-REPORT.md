# RC-005 Phase 6 Certification Report

**Run:** 20260709T111005Z UTC
**Verdict:** PASS

## Objective
Verify funding↔trading transfers with ledger, history, idempotency.

## APIs Used
- POST /wallet/transfer
- GET /wallet/internal-transfers
- GET /wallet/balances/{funding,trading}

## Database Tables
internal_transfers, user_balances, balance_ledger

## Results (9 pass / 0 fail)

PASS: funding→trading 2.00 USDT HTTP 200
PASS: trading→funding 1.00 USDT HTTP 200
PASS: transfer idempotency HTTP 200
PASS: same-account transfer rejected HTTP 400
PASS: internal_transfers rows=3
PASS: balance_ledger internal_transfer entries=6
PASS: GET /wallet/internal-transfers HTTP 200
PASS: no negative balances
PASS: Tier-1 reconciliation
