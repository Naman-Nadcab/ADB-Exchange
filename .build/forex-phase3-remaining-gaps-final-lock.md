# Phase 3 remaining gaps — final lock

**PHASE 3 FINAL STATUS:** **CONDITIONAL**

| Gap | Verdict |
|-----|---------|
| **P3-A** Browser `/forex/trade` | **PARTIAL_RUNTIME_VERIFIED** (UI/ticket/TIF; browser order submit not exercised) |
| **P3-B** DAY session-close expiry | **NOT_PROVEN** on live VPS (production path **TEST_VERIFIED**) |
| **P3-C** TRIGGERING / SUBMITTED journaling | **DOCUMENTED_BY_DESIGN** |

---

## Deployment identity

| | Backend | Frontend |
|---|---------|----------|
| Digest | `sha256:9f7f26e2…` | `sha256:ec76bc1f…` |
| Health | healthy | healthy |
| Redeploy this closure | no | no |

Git `7f0bf68e753969778683e04b19d43bc78014d02d` · REAL_FOREX **off** · MOCK/SIMULATED

---

## P3-A — Live browser terminal

**Evidence:** `node scripts/forex-phase3-p3a-browser-cert.mjs` → `.build/forex-phase3-p3a-browser-evidence.json` (12/12 checks)

- QA login (`qa_trader_a` / existing harness password)
- `/forex/trade` loads; no `[object Object]`
- Order ticket: Market, Limit, Stop, **Stop Limit**
- TIF: GTC, IOC, FOK, DAY — **no GTD**
- Stop Limit fields visible
- Desktop + mobile: no horizontal overflow; ticket usable

**Not proven in browser this run:** submitting orders and observing fill UI (execution already **RUNTIME_VERIFIED** via Phase 3 API/WS cert).

---

## P3-B — DAY expiry at session close

**Production path (code):** `expireDayOrders()` when `isForexTradingEligible().open === false`, triggered from `evaluateQuote()` → state **CANCELLED**, reason **DAY_ORDER_EXPIRED**, journal **ORDER_CANCELLED**.

**TEST_VERIFIED:** `forex-phase-a-orders.test.ts` — closed session + quote tick expires DAY pending (limit + stop_limit); GTC survivor remains pending.

**Live blocker:** Session **OPEN** at certification time; **0** persisted orders with `DAY_ORDER_EXPIRED`; no safe live clock override on deployed backend (`setForexSessionNowForTests` is test-only). Per policy, production scheduling was **not** altered to force GREEN.

---

## P3-C — Engineering states vs customer journal

**DOCUMENTED_BY_DESIGN:**

- **TRIGGERING** / **SUBMITTED** (and **ROUTING**) are real persisted order states and appear in **forex_order_events** / API `status`.
- Customer **journal** intentionally maps a smaller set (`FOREX_ORDER_JOURNAL` in `orders/service.ts`) for customer-visible audit — see `journal/models.ts`.
- Canonical customer lifecycle: **ACCEPTED → PENDING → terminal outcome**; fast internal transitions are not duplicated in the journal by design.

No journal mapping change (would duplicate engineering audit without contractual requirement).

---

## Safety firewall

Crypto unchanged · no migration/seed · no external LP.

Phase 4 not started.
