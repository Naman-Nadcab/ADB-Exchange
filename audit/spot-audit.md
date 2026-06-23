# Phase 5 — Spot Exchange Audit

**Generated:** 2026-06-22  
**Method:** Code trace + runtime API probes.

---

## Order Flow (verified path)

```
User UI (SpotTradingGrid / POST)
  → POST /api/v1/spot/order          [spot.fastify.ts]
  → Balance lock (user_balances)     [wallet service in transaction]
  → INSERT spot_orders               [DB commit]
  → placeOrderRust()                 [engine-client.ts:161 → POST /engine/place]
  → applyInlineEngineEvents / sync   [settlement inline]
  → settlement-worker (250ms)        [settlement-worker.ts]
  → user_balances credit/debit       [balance_ledger entries]
  → spot_trades rows                 [settlement path]
  → WS broadcast                     [spot-ws.service.ts / NATS]
```

**Evidence — engine client:**
```161:167:apps/backend/src/services/settlement/engine-client.ts
export async function placeOrderRust(
  order: RustOrder,
  opts?: { baseUrl?: string; engineId?: string }
): Promise<PlaceOrderRustResult> {
  const base = (opts?.baseUrl ?? getMatchingEngineBaseUrlForMarket(order.market)).replace(/\/$/, '');
  const url = `${base}/engine/place`;
```

**Engine failure rollback:** `spot.fastify.ts` 1740–1767 cancels order + unlocks balance on engine reject.

---

## API Routes (spot.fastify.ts)

| Route | Purpose | Verified |
|-------|---------|----------|
| `POST /spot/order` | Place order | Code ✓ |
| `DELETE /spot/order/:id` | Cancel | Code ✓ |
| `GET /spot/orders` | User orders | E2E path exists |
| `GET /spot/markets` | Market list | **200** runtime |
| `GET /spot/markets/:symbol/ticker` | Ticker | Code ✓ |
| `GET /spot/ws` | WebSocket | Code ✓ |
| `GET /spot/markets/:symbol/orderbook` | Orderbook | **404** runtime (wrong path tested: `/spot/markets/BTC_USDT/orderbook`) |

---

## Order Types

| Type | Implementation |
|------|----------------|
| Limit | `spot.fastify.ts` → Rust `limit` |
| Market | Rust `market` |
| Stop / stop-limit | `spot-trigger.service.ts` → `placeOrderRust` after trigger |
| IOC | Engine + partial enforcement — gap noted in `matching-engine.service.ts` 319–320 for legacy path |

**Node in-process matcher:** `matching-engine.service.ts` — legacy; production path is Rust (`spot-matching.service.ts` documents non-production).

---

## Settlement

| Component | File |
|-----------|------|
| Worker | `settlement/settlement-worker.ts` |
| JetStream consumer | `settlement/jetstream-match-consumer.ts` (when `USE_EVENT_STREAM=true`) |
| Engine replay | `settlement/engine-replay.ts` on startup |
| Integrity | `global-balance-auditor.ts`, `tier1-reconciliation.service.ts` |

`.env`: `USE_EVENT_STREAM=true`, `USE_RUST_MATCHING_ENGINE=true`

---

## Runtime Health

```json
GET /health → matching_engine: "up", nats: "up"
```

48 markets returned from `GET /spot/markets` (prior session).

---

## UI Screens

| Screen | Path | Wiring |
|--------|------|--------|
| Spot trade | `/trade/spot` | `SpotTradingGrid.tsx`, `SpotTradingGridTerminal.tsx` |
| Markets | `/dashboard` markets sidebar | `MarketsSidebar.tsx` |
| Orders | `/dashboard/wallet/spot` | wallet routes |
| Charts | Lightweight charts adapter | `LightweightChartsAdapter.ts` |

---

## Gaps / Issues

| Issue | Evidence | Severity |
|-------|----------|----------|
| Admin trades list 500 | Schema mismatch — see `database-audit.md` | P1 |
| Hedge enqueue only on sync spot path | `enqueueHedgeJobAfterInternalFill` in `spot.fastify.ts` ~1828; not in settlement worker | P2 |
| Legacy `orders` table still in schema | Parallel to `spot_orders` | P3 |
