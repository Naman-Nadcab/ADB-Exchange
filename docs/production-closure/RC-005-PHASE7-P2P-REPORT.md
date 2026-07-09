# RC-005 Phase 7 — P2P Certification Report

**Run:** 20260709T111005Z UTC  
**Verdict:** **FAIL** (production blocker)  
**Stop condition:** SANCTIONS_BLOCKED on `POST /p2p/ads`

---

## 1. Objective

Verify complete P2P production path: Ad → Order → Escrow → Payment → Release → Ledger → Wallet → History → Admin.

## 2. Execution Path Attempted

```
POST /p2p/my-payment-methods (buyer)  → PASS
POST /p2p/ads (seller sell ad)          → FAIL SANCTIONS_BLOCKED
```

Execution halted per mission stop rules before order/escrow/release.

## 3. APIs Used

| API | Result |
|-----|--------|
| GET /p2p/ads | PASS |
| GET /p2p/payment-methods | PASS |
| GET /p2p/my-orders | PASS |
| GET /admin/p2p/orders | PASS |
| GET /admin/p2p/disputes | PASS |
| POST /p2p/my-payment-methods | PASS |
| POST /p2p/ads | **FAIL 403 SANCTIONS_BLOCKED** |

## 4. Database Tables (expected on full path)

`p2p_ads`, `p2p_orders`, `escrows`, `user_balances`, `balance_ledger`, `p2p_disputes`, `audit_logs_immutable`

## 5. Root Cause

Production environment (`NODE_ENV=production`) enforces **fail-closed sanctions screening**.  
`SANCTIONS_PROVIDER` is not configured and `SANCTIONS_API_KEY` is empty in `exchange-backend`.

From `sanctions-screening.service.ts`:
> *"Sanctions provider not configured (production requires screening)"*

P2P sell-ad creation calls `checkSanctions()` and blocks when provider is missing.

## 6. Evidence

```
POST /api/v1/p2p/ads
HTTP 403
{"success":false,"error":{"code":"SANCTIONS_BLOCKED","message":"Sanctions provider not configured (production requires screening)"}}
```

Seller funding credited via admin manual-credit (+50 USDT) — credit path verified in Phase 4.

## 7. Partial Verification (read paths)

| Check | Status |
|-------|--------|
| Public ad listing | PASS |
| Payment methods catalog | PASS |
| Authenticated my-orders | PASS |
| Admin P2P orders list | PASS |
| Admin disputes list | PASS |
| Buyer payment method create | PASS |

## 8. Financial Verification (post Phases 4–6)

| Gate | Result |
|------|--------|
| Tier-1 reconciliation | PASS (`spot_mm: 0`) |
| Negative balances | 0 |
| Phases 4–6 | PASS |

## 9. Failure Scenarios Tested

| Scenario | Result |
|----------|--------|
| Create sell ad without sanctions provider | **BLOCKED (expected fail-closed)** |
| Escrow lock | NOT REACHED |
| Payment confirm / release | NOT REACHED |
| Cancel order | NOT REACHED |
| Dispute resolution | NOT REACHED |

## 10. Recovery / Remediation

**Operator action required before P2P can certify in production:**

1. Configure sanctions provider via admin or env:
   - `SANCTIONS_PROVIDER=chainalysis` (or approved provider)
   - `SANCTIONS_API_URL=https://public.chainalysis.com/api/v1/address`
   - `SANCTIONS_API_KEY=<valid key>`
2. Restart `exchange-backend`
3. Re-run: `./scripts/rc005-phases-4-7-cert.sh` (or Phase 7 section only)

**Do not** disable sanctions or set `noop` in production — that would violate Tier-1 fail-closed policy.

## 11. Remaining Risks

- Full escrow release ledger path unverified until sanctions configured
- P2P WebSocket `p2p_order_update` not measured
- Dispute admin resolution (`PATCH /admin/p2p/disputes/:id/resolve`) not exercised

## 12. Regression Check

Phases 4–6 re-run after P2P attempt: no financial drift introduced.

---

## PASS / FAIL

**FAIL** — P2P money-flow certification cannot complete without sanctions provider configuration. This is a **compliance/infrastructure blocker**, not an application logic defect in the P2P module itself.
