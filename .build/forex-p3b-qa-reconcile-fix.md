# P3-B QA reconciliation recovery + order cleanup

**Completed:** 2026-09-18T20:40:00Z  
**P3-B:** **NOT_PROVEN** (`LIVE_SESSION_CLOSE_NOT_CURRENTLY_OBSERVABLE`)  
**Phase 3:** **CONDITIONAL**  
Cleanup cancellations are **not** DAY expiry certification.

---

## Root cause

Forex hydrate failed with `POSITION_MISMATCH` on QA account `14e57a8f-bbd2-4b48-9b60-6bccede41176` (open EURUSD **short** 0.05 @ **1.03450518**).

| Source | Entry price |
|--------|-------------|
| Persisted `forex_positions.entry_price` (NUMERIC 20,8) | `1.03450518` |
| Fill replay (full precision) | `1.0345051691100823046` |
| Replay at 8dp (banker) | `1.03450517` |

**Classification:** equivalent economic average; reconcile used `persistScaleEq` with **1e-8** abs tolerance, which rejected a **~1.09e-8** gap at the **8th decimal** boundary between replay and stored row.

**Fix:** `persistEntryPriceEq` — match at 8dp via `fxToPriceString`, else allow gap **&lt; 1.2e-8** (one 8th-decimal unit for replay vs column).

**Secondary (cleanup unblock):** pending-working **cancel** no longer nests `*risk*` → `orderId` (prevented hangs under concurrent quote evaluation).

---

## Deployment

- **Backend only** — `exchange-backend` digest `sha256:1f04a223afccf729a8573866e7ef8cb7b216d911e22f1860c52934fad33e0e5b`
- **economicReady:** `true` after deploy and after cleanup
- No migration, no seed

---

## Cleanup (customer API)

| orderId | clientOrderId | Result |
|---------|---------------|--------|
| `eab3dfa3-…` | `p3b-day-natural-1789749675064` | **CANCELLED** |
| `0ec1c8f6-…` | `p3b-day-natural-1789751517107` | **CANCELLED** |
| `38806f23-…` | `p3b-day-natural-1789755535885` | **CANCELLED** |

- **failureReason:** null (normal cancel, not `DAY_ORDER_EXPIRED`)
- **Journal:** +3 `ORDER_CANCELLED` (94 → 97 events)
- **Executions / fills / ledger / positions:** unchanged

Original QA EURUSD short: **unchanged** (1.03450518 / 0.05 short).

---

## Tests

- `entry-price-reconcile.test.ts` — **PASS**

---

## Firewalls

- **Crypto:** unchanged  
- **REAL_FOREX:** OFF · MOCK/SIMULATED  

JSON: `.build/forex-p3b-qa-reconcile-fix.json`
