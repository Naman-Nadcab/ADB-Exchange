# RC-004 Phase 1 — Financial Integrity Forensic Report

**Generated:** 2026-07-09T09:30:00Z (UTC)  
**Mode:** Read-only forensics  
**Scope:** `balance_ledger` (trading) vs `user_balances` (trading, `chain_id=''`)

---

## 1. Executive Summary

Tier-1 `spot_balance_ledger` reports **56 mismatches** across **5 users**. **Zero real/customer users** are affected. All imbalances are confined to internal system, QA, and certification test accounts created during RC stabilization and MM provisioning.

| Classification | Users | Mismatch rows | Max drift | Customer risk |
|----------------|-------|---------------|-----------|---------------|
| Internal (liquidity bot / hybrid counterparty) | 1 | 52 | 5,000 | **None** |
| QA test traders | 2 | 2 | 204.33 | **None** |
| Cert journey (E2E) | 2 | 2 | ≤0.0003 BTC | **None** |
| Real users | 0 | 0 | — | **N/A** |

Settlement pipeline (RC-003) is healthy: `pending=0`, `failed=0`, `zombie=0`. The production blocker is **ledger genesis gap** on non-customer accounts, not customer fund loss.

---

## 2. Mismatch Inventory (Complete)

### 2.1 Internal — `hybrid-system@internal.invalid`

| Field | Value |
|-------|-------|
| User ID | `a0000000-0000-4000-8000-00000000aa01` |
| Email | `hybrid-system@internal.invalid` |
| Role | Hybrid counterparty + **liquidity bot** (`liquidity_bot_live` API key) |
| Created | 2026-06-23 (migration seed) |
| Mismatch rows | 52 of 53 trading balance rows |
| Trading balance rows | 53 |

**Sub-categories:**

| Pattern | Count | Drift | Ledger rows |
|---------|-------|-------|-------------|
| Zero-ledger currencies at exactly 5,000 available | 48 | 5,000 each | 0 |
| SOL at 500 available | 1 | 500 | 0 |
| BNB at 200 available | 1 | 200 | 0 |
| USDT/BTC active trading (has ledger history) | 2 | ≤36 USDT / ≤0.001 BTC | 38,959 / 32,137 |

**Bulk seed timestamp:** 48 currencies share `updated_at = 2026-06-29 07:22:44 UTC` — single batch operation.

**Evidence — no ledger for 50 currencies:**

```sql
-- 50 of 53 balance rows have zero balance_ledger entries
SELECT COUNT(*) FILTER (WHERE ledger_rows = 0) FROM (
  SELECT (SELECT COUNT(*) FROM balance_ledger bl WHERE bl.user_id=ub.user_id AND bl.currency_id=ub.currency_id) AS ledger_rows
  FROM user_balances ub WHERE user_id='a0000000-0000-4000-8000-00000000aa01' AND account_type='trading'
) x;
-- Result: 50
```

**Code path evidence:**

- User seeded in `migrate.ts` (hybrid system counterparty)
- API key provisioned in `scripts/p0-launch-provision.sh` (USDT/BTC/ETH only, with ledger-free INSERT)
- `readUserBalances()` → `ensureUserBalanceRowsBulk()` creates 0-balance rows on wallet read
- Trading activity on USDT/BTC writes ledger via `creditTradingBalance()` / settlement worker
- 5,000 balances: **manual/SQL bulk provision** without `insertBalanceLedger()` — no matching audit_logs row found

**Classification:** Test account contamination + operator/script provisioning without ledger pairing.

---

### 2.2 QA — `qa_trader_a@local.exchange`

| Field | Value |
|-------|-------|
| User ID | `14e57a8f-bbd2-4b48-9b60-6bccede41176` |
| Created | 2026-06-27 |
| Currency | USDT |
| `user_balances` | avail=499,195.628881, lock=35 |
| `balance_ledger` sum | avail=499,399.960555, lock=**-169.331674** |
| Drift | avail −204.33, lock +204.33 |
| Open orders | 0 |

**Origin:**

- Provisioned by `scripts/dev-provision-qa-traders.ts` — direct `INSERT INTO user_balances` **without** ledger
- 657 ledger rows (all `adjustment` + `internal_transfer`) from subsequent spot trading
- Locked ledger went **negative** at `2026-06-30 08:58:50` during burst settlement (events 804–848)
- `spot-lock-reconcile.service.ts` promotes available→locked in `user_balances` **without** ledger entries

**Classification:** QA contamination + software path asymmetry (lock reconcile skips ledger).

---

### 2.3 QA — `qa_trader_b@local.exchange`

| Field | Value |
|-------|-------|
| User ID | `dc606f80-223e-41e5-b68f-2a39e328f526` |
| Currency | BTC |
| Drift | avail −0.00170371, lock +0.00170371 |
| Ledger rows | 159 |

**Classification:** Settlement rounding / lock-unlock asymmetry (sub-threshold except for Tier-1 strict equality).

---

### 2.4 Cert journey users (2 rows)

| Email | Drift |
|-------|-------|
| `cert_journey_b_20260629t053134z@local.exchange` | locked +0.0003 BTC |
| `cert_journey_b_20260629t051227z@local.exchange` | avail −0.0001, locked +0.0001 BTC |

**Classification:** E2E certification rounding residue.

---

## 3. Non-Mismatch Integrity Observations

| Check | Value | Notes |
|-------|-------|-------|
| Real user mismatches | **0** | Verified SQL filter on email domain |
| Negative balances | 0 | PASS |
| Orphan settlement ledger | 12 rows | Events 835, 927, 970 deleted; pre-existing |
| Processed w/ ledger | 166/166 | PASS |
| Quarantined synthetic | 2,237 | RC-003 complete |

---

## 4. User Classification Matrix

| User class | Email pattern | Mismatch? | Funds at risk? |
|------------|---------------|-----------|----------------|
| Real | not `@local.exchange`, `@internal.invalid`, `@test.*` | No | No |
| Internal | `@internal.invalid` | Yes (52 rows) | No — system MM |
| QA | `@local.exchange` | Yes (2 rows) | No — test traders |
| Cert | `cert_journey_*@local.exchange` | Yes (2 rows) | No — E2E |
| Synthetic | N/A (quarantined in settlement) | N/A | N/A |

---

## 5. Phase 1 Gate

| Gate | Result |
|------|--------|
| Every mismatch identified | **PASS** (56/56) |
| Every mismatch classified | **PASS** |
| Real user impact | **NONE** |
| Root cause path documented | **PASS** (see RC-004 Phase 2) |

**Phase 1 verdict: PASS — proceed to Phase 2.**
