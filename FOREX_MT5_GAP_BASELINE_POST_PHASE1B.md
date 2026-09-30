# FOREX_MT5_GAP_BASELINE_POST_PHASE1B

**Audit type:** READ-ONLY — no implementation, no Phase 1C, no deploy, no WIP mutation  
**Audit UTC:** 2026-09-04  
**Repo:** `/opt/m-live` branch `release/exchange-production-baseline` (dirty working tree)  
**Method:** Live API/image/DB inspection + source inspection. Small verification only (trading-config, health, table list, image feature probes). No full test suites.

---

## 1. Executive summary

FDM Forex is a **credible MOCK/SIMULATED MT5-class core** for demo trading after Phases **0 / 1A / 1B**: quote authority, Market/Limit/Stop, NETTING+HEDGING, SL/TP/trailing, Close By, Atomic Reverse, margin/equity/ledger with reconciliation, and strong ownership/idempotency guarantees.

It is **not** yet an MT5-class professional terminal end-to-end:

- **Backend Phase 1B is ahead of frontend** (Close By / Reverse APIs live; UI not in live FE image).
- **Stop Limit, TIF, GTD/expiration, server journal** exist largely as **undeployed Phase A WIP** (and some schema already in Postgres).
- **DOM / L2 / Time & Sales** and **real LP/broker** are **DEPENDENCY** while `REAL_FOREX=OFF`.
- Chart/indicators/drawings/alerts/history/admin are **PARTIAL** vs MetaTrader 5 depth.
- Fees/swaps are structurally present but **economically zero** by policy.

**Overall MT5-class readiness (demo / MOCK posture): 56 / 100**

This score measures distance to a professional MT5-class product. It does **not** mean Phase 0–1B failed — those phases are certified PASS within their scoped gates.

---

## 2. Current certified baseline

| Phase | Scope | Status | Live evidence |
|-------|--------|--------|----------------|
| **0** | Quote authority / pin hygiene | **PASS / FROZEN** | `FOREX_PHASE0_*` certs; price-universe |
| **1A** | HEDGING + NETTING core | **PASS / FROZEN** | `FOREX_PHASE1A_HEDGING_CERT.md` |
| **1B** | Close By + Atomic Reverse | **PASS** | `FOREX_PHASE1B_CLOSEBY_REVERSE_CERT.md` — unit + live API 16/16 + browser 6/6 |

**Live posture (verified 2026-09-04):**

| Item | Value |
|------|--------|
| Backend | `m-live-backend:fx-phase1b-closeby` → `sha256:49d3ab25ced1d43423ad992902024b947df15c8450100f1a8f8f9a459f844ac9` |
| Frontend | `m-live-frontend:fx-cancel-ui` → `sha256:b90de0e54285…` (**Phase 1B FE not redeployed**) |
| `GET /trading-config` | `orderTypes: [market, limit, stop]`; **no** `timeInForce`; `executionMode: MOCK`; `source: SIMULATED` |
| REAL_FOREX | OFF |
| LP / execution | MOCK / SIMULATED |

**Certified capabilities (A = implemented + verified live):** Market, Limit, Stop; NETTING; HEDGING; independent same-symbol positions; SL; TP; Trailing; partial/full close; Close By (API); Atomic Reverse (API); P&L; equity; margin; free margin; ledger + MATCH recon; idempotency; ownership/IDOR; WS position/quote paths; demo funding; Phase 0 quotes.

**Certified but FE incomplete (B/C):** Close By + Reverse **backend verified**; live FE image lacks menu actions (WIP source only).

---

## 3. MT5 gap matrix

Status legend: **COMPLETE** | **PARTIAL** | **MISSING** | **DEPENDENCY** | **NOT APPLICABLE**

Evidence abbreviations: **LIVE** = running image/API/DB; **SRC** = repo source; **WIP** = dirty undeployed Phase A; **CERT** = phase cert doc.

### A. EXECUTION — score **72**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| A | Market orders | COMPLETE | LIVE trading-config; CERT Phase 0/1A/journey | — | — |
| A | Limit orders | COMPLETE | LIVE + pending trigger; CERT journey | — | — |
| A | Stop orders | COMPLETE | LIVE + pending; CERT journey | — | — |
| A | Stop Limit | PARTIAL | WIP `stop_limit` in orders/*; LIVE config excludes it | Ship + certify; not live | P0 |
| A | Pending triggering | COMPLETE | LIVE pending eval on quotes | — | — |
| A | Partial fills | PARTIAL | Status model exists; MOCK typically full-fills | Real partial fill semantics need LP | P1 / DEPENDENCY |
| A | Full fills | COMPLETE | MOCK venue; CERT | — | — |
| A | Execution price / Bid-Ask | COMPLETE | Phase 0 Bid/Ask authority CERT | — | — |
| A | Slippage / deviation | PARTIAL | Guards exist; MOCK-limited | Richer requote UX | P2 |
| A | Requotes/rejections | PARTIAL | Risk/rejection paths CERT | True requote workflow | P1 |
| A | Order lifecycle | COMPLETE | States + events tables LIVE DB | — | — |
| A | Order modification | COMPLETE | `PATCH /orders/:id` LIVE | — | — |
| A | Order cancellation | COMPLETE | Cancel API + FE cancel UI LIVE | — | — |

### B. TIME-IN-FORCE — score **22**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| B | GTC | PARTIAL | Default implied; WIP explicit TIF; LIVE no TIF array | Expose + certify | P0 |
| B | IOC | PARTIAL | WIP remainder cancel in orders/service | Not live | P0 |
| B | FOK | PARTIAL | WIP FOK path | Not live | P0 |
| B | Day | PARTIAL | WIP DAY expire on session close | Not live | P0 |
| B | GTD | MISSING | No GTD model found LIVE | Implement GTD | P1 |
| B | Expiration / pending expiry | PARTIAL | DAY WIP only; no general GTD | Full expiration model | P1 |

### C. POSITION MODEL — score **86**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| C | NETTING | COMPLETE | CERT 1A; LIVE mode API | — | — |
| C | HEDGING | COMPLETE | CERT 1A | — | — |
| C | Multi same-symbol positions | COMPLETE | CERT 1A | — | — |
| C | Partial / full close | COMPLETE | CERT + LIVE FE | — | — |
| C | Close By | COMPLETE (API) / PARTIAL (UX) | CERT 1B BE; FE missing in fx-cancel-ui | Deploy FE Close By UI | P0 |
| C | Reverse | COMPLETE (API) / PARTIAL (UX) | CERT 1B BE; FE missing live | Deploy FE Reverse UI | P0 |
| C | Position modification | PARTIAL | Protections modify; no general “position edit” like MT5 comment/magic | Optional fields | P2 |
| C | Position lifecycle | COMPLETE | OPEN/CLOSED + events | — | — |
| C | Position history | PARTIAL | Fills/trades/events; limited history UX | Rich closed-position history | P1 |

### D. RISK / MARGIN — score **80**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| D | Balance / equity / used / free | COMPLETE | LIVE `/margin` `/account`; CERT | — | — |
| D | Margin level | COMPLETE | Risk snapshots LIVE | — | — |
| D | Initial / maintenance | COMPLETE | Margin engine SRC/LIVE | — | — |
| D | Warning / call / stop-out | COMPLETE | Simulated liquidation stack LIVE | — | — |
| D | Liquidation + ordering | COMPLETE | `forex_liquidations*` tables + services | — | — |
| D | Risk / exposure / symbol limits | COMPLETE | `/risk*` `/exposure` LIVE | — | — |
| D | Real broker margin rules | DEPENDENCY | MOCK policies | Real LP margin contract | DEPENDENCY |

### E. FINANCIAL MODEL — score **74**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| E | Realized / unrealized P&L | COMPLETE | CERT ledger MATCH | — | — |
| E | Fees / commission | PARTIAL | Engines + tables; **rates 0** LIVE config | Product economics | P0 |
| E | Spread cost | PARTIAL | Via Bid/Ask fill; not separate ledger line | Explicit spread P&L views | P2 |
| E | Swap / financing / overnight | PARTIAL | Swap engine; events table; rates often 0 | Non-zero swap schedule | P1 |
| E | Funding (demo) | COMPLETE | `POST /funding/demo` CERT | — | — |
| E | Ledger + reconciliation | COMPLETE | CERT 1B MATCH; immutable entries | — | — |
| E | Precision / double-entry | COMPLETE | Decimal FX + ledger model | — | — |
| E | Real withdrawals | NOT APPLICABLE | REAL_FOREX OFF | — | — |

### F. CHART / TRADING FROM CHART — score **52**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| F | Live executable price | COMPLETE | Quotes + ticket; Phase 0 | — | — |
| F | Historical candles | COMPLETE | `/candles` + chart foundation LIVE | Authority ≠ execution quotes | P1 note |
| F | Bid/Ask visualization | PARTIAL | Watchlist strong; chart mid-centric | Dual Bid/Ask series | P2 |
| F | Position / order markers | PARTIAL | Lines/protections; not full MT5 markers | Enrich markers | P1 |
| F | SL/TP visualization | PARTIAL | Price lines LIVE | — | — |
| F | Drag SL / Drag TP | PARTIAL | WIP drag-commit; not certified live | Finish + certify | P0 |
| F | Modify / place pending from chart | PARTIAL | Context set SL/TP; limited order place | Full chart trading | P1 |
| F | Reverse / Close By from chart | MISSING | Not in live chart UX | Optional | P2 |

### G. INDICATORS — score **42**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| G | SMA / EMA / WMA | COMPLETE | `chart/studies.ts` + UI studies | — | — |
| G | VWAP | MISSING | No volume on candles (explicit) | Needs volume feed | DEPENDENCY / P2 |
| G | Bollinger Bands | PARTIAL | Studies + UI BB | Full MT5 params UX | P1 |
| G | RSI / MACD | PARTIAL | Implemented in studies; toggles | Full pane config | P1 |
| G | Stochastic | PARTIAL | Helper exists; not full study menu | First-class study | P1 |
| G | ATR | PARTIAL | Readout / helper | Full study | P1 |
| G | ADX / Ichimoku / Parabolic SAR | MISSING | Not in studies catalog | Implement | P2 |
| G | MT5-style config UI | PARTIAL | Limited periods/toggles | Full dialogs | P1 |

### H. DRAWINGS — score **55**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| H | Trend / H-line / V-line / Ray / Rect | COMPLETE | LIVE toolbar + drawings | — | — |
| H | Fibonacci | PARTIAL | Fib LIVE; FibExt WIP | Cert extensions | P1 |
| H | Channels / Text / S/R | PARTIAL | WIP `forex-drawings.ts` | Deploy carefully | P1 |
| H | Edit / delete / persist | PARTIAL | Local workspace persist | Server sync | P2 |

### I. MARKET WATCH — score **68**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| I | Symbol list / Bid / Ask / Spread | COMPLETE | ForexWatchlist LIVE | — | — |
| I | Change % | PARTIAL | LIVE n/a banner; WIP candle-ref | Wire + certify | P1 |
| I | High/Low / session status | PARTIAL | Sessions API; not all columns | Enrich | P1 |
| I | Favorites / search / sort / persist | PARTIAL | Workspace persistence | Full MT5 watch UX | P1 |

### J. MARKET SESSIONS — score **72**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| J | Sessions / weekend / eligibility | COMPLETE | `/sessions` LIVE | — | — |
| J | Holidays | PARTIAL | Tables exist; coverage often UNCONFIGURED | Holiday calendar ops | P1 |
| J | Session trading restrictions | COMPLETE | Session gate on customer orders | — | — |

### K. DEPTH / MICROSTRUCTURE — score **12**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| K | DOM / L2 | DEPENDENCY | UI honest stub; `/liquidity` = top-of-book | Needs real L2 | DEPENDENCY |
| K | Time & Sales / tape | MISSING | No FE tab / API | Needs trade stream | DEPENDENCY |
| K | Order book visualization | DEPENDENCY | Same as DOM | — | DEPENDENCY |

### L. HISTORY — score **58**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| L | Orders / fills / trades | PARTIAL | APIs + bottom History tab | Filters/export/pagination | P1 |
| L | Position / account history | PARTIAL | Ledger + fills | Closed-position statements | P1 |
| L | Export | MISSING | — | CSV/PDF | P2 |
| L | Fees/swaps visibility | PARTIAL | Endpoints; often zero | Non-zero + UI | P1 |

### M. NEWS / CALENDAR — score **66**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| M | News feed | COMPLETE | LIVE AVAILABLE (EXTERNAL_RSS) | — | — |
| M | Economic calendar | COMPLETE | LIVE AVAILABLE | — | — |
| M | Filtering / impact / currency | PARTIAL | Basic UX | Full MT5 filters | P2 |

### N. ALERTS — score **28**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| N | Price alerts | PARTIAL | localStorage FE only | Server-side alerts | P0 |
| N | Margin / position / order alerts | MISSING | — | Server events → notify | P1 |
| N | Browser / email / SMS / push | MISSING | — | Delivery channels | P1 / P2 |
| N | History / ack | MISSING | — | Persist | P1 |

### O. JOURNAL / LOGGING — score **40**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| O | Engineering order/position events | COMPLETE | `forex_*_events` LIVE DB | — | — |
| O | Customer trading journal | PARTIAL | WIP `forex_journal_events` **in DB**; route **not in live image** | Deploy + certify journal | P1 |
| O | Risk / error user history | PARTIAL | Risk events internal | Customer-visible journal | P1 |

### P. WORKSTATION UX — score **70**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| P | Multi-panel terminal | COMPLETE | Layout LIVE | — | — |
| P | Multi-chart + workspace persist | COMPLETE | local `eda-forex-workspace-v5` | Server sync | P2 |
| P | Order ticket / quick trade | COMPLETE | Ticket LIVE | — | — |
| P | Dense MT5 keyboard/shortcuts | PARTIAL | Limited | Shortcuts pack | P2 |

### Q. MOBILE — score **48**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| Q | Responsive shell | PARTIAL | Mobile nav LIVE | Full mobile terminal | P1 |
| Q | Positions / close / partial | PARTIAL | Works on small screens | Polish | P1 |
| Q | Reverse / Close By mobile | MISSING (live FE) | Same as desktop FE gap | After FE ship | P0 |
| Q | Chart / SL/TP mobile | PARTIAL | Chart-first | Dense tools | P1 |

### R. REAL-TIME / WEBSOCKET — score **70**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| R | Quote / order / position / margin WS | COMPLETE | Hub + FE manager; CERT browser reconstruct | — | — |
| R | Reconnect + REST hydrate | COMPLETE | Pattern LIVE | — | — |
| R | Missed-event / ordering guarantees | PARTIAL | Snapshot reconcile; not full event sourcing | Stronger guarantees | P2 |
| R | Private WS auth limits | PARTIAL | Browser WS auth constraints; REST authoritative | Documented tradeoff | P1 |

### S. SECURITY — score **82**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| S | Auth / ownership / IDOR | COMPLETE | CERT 1A/1B | — | — |
| S | Idempotency / concurrency | COMPLETE | clientOrderId; account risk queue | — | — |
| S | Validation | COMPLETE | Order/position validators | — | — |
| S | Forex-specific rate limits | PARTIAL | Shared Fastify limits | Dedicated Forex throttles | P1 |
| S | Audit trail | PARTIAL | Event tables; admin audit thin | Ops audit UI | P1 |

### T. RELIABILITY — score **72**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| T | Tx integrity / hydrate / locks | COMPLETE | Durability + Close By serialize CERT | — | — |
| T | Worker / queue recovery | PARTIAL | Pending recover paths | Multi-replica chaos | P2 |
| T | Redis / partial failure | PARTIAL | Demo-scale | Hardening | P2 |

### U. OBSERVABILITY — score **50**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| U | Prometheus Forex metrics | PARTIAL | `forex-prometheus-metrics.ts` | Dashboards/alerts | P1 |
| U | Tracing / latency SLOs | PARTIAL | Some latency metrics | Full tracing | P2 |

### V. ADMIN / OPERATIONS — score **35**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| V | Read-only Forex config snapshot | PARTIAL | Admin config helpers | — | — |
| V | Instrument / risk / kill mutations | MISSING | Hardcoded catalog + policies | Admin control plane | P0 |
| V | Emergency trading halt UX | PARTIAL | Dealing/halt flags in risk | Operator UI | P0 |

### W. BROKER / LP — score **38**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| W | MOCK LP + routing + top-of-book | COMPLETE (MOCK) | mock-provider; liquidity book | — | — |
| W | Real LP adapter / fill recon | DEPENDENCY | REAL_FOREX OFF by design | Real broker stack | DEPENDENCY |
| W | Timeout / reject / external map | PARTIAL | SIMULATED paths | Real LP contracts | DEPENDENCY |

### X. ACCOUNT / CUSTOMER LIFECYCLE — score **58**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| X | Forex account + demo funding | COMPLETE | CERT demo | — | — |
| X | Position mode | COMPLETE | NETTING/HEDGING API CERT | — | — |
| X | Currency (USD) | COMPLETE | Schema USD checks | Multi-currency | P2 |
| X | Withdrawals / KYC real Forex | NOT APPLICABLE / MISSING | REAL_FOREX OFF | Real money path | DEPENDENCY |

### Y. API CONTRACT — score **76**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| Y | REST core + WS | COMPLETE | Live routes inventory | — | — |
| Y | Validation / errors / idempotency | COMPLETE | CERT | — | — |
| Y | Disk vs live contract skew | PARTIAL | WIP advertises stop_limit/TIF/journal | Align deploy or hide | P0 |
| Y | Pagination / versioning | PARTIAL | Mostly unbounded lists | Page APIs | P1 |

### Z. DATA / DATABASE — score **78**

| Area | Capability | Current Status | Evidence | Gap | Priority |
|------|------------|----------------|----------|-----|----------|
| Z | Core forex_* schema | COMPLETE | LIVE Postgres table list | — | — |
| Z | Constraints / immutability | COMPLETE | Ledger triggers; netting unique | — | — |
| Z | Schema ahead of image | PARTIAL | `limit_price`, `time_in_force`, `forex_journal_events` present; features not live | Deploy features or freeze DDL narrative | P1 |
| Z | Retention / archival | PARTIAL | Tick/history growth | Retention policy | P2 |

---

## 4. Area scores (0–100)

| Area | Score |
|------|------:|
| A Execution | 72 |
| B Time-in-force | 22 |
| C Position model | 86 |
| D Risk / margin | 80 |
| E Financial model | 74 |
| F Chart trading | 52 |
| G Indicators | 42 |
| H Drawings | 55 |
| I Market Watch | 68 |
| J Sessions | 72 |
| K Depth / microstructure | 12 |
| L History | 58 |
| M News / calendar | 66 |
| N Alerts | 28 |
| O Journal | 40 |
| P Workstation UX | 70 |
| Q Mobile | 48 |
| R Real-time / WS | 70 |
| S Security | 82 |
| T Reliability | 72 |
| U Observability | 50 |
| V Admin / ops | 35 |
| W Broker / LP | 38 |
| X Account lifecycle | 58 |
| Y API contract | 76 |
| Z Data / DB | 78 |

---

## 5. Overall MT5-class readiness score

### **56 / 100**

**Interpretation**

- **Core trading engine (A/C/D/E/S under MOCK):** strong (~75–85 band).
- **Terminal completeness (F/G/H/I/L/N/O/Q/V):** mid/low.
- **Market microstructure + real broker (K/W):** intentionally blocked → pulls overall score down.

---

## 6. P0 — must-have before professional trading release

Count: **11**

1. Deploy FE **Close By / Reverse** (parity with certified Phase 1B APIs)
2. **Stop Limit** — live trading-config + cert (not WIP-only)
3. **TIF** GTC/IOC/FOK/DAY — live + cert
4. Resolve **disk↔live API contract skew** (hide or ship WIP surfaces)
5. **Chart SL/TP drag** finish + cert (or explicitly defer with product sign-off)
6. **Server-side price alerts** (replace localStorage-only)
7. **Admin emergency controls / trading halt UX**
8. **Non-zero fee/commission product decision** (or documented permanent zero for demo)
9. **Customer-visible history** completeness (filters + closed positions)
10. **Operator instrument/risk configuration** path
11. **Real LP readiness gate** (architecture complete before REAL_FOREX ON) — product blocker for real money, not for demo

---

## 7. P1 — important professional-terminal capabilities

Count: **18**

- GTD / pending expiration model  
- Partial-fill realism (when LP supports)  
- Position/order history filters, date range, pagination  
- Customer **journal** API (schema already exists)  
- Swap schedule with non-zero economics  
- Change % on Market Watch  
- Indicator config UX (Stochastic/ATR first-class; BB/RSI/MACD panes)  
- FibExt / Channel / Text drawings (from usable WIP)  
- Chart pending-order placement / richer markers  
- Holiday calendar operational coverage  
- Margin/position alert types  
- Forex-specific rate limits  
- Prometheus dashboards + alerting  
- Mobile terminal polish (incl. Close By/Reverse after FE ship)  
- Private WS auth improvements  
- Candle vs quote authority UX clarity  
- Export of history  
- Admin mutation APIs for limits/instruments  

---

## 8. P2 — advanced capabilities

Count: **14**

- ADX / Ichimoku / Parabolic SAR  
- VWAP (needs volume)  
- Multi-currency accounts  
- Server-synced workspaces  
- Full MT5 keyboard shortcuts  
- Email/SMS/push alert channels  
- Chart Reverse/Close By  
- Bid/Ask dual chart series  
- Explicit spread P&L lines  
- Chaos/multi-replica recovery drills  
- Distributed tracing SLOs  
- Data retention/archival automation  
- Magic/comment position fields  
- Advanced requote UX  

---

## 9. Dependency blockers

Count: **7**

1. **REAL_FOREX OFF** — real execution/fills  
2. **Real LP/broker adapters** — routing, timeouts, external recon  
3. **Authoritative L2/DOM** — no fabricated depth  
4. **Time & Sales / trade tape** — needs trade stream  
5. **VWAP / volume studies** — candles lack volume  
6. **Real money funding/withdrawals/KYC** — outside demo ledger  
7. **Real broker margin/stop-out contracts** — may differ from simulated policy  

---

## 10. Existing WIP that can safely be reused later

| WIP | Maps to gap | Notes |
|-----|-------------|--------|
| `stop_limit` order path (orders/pending/service) | A Stop Limit | Needs clean cert against LIVE config; strip unrelated diffs when shipping |
| TIF GTC/IOC/FOK/DAY | B | Same — ship with trading-config |
| `forex_journal_events` + journal service/routes | O | **DB already present**; image lacks journal module |
| Chart SL/TP drag commit | F | Usable; certify before deploy |
| Drawings: channel / text / FibExt / S/R | H | Reuse with FE-only deploy discipline |
| Change % candle reference | I | Reuse after candle authority rules clear |
| FE Close By / Reverse actions | C UX | **Already matches live BE** — safest next FE ship |
| Trailing UI already partially in fx-cancel-ui | C/D | Already live-ish |

---

## 11. Existing WIP that should NOT be reused as-is

| WIP | Why |
|-----|-----|
| Monolithic dirty `orders/service.ts` deploy | Bundles Stop Limit/TIF/journal with unrelated churn; risks shipping uncertified surfaces |
| Full dirty FE image rebuild | Would ship Stop Limit/TIF UI banners + drawings + journal clients without gated BE |
| Fabricated DOM/L2 | Explicitly forbidden while MOCK; keep stub |
| Assuming `forex_journal_events` = live journal product | Table exists; **API not in live backend image** |
| Treating Yahoo candles as execution prices | Phase 0 separation must remain |

---

## 12. Recommended implementation sequence

1. **Phase 1B FE parity (minimal)** — deploy **only** Close By / Reverse UI against live BE (no Phase A). Closes certified-capability UX gap.  
2. **Phase 1C — Pending execution completeness** — Stop Limit + TIF (GTC/IOC/FOK/DAY), trading-config live, targeted certs. Reuse WIP carefully.  
3. **Phase 1D — Chart protection UX** — SL/TP drag certify; optional pending-from-chart.  
4. **Phase 1E — Terminal ops** — server alerts + customer journal + history filters.  
5. **Phase 2 — Economics & admin** — fees/swaps policy, admin halt/limits.  
6. **Phase 3 — Real LP program** — only when ready; keep REAL_FOREX OFF until adapter + recon certified.  
7. **Parallel / later** — indicators catalog, drawings pack, mobile polish, DOM when L2 exists.

---

## Evidence snapshot (audit probes)

```
trading-config.orderTypes = [market, limit, stop]
trading-config.timeInForce = null
executionMode = MOCK
backend image = fx-phase1b-closeby (49d3ab25…)
frontend image = fx-cancel-ui (b90de0e5…)
BE close-by.js present; BE journal/ absent from image
Postgres: forex_journal_events EXISTS; many forex_* tables present
```

---

## Document control

- **No product code changed** for this audit.  
- **No Phase 1C started.**  
- **No broad test campaign.**  
- Next implementation phase must be chosen explicitly after this baseline.
