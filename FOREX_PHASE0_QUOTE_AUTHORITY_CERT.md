# FOREX_PHASE0_QUOTE_AUTHORITY_CERT

**Phase:** 0 — Quote authority + demo-pin hygiene  
**UTC completed:** 2026-09-04T02:27Z  
**Scope:** FDM Forex only. No hedging / Close By / Stop Limit / TIF / History Center / DOM / real LP.  
**API:** `http://127.0.0.1:4000`  
**Browser:** `http://109.123.254.30`  

---

## 1. Original failure

| Item | Evidence |
|------|----------|
| Baseline cert | `FOREX_BASELINE_CERT.md` — `PRICE_EURUSD` / `ONE_PRICE_UNIVERSE` **FAIL** |
| Symptom | EURUSD executable mid ≈ **1.143** vs Yahoo candle close ≈ **1.163** (~**1.74%**) |
| Other symbols | Within ~0.1% (anchors healthy) |
| Live journey / ledger / Crypto | **PASS** (financial path not broken) |

**Reproduce (pre-fix):** sticky pin after `/market-data/demo-price`:

```
BEFORE: 1.14325 (already contaminated from prior journey)
PIN_APPLY price=1.05000 → AFTER_PIN mid=1.05002 (stays indefinitely)
```

---

## 2. Root cause

| Fact | Detail |
|------|--------|
| State owner | In-process `demoPinnedMids` in `mock-provider.ts` |
| Writer | `pinForexDemoMid` via `ForexPricingService.applyDemoPrice` ← `POST /market-data/demo-price` |
| Reader | `mockPriceAt` → MOCK worker ticks → aggregator → REST/WS quotes, mark, SL/TP |
| Lifecycle before | **Indefinite** — no TTL, no auto-clear, no HTTP clear |
| Contamination | `forex-live-journey.cert.ts` left EURUSD pinned after LIMIT/STOP trigger tests |
| Anchor refresh | Updates Yahoo-based MOCK **base only**; does **not** clear pins |

---

## 3. Files changed (this phase)

### Implemented / updated

| File | Role |
|------|------|
| `apps/backend/src/services/forex/market-data/mock-provider.ts` | Pin TTL, expiry-on-read, `clearForexDemoPins`, `getForexDemoPin` |
| `apps/backend/src/services/forex/quotes.service.ts` | `clearDemoPins` (+ retick after clear) |
| `apps/backend/src/routes/forex-accounting.fastify.ts` | `POST /market-data/demo-price/clear` (DEMO/MOCK only) |
| `apps/backend/src/services/forex/market-data/demo-pin.test.ts` | **New** unit tests (8/8) |
| `apps/backend/src/services/forex/forex-price-consistency.cert.ts` | Clear-before-measure + pin lifecycle gates |
| `apps/backend/src/services/forex/forex-live-journey.cert.ts` | Clear at start + after each `applyAndFill` |
| `apps/frontend/src/lib/forex/api/client.ts` | `clearDemoPrice` client helper (not required for browser PASS) |

### Deployed image

| Item | Value |
|------|-------|
| Tag | `m-live-backend:fx-phase0-pin` (= `latest` / `fx-price-fix`) |
| Image ID | `sha256:50605482d2178e0bff86571c4c299c2884add5b1bf7e76c49dca89a28ea8e44b` |
| Rollback | `m-live-backend:checkpoint-20260904T015908Z` (`47375b084a2d`) |
| Frontend | **Unchanged** this phase (`fx-price-fix` / checkpoint still current) |
| Build isolation | Synced Phase 0 Forex files into `/tmp/fx-build` only; dirty `spot.fastify.ts` **not** in image |

### Not staged / not committed

No git commit. No `git add .`. Unrelated dirty files remain dirty and untouched by deploy.

---

## 4. Pin lifecycle before

```
POST /demo-price → pinForexDemoMid(symbol, mid)  // Map<string, string>
→ mockPriceAt uses pinned mid forever
→ process restart is the only reliable clear
→ next cert / UI session contaminated
```

---

## 5. Pin lifecycle after

```
POST /demo-price → pinForexDemoMid(mid, ttl=FOREX_DEMO_PIN_TTL_MS default 30s)
→ mockPriceAt uses pin only while expiresAtMs > now; else delete + resume anchor walk
→ POST /demo-price/clear → clear map + immediate retick (aggregator leaves pinned mid)
→ live-journey clears after each pending fill + at start
→ price-consistency clears before universe measurement
→ restart still empties in-memory pins
→ anchor refresh never creates/extends pins
```

---

## 6. Quote authority before

| Consumer | Source |
|----------|--------|
| Executable Bid/Ask | MOCK walk (`mockPriceAt`) — **unless sticky pin overrides base** |
| Chart candles | Yahoo EXTERNAL (reference) |
| Risk | Dual universe when pin stuck on one symbol |

---

## 7. Quote authority after

| Consumer | Source | Status |
|----------|--------|--------|
| Market Watch / ticket / preview / WS | MOCK pricing service (anchored base ± walk) | **PASS** |
| Position mark / P&L / margin | Same live quote DTO | **PASS** |
| SL / TP / trailing evaluation | Same quote Bid/Ask sides | **PASS** (journey + trailing) |
| Chart Live overlay | Executable quote (existing UI) | **PASS** (browser) |
| Chart Candle C | Yahoo EXTERNAL reference only | **PASS** (labeled separately) |
| Demo pin | Temporary DEMO override with TTL + clear | **PASS** |

Yahoo candles are **never** the fill/mark authority.

---

## 8. Bid/Ask semantics

| Check | Result | Evidence |
|-------|--------|----------|
| Zero-spread DEMO `bid == ask` | **PASS** | price cert `ZERO_SPREAD_DEMO` |
| BUY preview = ASK | **PASS** | `referenceSide=ASK` |
| SELL preview = BID | **PASS** | `referenceSide=BID` |
| LONG mark = BID | **PASS** | `MARK_BUY` |
| SHORT mark = ASK | **PASS** | `MARK_SELL` |
| Bid/Ask not collapsed for convenience | **PASS** | fields retained; DEMO spread configured-zero |

---

## 9. Price-universe results

**Threshold unchanged:** `MAX_UNIVERSE_DRIFT = 0.5%`. EURUSD **not** excluded.

| Run | Result |
|-----|--------|
| After deploy | **18/18 PASS** (incl. `PRICE_EURUSD`, `ONE_PRICE_UNIVERSE`, pin create/clear/resume) |
| After live-journey | **18/18 PASS** (no contamination) |

Sample (post-fix):

```
EURUSD  drift=0.0145%
… all symbols < 0.5%
ONE_PRICE_UNIVERSE PASS
DEMO_PIN_CREATE / CLEAR / RESUME PASS
```

---

## 10. Forex regression results

| Check | Status |
|-------|--------|
| Backend `tsc --noEmit` | **PASS** |
| Frontend `tsc --noEmit` | **PASS** |
| `demo-pin.test.ts` | **PASS** (8/8) |
| `anchor.test.ts` | **PASS** (7/7) |
| Frontend `price-consistency.test.ts` | **PASS** (4/4) |
| `forex-live-journey.cert.ts` | **PASS** (all keys including LIMIT/STOP/SL/TP/partial/full/ledger/CRYPTO) |
| Trailing create (`trailingDistance=0.002`) | **PASS** |
| Ledger reconciliation | **MATCH** |
| Demo funding | **PASS** (journey) |

---

## 11. Browser results

`scripts/forex-browser-cert.mjs` → **39/39 PASS**

| Notable | Detail |
|---------|--------|
| `PRICE_EURUSD` | bid=ask=live=1.16315; candleC=1.16306; liveVsBid=0% |
| Surfaces showing quote | 15 |
| Position mark vs BID | **PASS** |
| Mobile 390×844 | **PASS** (no H-overflow) |
| Abort noise | `ERR_ABORTED` on `/` and one preview — non-fatal; cert still 39/39 |

Screenshots: `/tmp/fx-cert-workstation.png`, `/tmp/fx-cert-position.png`, `/tmp/fx-cert-mobile.png`

---

## 12. Ledger reconciliation

| Context | Status |
|---------|--------|
| Live journey `RECONCILIATION` | **PASS** / **MATCH** |
| Post-trailing cleanup | **MATCH** |

---

## 13. Crypto smoke result

| Endpoint | HTTP |
|----------|------|
| `/api/v1/spot/tickers` | **200** |
| `/api/v1/wallet/balances` | **200** |
| `/api/v1/p2p/ads` | **200** |
| Journey `CRYPTO_REGRESSION` | **PASS** |
| Crypto business logic in this deploy | **Unchanged** (spot dirty files not in build tree) |

`/api/v1/markets/pairs` → 404 (pre-existing path difference; not introduced by Phase 0).

---

## 14–16. Safety posture

| Gate | Status |
|------|--------|
| REAL_FOREX | **OFF** (`source=SIMULATED`; admin `realForex` not enabled) |
| LP | **MOCK** |
| Execution | **SIMULATED / MOCK** |
| Destructive git | **None** |
| Unrelated files staged | **None** |

---

## 17. Remaining known limitations

| Item | Status |
|------|--------|
| Historical candles = Yahoo EXTERNAL | **MOCK LIMITATION** / by design (reference only) |
| Executable path = simulated MOCK walk | **MOCK LIMITATION** (intentional) |
| DOM / Time & Sales | **NOT SAFELY TESTABLE** / unavailable (not Phase 0) |
| Hedging / Close By / Stop Limit / TIF | **Not implemented** — Phase 1+ only after this gate |
| Frontend image not rebuilt this phase | **PASS** for browser (prior Live vs Candle UI already deployed); `clearDemoPrice` client is workspace-only until a future FE rebuild |
| Pin TTL default 30s | Certs must clear explicitly; do not rely on TTL alone for immediate isolation |

---

## Phase 0 exit gate

| Gate | Status |
|------|--------|
| EURUSD price-universe PASS | **PASS** |
| Other symbols PASS | **PASS** |
| Demo pin creation works | **PASS** |
| Demo pin clear/expiry works | **PASS** |
| No stale pin contamination | **PASS** |
| Normal quote resumes after pin | **PASS** |
| Bid/Ask authoritative | **PASS** |
| BUY uses ASK | **PASS** |
| SELL uses BID | **PASS** |
| Chart uses executable quote | **PASS** |
| Position marking uses executable quote | **PASS** |
| SL/TP uses executable quote | **PASS** |
| WebSocket / live quote consistent | **PASS** (browser live=bid) |
| Existing Forex journey PASS | **PASS** |
| Ledger MATCH | **PASS** |
| Crypto smoke PASS | **PASS** |
| REAL_FOREX OFF / LP MOCK / SIMULATED | **PASS** |
| No unrelated changes in deploy | **PASS** |
| No destructive Git | **PASS** |
| Phase 0 report created | **PASS** |

### Decision

**Phase 0 COMPLETE — PASS.**

**Do not start Phase 1 (Hedging) until explicitly requested.**
