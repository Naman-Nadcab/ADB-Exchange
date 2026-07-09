# RC-005 Phase 1 — Financial Write Path Remediation Report

**Date:** 2026-07-09 UTC  
**Status:** PASS (spot-lock-reconcile remediated and verified)  
**Verdict:** Phase 1 gate cleared; proceed to Phase 2+

---

## Root Cause

`spot-lock-reconcile.service.ts` promoted `available_balance → locked_balance` via raw SQL `UPDATE user_balances` without paired `balance_ledger` entries. Callers (`balance-consistency.service`, `exchange-startup-reconcile`, `liquidity-bot.service`) could heal lock drift while leaving the trading ledger sum inconsistent with `user_balances`.

## Accounting Model (Trading)

| Transition | Canonical path | Ledger required |
|------------|----------------|-----------------|
| Lock (place order) | `lockTradingBalance()` | avail debit + locked credit |
| Unlock (cancel) | `unlockTradingBalance()` | locked debit + avail credit |
| Debit locked (fill) | `debitLockedTradingBalance()` | locked debit |
| Credit available (fill) | `creditTradingBalance()` | avail credit |
| Lock reconcile (heal) | **Was raw UPDATE** → now `lockTradingBalance()` | avail debit + locked credit |

Intentional non-ledger paths: funding wallet, admin manual adjustments (separate audit), settlement global rows.

## Changes

| File | Change | Risk |
|------|--------|------|
| `apps/backend/src/services/spot-lock-reconcile.service.ts` | Delegate shortfall promotion to `lockTradingBalance()` with `descriptionSuffix: spot_lock_reconcile` | Low — uses existing canonical lock path |
| `apps/backend/src/services/spot-balance.service.ts` | Optional `descriptionSuffix` on `lockTradingBalance` ledger refs | Low — backward compatible |
| `apps/backend/src/services/spot-lock-reconcile.test.ts` | Static guard against raw UPDATE regression | None |

## Verification Evidence

1. **Unit test:** `docker exec exchange-backend node dist/services/spot-lock-reconcile.test.js` → `ok`
2. **Live order:** QA limit buy on BTC_USDT → spot balance/ledger mismatch count **0** immediately after
3. **Tier-1:** `spot_balance_ledger.ok: true`, `mismatches: 0` (post-reconcile)
4. **Ledger reconcile:** Pre-existing drifts from legacy reconcile path corrected via `reconcile-balance-ledger-trading.ts`

## Rollback Plan

Revert `spot-lock-reconcile.service.ts` to prior commit and redeploy backend. Re-run Tier-1; expect recurring sub-threshold drift on active trading users.

## Regression

- Settlement pipeline unchanged (still processed-only with quarantine)
- No duplicate ledger entries introduced (lock path is idempotent per order lock amount)
- Circuit / integrity checks not disabled

---

**Phase 1: PASS**
