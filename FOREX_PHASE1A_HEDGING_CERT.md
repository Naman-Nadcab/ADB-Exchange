# FOREX_PHASE1A_HEDGING_CERT

**Phase:** 1A — Hedging core (same-symbol independent positions)  
**Re-cert UTC:** 2026-09-04T06:30Z (approx.)  
**Status:** **PASS**  
**HEAD:** `2afe893` (`release/exchange-production-baseline`)  
**Scope:** Phase 1A Hedging ONLY. No Close By / Reverse / Stop Limit / TIF / Journal / chart drag / drawings.  
**API:** `http://127.0.0.1:4000`  
**Browser:** `http://109.123.254.30`  

Phase 0 remains **FROZEN**. Out-of-scope Phase A WIP remains on disk **untouched** (not deployed, not finished).

---

## 0. This re-cert cycle

| Action | Result |
|--------|--------|
| Reimplement hedging? | **NO** — used existing code |
| Expand to Phase A features? | **NO** |
| Deploy new images? | **NO** — certified against live `fx-phase1a-hedging` + `fx-cancel-ui` |
| Stage/commit? | **NO** |
| Minimum fix | Restored `forex-live-journey.cert.ts` SAFETY `orderTypes` to `['market','limit','stop']` (live API). Prior pollution expected `stop_limit` (out-of-scope Phase A WIP). |

---

## 1. Exit gate checklist

| Gate | Result |
|------|--------|
| HEDGING mode works | **PASS** |
| BUY+SELL same symbol → 2 independent OPEN | **PASS** |
| Unique position IDs | **PASS** |
| Independent P&L | **PASS** |
| Independent SL | **PASS** |
| Independent TP | **PASS** |
| Independent trailing | **PASS** |
| Individual close | **PASS** |
| Partial close | **PASS** |
| Margin / equity / balance | **PASS** |
| Realized P&L / ledger MATCH | **PASS** |
| Ownership / IDOR | **PASS** |
| Concurrency | **PASS** (unit J) |
| WebSocket / reload reconstruct | **PASS** (browser) |
| Browser E2E | **PASS** **65/65** (incl. PART 4B hedging) |
| NETTING regression | **PASS** |
| Phase 0 price-universe | **PASS** **18/18** |
| Forex live journey | **PASS** (all keys incl. CRYPTO_REGRESSION) |
| Crypto smoke | **PASS** (spot/wallet/p2p 200) |
| REAL_FOREX OFF / LP MOCK / SIMULATED | **PASS** |
| QA left in NETTING | **PASS** |
| No Crypto business logic changed this cycle | **PASS** |
| No destructive Git | **PASS** |

---

## 2. Evidence — unit

`FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-phase1a-hedging.test.ts`

```
PASS  hedging math open/reduce
PASS  TEST A NETTING regression
PASS  TEST B HEDGING two independent positions
PASS  same-side HEDGING creates two positions
PASS  TEST C independent close
PASS  TEST D partial close isolation
PASS  TEST E/F SL/TP isolation
PASS  TEST G/H P&L + margin
PASS  TEST I ledger MATCH
PASS  ownership / IDOR
PASS  TEST J concurrency
forex phase1a hedging: PASS
```

---

## 3. Evidence — live API

`forex-phase1a-hedging.cert.ts` → **15/15**

```
PASS  AUTH
PASS  MODE_NETTING
PASS  NETTING_REGRESSION — open=0
PASS  MODE_HEDGING
PASS  HEDGE_BUY_ONE — open=1
PASS  HEDGE_TWO_POSITIONS — open=2 modes=HEDGING,HEDGING
PASS  CLOSE_BUY_SELL_REMAINS — open=1
PASS  BOTH_CLOSED
PASS  MARGIN_BOTH_OPEN — used=4652.64
PASS  PARTIAL_CLOSE — buy=0.6 sell=1.00000000
PASS  SL_ISOLATION
PASS  TP_ISOLATION
PASS  LEDGER_MATCH
PASS  OWNERSHIP_FAKE_ID
PASS  RESTORE_NETTING
```

---

## 4. Evidence — Phase 0 / journey / Crypto

| Suite | Result |
|-------|--------|
| `forex-price-consistency.cert.ts` | **18/18** (`DEMO_POSTURE` SIMULATED/MOCK; BUY mark=BID; SELL mark=ASK) |
| `forex-live-journey.cert.ts` | **PASS** all keys |
| Crypto smoke | spot tickers / wallet / p2p → **200** |

---

## 5. Evidence — browser E2E

`node scripts/forex-browser-cert.mjs` → **65/65**

Hedging PART 4B:

| Check | Result |
|-------|--------|
| HEDGE_MODE_SET | PASS |
| HEDGE_TWO_OPEN | PASS (`open=2`) |
| HEDGE_BOTH_ROWS_VISIBLE | PASS |
| HEDGE_NOT_FLAT_LABEL | PASS |
| HEDGE_INDEPENDENT_CLOSE | PASS |
| HEDGE_LEDGER_MATCH | PASS (`MATCH`) |

Also retained: Cancel UI ×4, trailing, partial/full close, mobile layout.

---

## 6. Live deployment (unchanged this cycle)

| Service | Image |
|---------|--------|
| Backend | `m-live-backend:fx-phase1a-hedging` (`b680fe2b2f20`) |
| Frontend | `m-live-frontend:fx-cancel-ui` (`b90de0e54285`) |
| Trading config | `source=SIMULATED` `executionMode=MOCK` `orderTypes=[market,limit,stop]` |
| QA account after cert | **NETTING**, ledger **MATCH**, pins cleared |

---

## 7. Diff safety (classification — not staged)

| Class | Examples |
|-------|----------|
| **A. Phase 1A** | `positions/hedging.ts`, `account-mode*`, phase1a tests/certs, hedging branches in positions/orders/risk |
| **B. Phase 0** | pin hygiene, price certs, `FOREX_PHASE0_*` |
| **C. Pre-existing dirty** | Spot, admin-panel, compose, monitoring, backup scripts |
| **D. Out-of-scope Phase A WIP** | Stop Limit/TIF/journal/chart drag/drawings/Change% — **left on disk, not deployed** |
| **E. This cycle only** | `forex-live-journey.cert.ts` SAFETY orderTypes restore |

Nothing staged. No `git add .`. Crypto Spot dirty files untouched by this cycle’s edits.

---

## 8. Final verdict

**Phase 1A = PASS**

STOP. Do **not** start Phase 1B (Close By / Reverse). Do **not** continue Phase A WIP.
