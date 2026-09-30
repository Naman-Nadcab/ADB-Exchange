# P3-B — Natural session-close certification

**Status:** **GREEN**  
**Certification:** **RUNTIME_VERIFIED**  
**Method:** NATURAL_SESSION_CLOSE (mock market-data worker → `onAcceptedQuote` → `evaluateQuote` → `expireDayOrders`)  
**No demo-price · no clock override · no manual DB**

---

## Session

| Field | Value |
|-------|--------|
| Timezone | America/New_York |
| Before | `open=true`, `reason=OPEN` (2026-09-18T20:49:56Z) |
| Natural close observed | **2026-09-18T21:00:05Z** |
| After | `open=false`, `reason=FRIDAY_CLOSE` |

---

## QA order

| Field | Value |
|-------|--------|
| orderId | `921cbb64-dfdd-4130-b3ec-cc24c56ec2a8` |
| clientOrderId | `p3b-green-day-1789764597288` |
| Symbol / side | EURUSD **buy** limit @ **1.05**, vol **0.01**, **TIF=DAY** |
| Before close | **PENDING** |
| After close | **CANCELLED**, `failureReason=DAY_ORDER_EXPIRED` |
| Updated at | 2026-09-18T21:00:41.308Z |

---

## Journal (DB)

- `ORDER_ACCEPTED`, `ORDER_PENDING`, **`ORDER_CANCELLED`** (`e1c4e084-6d02-4c84-8a60-0eec988098fd`)

---

## DB counts

| Table | Before | After | Δ |
|-------|--------|-------|---|
| forex_orders | 791 | 792 | +1 cert order |
| forex_journal_events | 97 | 100 | +3 lifecycle |
| executions / fills / ledger / positions | unchanged | unchanged | 0 financial |

---

## Idempotency

5s wait for additional mock ticks: order stays **CANCELLED** / **DAY_ORDER_EXPIRED**; journal count stable (no duplicate cancel).

---

## Tests

- `entry-price-reconcile.test.ts` — PASS  
- `forex-phase-a-orders.test.ts` — PASS (DAY session close)

---

## Deployment / safety

- Backend: `sha256:1f04a223afccf729a8573866e7ef8cb7b216d911e22f1860c52934fad33e0e5b` (no redeploy this cert)
- REAL_FOREX: **OFF** · MOCK/SIMULATED  
- Crypto: **unchanged**

---

## Phase 3

See `.build/forex-phase3-final-green-certification.json` — **PHASE 3 = GREEN** (P3-B closes runtime gap).

**Browser UI:** NOT_PROVEN this run (API+DB sufficient for P3-B backend path).

JSON: `.build/forex-phase3-p3b-natural-close-certification.json`
