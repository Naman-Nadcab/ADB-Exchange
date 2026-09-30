# P3-B — DAY order session-close live certification

**Date (UTC):** 2026-09-18T16:38:00Z  
**Phase 3 final status:** **CONDITIONAL** (unchanged)  
**P3-B verdict:** **NOT_PROVEN** (live session-close) · **TEST_VERIFIED** (production code path)

---

## Objective

Observe **production** `expireDayOrders()` at **real session close** on the deployed MOCK stack, with DB/API (and UI if possible) proof. Do not force GREEN.

---

## Deployment identity

| Item | Value |
|------|--------|
| Git SHA | `7f0bf68e753969778683e04b19d43bc78014d02d` |
| Branch | `release/exchange-production-baseline` |
| Backend | `exchange-backend` · `sha256:9f7f26e226c676d86bf88e98d872f0e48161ac7a41f8799b0b9334ccfb62c8a6` |
| REAL_FOREX | **OFF** |
| Execution | **MOCK / SIMULATED** |
| Redeploy this cert | **No** |

---

## Step 1 — Implementation trace (read-only)

1. **DAY order** — Customer places pending order with `timeInForce: DAY` (not valid on market orders).
2. **Session** — `isForexTradingEligible()` uses IANA `America/New_York`, 24×5 windows, and `isForexWeekendClosed()` (Friday ≥ 17:00 NY closed).
3. **Trigger** — Every `evaluateQuote(quote)` calls **`expireDayOrders()` first** (`orders/service.ts`).
4. **Expiry logic** — Lists open DAY + pending-working orders; if `session.open === false`, transitions to **`CANCELLED`**, sets **`failureReason: DAY_ORDER_EXPIRED`**, emits **`ORDER_CANCEL_REQUESTED`** / **`ORDER_CANCELLED`**, persists order + journal.
5. **Live quote path** — Authenticated **`POST /api/v1/forex/market-data/demo-price`** applies simulated price and **`await getForexOrderService().evaluateQuote(quote)`** (same singleton as production orders).

**When `expireDayOrders()` actually cancels:** session **closed** and at least one **DAY** pending-working order in the in-memory store (hydrated from DB on startup).

---

## Step 2 — Safe deterministic hook search

| Mechanism | Usable for live P3-B? |
|-----------|------------------------|
| `setForexSessionNowForTests()` | **No** — in-process only; not exposed on `:4000`; external scripts cannot set backend clock |
| `POST …/market-data/demo-price` → `evaluateQuote` | **Yes, but only when wall-clock session is CLOSED** — uses real `isForexTradingEligible()`, no DB time fake |
| `X-EDA-Forex-Test` execution test API | **No** — does not run order expiry |
| Isolated cert backend / `exchange_forex_cert` | **Out of scope** — not production runtime |
| Admin session exception APIs | **None found** for customer-stack session clock |

**No new certification hook was added** (Step 4: a clock-override HTTP endpoint would bypass real session-close observation and is not an existing safe mechanism).

---

## Step 4 — Live observability

At certification time:

- **UTC:** 2026-09-18T16:35:15Z  
- **New York:** Friday 2026-09-18 12:35:15 **EDT** (session **OPEN**)  
- **`GET /api/v1/forex/sessions`:** `eligibility.open: true`, `reason: OPEN`  
- **DB:** `SELECT COUNT(*) FROM forex_orders WHERE failure_reason='DAY_ORDER_EXPIRED'` → **0**

Natural Friday close: **17:00 America/New_York** (~4h25m after cert). Per policy: **did not wait indefinitely** and **did not** change scheduling or DB.

**Report:** `LIVE_SESSION_CLOSE_NOT_CURRENTLY_OBSERVABLE`

---

## Steps 5–8 — Live order / DB / API / UI

| Step | Result |
|------|--------|
| Controlled DAY pending order | **Skipped** — no way to complete live expiry proof while session OPEN |
| Session-close evaluation on production | **Not observed** — `expireDayOrders()` would no-op (`session.open`) |
| DB before/after | **No cert order**; DAY_ORDER_EXPIRED count remains **0** |
| API order/journal after expiry | **N/A** |
| Customer UI `/forex/trade` | **NOT_PROVEN** — no expired DAY order to display |

---

## Step 11 — Idempotency

Covered in **`forex-phase-a-orders.test.ts`**: second `expireDayOrders()` after DAY cancel returns length **0**. Live double-invoke **not run** (no live expiry event).

---

## Step 12 — Tests

```text
FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-phase-a-orders.test.ts
→ PASS (includes "DAY pending orders expire when the session closes")
```

No full admin/crypto regression suites run.

---

## Step 13 — Deployment

**No production code changes** → **no redeploy**.

---

## Step 14 — Crypto firewall

| File | SHA-256 (this cert) | Changed this cert? |
|------|---------------------|--------------------|
| `apps/backend/src/routes/spot.fastify.ts` | `925ceffc408e494180b2e513b85cbc8eb3d780abfa8f3d999a120ff86b20efe1` | **NO** |
| `apps/backend/src/lib/spot-ticker-db-load.ts` | `bb2ffb23ab52ac81f37883bf58b36143a53cc2113614c96b3717fd08ae128613` | **NO** |

**CRYPTO = FROZEN** for this task.

---

## Step 15 — Final P3-B verdict

| Criterion | Status |
|-----------|--------|
| Live session-close + DB/API proof | **NOT_PROVEN** |
| Test-clock production-path proof | **TEST_VERIFIED** |
| **P3-B** | **NOT_PROVEN** (live gap remains) |

Do **not** force GREEN.

---

## Step 16 — Phase 3 status

| Item | Status |
|------|--------|
| P3-A | **PARTIAL_RUNTIME_VERIFIED** (unchanged) |
| P3-B | **NOT_PROVEN** (this cert) |
| P3-C | **DOCUMENTED_BY_DESIGN** (unchanged) |
| **PHASE 3** | **CONDITIONAL** |

**`forex-phase3-final-green-certification.*` not created.**

---

## JSON artifact

Full machine-readable record: `.build/forex-phase3-day-expiry-live-certification.json`

---

## Recommended follow-up (outside this STOP)

Re-run the same procedure **after** Friday 17:00 NY (or Sunday–Friday closed window):

1. Place one DAY **buy limit** far from market (e.g. EURUSD 1.05000) via QA API.  
2. Confirm session **CLOSED** via `/api/v1/forex/sessions`.  
3. `POST /api/v1/forex/market-data/demo-price` for EURUSD (any valid mid) to drive **`evaluateQuote` → `expireDayOrders()`**.  
4. Verify order **CANCELLED** / **DAY_ORDER_EXPIRED**, journal **ORDER_CANCELLED**, no fill/position/ledger delta.

No new hook required if natural session close is used.
