# Phase 4 preflight — Forex risk, margin & liquidation

**Date (UTC):** 2026-09-18T21:15:00Z  
**Phase 3 baseline:** **GREEN** (backend `sha256:1f04a223…`)  
**Phase 4 preflight verdict:** **CONDITIONAL** — core stack **exists**; **live certification not done**

---

## Deployment & safety

| Item | Value |
|------|--------|
| Branch | `release/exchange-production-baseline` |
| HEAD | `7f0bf68e753969778683e04b19d43bc78014d02d` |
| Backend / frontend | healthy |
| `economicReady` | true |
| REAL_FOREX | **OFF** |
| Execution | **MOCK / SIMULATED** |
| Crypto SHA (spot + ticker load) | **unchanged** vs Phase 3 |

---

## Authoritative risk chain (already in repo)

```text
Executable quote (MOCK providers)
  → mark open positions (LONG=BID, SHORT=ASK)
  → unrealized PnL
  → ledger equity (CUSTOMER_CASH + uPnL)
  → used / free margin, margin level
  → margin status (WARNING / MARGIN_CALL / STOP_OUT_READY)
  → account risk state (ForexRiskService)
  → liquidation eligibility + ordering
  → close via order/execution/position/ledger path
  → WS: fx.risk, fx.margin, fx.liquidation
```

**Policy source:** `accounting/valuation.ts`, `margin/engine.ts`, `risk/*`, `liquidation/*`.

---

## Gap map (summary)

| Domain | Status |
|--------|--------|
| Canonical backend risk / margin math | **EXISTING** |
| BID/ASK marking | **EXISTING** |
| Pre-trade preview API | **EXISTING** |
| Preview vs enforce alignment | **PARTIAL** (needs runtime proof) |
| Margin call / stop-out states | **EXISTING** |
| Liquidation service + ordering | **EXISTING** |
| Liquidation idempotency (live) | **PARTIAL** |
| Customer risk UI | **PARTIAL** |
| Risk WebSocket | **EXISTING** |
| Admin risk hub | **PARTIAL** (DB hub; not all live MTM) |
| IDOR (live Phase 4) | **PARTIAL** |
| Phase 4 runtime cert (tests 1–9) | **MISSING / NOT_PROVEN** |
| Browser customer + admin | **NOT_PROVEN** |

**Note:** `forex-phase4.test.ts` is the **legacy order-execution** suite, not this Phase 4 risk scope. Prefer **phase6–8** (+ phase7 liquidation) for targeted tests.

---

## Customer & admin surfaces (found)

**APIs:** `/margin`, `/risk/status`, `/risk/summary`, `/exposure`, `/liquidation`, `/orders/preview`  
**WS:** `fx.margin`, `fx.risk`, `fx.liquidation` (see `forex.fastify.ts`, `ws/protocol.ts`)  
**FE:** `ForexRiskBar.tsx`, `forex/account`, Zustand WS handlers  
**Admin:** `admin/risk-hub.ts`, margin policy patches on `admin-forex` routes  

---

## What Phase 4 is *not*

- Not a greenfield risk engine — **extend and certify** what exists.
- No Crypto changes, no REAL_FOREX, no SQL balance hacks, no demo-price cert hooks.
- **Phase 5 not started.**

---

## Artifacts

- JSON: `.build/forex-phase4-preflight.json`
- Gap register (initial): `.build/forex-phase4-gap-register.json`

**Next:** targeted tests → gap register RUNTIME_VERIFIED columns → live MOCK cert harness → final certification artifacts.
