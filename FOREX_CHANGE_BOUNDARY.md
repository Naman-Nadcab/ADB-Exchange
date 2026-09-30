# FOREX_CHANGE_BOUNDARY

**Status:** Discovery complete — NO feature implementation performed in this document’s production.  
**Recorded:** 2026-09-04 (Asia/Kolkata)  
**Repo:** `/opt/m-live`  
**Branch:** `release/exchange-production-baseline`  
**HEAD:** `2afe8933642489cb3d3c8d67c17e406709dc8730`  
**Task:** Safely close MT5-class forensic-audit findings for **FDM Forex only**.

---

## 1. Absolute posture (must remain)

| Control | Required state | Evidence |
|--------|----------------|----------|
| REAL FOREX | OFF | Live `trading-config.source=SIMULATED`, `executionMode=MOCK`; container env has demo flags, no real LP |
| LP | MOCK-A/B/C | `services/forex/market-data/mock-provider.ts` |
| Execution | MOCK / SIMULATED | Order/execution models hardcode `executionMode: 'MOCK'` |
| Demo money | Only | `POST /funding/demo` → Forex ledger only |
| Fake DOM as real L2 | Forbidden | UI DOM tab already refuses fabrication |
| Financial authority | Server + Forex ledger | `accounting/boundary.ts` — Crypto `user_balances` out of scope |

---

## 2. Files ALLOWED to change (Forex-owned)

### Frontend
- `apps/frontend/src/app/forex/**`
- `apps/frontend/src/components/forex/**`
- `apps/frontend/src/lib/forex/**`
- Forex-only scripts in `apps/frontend/package.json` (`test:forex-*`)
- `e2e/forex-*.spec.ts`
- `scripts/forex-browser-cert.mjs`

### Backend
- `apps/backend/src/routes/forex*.ts` (all `forex*.fastify.ts`)
- `apps/backend/src/services/forex/**`
- `apps/backend/src/lib/forex-prometheus-metrics.ts` (if present)
- Forex-only scripts in `apps/backend/package.json` (`test:forex-*`)

### Infra (Forex-scoped only)
- `docker-compose.forex-demo.yml`
- **Append-only** Forex DDL blocks inside `apps/backend/src/database/migrate.ts` (FOREX DOMAIN section ~L4053+)
- Documentation artifacts explicitly required by this task:
  - `FOREX_CHANGE_BOUNDARY.md` (this file)
  - `FOREX_PRE_IMPLEMENTATION_CHECKPOINT.md`
  - `FOREX_MT5_CLASS_IMPLEMENTATION_REPORT.md` (later)

### Untracked Forex work already in tree (may be incorporated intentionally)
- `apps/backend/src/services/forex/market-data/anchor.ts` (+ test)
- `apps/backend/src/services/forex/protection/trailing.ts` (+ test)
- `apps/backend/src/services/forex/forex-price-consistency.cert.ts`
- `apps/frontend/src/lib/forex/runtime/useForexSession.ts`
- `apps/frontend/src/lib/forex/models/{live-valuation,account-metrics,exposure-view,history-analytics,journal,ticket-risk,price-consistency*}.ts`

---

## 3. Files that MUST NOT change (Crypto / unrelated)

### Matching / Spot / Settlement
- Entire `matching-engine/`
- `apps/backend/src/routes/spot.fastify.ts`, `admin-spot.fastify.ts`
- `apps/backend/src/services/spot-*.ts`, settlement stack under `services/settlement/**`
- `apps/backend/src/lib/spot-*.ts`, `unified-spot-*.ts`

### P2P / Wallet / Crypto UI
- `apps/backend/src/routes/p2p*.ts`, `wallet.fastify.ts`
- `apps/backend/src/services/p2p*.ts`, `wallet.service.ts`, hot-wallet*
- `apps/frontend/src/app/{spot,p2p,wallet,trade/spot}/**`
- `apps/frontend/src/components/{trade,p2p,wallet}/**`

### Unrelated dirty files present now — DO NOT STAGE
| Path | Why forbidden for this task |
|------|-----------------------------|
| `apps/admin-panel/.../compliance-policy/page.tsx` | Admin/compliance, not Forex |
| `apps/backend/src/lib/spot-ticker-db-load.ts` | Spot |
| `apps/backend/src/routes/admin-phase1-compliance.fastify.ts` | Admin |
| `apps/backend/src/routes/spot.fastify.ts` | Spot |
| `apps/backend/src/server.ts` | Shared process — **only** touch if proven Forex-only registration need; prefer avoid |
| `apps/backend/src/services/platform-public-metrics.service.ts` | Shared metrics |
| `docker-compose.production.yml` | Shared prod topology |
| `infra/docker-compose.monitoring.yml` | Shared monitoring |
| `scripts/vps-backup-db.sh`, `scripts/vps-backup-cron.sh`, `scripts/vps-restore-isolated-test.sh` | Ops scripts (backup OK to *run*, not rewrite for features) |
| `scripts/classify-aml-alerts.sql`, `scripts/classify-settlement-dlq.sql` | Crypto/settlement ops |

---

## 4. Shared files — touch policy

| Shared file | May Forex need it? | Safe rule |
|-------------|--------------------|-----------|
| `apps/backend/src/database/migrate.ts` | Yes — additive `forex_*` DDL | **Append-only** Forex statements; never edit Crypto tables |
| `apps/backend/src/server.ts` | Only if new route plugin registration needed | Prefer existing `forexRoutes` registration; no health/Spot changes |
| `apps/backend/package.json` / `apps/frontend/package.json` | Add `test:forex-*` scripts only | Do not change unrelated scripts/deps carelessly |
| `apps/frontend/src/store/auth.ts` | Session reactivity already consumed via `useForexSession` | **Do not modify** unless Forex cannot proceed otherwise — prove safety first |
| `apps/frontend/src/lib/api.ts` | Base client for Forex API | **Do not modify** — wrap in `lib/forex/api/client.ts` |
| `apps/backend/src/lib/auth-cookies.ts`, `session.service.ts` | Used by `forexAuthenticate` | **Do not modify** |
| `nginx/*.conf` | Routes `/api/` generically | **Do not modify** for Forex features |
| `docker-compose.production.yml` | Env for demo overlay | Prefer `docker-compose.forex-demo.yml` overlay only |

**If a shared file must change:** document the exact lines, Crypto blast radius, and dual-product test plan in the phase report **before** editing.

---

## 5. Current architecture (summary)

```
Browser Forex UI (Zustand store + WS manager)
    ↓ REST /api/v1/forex/* + WS /api/v1/forex/ws
Fastify Forex routes (forexAuthenticate on private)
    ↓
Orders → Execution (MOCK venue) → Fills
    ↓
Positions (NETTING active) + Protections (SL/TP/trail)
    ↓
Margin / Risk / Liquidation services
    ↓
Forex Ledger (immutable entries) + forex_* Postgres tables
    ↑
Market-data worker: MOCK providers (+ optional Yahoo mid anchor)
Candles: Yahoo EXTERNAL (non-financial reference)
```

Isolation: `services/forex/accounting/boundary.ts` — Forex ledger ≠ Crypto `user_balances` / `balance_ledger`.

---

## 6. Source-of-truth map

| Value | Authority |
|-------|-----------|
| Executable Bid/Ask/Mid | Forex pricing service / SIMULATED quotes (`forex_quotes` latest + WS) |
| Historical OHLC | Yahoo EXTERNAL via `/candles` — **not** execution authority |
| Chart Live marker | Must bind to quote store (not candle close) |
| Order / fill / position state | `forex_orders`, fills, `forex_positions` + services |
| Balance / realized P&L | Forex ledger entries / transactions |
| Equity / margin / free / level | Server-derived from ledger + open positions + quotes |
| Unrealized P&L | Server valuation (LONG@BID, SHORT@ASK); FE may overlay live display |
| Fees / swaps | Event tables exist; economics currently configured **zero** |
| Alerts (today) | **Browser localStorage only** — not financial SOT |
| Crypto balances | **Out of scope** — must remain untouched |

---

## 7. Order lifecycle (current)

1. `POST /orders` + `clientOrderId` → claim/idempotent create  
2. Validate instrument/volume/type (`market|limit|stop` only)  
3. Pretrade risk / margin gate  
4. Pending: LIMIT/STOP wait for quote trigger (BID/ASK correct side)  
5. Market / triggered → MOCK execution → fills  
6. Apply fills to NETTING position  
7. Ledger: commissions (0), close → realized PnL postings  
8. WS: `fx.order`, `fx.fills`, `fx.position`, account channels  

**Not present:** Stop Limit, TIF (GTC/DAY/IOC/FOK/GTD).

---

## 8. Position lifecycle (current)

- **Mode:** `FOREX_ACTIVE_POSITION_MODE = 'NETTING'` (`positions/mode.ts`); config may read `FOREX_POSITION_MODE` but active constant + unique index enforce netting.  
- Open: one OPEN row per `(account_id, symbol)` in NETTING.  
- Opposite fill nets / may reverse leftover volume (engine-level reverse via excess fill — **no Reverse UX**).  
- Close / partial close: `POST /positions/:id/close` + `clientOrderId` + `expectedVersion`.  
- Protections: per-position SL/TP/trail server-side.  
- **HEDGING:** reserved helpers only — **not live**.

---

## 9. Ledger lifecycle (current)

- Double-entry `forex_ledger_entries` (immutable trigger).  
- Funding demo → credit CUSTOMER_CASH.  
- Close → realized PnL components.  
- `GET /ledger` exposes reconciliation; QA observed `status: MATCH`.  
- Never posts to Crypto wallet tables.

---

## 10. Quote lifecycle (current)

```
MOCK providers → optional Yahoo mid anchor (base for walk)
  → pricing validate/aggregate → forex_quotes
  → REST /quotes + WS fx.quote.*
Yahoo OHLC (separate) → /candles → chart history only
FE: Market Watch / Ticket / Live overlay subscribe to quote store
```

**Risk:** Dual source is intentional; execution must never use candle close.

---

## 11. Frontend ↔ backend communication

- REST via `lib/forex/api/client.ts` → shared `lib/api.ts`  
- Auth: Bearer or cookie session through `forexAuthenticate` / `useForexSession`  
- Hydrate: public then private REST; WS accelerates  
- Store: `useForexStore.applyWs`  
- Private financial truth: REST rehydrate after mutations  

---

## 12. Current test coverage (scripts)

**Backend:** `test:forex-phase1`…`phase9`, `phase95/96`, `phase104/105b`, `demo-cert`, `live-journey`, `anchor`, `price-cert`  
**Frontend:** `test:forex-price-consistency`, `test:forex-models`  
**Browser:** `scripts/forex-browser-cert.mjs` (Playwright)  
**E2E specs:** `e2e/forex-*.spec.ts`

Coverage is strong on NETTING demo path; **weak/absent** on hedging, Stop Limit, TIF, server alerts, stress liquidation.

---

## 13. Known risks (from audit + discovery)

1. Dual price sources if Live overlay regresses  
2. NETTING-only vs MT5 hedging expectation  
3. Local-only alerts  
4. Fees/swaps infrastructure with zero economics  
5. Shared `server.ts` / `migrate.ts` edit blast radius  
6. Dirty tree mix of Forex + Crypto/admin files — staging must be selective  
7. Host Redis unresolvable from sandbox can hang unit tests (env, not product)  

---

## 14. Implementation gate

No feature phase may start until:

1. This boundary is accepted operationally  
2. `FOREX_PRE_IMPLEMENTATION_CHECKPOINT.md` exists with DB backup path  
3. Baseline certification (section 3 of task brief) reports PASS or documents **pre-existing** failures  

---

## 15. Phase priority (reminder)

P0: Quote authority → Hedging → Close By / isolation → Accounting → Concurrency → Security → Liquidation  
P1: Stop Limit → TIF → History Center → Server alerts → Reverse → Chart trading → Sessions  
P2+: Fees/swaps, indicators, drawings, MW depth, news richness, mobile polish, journal, observability  
P3 / dependency: DOM, T&S, real LP (remain MOCK LIMITATION)

**Correctness > feature count. Preserve working demo behavior.**
