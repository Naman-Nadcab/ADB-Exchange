# P3-B run aborted safely

**Stopped:** 2026-09-18T18:54:00Z (user STOP — no further polling)  
**P3-B:** **NOT_PROVEN**  
**Blocker:** `LIVE_SESSION_CLOSE_NOT_CURRENTLY_OBSERVABLE`  
**Phase 3:** **CONDITIONAL** (no GREEN)

---

## Process terminated

| Item | Value |
|------|--------|
| Command | `node scripts/forex-phase3-p3b-natural-close-cert.mjs` |
| Behavior | Placed DAY limits, then **polled** `GET /api/v1/forex/sessions` every **15s** waiting for **real** Friday NY close |
| demo-price / expiry | **Never reached** (session still **OPEN** at stop) |
| Signal | SIGTERM to cert node/tee/bash only |
| Backend restart | **No** |
| Containers killed | **No** |

---

## Service health (at stop)

- `exchange-backend`: **healthy**
- `exchange-frontend`: **healthy**
- **REAL_FOREX:** OFF (no REAL_FOREX env in backend)
- **Execution:** MOCK / SIMULATED

---

## Session at stop

- **open:** `true`
- **reason:** `OPEN`
- **timezone:** America/New_York

Natural close was still ahead; cert was **waiting on wall clock**, not stuck on API errors (after DB query fix).

---

## QA DAY orders created (not manually altered)

Three placements from repeated cert script runs:

| orderId | clientOrderId | state | TIF | failureReason |
|---------|---------------|-------|-----|---------------|
| `eab3dfa3-f80f-44a2-a5d0-8dc9f5debd00` | `p3b-day-natural-1789749675064` | PENDING | DAY | — |
| `0ec1c8f6-9257-457e-80ff-e9f03b472329` | `p3b-day-natural-1789751517107` | PENDING | DAY | — |
| `38806f23-d7d2-46ce-9de6-42df17b5f996` | `p3b-day-natural-1789755535885` | PENDING | DAY | — |

Journal per order: **ORDER_ACCEPTED**, **ORDER_PENDING** only. No **ORDER_CANCELLED** / no **DAY_ORDER_EXPIRED** yet.

---

## DB before vs after (read-only)

| Table | Pre-run baseline | At stop | Delta |
|-------|------------------|---------|-------|
| forex_orders | 788 | 791 | +3 |
| forex_journal_events | 88 | 94 | +6 |
| forex_positions | 301 | 301 | 0 |
| forex_executions | 676 | 676 | 0 |
| forex_fills | 674 | 674 | 0 |
| forex_ledger_entries | 676 | 676 | 0 |

No unexplained financial rows.

---

## Git / deploy

- **No production deploy**
- **New untracked file:** `scripts/forex-phase3-p3b-natural-close-cert.mjs` (cert runner only)
- **Crypto:** unchanged SHA (pre-existing dirty files only)

---

## What was actually verified

- Live **DAY limit accept** path (PENDING, far limit 1.05) — **yes**
- Live **session-close expiry** via demo-price → `expireDayOrders()` — **no**
- Unit/integration DAY expiry tests — **TEST_VERIFIED** (unchanged)

**STOP — Phase 4 not started.**

JSON: `.build/forex-phase3-p3b-run-aborted-safely.json`
