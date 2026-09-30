# Forex Phase 0 + Phase 1 Implementation Report

**Starting SHA:** `7f0bf68e753969778683e04b19d43bc78014d02d`  
**Ending SHA:** `7f0bf68e753969778683e04b19d43bc78014d02d` (uncommitted)  
**Runtime:** **SOURCE_IMPLEMENTED_RUNTIME_NOT_DEPLOYED** (production `exchange-backend` not rebuilt in this task)

---

## Phase 0 — Canonical capability contract

**Status: IMPLEMENTED**

Single source: `apps/backend/src/services/forex/capabilities/customer-contract.ts`

Tri-state per feature: `engine`, `customerExposed`, `runtimeCertification`.

- Customer exposure remains **market / limit / stop** and **GTC** only.
- Engine-only: **stop_limit**, **IOC / FOK / DAY** (not exposed in ticket).
- **GTD:** not implemented (no enum in `orders/request.ts`).
- Position modes, protections, position actions modeled with conservative `NOT_CERTIFIED` defaults.

`getForexCustomerTradingConfig()` now returns:

- `orderTypes`, `timeInForce` (explicit GTC)
- `capabilities` (full contract object)

---

## Phase 1 — MOCK market-data authority

**Status: IMPLEMENTED (source)**

`mergeMockAuthorityLiveBar()` in `mock-authority.ts`:

1. Loads EXTERNAL Yahoo history (unchanged fetch path).
2. Reads executable quote from `getForexPricingService()` (same MOCK book as ticket).
3. Drops EXTERNAL bar in the **current bucket** and appends a **SIMULATED** OHLC bar (close = quote mid).
4. Sets response metadata: `source: SIMULATED` when merged, `marketDataAuthority`, `liveCandleSource: SIMULATED`, `historicalCandleSource: EXTERNAL`.

Settled historical bars remain reference; live bucket aligns with executable MOCK state.

---

## Frontend

Types extended for `capabilities` on `ForexTradingConfig` and candle authority fields on `ForexCandleResponse` / `ForexCandleView`.  
`FOREX_MARKET_DATA_NOTES` updated to document reference vs executable semantics.

No Stop Limit / IOC / FOK / DAY UI changes.

---

## Tests

| Test | Result |
|------|--------|
| `customer-contract.test.ts` | PASS |
| `mock-authority.test.ts` | PASS |
| `forex-phase1c-stoplimit-tif.test.ts` | PASS |
| `forex-phase-a-orders.test.ts` (config) | PASS |
| `price-consistency.test.ts` | PASS |
| `quote-chart-overlay.test.ts` | PASS |

---

## Crypto / REAL_FOREX

- **No Crypto files modified by this task** (pre-existing spot dirt untouched).
- **REAL_FOREX:** remains off in contract and runtime env.

---

## Deployment readiness

Rebuild/restart **exchange-backend** (and frontend if serving updated types) via existing staging workflow.  
After deploy, verify:

```bash
curl -sS http://127.0.0.1:4000/api/v1/forex/trading-config | jq '.data.capabilities.version'
curl -sS 'http://127.0.0.1:4000/api/v1/forex/candles?symbol=EURUSD&timeframe=15m&limit=3' | jq '.data | {source,liveCandleSource,marketDataAuthority,reason}'
curl -sS 'http://127.0.0.1:4000/api/v1/forex/quotes?symbols=EURUSD' | jq '.data.quotes[0].mid'
```

Compare last candle `close` to quote `mid` (same bucket; exact match not required if tick moved between calls).

---

## Known limitations

- Production API still shows pre-change behavior until deploy.
- Browser smoke on current image: terminal loads; authority fields not yet in API payload.
- Phase 2 (Stop Limit + extended TIF UI) explicitly out of scope.
