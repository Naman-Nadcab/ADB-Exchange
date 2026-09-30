# Forex Phase 0 + Phase 1 — Staging Runtime Verification

**Timestamp (UTC):** 2026-09-18T13:26:00Z  
**Git SHA:** `7f0bf68e753969778683e04b19d43bc78014d02d` (unchanged; uncommitted implementation)  
**Host:** `109.123.254.30` (existing `docker-compose.production.yml` VPS stack)

---

## Deployment

| Item | Value |
|------|--------|
| Workflow | `docker compose -f docker-compose.production.yml build backend` then `up -d --no-deps backend` |
| Reference | `deployment/README.md` — **not** full `deploy.sh` (no migrate, no seed, no frontend rebuild) |
| Migrations | **Not run** |
| Frontend | **Not rebuilt** |

### Runtime identity (post-deploy)

| Field | Value |
|-------|--------|
| Container | `exchange-backend` |
| Image | `m-live-backend:latest` |
| Digest | `sha256:64dc02980c1da78e432cf8f4adced55665e7a8411fe77bdb7a30a995d41e3da1` |
| Created | `2026-09-18T13:23:30Z` |
| Health | `healthy` |
| Proof | `mergeMockAuthorityLiveBar` present in container `dist/.../mock-authority.js` |

---

## Pre-deploy tests (all PASS)

- `customer-contract.test.ts`
- `mock-authority.test.ts`
- `forex-phase1c-stoplimit-tif.test.ts`
- `forex-phase-a-orders.test.ts` → `forex-phase-a-orders.test: ok`
- `price-consistency.test.ts` → 4/4
- `quote-chart-overlay.test.ts`

---

## Trading-config acceptance — **RUNTIME_VERIFIED**

`GET /api/v1/forex/trading-config`

- `orderTypes`: `market`, `limit`, `stop`
- `timeInForce`: `GTC`
- `capabilities.version`: **1**
- `stopLimit`: engine=true, customerExposed=**false**, runtimeCertification=NOT_CERTIFIED
- `day` / `ioc` / `fok`: engine=true, customerExposed=**false**
- `gtc`: customerExposed=true, runtimeCertification=MOCK_ONLY
- `gtd`: engine=**false**

---

## Candles acceptance — **RUNTIME_VERIFIED**

`GET /api/v1/forex/candles?symbol=EURUSD&timeframe=15m`

| Field | Value |
|-------|--------|
| `source` | `SIMULATED` |
| `reason` | `SIMULATED_MOCK_WITH_REFERENCE_HISTORY` |
| `liveCandleSource` | `SIMULATED` |
| `historicalCandleSource` | `EXTERNAL` |
| `marketDataAuthority.authority` | `SIMULATED` |
| `marketDataAuthority.referenceProvider` | `yahoo` |

**Mock authority check (sequential requests):**

- Quote mid: **1.14671** (SIMULATED MOCK-C)
- Live bar close: **1.14662** (~0.008% vs mid — same bucket, tick moved between calls)
- Penultimate bar close: **1.146789…** (EXTERNAL reference history — **distinct** from live SIMULATED bucket)

---

## Quotes — **RUNTIME_VERIFIED**

- `source`: SIMULATED  
- `providerCode`: MOCK-C  
- `executionMode` on config: MOCK  
- `REAL_FOREX`: not in container env; `capabilities.realForex`: false  

---

## Database (read-only)

| Table | Pre | Post |
|-------|-----|------|
| forex_journal_events | 0 | 0 |
| forex_orders | 741 | 741 |
| open forex_positions | 3 | 3 |

No deployment-induced mutation.

---

## Browser — **PARTIAL_RUNTIME_VERIFIED**

`/forex/trade` loads; chart region present; ticket **Market/Limit/Stop**; Stop Limit unavailable; TIF GTC only; DOM unavailable; Buy/Sell disabled (unsigned out).

**Gap:** Deployed frontend image unchanged — no on-chart label for `marketDataAuthority` (API truth is updated; UI semantics doc-only in repo).

---

## Crypto / REAL_FOREX

- **Crypto:** no task-caused changes; pre-existing dirty spot files untouched.
- **REAL_FOREX:** **VERIFIED OFF**

---

## Final summary

| Area | Verdict |
|------|---------|
| PHASE 0 RUNTIME | **RUNTIME_VERIFIED** |
| PHASE 1 RUNTIME | **RUNTIME_VERIFIED** |
| TRADING CONFIG | **RUNTIME_VERIFIED** |
| MOCK MARKET DATA | **RUNTIME_VERIFIED** |
| CANDLES | **RUNTIME_VERIFIED** |
| QUOTES | **RUNTIME_VERIFIED** |
| CHART | **PARTIAL_RUNTIME_VERIFIED** |
| REAL_FOREX | **VERIFIED OFF** |
| CRYPTO | **VERIFIED UNCHANGED** |
| STOP LIMIT / EXTENDED TIF | **NOT TOUCHED** |
| DB | **NO WRITES** |
| UNEXPECTED CHANGES | **NONE** |

**Remaining P0:** Optional frontend image rebuild if product wants visible authority labeling (not required for API-level Phase 1).

Artifacts: `.build/forex-phase1-runtime-verification.json`
