# RC-004 Phase 2–3 — Root Cause Validation & Recovery Design

**Generated:** 2026-07-09T09:30:00Z (UTC)  
**Mode:** Design only (Phase 4 executes separately)

---

## Phase 2 — Root Cause Validation

### RC-004-001: Hybrid zero-ledger currencies (48 × 5,000)

| Question | Answer | Evidence |
|----------|--------|----------|
| Why ledger missing? | Balances inserted/updated without `insertBalanceLedger()` | 0 ledger rows; bulk `updated_at` 2026-06-29 07:22:44 |
| Why balance exists? | MM/hybrid counterparty requires inventory per currency for orderbook depth | `liquidity_bot_live` API key; hybrid_execution_config counterparty |
| Trade exists? | Yes for USDT/BTC; no trades for zero-ledger altcoins | spot_trades + 71k adjustment ledger rows on active pairs |
| Settlement exists? | Yes for traded pairs | 166 processed events with ledger |
| Reconciliation should have failed? | **Yes** — spot-integrity correctly trips circuit | Tier-1 `spot_balance_ledger` FAIL |

**Root cause:** **Test account contamination** — operator/script bulk `user_balances` seed without ledger pairing. Not a customer deposit or trade bug.

---

### RC-004-002: Hybrid USDT/BTC sub-drift (36 USDT, 0.001 BTC)

| Question | Answer | Evidence |
|----------|--------|----------|
| Why ledger ≠ balance? | Accumulated settlement rounding + high-volume MM trading | 38k+ ledger rows; drift below 1000 threshold individually |
| Software bug? | Partial — rounding tolerance in settlement | global_settlement_balance shows 6 small drifts |

**Root cause:** **Historical data** — rounding residue from high-frequency MM settlement.

---

### RC-004-003: QA trader A USDT (204 drift, negative locked ledger)

| Question | Answer | Evidence |
|----------|--------|----------|
| Why ledger locked negative? | Settlement unlock debits exceeded lock credits during burst trades 2026-06-30 08:58 | Running sum went negative at event 804+ |
| Why user locked = 35? | `spot-lock-reconcile` promoted avail→lock without ledger | `spot-lock-reconcile.service.ts` lines 43–51 UPDATE only |
| Open orders? | 0 | No current lock requirement |
| Reconciliation should have failed? | **Yes** | Tier-1 critical on avail drift |

**Root cause:** **QA contamination** (ledger-free seed) + **software bug** (lock reconcile skips ledger).

---

### RC-004-004: QA trader B / cert users (sub-unit drift)

**Root cause:** **Settlement rounding** on test accounts. No customer impact.

---

## Phase 3 — Recovery Design

### Design principles (from mission rules)

1. `user_balances` is authoritative — **do not change wallet rows**
2. Compensating `balance_ledger` entries are allowed when they **explain** existing wallet state
3. Use **audited application paths** — existing scripts, not raw SQL
4. Single transactional batch with post-verify rollback on failure

### Selected recovery: **Option C — Audited ledger reconciliation**

**Script:** `apps/backend/scripts/reconcile-balance-ledger-trading.ts`

| Property | Value |
|----------|-------|
| Action | INSERT-only `balance_ledger` adjustments (`reference_type=adjustment`) |
| Mutates `user_balances`? | **No** |
| Mutates existing ledger? | **No** (append-only) |
| Batch tag | `reconciliation=tier1_phase1_20260401` |
| Verify | In-transaction COUNT mismatch = 0 or ROLLBACK |
| Idempotent? | No — re-run would double-adjust; run once only |

**Alternative considered — `backfill-opening-balance-ledger.ts`:** Rejected for full recovery because it **skips negative gaps** (ledger > balance), which affects QA-A USDT available.

**Alternative considered — zero hybrid balances:** Rejected — would break MM orderbook; internal funds not customer funds.

### Per-user expected outcome

| User | Entries | Expected post-state |
|------|---------|---------------------|
| hybrid-system | ~54 (avail + lock buckets) | Tier-1 spot_balance_ledger PASS |
| qa_trader_a | 2 (avail debit, lock credit) | Tier-1 PASS |
| qa_trader_b | 2 | Tier-1 PASS |
| cert journey (2) | 4 | Tier-1 PASS |

### Risk assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double-run creates duplicate adjustments | Medium | Run once; verify mismatch count before/after |
| Customer funds affected | **None** | 0 real-user mismatches |
| Ledger immutability violated | Low | INSERT only, no UPDATE/DELETE |
| MM bot disrupted | Low | Aligns ledger to existing balances |

### Rollback procedure

1. Identify adjustment rows: `description LIKE '%reconciliation=tier1_phase1_20260401%'`
2. **Do not DELETE** (immutable). Rollback = compensating inverse entries with new `reference_id` and audit reason `RC-004-rollback`
3. Record `reference_id` list from script output before commit

### Verification plan (Phase 5)

1. `runTier1ReconciliationRound()` — all checks PASS
2. `spot_balance_ledger` mismatches = 0
3. `negative_balances` = 0
4. `user_balances` row counts unchanged
5. `spot_trades` count unchanged

### Out of scope (separate RC)

| Item | Reason |
|------|--------|
| 12 orphan settlement_ledger rows | Deleted events; not balance_ledger mismatch |
| `spot-lock-reconcile` ledger gap bug | Software fix; not required for one-time alignment |
| Circuit auto-recover integrity gate | RC-003 finding; separate change |

---

## Phase 3 Gate

| Gate | Result |
|------|--------|
| Safest option selected | **PASS** — ledger-only alignment |
| Risk documented | **PASS** |
| Rollback documented | **PASS** |
| Customer funds protected | **PASS** |

**Phase 3 verdict: APPROVED — proceed to Phase 4 controlled recovery.**
