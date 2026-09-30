# Forex customer ecosystem — gap matrix

Read-only forensic inventory. **Crypto frozen.** **REAL_FOREX off.** No source changes in this pass.

Machine-readable rows: [forex-customer-ecosystem-gap-matrix.json](./forex-customer-ecosystem-gap-matrix.json)

## Customer routes (11 app pages)

| Route | Primary component | Status |
|-------|-------------------|--------|
| `/forex/trade` | Terminal + mobile companion | GREEN |
| `/forex/markets` | Markets browser | GREEN |
| `/forex/portfolio` | Positions + metrics | GREEN |
| `/forex/orders` | Order/fill history | GREEN |
| `/forex/analysis` | MTF + news/calendar | PROVIDER_DEPENDENT (info) |
| `/forex/alerts` | Server alerts panel | GREEN (PATCH condition PARTIAL) |
| `/forex/account` | Account summary | GREEN |
| `/forex/account/funds` | Demo credit only | UNAVAILABLE real / GREEN demo |
| `/forex/account/ledger` | Ledger/fees/swaps | GREEN |

Shared platform auth (`/login`) and product switch connect Crypto ↔ Forex; no Forex-only `/settings` route.

## Status legend

| Status | Meaning |
|--------|---------|
| GREEN | Backend capability exposed, authorized, and usable in UI |
| PARTIAL | Wired but incomplete vs backend or browser/runtime limits |
| MISSING | Not implemented; not invented in this audit |
| UNAVAILABLE | Product intentionally off (e.g. real funding) |
| PROVIDER_DEPENDENT | Needs external/news/LP provider |
| MARKET_DEPENDENT | Needs open market / runtime triggers |
| NOT_APPLICABLE | No customer surface or backend contract |

## Terminal closure (Phase 2)

| Area | Status | Notes |
|------|--------|-------|
| Market watch | GREEN | Search, filters, favorites |
| Chart + TF | GREEN | Candle API authoritative |
| Indicators (registry) | GREEN | 20 ids; legacy study dropdown overlap (polish) |
| VWAP / Std Dev / Heikin / Renko | MISSING | No backend/data pipeline |
| Drawings | GREEN | Crypto DrawingToolManager + Forex extras |
| Order ticket | GREEN | Preview; honest capability gaps (stop_limit/TIF) |
| Orders / positions / history | GREEN | Server states; CSV export |
| Risk / margin | GREEN | REST-authoritative hydrate |
| Alerts | GREEN | Phase 2 verified on digest `384ff1b0…` |
| Session | GREEN | Poll + “Market closed” when applicable |
| Command center | GREEN | Journal + summary |
| DOM/Tape | PROVIDER_DEPENDENT | Simulated liquidity, not live LP |
| WS private updates | PARTIAL | Browser WS cannot send Bearer; REST primary |

## Alerts (Phase 3 — no redesign)

- **14 types:** GREEN (UI = backend ALLOWED).
- **Enable/disable/delete/persistence/events/delivery:** GREEN (prior verification).
- **Condition validation:** PARTIAL (backend accepts empty price conditions).
- **PATCH condition editing:** PARTIAL (backend yes, UI no).

## Funding boundary

- **Real Forex deposit/withdraw:** NOT_IMPLEMENTED / UNAVAILABLE.
- **Demo/mock credit:** GREEN with explicit SIMULATED copy.
- **Crypto wallet:** untouched; separate product.

## Shared imports (Phase 9)

| Dependency | Class |
|------------|--------|
| `@/components/trade/chart/*` (colors, DrawingToolManager, types) | SHARED-SAFE (read-only) |
| `@/lib/api`, auth store | SHARED-SAFE |
| Forex-specific wrappers (`forex-drawings`, `ForexPageFrame`, store) | FOREX-WRAPPER |

## Crypto dirty tree (Phase 10 — evidence only)

- **Only Crypto route file modified in dirty tree:** `apps/backend/src/routes/spot.fastify.ts`
- **Not shipped** with Phase 2 frontend deploy.
- **Forex does not reference** `spot.fastify.ts`.
