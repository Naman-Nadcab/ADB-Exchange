# FDA Beta — Forex Audit

## Execution & market data (runtime evidence)

**Probe:** `GET http://109.123.254.30/api/v1/forex/capabilities` → **200**

```json
"source":"SIMULATED","executionMode":"MOCK","realForex":false
"runtimeCertification":"MOCK_ONLY" (order types, TIF)
```

| Layer | Classification | Evidence |
|-------|----------------|----------|
| Executable quotes | **SIMULATED** | `mock-authority.ts`, capabilities API |
| Order fills | **MOCK** | `execution/service.ts` → mock venues |
| Historical bars | **EXTERNAL ref** (Yahoo) | `ohlc-yahoo.ts` — not execution price |
| LP / MT5 / FIX | **NOT_CONNECTED** | `adapters/registry.ts` stubs disabled |

## Netting / hedging (code, not live trade proof)

| Mode | Backend | Tests |
|------|---------|-------|
| **NETTING** | `positions/service.ts`, account `position_mode` | `forex-phase5.test.ts`, phase1 netting regression |
| **HEDGING** | Independent `positionId` rows, fill routing | `forex-phase1a-hedging.test.ts` (close, partial, SL/TP per position) |

**UI:** `positionMode` from store; chart focus `chartFocusPositionId` for hedging SL/TP — **NOT_PROVEN** in browser this audit.

## Terminal `/forex/trade` (MT5-style)

| Component | Source present | Runtime proven this audit |
|-----------|----------------|---------------------------|
| Market Watch, symbol TF | Yes | Page **200** |
| Chart (Lightweight Charts) | Yes | **NOT_PROVEN** (no candle/order interaction) |
| Drawing rail tools | Yes (`ForexMt5DrawingRail`, extra engine) | **NOT_PROVEN** (Playwright not run; do not trust prior PASS docs) |
| Object Manager | Yes | **NOT_PROVEN** |
| Order ticket / SL / TP | Yes | **NOT_PROVEN** |
| DOM / Time & Sales | Not in scope | **EXTERNAL_DEPENDENCY** |

**Drawing tools (exposed in UI — implementation in repo, runtime NOT_PROVEN here):** trend, ray, hline, vline, channel, fib, fib extension, rectangle, ellipse, triangle, arrow, text, measure, crosshair.

## Forex ledger & accounts

- **Authority:** `forex_ledger_transactions` / `forex_ledger_entries` (double-entry, immutable trigger).
- **NOT** `user_balances` — boundary enforced in `accounting/boundary.ts`.
- Customer ledger route: `/forex/account/ledger`.

## Forex readiness

**READY_WITH_BLOCKERS** for **demo/simulated beta**; **NOT_READY** for **live broker / real money execution** without MOCK→REAL work and PSP connectivity proof.
