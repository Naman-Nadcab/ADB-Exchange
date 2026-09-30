# P3-B QA DAY order cleanup

**Outcome:** **INCOMPLETE / BLOCKED**  
**P3-B:** **NOT_PROVEN** (`LIVE_SESSION_CLOSE_NOT_CURRENTLY_OBSERVABLE`)  
**Phase 3:** **CONDITIONAL** (unchanged)

---

## Target orders (still PENDING)

| orderId | clientOrderId | TIF | limit | state |
|---------|---------------|-----|-------|-------|
| `eab3dfa3-f80f-44a2-a5d0-8dc9f5debd00` | `p3b-day-natural-1789749675064` | DAY | 1.05 | **PENDING** |
| `0ec1c8f6-9257-457e-80ff-e9f03b472329` | `p3b-day-natural-1789751517107` | DAY | 1.05 | **PENDING** |
| `38806f23-d7d2-46ce-9de6-42df17b5f996` | `p3b-day-natural-1789755535885` | DAY | 1.05 | **PENDING** |

All verified before cleanup: EURUSD **buy** limit **0.01**, far from market, **no fills**.

---

## What was attempted

1. **Customer cancel API** — `POST /api/v1/forex/orders/:orderId/cancel` (QA bearer token).
2. Pre-restart: requests **hung** (in-flight queue / slow DB).
3. **Backend restart** (`docker compose … restart backend`) to clear stuck state — **not** a code deploy.
4. Post-restart: cancel and order GET return **503** `FOREX_NOT_READY`:
   - `FOREX_RECONCILE_FAILED:14e57a8f-bbd2-4b48-9b60-6bccede41176:POSITION_MISMATCH`
   - Reconcile detail (existing QA open position): stored `entry_price` **1.03450518** vs replay **1.034505169110082…**

**Not used:** manual DB updates, manual journal inserts, admin force-cancel, DAY expiry, demo-price, production code changes, deploy.

---

## Financial / DB impact

| Table | Before | After attempt | Δ |
|-------|--------|---------------|---|
| forex_orders | 791 | 791 | 0 |
| forex_journal_events | 94 | 94 | 0 |
| executions / fills / ledger / positions | unchanged | unchanged | 0 |

No cancellation journal events. No financial movement.

---

## Service / firewalls

- **exchange-backend / exchange-frontend:** healthy (HTTP health)
- **Forex economicReady:** **false** (mutations blocked)
- **REAL_FOREX:** OFF · **MOCK/SIMULATED**
- **Crypto:** unchanged (pre-existing dirty SHA only)
- **Deploy:** NONE

---

## Cert script

`scripts/forex-phase3-p3b-natural-close-cert.mjs` — untracked, not deployed, not deleted.

---

## Unblock (outside this STOP scope)

When `GET /api/v1/forex/readiness` shows `economicReady: true`, run normal customer **cancel** on the three order IDs above.

JSON: `.build/forex-phase3-p3b-cleanup.json`
