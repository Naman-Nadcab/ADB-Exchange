# Second Confirmation Audit — Forex Customer Terminal

**Timestamp (UTC):** 2026-09-18T12:38:18Z  
**Mode:** Read-only cross-verification (prior fresh audit used as lead only)  
**Artifacts:**  
- `.build/forex-customer-terminal-second-confirmation-audit.json`  
- `.build/forex-customer-terminal-second-confirmation-audit.md`  

**Prior report not overwritten:** `.build/forex-customer-terminal-fresh-forensic-audit.{json,md}`

---

## A. Environment snapshot

| Field | Observed |
|--------|----------|
| HEAD | `7f0bf68e753969778683e04b19d43bc78014d02d` |
| Branch | `release/exchange-production-baseline` |
| Working tree | Dirty (pre-existing; **unchanged by this audit**) |
| ENVIRONMENT_CHANGED vs first audit | **NO** (same SHA; journal 0 / orders 741 / open positions 3) |
| exchange-frontend | `m-live-frontend`, healthy, created 2026-09-16 |
| exchange-backend | `m-live-backend`, healthy, created 2026-09-18 |
| exchange-nginx | routes `109.123.254.30` → stack |
| REAL_FOREX env on backend | **Not set** |
| Effective runtime | `MOCK`, `SIMULATED`, `realForex: false` (`runtime-controls.ts`) |

**SOURCE_RUNTIME_MISMATCH:** **CONDITIONAL** — uncommitted git changes vs container images; runtime API + browser used for customer truth; source used for execution paths.

---

## B. Runtime identity trace

`Browser (109.123.254.30/forex/trade)` → **nginx** → **m-live-frontend** → `GET /api/v1/forex/*` → **m-live-backend:4000** → **PostgreSQL `exchange`**.

Verified nginx and localhost both return `orderTypes: ["market","limit","stop"]` on `trading-config` (HTTP 200).

---

## C. Evidence methodology

Levels **A** (browser/runtime), **B** (HTTP API), **C** (read-only SQL), **D** (source). Level **E** (prior audit) used only to select checks — **never** as proof.

---

## D. Previous-claim cross-check (16 items)

| # | Prior claim | Result | Confidence |
|---|-------------|--------|------------|
| 1 | P0 Yahoo vs MOCK quotes | **MATCH** | HIGH |
| 2 | P0 config vs engine | **MATCH** (contradiction confirmed) | HIGH |
| 3 | Stop limit not exposed | **MATCH** | HIGH |
| 4 | IOC/FOK/DAY backend-only | **MATCH** | HIGH |
| 5 | Buy stop ask ≥ trigger | **MATCH** (`pending.ts:47`) | HIGH |
| 6 | Sell stop bid ≤ trigger | **MATCH** (`pending.ts:48`) | HIGH |
| 7 | Journal count 0 | **MATCH_WITH_NUANCE** (writers exist) | HIGH |
| 8 | Drawings unproven | **MATCH** | HIGH |
| 9 | Indicators unproven | **MATCH** (source math exists) | MEDIUM |
| 10 | Workspace unproven | **MATCH** | HIGH |
| 11 | Multi-chart unproven | **MATCH** | HIGH |
| 12 | Position mgmt unproven | **MATCH** | HIGH |
| 13 | WebSocket unproven | **PARTIALLY_UPDATED** (anonymous welcome captured) | MEDIUM |
| 14 | OTP auth blocker | **MATCH** | HIGH |
| 15 | REAL_FOREX OFF | **MATCH** | HIGH |
| 16 | Crypto isolation | **MATCH** | HIGH |

**Summary:** ~15 verified, **0 contradicted**, **0 stale**, **2 nuanced**.

---

## E. P0-1 Market data authority

**Verdict: VERIFIED_SPLIT_WITH_IMPACT**

| Channel | Evidence | Fields |
|---------|----------|--------|
| Candles | `GET :4000/.../candles?symbol=EURUSD&timeframe=15m&limit=3` | `source=EXTERNAL`, `provider=yahoo`, close `1.1461317539215088` @ `2026-09-18T12:15:00Z` |
| Quotes | `GET :4000/.../quotes?symbols=EURUSD` | `source=SIMULATED`, `providerCode=MOCK-C`, bid=ask=`1.14670`, spread `0` |

**Impact:** Same symbol/time window can show **different numeric “current” values** (observed ~5.7 pips delta). Source documents intent to **anchor** MOCK walk to external close (`market-data/anchor.ts:1-16`) but **does not unify API `source` fields**.

Not merely “two providers exist” — **executable path is explicitly SIMULATED** while **chart history API is EXTERNAL**.

---

## F. P0-2 Trading-config vs order engine

**Verdict: CONTRADICTORY_EVIDENCE**

**Runtime (B):** `trading-config` → `orderTypes: [market, limit, stop]`, no `timeInForce` array.

**Config (D):** `FOREX_CUSTOMER_ORDER_TYPES` in `admin/config.ts:23`.

**Engine (D):**

- `validate.ts:36-37` — accepts `stop_limit` pending types.
- `request.ts:6` — `GTC | IOC | FOK | DAY`.
- `service.ts` — stop_limit rewrite, FOK/DAY enforcement.

**UI (A):** Combobox **Market / Limit / Stop**; text **Stop Limit unavailable · Time in Force unavailable**.

---

## G–I. Buy Stop / Sell Stop / Stop Limit

### Buy Stop / Sell Stop

| Layer | Buy Stop | Sell Stop |
|-------|----------|-----------|
| Engine | `pending.ts:47` `ask.gte(requested)` | `pending.ts:48` `bid.lte(requested)` |
| Customer UI | Stop type + side (Level A) | Same |
| trading-config | `stop` advertised | Same |
| Runtime proven | **NOT_PROVEN** (MUTATION_PROHIBITED) | **NOT_PROVEN** |

**Verdict:** Engine **VERIFIED_FUNCTIONAL** (source); customer exposure **VERIFIED_FUNCTIONAL** (UI/config); execution **NOT_PROVEN**.

### Stop Limit

| Layer | Status |
|-------|--------|
| Engine | Validation + trigger + limit rewrite (`service.ts`, `pending.ts:49-50`) |
| API schema | `request.ts` includes `stop_limit`, `limitPrice` |
| trading-config / UI | **Not advertised** — `order-type-tif.ts:87` |
| Verdict | **VERIFIED_NOT_EXPOSED** (customer) + **VERIFIED_BACKEND_ONLY** |

---

## J. TIF verification

| TIF | API/schema | Validation/enforcement | UI | Verdict |
|-----|------------|------------------------|-----|---------|
| GTC | Yes (default) | Default resting | Only option (disabled combobox) | **CONDITIONAL** |
| DAY | Yes | Pending-only; session expiry in service | Hidden | **VERIFIED_BACKEND_ONLY** |
| IOC | Yes | Market-only vs pending (`validate.ts:44-48`) | Hidden | **VERIFIED_BACKEND_ONLY** |
| FOK | Yes | `service.ts` full-fill gate | Hidden | **VERIFIED_BACKEND_ONLY** |
| GTD | No enum | — | — | **VERIFIED_NOT_IMPLEMENTED** |

---

## K. Pending lifecycle

States exist in order service; **no order placement** in this audit → **NOT_PROVEN** runtime.

**Why not proven:** MUTATION_PROHIBITED.  
**Missing proof:** Safe MOCK submit + read-only observation of status transitions.

---

## L. Journal

**Fresh DB (C):** `forex_journal_events = 0`; `forex_orders = 741`; open positions = 3.

**Writing path (D):** `recordForexJournalEvent` in `orders/service.ts:1042`; `journal.setPersistEnabled(true)` on hydrate (`durability/hydrate.ts:85`); `INSERT` in `journal/persist.ts`.

**Verdict: EMPTY_BUT_WRITING_PATH_EXISTS** — empty table does **not** prove broken journal; consistent with no durable rows persisted for observed history or no post-hydrate events.

---

## M. Chart

- **A:** Chart region loads; study combobox; timeframes/types present; initial watchlist showed `n/a` before quote hydrate (timing).
- **B:** Candles EXTERNAL/yahoo (above).
- **Verdict:** **CONDITIONAL** (loads + API); executable alignment **VERIFIED_SPLIT_WITH_IMPACT**.

---

## N. Drawings

**D:** `ForexLightweightChart.tsx` — `DrawingToolManager`, `ForexDrawingEngine`, localStorage on `eda-forex-drawings:{instance}:{symbol}:{tf}`.

**A:** Toolbar inventory from prior browser session; **this session:** draw interaction **NOT_EXECUTED**.

**Verdict:** **NOT_PROVEN** (runtime); source implements create/persist handlers.

---

## O. Indicators

**D:** `chart/studies.ts` — EMA, RSI, MACD, etc.  
**A:** UI controls for studies + RSI/MACD buttons.  
**Verdict:** **NOT_PROVEN** render lifecycle; **UI_CONTROL_EXISTS** + **SOURCE math EXISTS**.

---

## P. Workspace

**D:** `localStorage` `eda-forex-workspace-v5`; `saveWorkspaceProfile` in toolbar — drawings **not** in partialize.  
**Verdict:** **NOT_PROVEN** (no save/load cycle executed).

---

## Q. Multi-chart

**A:** Layout buttons visible. **D:** `charts[]` + `chartsVisibleForLayout` in `workspace.ts`.  
**Verdict:** **NOT_PROVEN** (no layout switch test).

---

## R. Positions

APIs: close, close-by, reverse, protections — **source verified**.  
**Verdict:** **NOT_PROVEN** customer runtime (AUTH_BLOCKED + MUTATION_PROHIBITED).

---

## S. Risk / accounting

Endpoints exist; UI requires sign-in. **Verdict:** **NOT_PROVEN** authenticated display.

---

## T. WebSocket

**B (executed):** `ws://127.0.0.1:4000/api/v1/forex/ws` → `welcome`, `protocol: eda.forex.ws.v1`, `source: SIMULATED`, public events listed.

Private channels: **AUTH_REQUIRED** (source `forex.fastify.ts`).  
**Verdict:** **PARTIAL** (connect + welcome); streaming/reconnect **NOT_PROVEN**.

---

## U. Auth

`POST /api/v1/auth/login` without OTP → error **`otp` required**.  
**Verdict:** **AUTHENTICATED_BROWSER_CERTIFICATION_BLOCKED**; middleware architecture **CONDITIONAL** (source-only for full flow).

---

## V. Responsive / mobile

**NOT_EXECUTED** → **NOT_PROVEN**. Source CSS may exist → at most **SOURCE_SUPPORT_PRESENT** (not claimed here).

---

## W. REAL_FOREX safety

Container env: no REAL_FOREX; `effectiveForexRuntimeFlags.realForex: false`; `execution-gate.ts` effectiveRealForex false; only `internal-fdm` adapter registered.

**Verdict: VERIFIED**

---

## X. Crypto isolation

Forex under `/api/v1/forex` + dedicated auth. Pre-existing dirty spot files **not touched**.  
**Verdict: VERIFIED**

---

## Y. Contradiction matrix

1. **trading-config** vs **validate** on `stop_limit` → **CONTRADICTORY_EVIDENCE**  
2. **UI unavailable** vs **API would accept** stop_limit → **CONTRADICTORY_EVIDENCE**  
3. **Candles EXTERNAL** vs **quotes SIMULATED** → **CONTRADICTORY_EVIDENCE** (documented anchor mitigation)

---

## Z. Capability truth matrix

See JSON `capabilityTruthMatrix` (37 rows).

---

## AA. Final certification (individual)

| Domain | Verdict |
|--------|---------|
| CUSTOMER TERMINAL | CONDITIONAL |
| ORDER ENTRY | CONDITIONAL |
| MARKET / LIMIT / BUY STOP / SELL STOP | NOT_PROVEN |
| STOP LIMIT | VERIFIED_NOT_EXPOSED |
| PENDING LIFECYCLE | NOT_PROVEN |
| TIF | CONDITIONAL |
| POSITION MANAGEMENT | NOT_PROVEN |
| RISK / ACCOUNTING | NOT_PROVEN |
| MARKET DATA | VERIFIED_SPLIT_WITH_IMPACT |
| CHART | CONDITIONAL |
| DRAWINGS / INDICATORS / WORKSPACE / MULTI-CHART | NOT_PROVEN |
| WEBSOCKET | PARTIAL |
| MOBILE | NOT_PROVEN |
| SECURITY | CONDITIONAL |
| JOURNAL | PARTIAL |
| MT5 / FIX / cTrader adapters | VERIFIED_NOT_CONFIGURED |
| REAL_FOREX SAFETY | VERIFIED |
| CRYPTO ISOLATION | VERIFIED |

---

## AB–AC. Uncertainties & minimum proof

| Gap | Minimum safe proof |
|-----|-------------------|
| Order entry | OTP test user + MOCK order on non-prod OR observe existing orders read-only in UI |
| Drawings | Create H-Line unsigned + reload (localStorage only) |
| Private WS | Authenticated subscribe without new orders |
| Source/runtime parity | Deploy manifest: image digest ↔ git SHA |

---

# Required final answer format

============================================================
SECOND CONFIRMATION AUDIT — FINAL RESULT
============================================================

**ENVIRONMENT:** HEAD `7f0bf68e`, branch `release/exchange-production-baseline`, dirty tree unchanged; production stack healthy; backend image recreated 2026-09-18; first-audit SHA/counts match.

**AUDIT INTEGRITY:** READ-ONLY · NO CODE CHANGES · NO DB WRITES · NO DEPLOYMENT · NO CRYPTO MODIFICATIONS

**PREVIOUS AUDIT AGREEMENT:** 15 verified · 0 contradicted · 0 not reproduced · 2 nuanced (journal writers; WS welcome)

**P0 FINDINGS:**

**P0-1 MARKET DATA:** **VERIFIED_SPLIT_WITH_IMPACT** — candles `EXTERNAL/yahoo` vs quotes `SIMULATED/MOCK-C`; sample EURUSD close 1.14613 vs bid/ask 1.14670; anchor.ts documents mitigation, not single authority.

**P0-2 CONFIG VS ENGINE:** **CONTRADICTORY_EVIDENCE** — runtime `trading-config` 3 types; `validate.ts` + `request.ts` support `stop_limit` and IOC/FOK/DAY; UI hides stop limit and extended TIF.

**ORDER TYPES:**

- **MARKET:** NOT_PROVEN (runtime submit)  
- **LIMIT:** NOT_PROVEN  
- **BUY STOP:** NOT_PROVEN (engine + UI exposure verified in source/A)  
- **SELL STOP:** NOT_PROVEN  
- **STOP LIMIT:** VERIFIED_NOT_EXPOSED  

**TIF:**

- **GTC:** CONDITIONAL  
- **DAY:** VERIFIED_BACKEND_ONLY  
- **IOC:** VERIFIED_BACKEND_ONLY  
- **FOK:** VERIFIED_BACKEND_ONLY  
- **GTD:** VERIFIED_NOT_IMPLEMENTED  

**AUTH:** AUTHENTICATED_BROWSER_CERTIFICATION_BLOCKED (OTP required)

**JOURNAL:** PARTIAL — EMPTY_BUT_WRITING_PATH_EXISTS (0 rows; writers on hydrate)

**DRAWINGS:** NOT_PROVEN  

**INDICATORS:** NOT_PROVEN  

**WORKSPACE:** NOT_PROVEN  

**MULTI-CHART:** NOT_PROVEN  

**MARKET DATA:** VERIFIED_SPLIT_WITH_IMPACT  

**WEBSOCKET:** PARTIAL (anonymous welcome; streams not proven)

**REAL_FOREX SAFETY:** VERIFIED  

**CRYPTO ISOLATION:** VERIFIED  

============================================================
NO-ASSUMPTION FINAL STATEMENT
============================================================

1. **Confirmed from prior:** P0 split, P0 config/engine gap, stop limit hidden, extended TIF backend-only, stop trigger semantics, REAL_FOREX off, crypto isolation, OTP blocker.  
2. **Contradicted:** None material (WS slightly more proven than first audit).  
3. **Not reproduced:** N/A — environment stable at HEAD/counts.  
4. **Genuine runtime:** Public Forex APIs, MOCK quotes, Yahoo candles API, terminal shell, DOM unavailable, WS welcome.  
5. **Source only:** stop_limit lifecycle, IOC/FOK/DAY enforcement, close-by/reverse, position-mode API.  
6. **Visible not proven:** Drawings, indicator render, multi-chart, signed-in trading.  
7. **Genuinely unavailable:** DOM/L2, GTD, live external adapters.  
8. **Contradictions:** Yes — config/UI vs engine; candles vs quotes API.  
9. **P0 blockers (evidence-backed):** Dual API market authority; customer contract omits engine capabilities.  
10. **Minimum next verification:** OTP harness for read-only authenticated GETs; non-mutating drawing reload test; WS subscribe without orders.

**Generated files:**

- `/opt/m-live/.build/forex-customer-terminal-second-confirmation-audit.json`  
- `/opt/m-live/.build/forex-customer-terminal-second-confirmation-audit.md`
